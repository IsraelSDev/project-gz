import { INITIAL_SCENARIO, type ScenarioDefinition } from '@/game/content/scenario';
import { occupiedRect } from '@/shared/grid/gridMath';
import type { PlacementTerrain } from './placement';

/**
 * Terreno de construção de um cenário: a área construível e, como obstáculo, o retângulo que a nave
 * acidentada ocupa (ela é cenário, não instância do estado: D-25). Os edifícios existentes vêm do
 * estado, não daqui.
 */
export function createPlacementTerrain(scenario: ScenarioDefinition): PlacementTerrain {
  const ship = scenario.crashedShip;
  return {
    buildableArea: scenario.terrain.buildableArea,
    obstacles: [occupiedRect(ship.position, ship.size, ship.rotation)],
  };
}

/**
 * Terreno da partida atual. O MVP tem um único cenário e o `GameState` não guarda qual é: quando
 * houver mais de um, o estado passa a referenciá-lo (Fase 8, ao carregar partidas).
 */
export const INITIAL_PLACEMENT_TERRAIN: PlacementTerrain = createPlacementTerrain(INITIAL_SCENARIO);
