import type { GameController } from './GameController';
import { RESOLVE_EVENT } from '@/game/domain/events/resolveEventCommand';

export function resolveGameEvent(
  controller: Pick<GameController, 'submitCommand'>,
  eventId: string,
  choiceId: string,
) {
  const command = { type: RESOLVE_EVENT, eventId, choiceId };
  return controller.submitCommand(command);
}

export function isResolveEventCommand(commandType: string): boolean {
  return commandType === RESOLVE_EVENT;
}
