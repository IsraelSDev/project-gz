// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';
import { BuildingDetailsPanel } from '@/presentation/game-ui/BuildingDetailsPanel';
import { createSelectionStore } from '@/session/selectionStore';
import { createFakeController, trackSubscriptions } from '../../support/storeDoubles';

afterEach(cleanup);

const initialState = () => createInitialGameState(INITIAL_SCENARIO);
const EMPTY_MESSAGE = 'Selecione uma construção para consultar suas informações.';

const panel = () => screen.getByRole('complementary', { name: 'Construção selecionada' });
const buildingName = () => within(panel()).queryByRole('heading', { level: 3 })?.textContent;

/** Valor mostrado para um rótulo do painel (par `dt`/`dd`). */
function factOf(label: string): string | null {
  const term = within(panel())
    .queryAllByText(label)
    .find((element) => element.tagName === 'DT');
  return term?.nextElementSibling?.textContent ?? null;
}

describe('BuildingDetailsPanel', () => {
  it('sem seleção, mostra o estado vazio e nenhum controle', () => {
    render(
      <BuildingDetailsPanel
        controller={createGameController(initialState())}
        selection={createSelectionStore()}
      />,
    );

    expect(within(panel()).getByText(EMPTY_MESSAGE)).toBeTruthy();
    expect(buildingName()).toBeUndefined();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('status').textContent).toBe('Nenhuma construção selecionada.');
  });

  it('ao selecionar uma construção, mostra as informações dela', () => {
    const selection = createSelectionStore();
    render(
      <BuildingDetailsPanel
        controller={createGameController(initialState())}
        selection={selection}
      />,
    );

    act(() => selection.select('building-habitat-01'));

    expect(buildingName()).toBe('Módulo Habitacional');
    expect(within(panel()).getByText('Abrigo')).toBeTruthy();
    expect(factOf('Posição no grid')).toBe('x 14 · y 20');
    expect(factOf('Área ocupada')).toBe('3 × 3 células');
    expect(factOf('Rotação')).toBe('0°');
    expect(factOf('Identificador')).toBe('building-habitat-01');
    expect(within(panel()).queryByText(EMPTY_MESSAGE)).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Selecionado: Módulo Habitacional.');
  });

  it('ao trocar a seleção, atualiza o painel com a outra construção', () => {
    const selection = createSelectionStore();
    render(
      <BuildingDetailsPanel
        controller={createGameController(initialState())}
        selection={selection}
      />,
    );

    act(() => selection.select('building-habitat-01'));
    act(() => selection.select('building-solar-01'));

    expect(buildingName()).toBe('Matriz Solar');
    expect(within(panel()).getByText('Infraestrutura')).toBeTruthy();
    expect(factOf('Posição no grid')).toBe('x 23 · y 23');
    // 3x2 girada em 90°: ocupa 2 células em x e 3 em y.
    expect(factOf('Área ocupada')).toBe('2 × 3 células');
    expect(factOf('Rotação')).toBe('90°');
    expect(factOf('Identificador')).toBe('building-solar-01');
    expect(within(panel()).queryByText('Módulo Habitacional')).toBeNull();
  });

  it('volta ao estado vazio quando a seleção é limpa', () => {
    const selection = createSelectionStore();
    render(
      <BuildingDetailsPanel
        controller={createGameController(initialState())}
        selection={selection}
      />,
    );
    act(() => selection.select('building-extractor-01'));
    expect(buildingName()).toBe('Extrator de Água');

    act(() => selection.clear());

    expect(buildingName()).toBeUndefined();
    expect(within(panel()).getByText(EMPTY_MESSAGE)).toBeTruthy();
  });

  it('lê os dados do snapshot: um novo estado do controlador atualiza o painel', () => {
    const state = initialState();
    const controller = createFakeController(state);
    const selection = createSelectionStore();
    render(<BuildingDetailsPanel controller={controller} selection={selection} />);
    act(() => selection.select('building-habitat-01'));
    expect(factOf('Posição no grid')).toBe('x 14 · y 20');

    act(() => {
      controller.setState({
        ...state,
        buildings: state.buildings.map((building) =>
          building.instanceId === 'building-habitat-01'
            ? { ...building, position: { x: 17, y: 25 }, rotation: 180 }
            : building,
        ),
      });
    });

    expect(factOf('Posição no grid')).toBe('x 17 · y 25');
    expect(factOf('Rotação')).toBe('180°');
  });

  it('não altera o GameState ao selecionar, trocar ou limpar', () => {
    const controller = createGameController(initialState());
    const selection = createSelectionStore();
    const before = controller.getSnapshot();
    const serialized = JSON.stringify(before);
    render(<BuildingDetailsPanel controller={controller} selection={selection} />);

    act(() => selection.select('building-habitat-01'));
    act(() => selection.select('building-solar-01'));
    act(() => selection.clear());

    expect(controller.getSnapshot()).toBe(before);
    expect(JSON.stringify(controller.getSnapshot())).toBe(serialized);
    expect(Object.keys(controller.getSnapshot())).not.toContain('selectedEntityId');
    expect(serialized).not.toContain('selected');
  });

  describe('seleção inválida', () => {
    it('um identificador inexistente mostra o estado vazio, limpa a seleção e não lança erro', () => {
      const selection = createSelectionStore();
      render(
        <BuildingDetailsPanel
          controller={createGameController(initialState())}
          selection={selection}
        />,
      );

      expect(() => act(() => selection.select('nao-existe'))).not.toThrow();

      expect(buildingName()).toBeUndefined();
      expect(within(panel()).getByText(EMPTY_MESSAGE)).toBeTruthy();
      expect(selection.getSnapshot().selectedEntityId).toBeNull();
    });

    it('limpa uma única vez, sem laço de atualização entre o React e o store (nem no StrictMode)', () => {
      const selection = createSelectionStore();
      const listener = vi.fn();
      selection.subscribe(listener);
      render(
        <StrictMode>
          <BuildingDetailsPanel
            controller={createGameController(initialState())}
            selection={selection}
          />
        </StrictMode>,
      );

      act(() => selection.select('nao-existe'));

      // Uma notificação para selecionar e uma para limpar: nada além disso.
      expect(listener).toHaveBeenCalledTimes(2);
      expect(selection.getSnapshot().selectedEntityId).toBeNull();
    });

    it('uma seleção que deixa de existir no estado volta ao estado vazio e é limpa', () => {
      const state = initialState();
      const controller = createFakeController(state);
      const selection = createSelectionStore();
      render(<BuildingDetailsPanel controller={controller} selection={selection} />);
      act(() => selection.select('building-solar-01'));
      expect(buildingName()).toBe('Matriz Solar');

      act(() => {
        controller.setState({
          ...state,
          buildings: state.buildings.filter(
            (building) => building.instanceId !== 'building-solar-01',
          ),
        });
      });

      expect(buildingName()).toBeUndefined();
      expect(within(panel()).getByText(EMPTY_MESSAGE)).toBeTruthy();
      expect(selection.getSnapshot().selectedEntityId).toBeNull();
    });

    it('seleção em um estado sem nenhuma construção não lança erro', () => {
      const empty: GameState = { ...initialState(), buildings: [] };
      const selection = createSelectionStore();
      render(
        <BuildingDetailsPanel controller={createGameController(empty)} selection={selection} />,
      );

      expect(() => act(() => selection.select('building-habitat-01'))).not.toThrow();

      expect(selection.getSnapshot().selectedEntityId).toBeNull();
    });
  });

  describe('controle de fechar', () => {
    it('limpa a seleção, avisa que foi fechado e volta ao estado vazio', () => {
      const selection = createSelectionStore();
      const onDismissed = vi.fn();
      render(
        <BuildingDetailsPanel
          controller={createGameController(initialState())}
          selection={selection}
          onDismissed={onDismissed}
        />,
      );
      act(() => selection.select('building-habitat-01'));

      fireEvent.click(screen.getByRole('button', { name: 'Limpar seleção' }));

      expect(selection.getSnapshot().selectedEntityId).toBeNull();
      expect(onDismissed).toHaveBeenCalledOnce();
      expect(within(panel()).getByText(EMPTY_MESSAGE)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Limpar seleção' })).toBeNull();
    });
  });

  describe('acessibilidade', () => {
    it('é uma região complementar com nome e organiza as informações em uma lista de descrição', () => {
      const selection = createSelectionStore();
      const { container } = render(
        <BuildingDetailsPanel
          controller={createGameController(initialState())}
          selection={selection}
        />,
      );
      act(() => selection.select('building-habitat-01'));

      expect(panel()).toBeTruthy();
      expect(within(panel()).getByRole('heading', { level: 2 }).textContent).toBe(
        'Construção selecionada',
      );
      const terms = [...container.querySelectorAll('dl dt')].map((term) => term.textContent);
      expect(terms).toEqual(['Posição no grid', 'Área ocupada', 'Rotação', 'Identificador']);
      expect(container.querySelectorAll('dl dd')).toHaveLength(terms.length);
    });

    it('o botão de fechar tem nome acessível e é alcançável pelo teclado', () => {
      const selection = createSelectionStore();
      render(
        <BuildingDetailsPanel
          controller={createGameController(initialState())}
          selection={selection}
        />,
      );
      act(() => selection.select('building-habitat-01'));

      const button = screen.getByRole('button', { name: 'Limpar seleção' });

      expect(button.getAttribute('type')).toBe('button');
      expect(button.tabIndex).toBeGreaterThanOrEqual(0);
    });
  });

  describe('assinaturas', () => {
    it('remove as assinaturas do controlador e do store ao desmontar', () => {
      const controller = trackSubscriptions(createGameController(initialState()));
      const selection = trackSubscriptions(createSelectionStore());
      const { unmount } = render(
        <BuildingDetailsPanel controller={controller} selection={selection} />,
      );
      expect(controller.activeSubscriptions()).toBe(1);
      expect(selection.activeSubscriptions()).toBe(1);

      unmount();

      expect(controller.activeSubscriptions()).toBe(0);
      expect(selection.activeSubscriptions()).toBe(0);
    });

    it('mantém uma assinatura de cada no StrictMode e as remove ao desmontar', () => {
      const controller = trackSubscriptions(createGameController(initialState()));
      const selection = trackSubscriptions(createSelectionStore());
      const { unmount } = render(
        <StrictMode>
          <BuildingDetailsPanel controller={controller} selection={selection} />
        </StrictMode>,
      );
      expect(controller.activeSubscriptions()).toBe(1);
      expect(selection.activeSubscriptions()).toBe(1);

      unmount();

      expect(controller.activeSubscriptions()).toBe(0);
      expect(selection.activeSubscriptions()).toBe(0);
    });

    it('um store limpo depois de desmontar não tenta atualizar o componente', () => {
      const selection = createSelectionStore();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { unmount } = render(
        <BuildingDetailsPanel
          controller={createGameController(initialState())}
          selection={selection}
        />,
      );
      unmount();

      expect(() => {
        selection.select('building-habitat-01');
        selection.clear();
      }).not.toThrow();
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });
});
