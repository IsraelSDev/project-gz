// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { RESOURCE_DEFINITIONS, RESOURCE_IDS } from '@/game/content/resources';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';
import { ResourceBar } from '@/presentation/hud/ResourceBar';
import { createFakeController, trackSubscriptions } from '../../support/storeDoubles';

afterEach(cleanup);

const format = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const initialState = () => createInitialGameState(INITIAL_SCENARIO);
const withResources = (resources: Record<string, number>): GameState =>
  ({ ...initialState(), resources }) as unknown as GameState;

/** Texto de cada recurso exibido, na ordem da barra: "<nome><valor>". */
function shownResources(): string[] {
  const list = screen.getByRole('list', { name: 'Recursos da colônia' });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

describe('ResourceBar', () => {
  it('exibe os recursos do snapshot com o nome do conteúdo e o valor formatado', () => {
    const state = initialState();
    render(<ResourceBar controller={createGameController(state)} />);

    expect(shownResources()).toEqual(
      RESOURCE_IDS.map((id) => `${RESOURCE_DEFINITIONS[id].name}${format(state.resources[id])}`),
    );
  });

  it('formata números grandes no padrão pt-BR (separador de milhar)', () => {
    render(
      <ResourceBar
        controller={createGameController(
          withResources({ food: 1234567, water: 1000, materials: 999, energy: 0 }),
        )}
      />,
    );

    expect(shownResources()).toEqual([
      'Alimentos1.234.567',
      'Água1.000',
      'Materiais999',
      'Energia0',
    ]);
  });

  it('não usa valores próprios: exibe exatamente o que o snapshot traz, não o cenário inicial', () => {
    const controller = createGameController(
      withResources({ food: 7, water: 8, materials: 9, energy: 10 }),
    );
    render(<ResourceBar controller={controller} />);

    expect(shownResources()).toEqual(['Alimentos7', 'Água8', 'Materiais9', 'Energia10']);
    const text = document.body.textContent ?? '';
    for (const initial of Object.values(INITIAL_SCENARIO.initialResources)) {
      expect(text).not.toContain(String(initial));
    }
  });

  it('acompanha um novo snapshot publicado pelo controlador, sem estado próprio', () => {
    const controller = createFakeController(initialState());
    render(<ResourceBar controller={controller} />);
    const before = shownResources();

    act(() => {
      controller.setState({
        ...controller.getSnapshot(),
        resources: { food: 11, water: 22, materials: 33, energy: 44 },
      });
    });

    expect(before).not.toEqual(shownResources());
    expect(shownResources()).toEqual(['Alimentos11', 'Água22', 'Materiais33', 'Energia44']);
  });

  it('exibe só os recursos que existem no estado, sem inventar os ausentes', () => {
    render(
      <ResourceBar
        controller={createGameController(withResources({ food: 5, water: 6, materials: 7 }))}
      />,
    );

    expect(shownResources()).toEqual(['Alimentos5', 'Água6', 'Materiais7']);
    expect(screen.queryByText('Energia')).toBeNull();
  });

  it('mostra um valor inválido como indisponível, nunca como NaN ou Infinity', () => {
    render(
      <ResourceBar
        controller={createGameController(
          withResources({
            food: Number.NaN,
            water: Number.POSITIVE_INFINITY,
            materials: 1,
            energy: 2,
          }),
        )}
      />,
    );

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/NaN|Infinity|∞/);
    expect(shownResources()[0]).toContain('indisponível');
    expect(shownResources()[1]).toContain('indisponível');
    expect(shownResources()[2]).toBe('Materiais1');
  });

  it('não tem controles: a barra só informa (nada que pareça funcionar sem implementação)', () => {
    render(<ResourceBar controller={createGameController(initialState())} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('remove a assinatura ao desmontar', () => {
    const controller = trackSubscriptions(createGameController(initialState()));
    const { unmount } = render(<ResourceBar controller={controller} />);
    expect(controller.activeSubscriptions()).toBe(1);

    unmount();

    expect(controller.activeSubscriptions()).toBe(0);
  });

  it('mantém uma única assinatura no StrictMode e a remove ao desmontar', () => {
    const controller = trackSubscriptions(createGameController(initialState()));
    const { unmount } = render(
      <StrictMode>
        <ResourceBar controller={controller} />
      </StrictMode>,
    );
    expect(controller.activeSubscriptions()).toBe(1);

    unmount();

    expect(controller.activeSubscriptions()).toBe(0);
  });
});
