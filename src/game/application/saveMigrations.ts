import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { POPULATION_RULES } from '@/game/content/population';
import type { GameState } from '@/game/domain/state/GameState';
import { EVENT_DEFINITIONS } from '@/game/content/events';
import {
  INITIAL_CHARACTERS,
  INITIAL_GOVERNMENT,
  INITIAL_RELATIONSHIPS,
} from '@/game/content/characters';

/** Estado v1 aceito no save da Fase 8, antes de haver população. */
export type LegacyGameStateV1 = Omit<
  GameState,
  | 'schemaVersion'
  | 'contentVersion'
  | 'population'
  | 'characters'
  | 'government'
  | 'relationships'
  | 'research'
  | 'exploration'
> & {
  readonly schemaVersion: 1;
  readonly contentVersion: '0.4.0';
};

export type LegacyGameStateV2 = Omit<
  GameState,
  | 'schemaVersion'
  | 'contentVersion'
  | 'characters'
  | 'government'
  | 'relationships'
  | 'research'
  | 'exploration'
> & {
  readonly schemaVersion: 2;
  readonly contentVersion: '0.5.0';
};

export type LegacyGameStateV3 = Omit<
  GameState,
  'schemaVersion' | 'contentVersion' | 'research' | 'exploration'
> & {
  readonly schemaVersion: 3;
  readonly contentVersion: '0.6.0';
};

/** Migração pura: não altera o objeto v1 nem reaplica o tick já persistido. */
export function migrateV1ToV2(state: LegacyGameStateV1): LegacyGameStateV2 {
  return {
    ...state,
    schemaVersion: 2,
    contentVersion: '0.5.0',
    population: {
      survivors: POPULATION_RULES.initialSurvivors,
      shortageTicks: 0,
      stableTicks: 0,
      outcome: 'ongoing',
    },
  };
}

/** Adiciona elenco, governo inicial e relações ao formato da Fase 9 sem mexer no progresso. */
export function migrateV2ToV3(state: LegacyGameStateV2): LegacyGameStateV3 {
  return {
    ...state,
    schemaVersion: 3,
    contentVersion: '0.6.0',
    characters: INITIAL_CHARACTERS,
    government: INITIAL_GOVERNMENT,
    relationships: INITIAL_RELATIONSHIPS,
  };
}

/** Adiciona os sistemas da Fase 11 sem alterar tick, estoque, elenco ou recompensas antigas. */
export function migrateV3ToV4(state: LegacyGameStateV3): GameState {
  return {
    ...state,
    schemaVersion: 4,
    contentVersion: INITIAL_SCENARIO.contentVersion,
    events: [
      ...state.events,
      ...Object.values(EVENT_DEFINITIONS)
        .filter((definition) => !state.events.some((event) => event.eventId === definition.id))
        .map((definition) => ({
          eventId: definition.id as GameState['events'][number]['eventId'],
          status: 'available' as const,
        })),
    ],
    research: { unlockedTechnologyIds: [], activeTechnologyId: null, progress: 0 },
    exploration: { discoveredPointIds: [] },
  };
}
