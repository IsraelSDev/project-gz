import {
  BUILDING_DEFINITIONS,
  getBuildingDefinition,
  isBuildingDefinitionId,
  type BuildingDefinition,
} from '@/game/content/buildings';
import {
  REGION_DEFINITIONS,
  SETTLEMENT_FOUNDING_COST,
  SETTLEMENT_STARTER_BUILDINGS,
  SETTLEMENT_STARTING_RESOURCES,
  type RegionId,
} from '@/game/content/regions';
import { MAX_RESOURCE_AMOUNT, RESOURCE_IDS, type ResourceId } from '@/game/content/resources';
import { evaluatePlacementSpace, missingForCost } from '@/game/domain/construction/placement';
import { advancePopulationRecord } from '@/game/domain/population/advancePopulation';
import { advanceEconomy } from '@/game/domain/economy/advanceEconomy';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameState, ResourceStock, SettlementState } from '@/game/domain/state/GameState';
import type { CommandHandler, SimulationCommand } from '@/game/domain/commands/simulationCommand';
import { err, ok } from '@/shared/result/result';
import {
  applyConstructionDiscount,
  getTechnologyModifiers,
} from '@/game/domain/research/technologyEffects';

export const TERRITORY_ACTION = 'TerritoryAction';
export interface TerritoryActionCommand extends SimulationCommand {
  readonly type: typeof TERRITORY_ACTION;
  readonly action: 'found' | 'appoint' | 'transfer-resources' | 'transfer-population' | 'build';
  readonly regionId?: string;
  readonly settlementId?: string;
  readonly characterId?: string | null;
  readonly resources?: Partial<ResourceStock>;
  readonly amount?: number;
  readonly buildingId?: string;
}

export const territoryActionCommand = (
  action: TerritoryActionCommand['action'],
  fields: Omit<Partial<TerritoryActionCommand>, 'type' | 'action'> = {},
): TerritoryActionCommand => ({ type: TERRITORY_ACTION, action, ...fields });

function recordTerritoryAction(
  state: GameState,
  settlementId: string,
  action: GameState['territory']['history'][number]['action'],
  amount: number,
  detail: string,
) {
  const city = state.settlements.find((entry) => entry.settlementId === settlementId);
  const regionId = city?.regionId ?? 'crash-site';
  return {
    ...state.territory,
    history: [
      ...state.territory.history,
      { tick: state.tick, action, regionId, settlementId, amount, detail },
    ].slice(-100),
  };
}

function payCapital(state: GameState, cost: Readonly<Partial<Record<ResourceId, number>>>) {
  const resources = { ...state.resources };
  for (const resource of RESOURCE_IDS) resources[resource] -= cost[resource] ?? 0;
  return resources;
}

