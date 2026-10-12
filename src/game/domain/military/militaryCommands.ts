import { isIndependentCivilizationId } from '@/game/content/independentCivilizations';
import type { CommandHandler, SimulationCommand } from '@/game/domain/commands/simulationCommand';
import type { GameState, MilitaryUnitType } from '@/game/domain/state/GameState';
import { UNIT_DEFINITIONS } from '@/game/content/military';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import { err, ok } from '@/shared/result/result';

export const MILITARY_ACTION = 'MilitaryAction';
const UNIT_TYPES = Object.keys(UNIT_DEFINITIONS) as MilitaryUnitType[];
const POST_ID = 'guard-post';
const CAPACITY_PER_POST = 4;
const enemyFor = (civilizationId: string) => ({
  health: civilizationId === 'oruun-clans' ? 42 : civilizationId === 'selari-commons' ? 32 : 26,
  attack: civilizationId === 'oruun-clans' ? 5 : 3,
});

export interface MilitaryActionCommand extends SimulationCommand {
  readonly type: typeof MILITARY_ACTION;
  readonly action: 'recruit' | 'declare-war' | 'start-battle' | 'retreat' | 'end-war';
  readonly unitType?: string;
  readonly civilizationId?: string;
}
export const militaryActionCommand = (
  action: MilitaryActionCommand['action'],
  fields: { unitType?: MilitaryUnitType; civilizationId?: string } = {},
): MilitaryActionCommand => ({ type: MILITARY_ACTION, action, ...fields });

export const handleMilitaryAction: CommandHandler = (state, command) => {
  const fields = command as Partial<MilitaryActionCommand>;
  if (
    fields.type !== MILITARY_ACTION ||
    !['recruit', 'declare-war', 'start-battle', 'retreat', 'end-war'].includes(fields.action ?? '')
  )
    return err('INVALID_COMMAND');
  if (fields.action === 'recruit') {
    if (state.military.battle?.status === 'active') return err('COMMAND_REJECTED');
    if (!UNIT_TYPES.includes(fields.unitType as MilitaryUnitType)) return err('INVALID_COMMAND');
    const posts = state.buildings.filter((building) => building.definitionId === POST_ID);
    if (!posts.length || state.military.units.length >= posts.length * CAPACITY_PER_POST)
      return err('COMMAND_REJECTED');
    const type = fields.unitType as MilitaryUnitType;
    const def = UNIT_DEFINITIONS[type];
    if (state.resources.materials < def.cost) return err('INSUFFICIENT_RESOURCES');
    const post = posts[Math.floor(state.military.units.length / CAPACITY_PER_POST)] ?? posts[0]!;
    const slot = state.military.units.length % CAPACITY_PER_POST;
    return ok({
      ...state,
      resources: { ...state.resources, materials: state.resources.materials - def.cost },
      military: {
        ...state.military,
        nextUnitId: state.military.nextUnitId + 1,
        units: [
          ...state.military.units,
          {
            unitId: `unit-${state.military.nextUnitId}`,
            type,
            position: {
              x: post.position.x + (slot % 3),
              y: post.position.y + 2 + Math.floor(slot / 3),
            },
            health: def.health,
            supplied: true,
          },
        ],
      },
    });
  }
  if (
    typeof fields.civilizationId !== 'string' ||
    !isIndependentCivilizationId(fields.civilizationId)
  )
    return err('INVALID_COMMAND');
  const relation = state.diplomacy.civilizations.find(
    (item) => item.civilizationId === fields.civilizationId,
  );
  if (!relation) return err('INVALID_COMMAND');
  if (fields.action === 'declare-war') {
    if (
      relation.contactStatus !== 'contacted' ||
      relation.relationshipScore > -30 ||
      relation.nonAggressionPact === 'active' ||
      relation.warStatus === 'active'
    )
      return err('DIPLOMACY_REQUIREMENT_NOT_MET');
    const diplomacy = {
      ...state.diplomacy,
      civilizations: state.diplomacy.civilizations.map((item) =>
        item === relation
          ? {
              ...item,
              relationshipScore: Math.max(-100, item.relationshipScore - 5),
              warStatus: 'active' as const,
              history: [
                ...item.history,
                {
                  tick: state.tick,
                  action: 'war-declared' as const,
                  relationshipChange: Math.max(-5, -100 - item.relationshipScore),
                },
              ],
            }
          : item,
      ),
    };
    return ok({ ...state, diplomacy });
  }
  if (fields.action === 'start-battle') {
    if (
      relation.warStatus !== 'active' ||
      state.military.battle?.status === 'active' ||
      !state.military.units.some((unit) => unit.supplied)
    )
      return err('COMMAND_REJECTED');
    const leader = state.characters.find(
      (character) => character.characterId === state.government.leaderId && character.alive,
    );
    return ok({
      ...state,
      military: {
        ...state.military,
        battle: {
          civilizationId: relation.civilizationId,
          enemyHealth: enemyFor(relation.civilizationId).health,
          round: 0,
          status: 'active',
          commanderId: leader?.characterId ?? null,
        },
      },
    });
  }
  if (
    state.military.battle?.status === 'active' &&
    state.military.battle.civilizationId === relation.civilizationId &&
    fields.action === 'retreat'
  ) {
    return ok(finishBattle(state, 'retreated'));
  }
  if (
    fields.action === 'end-war' &&
    relation.warStatus === 'active' &&
    state.military.battle?.status !== 'active'
  ) {
    const change = Math.min(5, 100 - relation.relationshipScore);
    return ok({
      ...state,
      diplomacy: {
        ...state.diplomacy,
        civilizations: state.diplomacy.civilizations.map((item) =>
          item === relation
            ? {
                ...item,
                relationshipScore: Math.min(100, item.relationshipScore + change),
                warStatus: 'ended' as const,
                history: [
                  ...item.history,
                  { tick: state.tick, action: 'war-ended' as const, relationshipChange: change },
                ],
              }
            : item,
        ),
      },
    });
  }
  return err('COMMAND_REJECTED');
};

