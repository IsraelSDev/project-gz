import { createListenerSet } from '@/shared/store/listenerSet';

/*
 * Estado de sessão da interface: a seleção atual (docs/TECHNICAL_ARCHITECTURE.md §5.3, D-09).
 * Não faz parte do `GameState`, não é salvo e não é um comando de domínio: selecionar não altera a
 * partida. Guarda SÓ o identificador estável (`instanceId`), nunca meshes, nós nem nomes de meshes.
 * Não depende de React nem de Babylon.js; `subscribe` e `getSnapshot` seguem o contrato de
 * `useSyncExternalStore`.
 */

export interface SelectionState {
  /** `instanceId` da entidade selecionada, ou `null` quando não há seleção. */
  readonly selectedEntityId: string | null;
}

export interface SelectionStore {
  /** Estado atual, somente leitura. A referência só muda quando a seleção realmente muda. */
  getSnapshot(): SelectionState;
  /** Registra um ouvinte e devolve a função que cancela a assinatura. */
  subscribe(listener: () => void): () => void;
  /** Seleciona a entidade. Não faz nada (nem notifica) se ela já estiver selecionada. */
  select(entityId: string): void;
  /** Limpa a seleção. Não faz nada (nem notifica) se não houver seleção. */
  clear(): void;
}

function createState(selectedEntityId: string | null): SelectionState {
  return Object.freeze({ selectedEntityId });
}

export function createSelectionStore(): SelectionStore {
  const listeners = createListenerSet();
  let state = createState(null);

  const update = (selectedEntityId: string | null): void => {
    if (state.selectedEntityId === selectedEntityId) {
      return;
    }
    state = createState(selectedEntityId);
    listeners.notify();
  };

  return {
    getSnapshot: () => state,
    subscribe: listeners.subscribe,
    select: (entityId) => update(entityId),
    clear: () => update(null),
  };
}