function foundSettlement(state: GameState, regionId: unknown) {
  if (typeof regionId !== 'string' || !Object.hasOwn(REGION_DEFINITIONS, regionId))
    return err('INVALID_COMMAND' as const);
  const definition = REGION_DEFINITIONS[regionId as RegionId];
  const region = state.territory.regions.find((entry) => entry.regionId === definition.id);
  const civilizationId = definition.civilizationId;
  const relation = civilizationId
    ? state.diplomacy.civilizations.find((entry) => entry.civilizationId === civilizationId)
    : undefined;
  if (
    !region ||
    !definition.discoveryPointId ||
    !state.exploration.discoveredPointIds.includes(definition.discoveryPointId) ||
    region.settlementId !== null
  )
    return err('COMMAND_REJECTED' as const);
  if (region.owner === 'civilization') {
    if (
      !civilizationId ||
      region.civilizationId !== civilizationId ||
      relation?.nonAggressionPact !== 'active' ||
      relation.warStatus === 'active'
    )
      return err('COMMAND_REJECTED' as const);
  } else if (region.owner !== null) {
    return err('COMMAND_REJECTED' as const);
  }
  if (missingForCost(state.resources, SETTLEMENT_FOUNDING_COST).length > 0)
    return err('INSUFFICIENT_RESOURCES' as const);
  const settlementId = `settlement-${state.territory.nextSettlementId}`;
  const buildings = SETTLEMENT_STARTER_BUILDINGS.map((seed, index) => ({
    instanceId: `${settlementId}-building-${index + 1}`,
    definitionId: seed.definitionId,
    position: { x: seed.x, y: seed.y },
    rotation: 0 as const,
  }));
  const settlement: SettlementState = {
    settlementId,
    regionId: definition.id,
    name: definition.name,
    resources: SETTLEMENT_STARTING_RESOURCES,
    buildings,
    population: { survivors: 0, shortageTicks: 0, stableTicks: 0, outcome: 'ongoing' },
    administratorId: null,
    nextBuildingId: SETTLEMENT_STARTER_BUILDINGS.length + 1,
  };
  return ok({
    ...state,
    resources: payCapital(state, SETTLEMENT_FOUNDING_COST),
    settlements: [...state.settlements, settlement],
    territory: {
      ...state.territory,
      nextSettlementId: state.territory.nextSettlementId + 1,
      history: [
        ...state.territory.history,
        {
          tick: state.tick,
          action: 'settlement-founded' as const,
          regionId: definition.id,
          settlementId,
          amount: 0,
          detail: definition.name,
        },
      ].slice(-100),
      regions: state.territory.regions.map((entry) =>
        entry.regionId === definition.id
          ? { ...entry, owner: 'colony' as const, civilizationId: null, settlementId }
          : entry,
      ),
    },
  });
}

function appointAdministrator(state: GameState, settlementId: unknown, characterId: unknown) {
  if (typeof settlementId !== 'string' || (characterId !== null && typeof characterId !== 'string'))
    return err('INVALID_COMMAND' as const);
  const city = state.settlements.find((entry) => entry.settlementId === settlementId);
  if (!city) return err('COMMAND_REJECTED' as const);
  if (characterId === null) {
    if (city.administratorId === null) return err('COMMAND_REJECTED' as const);
    return ok({
      ...state,
      territory: recordTerritoryAction(
        state,
        settlementId,
        'administrator-appointed',
        0,
        'removed',
      ),
      settlements: state.settlements.map((entry) =>
        entry.settlementId === settlementId ? { ...entry, administratorId: null } : entry,
      ),
    });
  }
  const person = state.characters.find((entry) => entry.characterId === characterId);
  const alreadyAssigned =
    state.government.leaderId === characterId ||
    Object.values(state.government.offices).includes(characterId) ||
    state.settlements.some((entry) => entry.administratorId === characterId);
  if (!person?.alive || !person.available || person.skills.leadership < 2 || alreadyAssigned)
    return err('COMMAND_REJECTED' as const);
  return ok({
    ...state,
    territory: recordTerritoryAction(
      state,
      settlementId,
      'administrator-appointed',
      0,
      person.name,
    ),
    settlements: state.settlements.map((entry) =>
      entry.settlementId === settlementId ? { ...entry, administratorId: characterId } : entry,
    ),
  });
}

