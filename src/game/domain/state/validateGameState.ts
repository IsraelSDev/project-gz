import { isBuildingDefinitionId } from '@/game/content/buildings';
import { EVENT_DEFINITIONS, isEventId } from '@/game/content/events';
import { RESOURCE_IDS } from '@/game/content/resources';
import { isRotation } from '@/shared/grid/gridMath';
import type { CharacterSkill } from '@/game/content/characters';
import { isTechnologyId, TECHNOLOGY_DEFINITIONS } from '@/game/content/technologies';
import { POINTS_OF_INTEREST } from '@/game/content/pointsOfInterest';
import { GAME_STATE_SCHEMA_VERSION, type GameEventState, type GameState } from './GameState';

const isWholeNumber = (value: unknown): value is number => Number.isSafeInteger(value);
const hasExactKeys = (value: object, expected: readonly string[]): boolean => {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
};

/**
 * Valida as invariantes do estado e devolve a lista de problemas (vazia quando é válido), para
 * depuração. Não lança exceção. É a ÚNICA definição do que é um `GameState` válido: o estado
 * inicial e o resultado de cada comando passam por ela, e o carregamento de partidas (Fase 8) vai
 * reutilizá-la. Regras de posicionamento (área, sobreposição) pertencem ao cenário e à construção
 * (Fase 6), não a este nível.
 */
