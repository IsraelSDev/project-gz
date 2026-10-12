import { advanceEconomy } from '@/game/domain/economy/advanceEconomy';
import { advanceEvents } from '@/game/domain/events/advanceEvents';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameState } from '@/game/domain/state/GameState';

/** Fase do passo em que os comandos de simulação pendentes são aplicados (item 2 da ordem). */
export type CommandPhase = (state: GameState) => GameState;

const noCommands: CommandPhase = (state) => state;

/**
 * Executa UM passo de simulação (um tick de tempo de jogo) e devolve o novo estado; o estado de
 * entrada não é alterado. É o ÚNICO lugar que incrementa `tick` e que executa a economia: ambos
 * acontecem só quando um passo é realmente executado, nunca por causa de um quadro renderizado, e
 * nunca com o jogo pausado. Função pura e determinística: não lê relógio, aleatoriedade nem ambiente.
 *
 * Ordem dos sistemas em cada passo (Arquitetura §6.5; a ordem é definida AQUI, num lugar só):
 *  1. Atualizar o tick.
 *  2. Processar os comandos de simulação pendentes. A fila é do `GameController` (aplicação), então
 *     ele entrega esta fase em `applyCommands`; sem ela, nenhum comando é aplicado.
 *  3. Calcular produção.            (`advanceEconomy`, Fase 5)
 *  4. Calcular consumo.             (`advanceEconomy`, Fase 5)
 *  5. Atualizar necessidades.       (Fase 9)
 *  6. Avaliar gatilhos de eventos.  (Fase 7)
 *  7. Publicar um novo snapshot.    (feito pelo `GameController`)
 *
 * Como os comandos vêm antes da economia, um edifício criado ou recurso gasto por um comando já
 * vale no mesmo passo. `resources` e `buildings` mantêm a referência quando não mudam
 * (compartilhamento estrutural), o que permite à interface reagir só ao que mudou.
 */
export function advanceSimulationStep(
  state: GameState,
  applyCommands: CommandPhase = noCommands,
): GameState {
  if (!Number.isSafeInteger(state.tick + 1)) {
    throw new RangeError('O tick excedeu o maior inteiro seguro.');
  }
  const ticked = freezeDeep({ ...state, tick: state.tick + 1 });
  const commanded = applyCommands(ticked);

  const resources = advanceEconomy(commanded.resources, commanded.buildings);
  const economicState =
    resources === commanded.resources ? commanded : freezeDeep({ ...commanded, resources });
  return advanceEvents(economicState);
}
