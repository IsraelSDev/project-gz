// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';
import { EventPanel } from '@/presentation/game-ui/EventPanel';

afterEach(cleanup);

function setup(patch: Partial<GameState> = {}) {
  const state = createInitialGameState(INITIAL_SCENARIO);
  const active = {
    ...state,
    ...patch,
    events: state.events.map((event) =>
      event.eventId === 'wreck-signal' ? { ...event, status: 'active' as const } : event,
    ),
  };
  const controller = createGameController(active);
  render(<EventPanel controller={controller} />);
  return controller;
}

describe('EventPanel', () => {
  it('mostra título, descrição e escolhas com suas condições de recurso', () => {
    setup({ resources: { ...createInitialGameState(INITIAL_SCENARIO).resources, energy: 0 } });

    expect(screen.getByText('Um sinal entre os destroços')).toBeTruthy();
    expect(screen.getByText(/Um pulso repetido/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Responder ao sinal/ }).hasAttribute('disabled'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: /Desmontar o transmissor/ }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('envia uma única decisão e apresenta o resultado mecânico', () => {
    const controller = setup();

    fireEvent.click(screen.getByRole('button', { name: /Responder ao sinal/ }));

    expect(controller.getSnapshot().events[0]).toMatchObject({ status: 'resolved' });
    expect(screen.getByText(/A resposta localiza uma liga útil/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Responder ao sinal/ })).toBeNull();
  });

  it('ao jogar em andamento informa que a decisão aguarda o próximo tick', () => {
    const controller = setup();
    act(() => controller.clock.resume());
    fireEvent.click(screen.getByRole('button', { name: /Responder ao sinal/ }));

    expect(controller.getSnapshot().events[0]?.status).toBe('active');
    expect(
      screen.getByRole('button', { name: /Responder ao sinal/ }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('próximo tick');
  });
});
