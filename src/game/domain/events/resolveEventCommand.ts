import { EVENT_DEFINITIONS, isEventId } from '@/game/content/events';
import { MAX_RESOURCE_AMOUNT, RESOURCE_IDS } from '@/game/content/resources';
import type { CommandHandler, SimulationCommand } from '@/game/domain/commands/simulationCommand';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameEventState, ResourceStock } from '@/game/domain/state/GameState';
import { err, ok } from '@/shared/result/result';

export const RESOLVE_EVENT = 'ResolveEvent';

export interface ResolveEventCommand extends SimulationCommand {
  readonly type: typeof RESOLVE_EVENT;
  readonly eventId: string;
  readonly optionId: string;
}

export function resolveEventCommand(eventId: string, optionId: string): ResolveEventCommand {
  return { type: RESOLVE_EVENT, eventId, optionId };
}

function applyResourceChanges(
  resources: ResourceStock,
  cost: Readonly<Record<string, number>>,
  effects: Readonly<Record<string, number>>,
): ResourceStock | null {
  const next: Record<string, number> = { ...resources };
  for (const id of RESOURCE_IDS) {
    const price = cost[id] ?? 0;
    const gain = effects[id] ?? 0;
    if (resources[id] < price) return null;
    next[id] = Math.min(MAX_RESOURCE_AMOUNT, resources[id] - price + gain);
  }
  return next as ResourceStock;
}

export const handleResolveEvent: CommandHandler = (state, command) => {
  const fields: Readonly<Record<string, unknown>> = { ...command };
  const eventId = fields.eventId;
  const optionId = fields.optionId;
  if (typeof eventId !== 'string' || !isEventId(eventId) || typeof optionId !== 'string') {
    return err('INVALID_COMMAND');
  }

  const eventState = state.events.find((event) => event.eventId === eventId);
  if (!eventState || eventState.status !== 'active') return err('EVENT_NOT_ACTIVE');

  const definition = EVENT_DEFINITIONS[eventId];
  const option = definition.options.find((candidate) => candidate.id === optionId);
  if (!option) return err('INVALID_COMMAND');

  const resources = applyResourceChanges(state.resources, option.cost, option.effects);
  if (!resources) return err('INSUFFICIENT_RESOURCES');

  const events = state.events.map((event): GameEventState =>
    event.eventId === eventId
      ? { ...event, status: 'resolved', chosenOptionId: option.id, resolvedAtTick: state.tick }
      : event,
  );
  return ok(freezeDeep({ ...state, resources, events }));
};
