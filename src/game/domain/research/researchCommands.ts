import { TECHNOLOGY_DEFINITIONS, isTechnologyId } from '@/game/content/technologies';
import { deriveCurrentEra, getEraIndex } from '@/game/content/developmentEras';
import type { GameState } from '@/game/domain/state/GameState';
import type { CommandHandler, SimulationCommand } from '@/game/domain/commands/simulationCommand';
import { RESOURCE_IDS, type ResourceRates } from '@/game/content/resources';
import { getTechnologyModifiers } from './technologyEffects';
import { err, ok } from '@/shared/result/result';

export const START_RESEARCH = 'StartResearch';
export interface StartResearchCommand extends SimulationCommand {
  readonly type: typeof START_RESEARCH;
  readonly technologyId: string;
}
export const startResearchCommand = (technologyId: string): StartResearchCommand => ({
  type: START_RESEARCH,
  technologyId,
});

export function countFieldLaboratories(
  state: Pick<GameState, 'buildings' | 'settlements'>,
): number {
  return (
    state.buildings.filter((building) => building.definitionId === 'field-laboratory').length +
    state.settlements.reduce(
      (count, city) =>
        count +
        city.buildings.filter((building) => building.definitionId === 'field-laboratory').length,
      0,
    )
  );
}

export type ResearchBlockReason =
  | 'completed'
  | 'in-progress'
  | 'another-project'
  | 'era'
  | 'prerequisites'
  | 'laboratory'
  | 'scientist'
  | 'resources';

export function getResearchBlockReason(
  state: GameState,
  technologyId: string,
): ResearchBlockReason | null {
  if (!isTechnologyId(technologyId)) return 'prerequisites';
  const technology = TECHNOLOGY_DEFINITIONS[technologyId];
  if (state.research.unlockedTechnologyIds.includes(technologyId)) return 'completed';
  if (state.research.activeTechnologyId === technologyId) return 'in-progress';
  if (state.research.activeTechnologyId !== null) return 'another-project';
  if (getEraIndex(state.research.currentEra) < getEraIndex(technology.era)) return 'era';
  if (
    !technology.prerequisites.every((required) =>
      state.research.unlockedTechnologyIds.includes(required),
    )
  )
    return 'prerequisites';
  if (countFieldLaboratories(state) === 0) return 'laboratory';
  const scientistId = state.government.offices.science;
  if (
    !state.characters.some(
      (character) =>
        character.characterId === scientistId && character.alive && character.available,
    )
  )
    return 'scientist';
  const cost = technology.cost as ResourceRates;
  if (RESOURCE_IDS.some((resource) => state.resources[resource] < (cost[resource] ?? 0)))
    return 'resources';
  return null;
}

export const handleStartResearch: CommandHandler = (state, command) => {
  const id = (command as { technologyId?: unknown }).technologyId;
  if (typeof id !== 'string' || !isTechnologyId(id)) return err('INVALID_COMMAND');
  const reason = getResearchBlockReason(state, id);
  if (reason === 'resources') return err('INSUFFICIENT_RESOURCES');
  if (reason !== null) return err('COMMAND_REJECTED');
  const tech = TECHNOLOGY_DEFINITIONS[id];
  const cost = tech.cost as ResourceRates;
  const resources = { ...state.resources };
  for (const resource of RESOURCE_IDS) resources[resource] -= cost[resource] ?? 0;
  return ok({
    ...state,
    resources,
    research: { ...state.research, activeTechnologyId: id, progress: 0 },
  });
};

export function advanceResearch(state: GameState): GameState {
  const id = state.research.activeTechnologyId;
  if (!id || !isTechnologyId(id) || countFieldLaboratories(state) === 0) return state;
  const scientist = state.characters.find(
    (character) =>
      character.characterId === state.government.offices.science &&
      character.alive &&
      character.available,
  );
  if (!scientist) return state;
  const modifiers = getTechnologyModifiers(state.research.unlockedTechnologyIds);
  const labBonus = Math.max(0, countFieldLaboratories(state) - 1) * modifiers.researchPerExtraLab;
  const progress = state.research.progress + Math.max(1, scientist.skills.science) + labBonus;
  const definition = TECHNOLOGY_DEFINITIONS[id];
  if (progress < definition.researchPoints)
    return { ...state, research: { ...state.research, progress } };
  const unlockedTechnologyIds = [...state.research.unlockedTechnologyIds, id];
  return {
    ...state,
    research: {
      currentEra: deriveCurrentEra(unlockedTechnologyIds),
      unlockedTechnologyIds,
      activeTechnologyId: null,
      progress: 0,
    },
  };
}

export function hasTechnology(state: Pick<GameState, 'research'>, id: string | undefined): boolean {
  return !id || state.research.unlockedTechnologyIds.includes(id);
}
