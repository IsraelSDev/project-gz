// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import type { SaveProvider } from '@/game/application/ports/SaveProvider';
import { encodeGameSave } from '@/game/application/saveGame';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { SavePanel } from '@/presentation/game-ui/SavePanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(provider: SaveProvider, onStateReplaced = vi.fn()) {
  const initialState = createInitialGameState(INITIAL_SCENARIO);
  const controller = createGameController(initialState);
  render(
    <SavePanel
      controller={controller}
      provider={provider}
      initialState={initialState}
      onStateReplaced={onStateReplaced}
    />,
  );
  return { controller, initialState, onStateReplaced };
}

describe('SavePanel', () => {
  it('salva e informa sucesso', async () => {
    const write = vi.fn(async () => undefined);
    setup({ read: async () => null, write });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    });

    expect(write).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toBe('Partida salva.');
  });

  it('impede cliques duplicados enquanto o armazenamento responde', async () => {
    let finishWrite: (() => void) | undefined;
    const write = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        }),
    );
    setup({ read: async () => null, write });

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(write).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await act(async () => finishWrite?.());
    expect(screen.getByRole('status').textContent).toBe('Partida salva.');
  });

  it('carrega o salvamento e limpa a sessao visual', async () => {
    const savedState = createInitialGameState(INITIAL_SCENARIO);
    const onStateReplaced = vi.fn();
    const { controller } = setup(
      { read: async () => encodeGameSave(savedState), write: async () => undefined },
      onStateReplaced,
    );
    controller.clock.setSpeed(4);
    controller.clock.resume();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Carregar' }));
    });

    expect(controller.getSnapshot()).toEqual(savedState);
    expect(controller.clock.getSnapshot()).toEqual({ paused: true, speed: 1 });
    expect(onStateReplaced).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toContain('Partida carregada');
  });

  it('mantem a partida intacta se nao existir salvamento', async () => {
    const { controller } = setup({ read: async () => null, write: async () => undefined });
    const before = controller.getSnapshot();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Carregar' }));
    });

    expect(controller.getSnapshot()).toBe(before);
    expect(screen.getByRole('alert').textContent).toBe('Nenhuma partida salva foi encontrada.');
  });

  it('pede confirmacao antes de descartar progresso em nova partida', async () => {
    const initialState = createInitialGameState(INITIAL_SCENARIO);
    const { controller } = setup({ read: async () => null, write: async () => undefined });
    controller.clock.resume();
    controller.clock.advance(1_000);
    controller.clock.pause();
    const progressed = controller.getSnapshot();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    fireEvent.click(screen.getByRole('button', { name: 'Nova partida' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(controller.getSnapshot()).toBe(progressed);

    confirm.mockReturnValue(true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Nova partida' }));
    });

    expect(controller.getSnapshot()).toEqual(initialState);
    expect(screen.getByRole('status').textContent).toBe('Nova partida iniciada.');
  });
});
