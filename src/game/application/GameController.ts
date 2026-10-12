import type { GameState } from '@/game/domain/state/GameState';
import { createListenerSet } from '@/shared/store/listenerSet';

/*
 * Ponte entre a partida e a interface (docs/TECHNICAL_ARCHITECTURE.md §3.3 e §11). Nesta fase o
 * controlador só EXPÕE o estado, em leitura: não há comandos, relógio, pausa nem economia (Fase 4
 * em diante). `subscribe` e `getSnapshot` seguem o contrato de `useSyncExternalStore`.
 */

/**
 * Visão imutável da partida entregue à interface. Por enquanto é o próprio `GameState`, que o
 * domínio já entrega congelado em profundidade: não há segunda cópia dos dados nem objetos novos a
 * cada leitura.
 */
export type GameSnapshot = GameState;

export interface GameController {
  /** Snapshot atual. A MESMA referência é devolvida enquanto o estado não mudar. */
  getSnapshot(): GameSnapshot;
  /** Registra um ouvinte, chamado a cada novo snapshot, e devolve o cancelamento da assinatura. */
  subscribe(listener: () => void): () => void;
}

/**
 * Cria o controlador a partir do estado inicial (já imutável, vindo do domínio). Sem comandos
 * ainda, o estado é estático e os ouvintes nunca são chamados; a assinatura existe para a interface
 * já nascer ligada ao contrato que a Fase 4 vai alimentar.
 */
export function createGameController(initialState: GameState): GameController {
  const snapshot: GameSnapshot = initialState;
  const listeners = createListenerSet();

  return {
    getSnapshot: () => snapshot,
    subscribe: listeners.subscribe,
  };
}
