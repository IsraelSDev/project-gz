import { isBuildingDefinitionId } from '@/game/content/buildings';
import { GAME_EVENT_DEFINITIONS, isGameEventId } from '@/game/content/events';
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
  if (!isWholeNumber(state.nextEntityId) || state.nextEntityId < 1) {
    issues.push('nextEntityId deve ser um inteiro maior ou igual a 1.');
  }
  if (!isWholeNumber(state.rng) || state.rng <= 0 || state.rng > 0xffffffff) {
    issues.push('rng deve ser um estado xorshift32 não zero de 32 bits.');
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

  if (!Array.isArray(state.events) || state.events.length > 100) {
    issues.push('events deve ser uma lista com no máximo 100 registros.');
  } else {
    const seenEventIds = new Set<string>();
    for (const event of state.events) {
      if (!isGameEventId(event.eventId)) {
        issues.push(`Evento desconhecido: "${String(event.eventId)}".`);
        continue;
      }
      if (seenEventIds.has(event.eventId)) {
        issues.push(`Evento duplicado: "${event.eventId}".`);
      }
      seenEventIds.add(event.eventId);
      if (!isWholeNumber(event.triggeredAtTick) || event.triggeredAtTick < 0) {
        issues.push(`Evento "${event.eventId}": triggeredAtTick inválido.`);
      }
      if (event.status === 'pending') {
        if (event.resolvedAtTick !== undefined || event.choiceId !== undefined) {
          issues.push(`Evento pendente "${event.eventId}" não pode ter resolução.`);
        }
      } else if (event.status === 'resolved') {
        const definition = GAME_EVENT_DEFINITIONS.find((item) => item.id === event.eventId);
        if (
          !isWholeNumber(event.resolvedAtTick) ||
          event.resolvedAtTick < event.triggeredAtTick ||
          !definition?.choices.some((choice) => choice.id === event.choiceId)
        ) {
          issues.push(`Evento resolvido "${event.eventId}" precisa de escolha e tick válidos.`);
        }
      } else {
        issues.push(`Evento "${event.eventId}": status inválido.`);
      }
    }
    if (state.events.filter((event) => event.status === 'pending').length > 1) {
      issues.push('Só pode haver um evento pendente.');
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
