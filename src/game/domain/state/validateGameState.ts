import { isBuildingDefinitionId } from '@/game/content/buildings';
import { RESOURCE_IDS } from '@/game/content/resources';
import { isRotation } from '@/shared/grid/gridMath';
import { GAME_STATE_SCHEMA_VERSION, type GameState } from './GameState';

const isWholeNumber = (value: unknown): value is number => Number.isSafeInteger(value);

/**
 * Valida as invariantes do estado e devolve a lista de problemas (vazia quando é válido), para
 * depuração. Não lança exceção. É a ÚNICA definição do que é um `GameState` válido: o estado
 * inicial e o resultado de cada comando passam por ela, e o carregamento de partidas (Fase 8) vai
 * reutilizá-la. Regras de posicionamento (área, sobreposição) pertencem ao cenário e à construção
 * (Fase 6), não a este nível.
 */
export function validateGameState(state: GameState): readonly string[] {
  const issues: string[] = [];

  if (state.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    issues.push(`schemaVersion deve ser ${GAME_STATE_SCHEMA_VERSION}.`);
  }
  if (typeof state.contentVersion !== 'string' || state.contentVersion.trim() === '') {
    issues.push('contentVersion não pode ser vazio.');
  }
  if (!isWholeNumber(state.tick) || state.tick < 0) {
    issues.push('tick deve ser um inteiro não negativo.');
  }

  const resources: Record<string, unknown> = state.resources;
  for (const id of RESOURCE_IDS) {
    const amount = Object.hasOwn(resources, id) ? resources[id] : undefined;
    if (!isWholeNumber(amount) || amount < 0) {
      issues.push(`resources.${id} deve ser um inteiro não negativo.`);
    }
  }
  for (const key of Object.keys(resources)) {
    if (!RESOURCE_IDS.some((id) => id === key)) {
      issues.push(`resources tem um recurso desconhecido: "${key}".`);
    }
  }

  if (!Array.isArray(state.buildings)) {
    issues.push('buildings deve ser uma lista.');
    return issues;
  }
  const seenIds = new Set<string>();
  for (const building of state.buildings) {
    const id: unknown = building.instanceId;
    if (typeof id !== 'string' || id.trim() === '') {
      issues.push('Todo edifício precisa de um instanceId não vazio.');
    } else if (seenIds.has(id)) {
      issues.push(`instanceId duplicado: "${id}".`);
    } else {
      seenIds.add(id);
    }

    const label = `edifício "${String(id)}"`;
    if (
      typeof building.definitionId !== 'string' ||
      !isBuildingDefinitionId(building.definitionId)
    ) {
      issues.push(`${label}: definição desconhecida.`);
    }
    if (!isRotation(building.rotation)) {
      issues.push(`${label}: rotação inválida.`);
    }
    if (!isWholeNumber(building.position.x) || !isWholeNumber(building.position.y)) {
      issues.push(`${label}: a posição deve usar células inteiras.`);
    }
  }

  return issues;
}
