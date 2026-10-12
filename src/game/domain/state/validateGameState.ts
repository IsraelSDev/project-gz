import { isBuildingDefinitionId } from '@/game/content/buildings';
import { EVENT_DEFINITIONS, isEventId } from '@/game/content/events';
import { RESOURCE_IDS } from '@/game/content/resources';
import { isRotation } from '@/shared/grid/gridMath';
import { GAME_STATE_SCHEMA_VERSION, type GameEventState, type GameState } from './GameState';

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
  if (!state.population || typeof state.population !== 'object') {
    issues.push('population deve existir.');
  } else {
    if (!isWholeNumber(state.population.survivors) || state.population.survivors < 0) {
      issues.push('population.survivors deve ser um inteiro não negativo.');
    }
    if (
      !isWholeNumber(state.population.shortageTicks) ||
      state.population.shortageTicks < 0 ||
      state.population.shortageTicks >= 60
    ) {
      issues.push('population.shortageTicks deve estar entre 0 e 59.');
    }
    if (!isWholeNumber(state.population.stableTicks) || state.population.stableTicks < 0) {
      issues.push('population.stableTicks deve ser um inteiro não negativo.');
    }
    if (!['ongoing', 'victory', 'defeat'].includes(state.population.outcome)) {
      issues.push('population.outcome inválido.');
    }
    if (state.population.outcome === 'defeat' && state.population.survivors !== 0) {
      issues.push('Derrota exige zero sobreviventes.');
    }
    if (
      state.population.outcome === 'victory' &&
      (state.population.stableTicks < 900 || state.population.survivors < 6)
    ) {
      issues.push('Vitória exige 900 ticks estáveis e ao menos 6 sobreviventes.');
    }
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

  if (!Array.isArray(state.events)) {
    issues.push('events deve ser uma lista.');
    return issues;
  }
  const seenEventIds = new Set<string>();
  for (const event of state.events as readonly GameEventState[]) {
    if (!event || typeof event !== 'object' || !isEventId(event.eventId)) {
      issues.push('Todo evento precisa de um eventId conhecido.');
      continue;
    }
    if (seenEventIds.has(event.eventId)) {
      issues.push(`Estado duplicado para o evento "${event.eventId}".`);
    }
    seenEventIds.add(event.eventId);
    if (!['available', 'active', 'resolved', 'closed'].includes(event.status)) {
      issues.push(`Evento "${event.eventId}": estado inválido.`);
    }
    if (event.status === 'resolved') {
      const optionExists = EVENT_DEFINITIONS[event.eventId].options.some(
        (option) => option.id === event.chosenOptionId,
      );
      if (
        !optionExists ||
        !isWholeNumber(event.resolvedAtTick) ||
        event.resolvedAtTick > state.tick
      ) {
        issues.push(`Evento "${event.eventId}": resolução inválida.`);
      }
    } else if (event.chosenOptionId !== undefined || event.resolvedAtTick !== undefined) {
      issues.push(`Evento "${event.eventId}": dados de resolução sem estado resolvido.`);
    }
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