export function validateGameState(state: GameState): readonly string[] {
  const issues: string[] = [];
  const characters = Array.isArray(state.characters) ? state.characters : [];

  if (state.schemaVersion !== GAME_STATE_SCHEMA_VERSION) {
    issues.push(`schemaVersion deve ser ${GAME_STATE_SCHEMA_VERSION}.`);
  }
  if (typeof state.contentVersion !== 'string' || state.contentVersion.trim() === '') {
    issues.push('contentVersion não pode ser vazio.');
  }
  if (
    !state.research ||
    !Array.isArray(state.research.unlockedTechnologyIds) ||
    !Array.isArray(state.exploration?.discoveredPointIds)
  ) {
    issues.push('research e exploration devem existir com listas válidas.');
  } else {
    if (
      !hasExactKeys(state.research, ['unlockedTechnologyIds', 'activeTechnologyId', 'progress']) ||
      !hasExactKeys(state.exploration, ['discoveredPointIds'])
    ) {
      issues.push('research ou exploration têm campos desconhecidos ou ausentes.');
    }
    const unlocked = state.research.unlockedTechnologyIds;
    if (new Set(unlocked).size !== unlocked.length || unlocked.some((id) => !isTechnologyId(id)))
      issues.push('Tecnologias desbloqueadas inválidas ou duplicadas.');
    if (
      state.research.activeTechnologyId !== null &&
      (!isTechnologyId(state.research.activeTechnologyId) ||
        unlocked.includes(state.research.activeTechnologyId))
    )
      issues.push('Pesquisa ativa inválida.');
    if (
      isTechnologyId(state.research.activeTechnologyId) &&
      !TECHNOLOGY_DEFINITIONS[state.research.activeTechnologyId]!.prerequisites.every((id) =>
        unlocked.includes(id),
      )
    ) {
      issues.push('Pré-requisitos da pesquisa ativa não foram concluídos.');
    }
    if (
      !isWholeNumber(state.research.progress) ||
      state.research.progress < 0 ||
      (state.research.activeTechnologyId === null && state.research.progress !== 0) ||
      (state.research.activeTechnologyId !== null &&
        state.research.progress >=
          (TECHNOLOGY_DEFINITIONS[state.research.activeTechnologyId]?.researchPoints ?? 0))
    )
      issues.push('Progresso de pesquisa inválido.');
    const points = state.exploration.discoveredPointIds;
    if (
      new Set(points).size !== points.length ||
      points.some((id) => !Object.hasOwn(POINTS_OF_INTEREST, id))
    )
      issues.push('Descobertas de exploração inválidas ou duplicadas.');
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

  if (!Array.isArray(state.characters)) {
    issues.push('characters deve ser uma lista.');
  } else {
    const characterIds = new Set<string>();
    for (const character of state.characters as GameState['characters']) {
      if (!character || typeof character !== 'object') {
        issues.push('Todo personagem precisa ser um objeto válido.');
        continue;
      }
      const id = character.characterId;
      if (
        !hasExactKeys(character, [
          'characterId',
          'name',
          'species',
          'lifeStage',
          'skills',
          'traits',
          'alive',
          'available',
        ])
      ) {
        issues.push(`Personagem "${String(id)}" tem campos desconhecidos ou ausentes.`);
      }
      if (typeof id !== 'string' || id.trim() === '')
        issues.push('Personagem precisa de characterId.');
      else if (characterIds.has(id)) issues.push(`characterId duplicado: "${id}".`);
      else characterIds.add(id);
      if (typeof character.name !== 'string' || character.name.trim() === '')
        issues.push(`Personagem "${String(id)}" precisa de nome.`);
      if (typeof character.species !== 'string' || character.species.trim() === '')
        issues.push(`Personagem "${String(id)}" precisa de espécie.`);
      if (!['young', 'adult', 'elder'].includes(character.lifeStage))
        issues.push(`Personagem "${String(id)}" tem estágio de vida inválido.`);
      if (typeof character.alive !== 'boolean' || typeof character.available !== 'boolean')
        issues.push(`Personagem "${String(id)}" tem estado inválido.`);
      if (!character.alive && character.available)
        issues.push(`Personagem morto "${String(id)}" não pode estar disponível.`);
      for (const skill of ['leadership', 'science', 'engineering', 'production'] as const) {
        const value = character.skills?.[skill];
        if (!isWholeNumber(value) || value < 0 || value > 5)
          issues.push(`Personagem "${String(id)}": competência ${skill} deve estar entre 0 e 5.`);
      }
      if (
        !character.skills ||
        !hasExactKeys(character.skills, ['leadership', 'science', 'engineering', 'production'])
      )
        issues.push(`Personagem "${String(id)}" tem estrutura de competências inválida.`);
      if (
        !Array.isArray(character.traits) ||
        character.traits.length === 0 ||
        character.traits.some(
          (trait) => !['calm', 'curious', 'bold', 'patient', 'kind'].includes(trait),
        )
      ) {
        issues.push(`Personagem "${String(id)}" tem traços inválidos.`);
      } else if (new Set(character.traits).size !== character.traits.length) {
        issues.push(`Personagem "${String(id)}" tem traços duplicados.`);
      }
    }
    const livingImportantCount = (state.characters as readonly unknown[]).filter(
      (character) =>
        typeof character === 'object' &&
        character !== null &&
        (character as { readonly alive?: unknown }).alive === true,
    ).length;
    if (state.population && livingImportantCount > state.population.survivors) {
      issues.push('Personagens importantes vivos não podem exceder a população agregada.');
    }
  }

  if (!state.government || typeof state.government !== 'object' || !state.government.offices) {
    issues.push('government e offices devem existir.');
  } else {
    if (
      !hasExactKeys(state.government, ['leaderId', 'offices']) ||
      !hasExactKeys(state.government.offices, ['science', 'engineering', 'production'])
    )
      issues.push('government tem estrutura inválida.');
    const officeIds = ['science', 'engineering', 'production'] as const;
    const assigned = [
      state.government.leaderId,
      ...officeIds.map((office) => state.government.offices[office]),
    ].filter((id): id is string => id !== null);
    if (new Set(assigned).size !== assigned.length)
      issues.push('Um personagem não pode ocupar mais de um cargo simultaneamente.');
    const roles: readonly (readonly [string, string | null])[] = [
      ['leader', state.government.leaderId],
      ...officeIds.map((office) => [office, state.government.offices[office]] as const),
    ];
    for (const [office, id] of roles) {
      if (id === null) continue;
      const character = characters.find(
        (candidate) =>
          typeof candidate === 'object' && candidate !== null && candidate.characterId === id,
      );
      if (!character || !character.alive || !character.available)
        issues.push(`Cargo governamental ${office} aponta para personagem indisponível.`);
      else {
        const skill: CharacterSkill =
          office === 'leader' ? 'leadership' : (office as CharacterSkill);
        if (character.skills[skill] < 2)
          issues.push(`Cargo governamental ${office} exige competência mínima 2.`);
      }
    }
    if (
      Object.keys(state.government.offices).some(
        (key) => !officeIds.includes(key as (typeof officeIds)[number]),
      )
    )
      issues.push('government tem cargo desconhecido.');
  }

  if (!Array.isArray(state.relationships)) {
    issues.push('relationships deve ser uma lista.');
  } else {
    const seen = new Set<string>();
    for (const relation of state.relationships) {
      if (
        !relation ||
        !characters.some(
          (character) =>
            typeof character === 'object' &&
            character !== null &&
            character.characterId === relation.fromId,
        ) ||
        !characters.some(
          (character) =>
            typeof character === 'object' &&
            character !== null &&
            character.characterId === relation.toId,
        ) ||
        relation.fromId === relation.toId
      ) {
        issues.push('Relação precisa apontar para dois personagens distintos existentes.');
        continue;
      }
      if (!hasExactKeys(relation, ['fromId', 'toId', 'affinity', 'trust', 'rivalry']))
        issues.push('Relação tem campos desconhecidos ou ausentes.');
      const key = [relation.fromId, relation.toId].sort().join('|');
      if (seen.has(key)) issues.push(`Relação duplicada: ${key}.`);
      seen.add(key);
      for (const value of [relation.affinity, relation.trust, relation.rivalry]) {
        if (!isWholeNumber(value) || value < -5 || value > 5)
          issues.push('Afinidade, confiança e rivalidade devem ser inteiros entre -5 e 5.');
      }
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
