import { BUILDING_DEFINITIONS } from '@/game/content/buildings';
import { EVENT_DEFINITIONS, type EventId } from '@/game/content/events';
import { RESOURCE_IDS, type ResourceId } from '@/game/content/resources';
import type { ScenarioDefinition } from '@/game/content/scenario';
import { validateBuildingContent } from '@/game/domain/construction/validateBuildingContent';
import { freezeDeep } from './freezeDeep';
import {
  GAME_STATE_SCHEMA_VERSION,
  type BuildingInstance,
  type GameState,
  type ResourceStock,
} from './GameState';
import { validateGameState } from './validateGameState';
import { validateScenario } from './validateScenario';

function copyResources(scenario: ScenarioDefinition): ResourceStock {
  const entries = RESOURCE_IDS.map((id): [ResourceId, number] => [
    id,
    scenario.initialResources[id],
  ]);
  return Object.fromEntries(entries) as ResourceStock;
}

/**
 * Cria o estado inicial (somente leitura) a partir do cenário. Lança um erro se o cenário ou o
 * estado resultante forem inválidos: isso é um erro de conteúdo, não uma falha esperada de gameplay.
 */
export function createInitialGameState(scenario: ScenarioDefinition): GameState {
  const contentIssues = validateBuildingContent(BUILDING_DEFINITIONS);
  if (contentIssues.length > 0) {
    throw new Error(`Conteúdo de edifícios inválido:\n- ${contentIssues.join('\n- ')}`);
  }
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

  const state = freezeDeep<GameState>({
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    contentVersion: scenario.contentVersion,
    tick: 0,
    resources: copyResources(scenario),
    buildings,
    nextEntityId: 1,
    events: Object.keys(EVENT_DEFINITIONS).map((eventId) => ({
      eventId: eventId as EventId,
      status: 'available' as const,
    })),
  });

  const stateIssues = validateGameState(state);
  if (stateIssues.length > 0) {
    throw new Error(`Estado inicial inválido:\n- ${stateIssues.join('\n- ')}`);
  }
  return state;
}
