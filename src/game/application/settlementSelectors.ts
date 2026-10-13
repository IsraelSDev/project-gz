import type { GameState } from '@/game/domain/state/GameState';
import { calculateHousingCapacity } from '@/game/domain/population/housingCapacity';

/** Capacidade imperial agregada, sem copiar o estado econômico dos assentamentos. */
export function totalSettlementHousingCapacity(
  state: Pick<GameState, 'buildings' | 'settlements'>,
) {
  return (
    calculateHousingCapacity(state.buildings) +
    state.settlements.reduce((sum, city) => sum + calculateHousingCapacity(city.buildings), 0)
  );
}
