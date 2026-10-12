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
import { createSelectionStore } from '@/session/selectionStore';

afterEach(cleanup);

/*
 * A cada tick o snapshot muda, mas `resources` e `buildings` mantêm a referência. Como a HUD lê só
 * as fatias de que precisa, só o que mostra o tick re-renderiza: os outros ficam parados.
 */
describe('isolamento de renderização por fatia do estado', () => {
  it('a cada tick só os controles de tempo re-renderizam; a barra e o painel não', () => {
    const controller = createGameController(createInitialGameState(INITIAL_SCENARIO));
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
    act(() => controller.clock.resume());
    const barAfterMount = barRender.mock.calls.length;
    const panelAfterMount = panelRender.mock.calls.length;
    const timeBefore = timeRender.mock.calls.length;

    for (let second = 0; second < 5; second += 1) {
      act(() => {
        controller.clock.advance(1_000);
      });
    }

    expect(controller.getSnapshot().tick).toBe(5);
    expect(barRender).toHaveBeenCalledTimes(barAfterMount);
    expect(panelRender).toHaveBeenCalledTimes(panelAfterMount);
    expect(timeRender.mock.calls.length).toBeGreaterThan(timeBefore);
  });
});
