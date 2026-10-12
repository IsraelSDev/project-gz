import { useSyncExternalStore } from 'react';
import type { BuildState, BuildStore } from '@/session/buildStore';

/** Estado do modo de construção, lido do store de sessão com `useSyncExternalStore`. */
export function useBuild(store: BuildStore): BuildState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/**
 * Só "há um edifício em posicionamento?". Devolve um booleano (valor primitivo), então quem usa só
 * re-renderiza quando o modo liga ou desliga, e não a cada célula que o ponteiro percorre.
 */
export function usePlacementActive(store: BuildStore): boolean {
  const read = () => store.getSnapshot().definitionId !== null;
  return useSyncExternalStore(store.subscribe, read, read);
}
