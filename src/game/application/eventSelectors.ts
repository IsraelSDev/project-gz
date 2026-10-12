import { EVENT_DEFINITIONS, type EventId } from '@/game/content/events';
import type { GameState, ResourceStock } from '@/game/domain/state/GameState';

export interface EventOptionView {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly affordable: boolean;
}

export interface EventView {
  readonly id: EventId;
  readonly status: 'active' | 'resolved';
  readonly title: string;
  readonly description: string;
  readonly options: readonly EventOptionView[];
  readonly result: string | null;
}

function canAfford(resources: ResourceStock, cost: Readonly<Record<string, number>>): boolean {
  return Object.entries(cost).every(
    ([id, amount]) => resources[id as keyof ResourceStock] >= amount,
  );
}

/** Conteúdo visível de eventos, derivado do estado e entregue à apresentação pela aplicação. */
export function selectVisibleEvents(state: GameState): readonly EventView[] {
  return state.events.flatMap((event): EventView[] => {
    if (event.status !== 'active' && event.status !== 'resolved') return [];
    const definition = EVENT_DEFINITIONS[event.eventId];
    const chosen = definition.options.find((option) => option.id === event.chosenOptionId);
    return [
      {
        id: event.eventId,
        status: event.status,
        title: definition.title,
        description: definition.description,
        options:
          event.status === 'active'
            ? definition.options.map((option) => ({
                id: option.id,
                label: option.label,
                description: option.description,
                affordable: canAfford(state.resources, option.cost),
              }))
            : [],
        result:
          event.status === 'resolved' ? (chosen?.consequence ?? 'O evento foi encerrado.') : null,
      },
    ];
  });
}
