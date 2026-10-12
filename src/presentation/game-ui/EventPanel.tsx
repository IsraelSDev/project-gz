import { useEffect, useState } from 'react';
import { selectVisibleEvents } from '@/game/application/eventSelectors';
import { resolveEvent, RESOLVE_EVENT_TYPE } from '@/game/application/eventUseCases';
import type { GameController } from '@/game/application/GameController';
import { describeError } from '@/presentation/build/buildMessages';
import { useGameSelector } from '@/presentation/hooks/useGameSelector';

export interface EventPanelProps {
  readonly controller: GameController;
}

export function EventPanel({ controller }: EventPanelProps) {
  const events = useGameSelector(controller, (snapshot) => snapshot.events);
  const resources = useGameSelector(controller, (snapshot) => snapshot.resources);
  const visible = selectVisibleEvents({ events, resources });
  const [feedback, setFeedback] = useState<{ readonly eventId: string; readonly text: string }>();
  const [pendingEventId, setPendingEventId] = useState<string>();

  useEffect(
    () =>
      controller.subscribeRejections((rejection) => {
        if (rejection.command.type !== RESOLVE_EVENT_TYPE) return;
        const command = rejection.command as { readonly eventId?: unknown };
        if (typeof command.eventId !== 'string') return;
        setPendingEventId((pending) => (pending === command.eventId ? undefined : pending));
        setFeedback({ eventId: command.eventId, text: describeError(rejection.error) });
      }),
    [controller],
  );

  if (visible.length === 0) return null;

  return (
    <section className="hud-panel event-panel" aria-label="Eventos da colônia">
      {visible.map((event) => (
        <article key={event.id} data-event-status={event.status}>
          <header className="hud-panel__header">
            <h2 className="hud-panel__title">
              {event.status === 'active' ? 'Evento em andamento' : 'Evento resolvido'}
            </h2>
          </header>
          <h3 className="event-panel__title">{event.title}</h3>
          <p className="event-panel__description">{event.description}</p>
          {event.status === 'active' ? (
            <div className="event-panel__options">
              {event.options.map((option) => (
                <button
                  className="event-option"
                  key={option.id}
                  type="button"
                  disabled={!option.affordable || pendingEventId === event.id}
                  onClick={() => {
                    const result = resolveEvent(controller, event.id, option.id);
                    if (result.ok) {
                      if (result.value === 'queued') setPendingEventId(event.id);
                      setFeedback({
                        eventId: event.id,
                        text:
                          result.value === 'queued'
                            ? 'Decisão enviada; será aplicada no próximo tick.'
                            : '',
                      });
                    } else {
                      setFeedback({ eventId: event.id, text: describeError(result.error) });
                    }
                  }}
                >
                  <span className="event-option__label">{option.label}</span>
                  <span className="event-option__description">{option.description}</span>
                </button>
              ))}
              {feedback?.eventId === event.id && feedback.text && (
                <p className="event-panel__feedback" role="status">
                  {feedback.text}
                </p>
              )}
            </div>
          ) : (
            <p className="event-panel__result" role="status">
              {event.result}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
