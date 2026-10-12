import type { GameController } from '@/game/application/GameController';

export interface SpacePauseKeyEvent {
  readonly code: string;
  readonly key: string;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  readonly target: EventTarget | null;
  preventDefault(): void;
}

type SpacePauseClock = Pick<GameController['clock'], 'getSnapshot' | 'pause' | 'resume'>;

/** Alterna a simulação com Espaço sem acionar o botão que estiver focado. */
export function handleSpacePauseShortcut(event: SpacePauseKeyEvent, clock: SpacePauseClock): void {
  if (
    (event.code !== 'Space' && event.key !== ' ') ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return;
  }
  const target = event.target;
  if (
    typeof HTMLElement !== 'undefined' &&
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  ) {
    return;
  }

  event.preventDefault();
  if (event.repeat) return;
  if (clock.getSnapshot().paused) {
    clock.resume();
  } else {
    clock.pause();
  }
}