function finishBattle(state: GameState, outcome: 'victory' | 'defeat' | 'retreated'): GameState {
  const battle = state.military.battle!;
  const nextBattle = { ...battle, status: outcome };
  const relation = state.diplomacy.civilizations.find(
    (item) => item.civilizationId === battle.civilizationId,
  )!;
  const delta = outcome === 'victory' ? -3 : outcome === 'defeat' ? -5 : -1;
  const scoreDelta = Math.max(-100 - relation.relationshipScore, delta);
  return {
    ...state,
    military: {
      ...state.military,
      battle: nextBattle,
      history: [
        ...state.military.history,
        {
          tick: state.tick,
          civilizationId: battle.civilizationId,
          outcome,
          rounds: battle.round + (outcome === 'retreated' ? 0 : 1),
        },
      ].slice(-20),
    },
    diplomacy: {
      ...state.diplomacy,
      civilizations: state.diplomacy.civilizations.map((item) =>
        item === relation
          ? {
              ...item,
              relationshipScore: item.relationshipScore + scoreDelta,
              history: [
                ...item.history,
                {
                  tick: state.tick,
                  action: 'battle-resolved' as const,
                  relationshipChange: scoreDelta,
                },
              ],
            }
          : item,
      ),
    },
  };
}

/** CobranÃ§a e confronto por tick, ambos ordenados e sem fontes aleatÃ³rias. Unidades sem alimento ficam sem suprimento. */
export function advanceMilitary(state: GameState): GameState {
  if (state.military.units.length === 0 && state.military.battle?.status !== 'active') return state;
  const units = [...state.military.units].sort((a, b) => a.unitId.localeCompare(b.unitId));
  let food = state.resources.food;
  const supplied = units.map((unit) => {
    const upkeep = UNIT_DEFINITIONS[unit.type].upkeep;
    const isSupplied = food >= upkeep;
    if (isSupplied) food -= upkeep;
    return { ...unit, supplied: isSupplied };
  });
  const supplyChanged = supplied.some((unit, index) => unit.supplied !== units[index]?.supplied);
  const unitsChanged = supplied.some(
    (unit, index) => unit.supplied !== state.military.units[index]?.supplied,
  );
  let result: GameState = {
    ...state,
    resources: food === state.resources.food ? state.resources : { ...state.resources, food },
    military: supplyChanged ? { ...state.military, units: supplied } : state.military,
  };
  const battle = result.military.battle;
  if (!battle || battle.status !== 'active') {
    return !supplyChanged && food === state.resources.food ? state : freezeDeep(result);
  }
  const army = (unitsChanged ? supplied : state.military.units).filter((unit) => unit.supplied);
  const leader = result.characters.find(
    (character) => character.characterId === battle.commanderId && character.alive,
  );
  const attack =
    army.reduce((sum, unit) => sum + UNIT_DEFINITIONS[unit.type].attack, 0) +
    (leader?.skills.leadership ?? 0);
  const enemyHealth = Math.max(0, battle.enemyHealth - attack);
  if (enemyHealth === 0)
    return freezeDeep(
      finishBattle(
        {
          ...result,
          military: {
            ...result.military,
            battle: { ...battle, enemyHealth, round: battle.round + 1 },
          },
        },
        'victory',
      ),
    );
  const postDefense =
    result.buildings.filter((building) => building.definitionId === POST_ID).length * 3;
  let incoming = Math.max(0, enemyFor(battle.civilizationId).attack - postDefense);
  const survivors = supplied
    .map((unit) => {
      if (!unit.supplied || incoming <= 0) return unit;
      const blocked = Math.min(incoming, UNIT_DEFINITIONS[unit.type].defense);
      incoming -= blocked;
      const damage = Math.min(incoming, unit.health);
      incoming -= damage;
      return { ...unit, health: unit.health - damage };
    })
    .filter((unit) => unit.health > 0);
  result = {
    ...result,
    military: {
      ...result.military,
      units: survivors,
      battle: { ...battle, enemyHealth, round: battle.round + 1 },
    },
  };
  if (!survivors.some((unit) => unit.supplied)) result = finishBattle(result, 'defeat');
  return freezeDeep(result);
}
