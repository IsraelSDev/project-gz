import { getEventDefinition } from '@/game/content/events';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameEventState, GameState } from '@/game/domain/state/GameState';

/** Ativa eventos elegíveis depois da economia; não lê relógios nem sorteio externo. */
export function advanceEvents(state: GameState): GameState {
  let changed = false;
  const events = state.events.map((event): GameEventState => {
    if (event.status !== 'available') return event;
    const definition = getEventDefinition(event.eventId);
    let triggered = false;
    if (definition.trigger.kind === 'tick') {
      triggered = state.tick >= definition.trigger.minTick;
    } else if (definition.trigger.kind === 'point-discovered') {
      triggered = state.exploration.discoveredPointIds.includes(definition.trigger.pointId);
    } else if (definition.trigger.kind === 'civilization-discovered') {
      const civilizationId = definition.trigger.civilizationId;
      triggered = state.diplomacy.civilizations.some(
        (relation) =>
          relation.civilizationId === civilizationId && relation.contactStatus !== 'unknown',
      );
    }
    if (!triggered) return event;
    changed = true;
    return { ...event, status: 'active' };
  });

  return changed ? freezeDeep({ ...state, events }) : state;
}
