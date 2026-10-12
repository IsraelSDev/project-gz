import { BUILDING_DEFINITIONS, getBuildingDefinition } from '@/game/content/buildings';
import { INDEPENDENT_CIVILIZATIONS } from '@/game/content/independentCivilizations';
import { REGION_DEFINITIONS, SETTLEMENT_FOUNDING_COST } from '@/game/content/regions';
import { RESOURCE_DEFINITIONS, RESOURCE_IDS } from '@/game/content/resources';
import type { GameController } from './GameController';
import {
  territoryActionCommand,
  type TerritoryActionCommand,
} from '@/game/domain/territory/territoryCommands';

export const TERRITORY_PANEL_CONTENT = {
  buildings: BUILDING_DEFINITIONS,
  regions: REGION_DEFINITIONS,
  civilizations: INDEPENDENT_CIVILIZATIONS,
  foundingCost: SETTLEMENT_FOUNDING_COST,
  resources: RESOURCE_DEFINITIONS,
  resourceIds: RESOURCE_IDS,
  building: getBuildingDefinition,
} as const;

export function requestTerritoryAction(
  controller: GameController,
  action: TerritoryActionCommand['action'],
  fields: Omit<Partial<TerritoryActionCommand>, 'type' | 'action'> = {},
) {
  return controller.submitCommand(territoryActionCommand(action, fields));
}

export function selectTerritoryRegions(state: ReturnType<GameController['getSnapshot']>) {
  return state.territory.regions.map((region) => {
    const definition = REGION_DEFINITIONS[region.regionId];
    const pointId = definition.discoveryPointId;
    return {
      ...definition,
      ...region,
      discovered:
        region.regionId === 'crash-site' ||
        (pointId !== undefined && state.exploration.discoveredPointIds.includes(pointId)),
      settlement: state.settlements.find((city) => city.settlementId === region.settlementId),
    };
  });
}

/** O capital é projetado dos campos do GameState usados pelas fases anteriores, sem duplicar estoques. */
export function selectSettlements(state: ReturnType<GameController['getSnapshot']>) {
  const capitalRegion = state.territory.regions.find((region) => region.regionId === 'crash-site')!;
  return [
    {
      settlementId: 'settlement-capital',
      regionId: 'crash-site' as const,
      name: 'Capital — Local da Queda',
      resources: state.resources,
      buildings: state.buildings,
      population: state.population,
      administratorId: state.government.leaderId,
      capital: true,
      owner: capitalRegion.owner,
    },
    ...state.settlements.map((city) => ({ ...city, capital: false, owner: 'colony' as const })),
  ];
}

export function totalSettlementPopulation(state: ReturnType<GameController['getSnapshot']>) {
  return (
    state.population.survivors +
    state.settlements.reduce((sum, city) => sum + city.population.survivors, 0)
  );
}