function transferResources(state: GameState, settlementId: unknown, raw: unknown) {
  if (typeof settlementId !== 'string' || !raw || typeof raw !== 'object')
    return err('INVALID_COMMAND' as const);
  const city = state.settlements.find((entry) => entry.settlementId === settlementId);
  if (!city) return err('COMMAND_REJECTED' as const);
  const amounts = raw as Partial<Record<ResourceId, unknown>>;
  if (Object.keys(amounts).some((id) => !RESOURCE_IDS.includes(id as ResourceId)))
    return err('INVALID_COMMAND' as const);
  const capital = { ...state.resources };
  const destination = { ...city.resources };
  let moved = false;
  for (const id of RESOURCE_IDS) {
    const amount = amounts[id] ?? 0;
    if (!Number.isSafeInteger(amount) || (amount as number) < 0)
      return err('INVALID_COMMAND' as const);
    if ((amount as number) === 0) continue;
    moved = true;
    if (capital[id] < (amount as number)) return err('INSUFFICIENT_RESOURCES' as const);
    if (destination[id] + (amount as number) > MAX_RESOURCE_AMOUNT)
      return err('COMMAND_REJECTED' as const);
    capital[id] -= amount as number;
    destination[id] += amount as number;
  }
  if (!moved) return err('INVALID_COMMAND' as const);
  const amount = RESOURCE_IDS.reduce(
    (sum, id) => sum + ((amounts[id] as number | undefined) ?? 0),
    0,
  );
  return ok({
    ...state,
    territory: recordTerritoryAction(
      state,
      settlementId,
      'resources-transferred',
      amount,
      'capital-to-city',
    ),
    resources: capital,
    settlements: state.settlements.map((entry) =>
      entry.settlementId === settlementId ? { ...entry, resources: destination } : entry,
    ),
  });
}

function transferPopulation(state: GameState, settlementId: unknown, amount: unknown) {
  if (typeof settlementId !== 'string') return err('INVALID_COMMAND' as const);
  const city = state.settlements.find((entry) => entry.settlementId === settlementId);
  if (!city || !Number.isSafeInteger(amount) || (amount as number) < 1)
    return err('INVALID_COMMAND' as const);
  const people = amount as number;
  const livingImportant = state.characters.filter((person) => person.alive).length;
  const capacity = city.buildings.reduce(
    (sum, building) => sum + (getBuildingDefinition(building.definitionId).housingCapacity ?? 0),
    0,
  );
  if (
    state.population.survivors - people < livingImportant ||
    city.population.survivors + people > capacity
  )
    return err('COMMAND_REJECTED' as const);
  return ok({
    ...state,
    territory: recordTerritoryAction(
      state,
      settlementId,
      'population-transferred',
      people,
      'capital-to-city',
    ),
    population: { ...state.population, survivors: state.population.survivors - people },
    settlements: state.settlements.map((entry) =>
      entry.settlementId === settlementId
        ? {
            ...entry,
            population: {
              ...entry.population,
              survivors: entry.population.survivors + people,
              shortageTicks: 0,
              stableTicks: 0,
              outcome: 'ongoing' as const,
            },
          }
        : entry,
    ),
  });
}

function buildInSettlement(state: GameState, settlementId: unknown, buildingId: unknown) {
  if (
    typeof settlementId !== 'string' ||
    typeof buildingId !== 'string' ||
    !isBuildingDefinitionId(buildingId)
  )
    return err('INVALID_COMMAND' as const);
  const city = state.settlements.find((entry) => entry.settlementId === settlementId);
  const definition: BuildingDefinition = BUILDING_DEFINITIONS[buildingId];
  const cost = applyConstructionDiscount(definition.cost, state.research.unlockedTechnologyIds);
  if (!city) return err('COMMAND_REJECTED' as const);
  if (definition.category === 'military') return err('COMMAND_REJECTED' as const);
  if (
    definition.requiredTechnologyId &&
    !state.research.unlockedTechnologyIds.includes(definition.requiredTechnologyId)
  )
    return err('COMMAND_REJECTED' as const);
  if (missingForCost(city.resources, cost).length > 0)
    return err('INSUFFICIENT_RESOURCES' as const);
  let placement: ReturnType<typeof evaluatePlacementSpace> | undefined;
  let position: { x: number; y: number; rotation: 0 | 90 | 180 | 270 } | undefined;
  for (let y = 0; y < 16 && !placement?.ok; y++) {
    for (let x = 0; x < 16 && !placement?.ok; x++) {
      for (const rotation of [0, 90, 180, 270] as const) {
        const candidate = evaluatePlacementSpace(
          city.buildings,
          { definitionId: buildingId, position: { x, y }, rotation },
          { buildableArea: { x: 0, y: 0, width: 16, depth: 16 }, obstacles: [] },
        );
        if (candidate.ok) {
          placement = candidate;
          position = { x, y, rotation };
          break;
        }
      }
    }
  }
  if (!placement?.ok || !position) return err('COMMAND_REJECTED' as const);
  const resources = { ...city.resources };
  for (const id of RESOURCE_IDS) resources[id] -= cost[id] ?? 0;
  const building = {
    instanceId: `${city.settlementId}-building-${city.nextBuildingId}`,
    definitionId: buildingId,
    position: { x: position.x, y: position.y },
    rotation: position.rotation,
  };
  return ok({
    ...state,
    territory: recordTerritoryAction(state, settlementId, 'building-constructed', 1, buildingId),
    settlements: state.settlements.map((entry) =>
      entry.settlementId === settlementId
        ? {
            ...entry,
            resources,
            nextBuildingId: entry.nextBuildingId + 1,
            buildings: [...entry.buildings, building],
          }
        : entry,
    ),
  });
}

