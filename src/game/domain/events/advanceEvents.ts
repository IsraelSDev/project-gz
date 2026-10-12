import { GAME_EVENT_DEFINITIONS } from '@/game/content/events';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameState } from '@/game/domain/state/GameState';

const EVENT_LOG_LIMIT = 100;

/** Aciona eventos cujo marco de tempo foi alcançado, mantendo no máximo um evento pendente. */
export function advanceEvents(state: GameState): GameState {
  if (state.events.some((event) => event.status === 'pending')) {
    return state;
  }

  const definition = GAME_EVENT_DEFINITIONS.find(
    (event) =>
      state.tick >= event.triggerTick &&
      !state.events.some((record) => record.eventId === event.id),
  );
  if (!definition) {
    return state;
  }

  const events = [
    ...state.events,
    { eventId: definition.id, status: 'pending' as const, triggeredAtTick: state.tick },
  ].slice(-EVENT_LOG_LIMIT);
  return freezeDeep({ ...state, events });
}
