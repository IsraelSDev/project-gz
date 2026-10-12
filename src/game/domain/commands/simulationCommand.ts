import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameState } from '@/game/domain/state/GameState';
import { validateGameState } from '@/game/domain/state/validateGameState';
import { err, ok, type Result } from '@/shared/result/result';

/*
 * Comandos de SIMULAÇÃO: os que alteram a partida (docs/TECHNICAL_ARCHITECTURE.md §7.2), como
 * `PlaceBuilding` (Fase 6) e `ResolveEvent` (Fase 7). Não confundir com os comandos de CONTROLE
 * (pausar, retomar, velocidade), que atuam no relógio e nunca passam por aqui, nem com a seleção,
 * que é estado de sessão da interface.
 *
 * Nesta fase existe só a infraestrutura: nenhum comando concreto ainda. Cada comando futuro é um
 * objeto `{ type, ...dados }` com um tratador registrado em `COMMAND_HANDLERS`.
 */

export interface SimulationCommand {
  /** Identifica o tratador do comando (por exemplo, 'PlaceBuilding'). */
  readonly type: string;
}

/**
 * Códigos de erro esperados ao validar ou aplicar um comando. O domínio devolve só o código; o
 * texto é da interface (Arquitetura §14).
 *  - INVALID_COMMAND: o comando não existe ou está malformado.
 *  - COMMAND_REJECTED: o comando é bem formado, mas as regras do jogo o recusam no estado atual.
 *  - INVALID_STATE: aplicar o comando produziria um estado que viola as invariantes do `GameState`.
 */
export type CommandErrorCode = 'INVALID_COMMAND' | 'COMMAND_REJECTED' | 'INVALID_STATE';

/** Resultado de aplicar um comando: o NOVO estado (o de entrada nunca é alterado) ou um erro. */
export type CommandResult = Result<GameState, CommandErrorCode>;

/**
 * Tratador de um tipo de comando: decide se o comando vale no estado dado e, se valer, devolve o
 * novo estado. Pura e determinística; a validação das regras do comando vive só aqui.
 */
export type CommandHandler = (state: GameState, command: SimulationCommand) => CommandResult;

export type CommandHandlers = Readonly<Record<string, CommandHandler>>;

/** Tratadores dos comandos existentes. Vazio na Fase 4: os comandos concretos entram nas Fases 6 e 7. */
export const COMMAND_HANDLERS: CommandHandlers = {};

/**
 * Valida E aplica um comando em uma única passada, sem alterar o estado de entrada. É o único ponto
 * de validação de comandos: o `GameController` o chama ao receber o comando (para recusar cedo) e de
 * novo ao aplicá-lo no passo (a aplicação é a decisão definitiva), sem duplicar regras.
 *
 * O estado resultante também precisa ser válido (`validateGameState`); caso contrário o comando é
 * recusado com `INVALID_STATE` e nada muda. Falhas esperadas viram `Result`; só bugs lançam exceção.
 */
export function executeSimulationCommand(
  state: GameState,
  command: SimulationCommand,
  handlers: CommandHandlers = COMMAND_HANDLERS,
): CommandResult {
  const type: unknown = command.type;
  if (typeof type !== 'string' || !Object.hasOwn(handlers, type)) {
    return err('INVALID_COMMAND');
  }
  const handler = handlers[type];
  if (!handler) {
    return err('INVALID_COMMAND');
  }

  const result = handler(state, command);
  if (!result.ok) {
    return result;
  }
  if (validateGameState(result.value).length > 0) {
    return err('INVALID_STATE');
  }
  return ok(freezeDeep(result.value));
}
