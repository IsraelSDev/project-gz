import { RESOURCE_IDS, type ResourceId } from '@/game/content/resources';
import type { ScenarioDefinition } from '@/game/content/scenario';
import {
  GAME_STATE_SCHEMA_VERSION,
  type BuildingInstance,
  type GameState,
  type ResourceStock,
} from './GameState';
import { validateScenario } from './validateScenario';

function freezeDeep<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      freezeDeep(child);
    }
  }
  return value;
}

function copyResources(scenario: ScenarioDefinition): ResourceStock {
  const entries = RESOURCE_IDS.map((id): [ResourceId, number] => [
    id,
    scenario.initialResources[id],
  ]);
  return Object.fromEntries(entries) as ResourceStock;
}

/**
 * Cria o estado inicial (somente leitura) a partir do cenário. Lança um erro se o cenário for
 * inválido: isso é um erro de conteúdo, não uma falha esperada de gameplay.
 */
export function createInitialGameState(scenario: ScenarioDefinition): GameState {
  const issues = validateScenario(scenario);
  if (issues.length > 0) {
    throw new Error(`Cenário inicial inválido:\n- ${issues.join('\n- ')}`);
  }

  const buildings = scenario.initialBuildings.map((building): BuildingInstance => ({
    instanceId: building.instanceId,
    definitionId: building.definitionId,
    position: { x: building.position.x, y: building.position.y },
    rotation: building.rotation,
  }));

  return freezeDeep({
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    contentVersion: scenario.contentVersion,
    tick: 0,
    resources: copyResources(scenario),
    buildings,
  });
}
