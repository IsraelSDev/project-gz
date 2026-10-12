import { useSyncExternalStore } from 'react';
import type { ClockSnapshot, SimulationClock } from '@/game/application/time/SimulationClock';

/** O que a interface lê do relógio. */
export type ClockReader = Pick<SimulationClock, 'getSnapshot' | 'subscribe'>;

/**
 * Estado do relógio (`paused` e `speed`) lido com `useSyncExternalStore`. Não há cópia no React: o
 * relógio é a única fonte, o snapshot só muda de referência quando algo muda e a assinatura é
 * cancelada ao desmontar.
 */
export function useClock(clock: ClockReader): ClockSnapshot {
  return useSyncExternalStore(clock.subscribe, clock.getSnapshot, clock.getSnapshot);
}
