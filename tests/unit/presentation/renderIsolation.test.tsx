// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { BuildingDetailsPanel } from '@/presentation/game-ui/BuildingDetailsPanel';
import { ResourceBar } from '@/presentation/hud/ResourceBar';
import { TimeControls } from '@/presentation/hud/TimeControls';
import { CharacterGovernmentPanel } from '@/presentation/game-ui/CharacterGovernmentPanel';
import { createSelectionStore } from '@/session/selectionStore';

afterEach(cleanup);

/*
 * A cada tick o snapshot muda, mas `buildings` mantém a referência e `resources` só muda quando a
 * economia altera algum estoque. Como a HUD lê só as fatias de que precisa, cada componente
 * re-renderiza apenas quando a SUA fatia muda: o painel nunca re-renderiza por tick, e a barra de
 * recursos só quando um valor muda.
 */
function mountHud(controller: ReturnType<typeof createGameController>) {
  const selection = createSelectionStore();
  const barRender = vi.fn();
  const panelRender = vi.fn();
  const timeRender = vi.fn();
  render(
    <>
      <Profiler id="bar" onRender={barRender}>
        <ResourceBar controller={controller} />
      </Profiler>
      <Profiler id="panel" onRender={panelRender}>
        <BuildingDetailsPanel controller={controller} selection={selection} />
      </Profiler>
      <Profiler id="time" onRender={timeRender}>
        <TimeControls controller={controller} />
      </Profiler>
    </>,
  );
  return { barRender, panelRender, timeRender };
}

const tickOnce = (controller: ReturnType<typeof createGameController>) =>
  act(() => {
    controller.clock.advance(1_000);
  });

describe('isolamento de renderização por fatia do estado', () => {
  it('com a economia rodando, a barra acompanha os valores que mudam; o painel e os controles seguem a sua própria fatia', () => {
    const controller = createGameController(createInitialGameState(INITIAL_SCENARIO));
    const { barRender, panelRender, timeRender } = mountHud(controller);
    act(() => controller.clock.resume());
    const barAfterMount = barRender.mock.calls.length;
    const panelAfterMount = panelRender.mock.calls.length;
    const timeBefore = timeRender.mock.calls.length;

    for (let second = 0; second < 5; second += 1) {
      tickOnce(controller);
    }

    expect(controller.getSnapshot().tick).toBe(5);
    // Os recursos mudam a cada passo (a economia roda): a barra re-renderiza uma vez por passo.
    expect(barRender.mock.calls.length - barAfterMount).toBe(5);
    // As construções não mudam: o painel não re-renderiza por causa dos ticks.
    expect(panelRender).toHaveBeenCalledTimes(panelAfterMount);
    expect(timeRender.mock.calls.length).toBeGreaterThan(timeBefore);
  });

  it('se nenhum estoque muda, nem a barra re-renderiza; só os controles de tempo', () => {
    const controller = createGameController({
      ...createInitialGameState(INITIAL_SCENARIO),
      buildings: [],
      resources: { food: 0, water: 0, materials: 150, energy: 100 },
    });
    const { barRender, panelRender, timeRender } = mountHud(controller);
    act(() => controller.clock.resume());
    const barAfterMount = barRender.mock.calls.length;
    const panelAfterMount = panelRender.mock.calls.length;
    const timeBefore = timeRender.mock.calls.length;

    for (let second = 0; second < 5; second += 1) {
      tickOnce(controller);
    }

    expect(controller.getSnapshot().tick).toBe(5);
    expect(barRender).toHaveBeenCalledTimes(barAfterMount);
    expect(panelRender).toHaveBeenCalledTimes(panelAfterMount);
    expect(timeRender.mock.calls.length).toBeGreaterThan(timeBefore);
  });

  it('pausado, nada re-renderiza, nem a barra', () => {
    const controller = createGameController(createInitialGameState(INITIAL_SCENARIO));
    const { barRender, panelRender, timeRender } = mountHud(controller);
    const counts = [barRender, panelRender, timeRender].map((spy) => spy.mock.calls.length);

    for (let second = 0; second < 5; second += 1) {
      tickOnce(controller);
    }

    expect([barRender, panelRender, timeRender].map((spy) => spy.mock.calls.length)).toEqual(
      counts,
    );
  });

  it('o painel de personagens não re-renderiza por tick sem mudança no elenco, governo ou população', () => {
    const controller = createGameController(createInitialGameState(INITIAL_SCENARIO));
    const characterPanelRender = vi.fn();
    render(
      <Profiler id="characters" onRender={characterPanelRender}>
        <CharacterGovernmentPanel controller={controller} />
      </Profiler>,
    );
    act(() => controller.clock.resume());
    const afterMount = characterPanelRender.mock.calls.length;

    for (let second = 0; second < 5; second += 1) tickOnce(controller);

    expect(controller.getSnapshot().tick).toBe(5);
    expect(characterPanelRender).toHaveBeenCalledTimes(afterMount);
  });
});
