// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createSimulationClock } from '@/game/application/time/SimulationClock';
import { handleSpacePauseShortcut, type SpacePauseKeyEvent } from '@/app/spacePauseShortcut';

function setupEvent(overrides: Partial<SpacePauseKeyEvent> = {}) {
  const preventDefault = vi.fn();
  const event: SpacePauseKeyEvent = {
    code: 'Space',
    key: ' ',
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    repeat: false,
    target: document.createElement('button'),
    preventDefault,
    ...overrides,
  };
  return { event, preventDefault };
}

const createClock = () => createSimulationClock({ onStep: () => undefined });

describe('atalho de pausa com Espaço', () => {
  it('retoma o jogo e preserva a velocidade selecionada', () => {
    const clock = createClock();
    clock.setSpeed(4);
    const { event, preventDefault } = setupEvent();

    handleSpacePauseShortcut(event, clock);

    expect(clock.getSnapshot()).toEqual({ paused: false, speed: 4 });
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('pausa o jogo e preserva a velocidade selecionada', () => {
    const clock = createClock();
    clock.setSpeed(2);
    clock.resume();
    const { event } = setupEvent();

    handleSpacePauseShortcut(event, clock);

    expect(clock.getSnapshot()).toEqual({ paused: true, speed: 2 });
  });

  it('previne ativar o botão focado, mas ignora repetição da tecla segurada', () => {
    const clock = createClock();
    const { event, preventDefault } = setupEvent({ repeat: true });

    handleSpacePauseShortcut(event, clock);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(clock.getSnapshot()).toEqual({ paused: true, speed: 1 });
  });

  it.each([
    ['outra tecla', { code: 'KeyA', key: 'a' }],
    ['Ctrl', { ctrlKey: true }],
    ['Alt', { altKey: true }],
    ['Meta', { metaKey: true }],
    ['campo de texto', { target: document.createElement('input') }],
    [
      'área editável',
      { target: Object.assign(document.createElement('div'), { isContentEditable: true }) },
    ],
  ])('não intercepta %s', (_name, overrides) => {
    const clock = createClock();
    const { event, preventDefault } = setupEvent(overrides);

    handleSpacePauseShortcut(event, clock);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(clock.getSnapshot()).toEqual({ paused: true, speed: 1 });
  });
});
