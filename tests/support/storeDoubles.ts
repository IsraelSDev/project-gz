import type { GameStateReader } from '@/game/application/GameController';
import type { GameState } from '@/game/domain/state/GameState';
import { createListenerSet } from '@/shared/store/listenerSet';

/*
 * Apoio dos testes de componentes. Este dublê de LEITURA do estado deixa um teste publicar um novo
 * estado arbitrário (por exemplo, sem uma construção) e provar que a interface lê o snapshot, em
 * vez de guardar cópias. Só para testes: nada disto existe na aplicação.
 */

export interface FakeController extends GameStateReader {
  /** Publica um novo snapshot e notifica os assinantes, como o controlador real faz a cada passo. */
  setState(next: GameState): void;
}

export function createFakeController(initial: GameState): FakeController {
  const listeners = createListenerSet();
  let snapshot = initial;
  return {
    getSnapshot: () => snapshot,
    subscribe: listeners.subscribe,
    setState: (next) => {
      snapshot = next;
      listeners.notify();
    },
  };
}

interface Subscribable {
  subscribe(listener: () => void): () => void;
}

/** Envolve um store contando as assinaturas ativas (para provar que a desmontagem as remove). */
export function trackSubscriptions<T extends Subscribable>(
  source: T,
): T & { readonly activeSubscriptions: () => number } {
  let active = 0;
  return {
    ...source,
    subscribe: (listener) => {
      active += 1;
      const unsubscribe = source.subscribe(listener);
      let released = false;
      return () => {
        if (!released) {
          released = true;
          active -= 1;
        }
        unsubscribe();
      };
    },
    activeSubscriptions: () => active,
  };
}
