import { GAME_EVENT_DEFINITIONS } from '@/game/content/events';
import { MAX_RESOURCE_AMOUNT } from '@/game/content/resources';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameState } from '@/game/domain/state/GameState';
import { err, ok, type Result } from '@/shared/result/result';
import { randomInteger } from './random';

export const RESOLVE_EVENT = 'ResolveEvent';

export interface ResolveEventCommand {
  readonly type: typeof RESOLVE_EVENT;
  readonly eventId: string;
  readonly choiceId: string;
}

export type ResolveEventError =
  'EVENT_NOT_AVAILABLE' | 'INVALID_EVENT_CHOICE' | 'RESOURCE_LIMIT_EXCEEDED';

export function handleResolveEvent(
  state: GameState,
  command: ResolveEventCommand,
): Result<GameState, ResolveEventError> {
  const definition = GAME_EVENT_DEFINITIONS.find((event) => event.id === command.eventId);
  const active = state.events.find(
    (event) => event.eventId === command.eventId && event.status === 'pending',
  );
  if (!definition || !active) {
    return err('EVENT_NOT_AVAILABLE');
  }

  const choice = definition.choices.find((item) => item.id === command.choiceId);
  if (!choice) {
    return err('INVALID_EVENT_CHOICE');
  }

  const resources = { ...state.resources };
  let rng = state.rng;
  for (const effect of choice.effects) {
    let amount: number;
    if (effect.kind === 'random-resource') {
      const result = randomInteger(rng, effect.min, effect.max);
      rng = result.state;
      amount = result.value;
    } else {
      amount = effect.amount;
    }

    const updated = resources[effect.resourceId] + amount;
    if (!Number.isSafeInteger(updated) || updated < 0 || updated > MAX_RESOURCE_AMOUNT) {
      return err('RESOURCE_LIMIT_EXCEEDED');
    }
    resources[effect.resourceId] = updated;
  }

  const events = state.events.map((event) =>
    event === active
      ? { ...event, status: 'resolved' as const, resolvedAtTick: state.tick, choiceId: choice.id }
      : event,
  );
  return ok(freezeDeep({ ...state, resources, rng, events }));
}