export const handleTerritoryAction: CommandHandler = (state, command) => {
  const fields = command as Partial<TerritoryActionCommand>;
  if (
    fields.type !== TERRITORY_ACTION ||
    !fields.action ||
    !['found', 'appoint', 'transfer-resources', 'transfer-population', 'build'].includes(
      fields.action,
    )
  )
    return err('INVALID_COMMAND');
  if (fields.action === 'found') return foundSettlement(state, fields.regionId);
  if (fields.action === 'appoint')
    return appointAdministrator(state, fields.settlementId, fields.characterId);
  if (fields.action === 'transfer-resources')
    return transferResources(state, fields.settlementId, fields.resources);
  if (fields.action === 'transfer-population')
    return transferPopulation(state, fields.settlementId, fields.amount);
  return buildInSettlement(state, fields.settlementId, fields.buildingId);
};

/** Economia independente por cidade, com o mesmo motor econômico e a mesma regra de sobrevivência. */
export function advanceSettlements(state: GameState): GameState {
  if (state.settlements.length === 0) return state;
  let changed = false;
  const modifiers = getTechnologyModifiers(state.research.unlockedTechnologyIds);
  const settlements = state.settlements.map((city) => {
    const buildingProduction = advanceEconomy(
      city.resources,
      city.buildings,
      undefined,
      modifiers.productionByBuilding,
    );
    const opportunities = REGION_DEFINITIONS[city.regionId].opportunities;
    const regionalProduction = RESOURCE_IDS.some((id) => opportunities[id] !== undefined)
      ? freezeDeep(
          Object.fromEntries(
            RESOURCE_IDS.map((id) => [
              id,
              Math.min(MAX_RESOURCE_AMOUNT, buildingProduction[id] + (opportunities[id] ?? 0)),
            ]),
          ) as ResourceStock,
        )
      : buildingProduction;
    const production =
      regionalProduction === buildingProduction ? buildingProduction : regionalProduction;
    const population = advancePopulationRecord(city.population, production, city.buildings);
    const administrator = state.characters.find(
      (person) => person.characterId === city.administratorId,
    );
    const bonus =
      administrator?.alive && administrator.skills.leadership >= 2 && state.tick % 10 === 0;
    const resources = bonus
      ? freezeDeep({
          ...population.resources,
          materials: Math.min(
            MAX_RESOURCE_AMOUNT,
            population.resources.materials + 1 + modifiers.governorMaterialsPerTenTicks,
          ),
        })
      : population.resources;
    if (resources !== city.resources || population.population !== city.population) changed = true;
    return resources === city.resources && population.population === city.population
      ? city
      : { ...city, resources, population: population.population };
  });
  return changed ? freezeDeep({ ...state, settlements }) : state;
}
