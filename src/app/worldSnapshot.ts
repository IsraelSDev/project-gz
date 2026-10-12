import { getBuildingDefinition } from '@/game/content/buildings';
import { INITIAL_SCENARIO, type ScenarioDefinition } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';
import type { WorldSnapshot } from '@/rendering/world/WorldSnapshot';

/**
 * Monta o contrato de renderização a partir do estado da partida e do cenário. É a ÚNICA ponte
 * entre o domínio e a renderização: os edifícios da cena vêm das instâncias do estado. Só precisa
 * de `buildings`: assim a cena não é refeita quando só o `tick` ou os recursos mudam.
 */
export function toWorldSnapshot(
  state: Pick<GameState, 'buildings'>,
  scenario: ScenarioDefinition,
): WorldSnapshot {
  return {
    terrain: {
      sizeCells: scenario.terrain.sizeCells,
      buildableArea: scenario.terrain.buildableArea,
      seed: scenario.terrain.seed,
    },
    crashedShip: scenario.crashedShip,
    buildings: state.buildings.map((building) => ({
      instanceId: building.instanceId,
      definitionId: building.definitionId,
      position: building.position,
      rotation: building.rotation,
      size: getBuildingDefinition(building.definitionId).footprint,
    })),
  };
}

export function createInitialWorldSnapshot(): WorldSnapshot {
  return toWorldSnapshot(createInitialGameState(INITIAL_SCENARIO), INITIAL_SCENARIO);
}
