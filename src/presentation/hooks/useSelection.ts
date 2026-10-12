import { useSyncExternalStore } from 'react';
import type { SelectionState, SelectionStore } from '@/session/selectionStore';

/** Seleção atual da interface, lida do store de sessão com `useSyncExternalStore`. */
export function useSelection(store: SelectionStore): SelectionState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
