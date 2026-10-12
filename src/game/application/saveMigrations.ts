import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { POPULATION_RULES } from '@/game/content/population';
import type { GameState } from '@/game/domain/state/GameState';
import { EVENT_DEFINITIONS } from '@/game/content/events';
import {
  INITIAL_CHARACTERS,
  INITIAL_GOVERNMENT,
  INITIAL_RELATIONSHIPS,
} from '@/game/content/characters';
import { civilizationForDiscoveryPoint } from '@/game/content/independentCivilizations';
import {
  createInitialDiplomacy,
  discoverIndependentCivilization,
} from '@/game/domain/diplomacy/diplomacyState';

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
  | 'diplomacy'
  | 'military'
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
  | 'diplomacy'
  | 'military'
> & {
  readonly schemaVersion: 2;
  readonly contentVersion: '0.5.0';
};

export type LegacyGameStateV3 = Omit<
  GameState,
  'schemaVersion' | 'contentVersion' | 'research' | 'exploration' | 'diplomacy' | 'military'
> & {
  readonly schemaVersion: 3;
  readonly contentVersion: '0.6.0';
};

export type LegacyGameStateV4 = Omit<
  GameState,
  'schemaVersion' | 'contentVersion' | 'diplomacy' | 'military'
> & {
  readonly schemaVersion: 4;
  readonly contentVersion: '0.7.0';
};

export type LegacyGameStateV5 = Omit<GameState, 'schemaVersion' | 'contentVersion' | 'military'> & {
  readonly schemaVersion: 5;
  readonly contentVersion: '0.8.0';
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
export function migrateV3ToV4(state: LegacyGameStateV3): LegacyGameStateV4 {
  return {
    ...state,
    schemaVersion: 4,
    contentVersion: '0.7.0',
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

/** Fase 13: preserva explorações anteriores e as projeta como descobertas diplomáticas. */
export function migrateV4ToV5(state: LegacyGameStateV4): LegacyGameStateV5 {
  let diplomacy = createInitialDiplomacy();
  for (const pointId of state.exploration.discoveredPointIds) {
    const civilization = civilizationForDiscoveryPoint(pointId);
    if (civilization) {
      diplomacy = discoverIndependentCivilization(diplomacy, civilization.id, state.tick);
    }
  }
  const events = [
    ...state.events,
    ...Object.values(EVENT_DEFINITIONS)
      .filter((definition) => !state.events.some((event) => event.eventId === definition.id))
      .map((definition) => ({
        eventId: definition.id as GameState['events'][number]['eventId'],
        status: 'available' as const,
      })),
  ];
  return {
    ...state,
    schemaVersion: 5,
    contentVersion: '0.8.0',
    events,
    diplomacy,
  };
}

/** Fase 14: adiciona um estado militar vazio, sem alterar recursos ou progresso do save. */
export function migrateV5ToV6(state: LegacyGameStateV5): GameState {
  const events = [
    ...state.events,
    ...Object.values(EVENT_DEFINITIONS)
      .filter((definition) => !state.events.some((event) => event.eventId === definition.id))
      .map((definition) => ({
        eventId: definition.id as GameState['events'][number]['eventId'],
        status: 'available' as const,
      })),
  ];
  return {
    ...state,
    schemaVersion: 6,
    contentVersion: INITIAL_SCENARIO.contentVersion,
    events,
    diplomacy: {
      civilizations: state.diplomacy.civilizations.map((relation) => ({
        ...relation,
        warStatus: 'none' as const,
      })),
    },
    military: { nextUnitId: 1, units: [], battle: null, history: [] },
  };
}
