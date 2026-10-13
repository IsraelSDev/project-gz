import type { PlacementErrorCode } from '@/game/domain/construction/placement';
import { handleResolveEvent, RESOLVE_EVENT } from '@/game/domain/events/resolveEventCommand';
import {
  APPOINT_CHARACTER,
  handleAppointCharacter,
  handleRemoveCharacterFromOffice,
  REMOVE_CHARACTER_FROM_OFFICE,
} from '@/game/domain/government/governmentCommands';
import {
  handlePlaceBuilding,
  PLACE_BUILDING,
} from '@/game/domain/construction/placeBuildingCommand';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import { handleStartResearch, START_RESEARCH } from '@/game/domain/research/researchCommands';
import { handleExplorePoint, EXPLORE_POINT } from '@/game/domain/exploration/exploreCommand';
import {
  DIPLOMATIC_ACTION,
  handleDiplomaticAction,
} from '@/game/domain/diplomacy/diplomacyCommands';
import type { GameState } from '@/game/domain/state/GameState';
import { validateGameState } from '@/game/domain/state/validateGameState';
import { err, ok, type Result } from '@/shared/result/result';
import { handleMilitaryAction, MILITARY_ACTION } from '@/game/domain/military/militaryCommands';
import { handleTerritoryAction, TERRITORY_ACTION } from '@/game/domain/territory/territoryCommands';

/*
 * Comandos de SIMULAÇÃO: os que alteram a partida (docs/TECHNICAL_ARCHITECTURE.md §7.2), como
 * `PlaceBuilding` (Fase 6) e `ResolveEvent` (Fase 7). Não confundir com os comandos de CONTROLE
 * (pausar, retomar, velocidade), que atuam no relógio e nunca passam por aqui, nem com a seleção,
 * que é estado de sessão da interface.
 *
 * Cada comando é um objeto `{ type, ...dados }` com um tratador registrado em `COMMAND_HANDLERS`.
 * Existe `PlaceBuilding` (Fase 6); `ResolveEvent` entra na Fase 7.
 */

export interface SimulationCommand {
  /** Identifica o tratador do comando (por exemplo, 'PlaceBuilding'). */
  readonly type: string;
}

/**
 * Códigos de erro esperados ao validar ou aplicar um comando. O domínio devolve só o código; o
 * texto é da interface (Arquitetura §14).
 *  - INVALID_COMMAND: o comando não existe ou está malformado.
 *  - COMMAND_REJECTED: o comando é bem formado, mas as regras do jogo o recusam no estado atual
 *    (recusa genérica, sem um motivo mais específico).
 *  - INVALID_STATE: aplicar o comando produziria um estado que viola as invariantes do `GameState`.
 *  - Os códigos de `PlacementErrorCode` (Fase 6): recusas específicas de `PlaceBuilding`, para a
 *    interface explicar o motivo (fora da área, sobreposição, recursos insuficientes).
 */
export type CommandErrorCode =
  | 'INVALID_COMMAND'
  | 'COMMAND_REJECTED'
  | 'INVALID_STATE'
  | 'EVENT_NOT_ACTIVE'
  | 'INSUFFICIENT_RESOURCES'
  | 'DIPLOMACY_REQUIREMENT_NOT_MET'
  | 'DIPLOMACY_ALREADY_COMPLETED'
  | PlacementErrorCode;

/** Resultado de aplicar um comando: o NOVO estado (o de entrada nunca é alterado) ou um erro. */
export type CommandResult = Result<GameState, CommandErrorCode>;

/**
 * Tratador de um tipo de comando: decide se o comando vale no estado dado e, se valer, devolve o
 * novo estado. Pura e determinística; a validação das regras do comando vive só aqui.
 */
export type CommandHandler = (state: GameState, command: SimulationCommand) => CommandResult;

export type CommandHandlers = Readonly<Record<string, CommandHandler>>;

/** Tratadores dos comandos existentes. */
export const COMMAND_HANDLERS: CommandHandlers = {
  [PLACE_BUILDING]: handlePlaceBuilding,
  [RESOLVE_EVENT]: handleResolveEvent,
  [APPOINT_CHARACTER]: handleAppointCharacter,
  [REMOVE_CHARACTER_FROM_OFFICE]: handleRemoveCharacterFromOffice,
  [START_RESEARCH]: handleStartResearch,
  [EXPLORE_POINT]: handleExplorePoint,
  [DIPLOMATIC_ACTION]: handleDiplomaticAction,
  [MILITARY_ACTION]: handleMilitaryAction,
  [TERRITORY_ACTION]: handleTerritoryAction,
};

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
