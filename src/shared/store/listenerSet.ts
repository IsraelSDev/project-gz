/*
 * Conjunto de ouvintes de um store externo (contrato de `useSyncExternalStore`). Usado pelo store de
 * seleção (`session/`) e pelo `GameController` (`game/application/`), que precisam da mesma
 * semântica de assinatura.
 */

export type Listener = () => void;

export interface ListenerSet {
  /** Registra um ouvinte e devolve a função que o remove. A remoção é idempotente. */
  subscribe(listener: Listener): () => void;
  /**
   * Chama os ouvintes registrados neste instante. Inscrever ou cancelar durante a notificação é
   * seguro: quem cancelou antes de ser chamado não é chamado.
   */
  notify(): void;
}

export function createListenerSet(): ListenerSet {
  // Cada chamada de `subscribe` gera uma assinatura própria: registrar a mesma função duas vezes
  // não faz o cancelamento de uma remover a outra.
  const subscriptions = new Set<{ readonly listener: Listener }>();

  return {
    subscribe: (listener) => {
      const subscription = { listener };
      subscriptions.add(subscription);
      return () => {
        subscriptions.delete(subscription);
      };
    },
    notify: () => {
      for (const subscription of [...subscriptions]) {
        if (subscriptions.has(subscription)) {
          subscription.listener();
        }
      }
    },
  };
}
