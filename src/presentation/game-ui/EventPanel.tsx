import { useEffect, useState } from 'react';
import type { GameController } from '@/game/application/GameController';
import { selectGameEventDefinition } from '@/game/application/eventSelectors';
import { isResolveEventCommand, resolveGameEvent } from '@/game/application/eventUseCases';
import { useGameSelector } from '@/presentation/hooks/useGameSelector';
import { describeError } from '../build/buildMessages';

export interface EventPanelProps {
  readonly controller: GameController;
}

export function EventPanel({ controller }: EventPanelProps) {
  const events = useGameSelector(controller, (snapshot) => snapshot.events);
  const event = events.find((item) => item.status === 'pending');
  const definition = selectGameEventDefinition(event?.eventId);
  const [feedback, setFeedback] = useState<{
    readonly eventId: string;
    readonly message: string;
    readonly queued: boolean;
  }>();

  useEffect(() => {
    return controller.subscribeRejections((rejection) => {
      if (isResolveEventCommand(rejection.command.type) && event?.eventId) {
        setFeedback({
          eventId: event.eventId,
          message: describeError(rejection.error),
          queued: false,
        });
      }
    });
  }, [controller, event?.eventId]);

  if (!event || !definition) {
    return null;
  }

  const eventFeedback = feedback?.eventId === event.eventId ? feedback : undefined;

  const resolve = (choiceId: string) => {
    const result = resolveGameEvent(controller, event.eventId, choiceId);
    if (result.ok) {
      setFeedback({
        eventId: event.eventId,
        message:
          result.value === 'queued'
            ? 'Escolha registrada para o próximo passo.'
            : 'Escolha aplicada.',
        queued: result.value === 'queued',
      });
    } else {
      setFeedback({ eventId: event.eventId, message: describeError(result.error), queued: false });
    }
  };

  return (
    <section
      className="event-panel hud-panel"
      aria-labelledby="event-panel-title"
      aria-live="polite"
    >
      <p className="hud-panel__title">Evento</p>
      <h2 className="event-panel__title" id="event-panel-title">
        {definition.title}
      </h2>
      <p className="event-panel__description">{definition.description}</p>
      <div className="event-panel__choices">
        {definition.choices.map((choice) => (
          <button
            className="event-choice"
            key={choice.id}
            type="button"
            disabled={eventFeedback?.queued ?? false}
            onClick={() => resolve(choice.id)}
          >
            <span className="event-choice__label">{choice.label}</span>
            <span className="event-choice__description">{choice.description}</span>
          </button>
        ))}
      </div>
      <p className="event-panel__feedback" role="status" aria-live="polite">
        {eventFeedback?.message}
      </p>
    </section>
  );
}
