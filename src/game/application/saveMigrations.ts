import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { POPULATION_RULES } from '@/game/content/population';
import type { GameState } from '@/game/domain/state/GameState';

/** Estado v1 aceito no save da Fase 8, antes de haver população. */
export type LegacyGameStateV1 = Omit<
  GameState,
  'schemaVersion' | 'contentVersion' | 'population'
> & {
  readonly schemaVersion: 1;
  readonly contentVersion: '0.4.0';
};

/** Migração pura: não altera o objeto v1 nem reaplica o tick já persistido. */
export function migrateV1ToV2(state: LegacyGameStateV1): GameState {
  return {
    ...state,
    schemaVersion: 2,
    contentVersion: INITIAL_SCENARIO.contentVersion,
    population: {
      survivors: POPULATION_RULES.initialSurvivors,
      shortageTicks: 0,
      stableTicks: 0,
      outcome: 'ongoing',
    },
  };
}
