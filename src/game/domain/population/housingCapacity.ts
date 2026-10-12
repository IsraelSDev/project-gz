import { getBuildingDefinition } from '@/game/content/buildings';
import type { BuildingInstance } from '@/game/domain/state/GameState';

/** Capacidade sempre deriva das estruturas presentes e do conteúdo, nunca de um contador salvo. */
export function calculateHousingCapacity(buildings: readonly BuildingInstance[]): number {
  return buildings.reduce(
    (total, building) =>
      total + (getBuildingDefinition(building.definitionId).housingCapacity ?? 0),
    0,
  );
}
