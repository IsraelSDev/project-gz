import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { POPULATION_RULES } from '@/game/content/population';
import type { GameState } from '@/game/domain/state/GameState';
import {
  INITIAL_CHARACTERS,
  INITIAL_GOVERNMENT,
  INITIAL_RELATIONSHIPS,
} from '@/game/content/characters';

/** Estado v1 aceito no save da Fase 8, antes de haver população. */
export type LegacyGameStateV1 = Omit<
  GameState,
  'schemaVersion' | 'contentVersion' | 'population' | 'characters' | 'government' | 'relationships'
> & {
  readonly schemaVersion: 1;
  readonly contentVersion: '0.4.0';
};

export type LegacyGameStateV2 = Omit<
  GameState,
  'schemaVersion' | 'contentVersion' | 'characters' | 'government' | 'relationships'
> & {
  readonly schemaVersion: 2;
  readonly contentVersion: '0.5.0';
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
export function migrateV2ToV3(state: LegacyGameStateV2): GameState {
  return {
    ...state,
    schemaVersion: 3,
    contentVersion: INITIAL_SCENARIO.contentVersion,
    characters: INITIAL_CHARACTERS,
    government: INITIAL_GOVERNMENT,
    relationships: INITIAL_RELATIONSHIPS,
  };
}
