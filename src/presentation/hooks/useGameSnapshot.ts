import { useSyncExternalStore } from 'react';
import type { GameController, GameSnapshot } from '@/game/application/GameController';

/**
 * Snapshot atual da partida, lido do `GameController` com `useSyncExternalStore`. Não há cópia do
 * estado no React: o componente re-renderiza só quando o controlador publica um novo snapshot, e a
 * assinatura é cancelada ao desmontar. Sem `getServerSnapshot` próprio: o estado é o mesmo no
 * servidor e no cliente.
 */
export function useGameSnapshot(controller: GameController): GameSnapshot {
  return useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
}
