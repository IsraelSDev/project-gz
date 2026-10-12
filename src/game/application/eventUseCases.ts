import type { CommandErrorCode } from '@/game/domain/commands/simulationCommand';
import {
  resolveEventCommand,
  RESOLVE_EVENT as RESOLVE_EVENT_TYPE,
} from '@/game/domain/events/resolveEventCommand';
import type { Result } from '@/shared/result/result';
import type { CommandOutcome, GameController } from './GameController';

export { RESOLVE_EVENT_TYPE };

/** Envia a decisão ao fluxo único de comandos da partida. */
export function resolveEvent(
  controller: Pick<GameController, 'submitCommand'>,
  eventId: string,
  optionId: string,
): Result<CommandOutcome, CommandErrorCode> {
  return controller.submitCommand(resolveEventCommand(eventId, optionId));
}
