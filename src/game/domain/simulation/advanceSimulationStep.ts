import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameState } from '@/game/domain/state/GameState';

/**
 * Executa UM passo de simulação (um tick de tempo de jogo) e devolve o novo estado; o estado de
 * entrada não é alterado. É o ÚNICO lugar que incrementa `tick`: o tick avança só quando um passo
 * é realmente executado, nunca por causa de um quadro renderizado. Função pura e determinística: não
 * lê relógio, aleatoriedade nem ambiente.
 *
 * Ordem dos sistemas em cada passo (Arquitetura §6.5). Esta fase implementa só o item 1; os demais
 * entram junto do sistema que os usa e a ordem é confirmada por testes:
 *  1. Atualizar o tick.
 *  2. Processar os comandos de simulação pendentes (feito pelo `GameController`, que enfileira).
 *  3. Calcular produção.            (Fase 5)
 *  4. Calcular consumo.             (Fase 5)
 *  5. Atualizar necessidades.       (Fase 9)
 *  6. Avaliar gatilhos de eventos.  (Fase 7)
 *  7. Publicar um novo snapshot.    (feito pelo `GameController`)
 *
 * `resources` e `buildings` mantêm a mesma referência (compartilhamento estrutural), o que permite
 * à interface reagir só ao que mudou.
 */
export function advanceSimulationStep(state: GameState): GameState {
  if (!Number.isSafeInteger(state.tick + 1)) {
    throw new RangeError('O tick excedeu o maior inteiro seguro.');
  }
  return freezeDeep({ ...state, tick: state.tick + 1 });
}
