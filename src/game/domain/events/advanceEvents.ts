import { EVENT_DEFINITIONS, type EventId } from '@/game/content/events';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameEventState, GameState } from '@/game/domain/state/GameState';

/** Ativa eventos elegíveis depois da economia; não lê relógios nem sorteio externo. */
export function advanceEvents(state: GameState): GameState {
  let changed = false;
  const events = state.events.map((event): GameEventState => {
    if (event.status !== 'available') return event;
    const definition = EVENT_DEFINITIONS[event.eventId as EventId];
    const triggered =
      definition.trigger.kind === 'tick'
        ? state.tick >= definition.trigger.minTick
        : state.exploration.discoveredPointIds.includes(definition.trigger.pointId);
    if (!triggered) return event;
    changed = true;
    return { ...event, status: 'active' };
  });

  return changed ? freezeDeep({ ...state, events }) : state;
}
