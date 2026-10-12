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
import { expectedResourcesAfter } from '../../support/economyExpectations';
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

  // Estes dois casos usam o dublê de leitura: o controlador real recusa um estado inicial inválido.
  it('exibe só os recursos que existem no estado, sem inventar os ausentes', () => {
    render(
      <ResourceBar
        controller={createFakeController(withResources({ food: 5, water: 6, materials: 7 }))}
      />,
    );

    expect(shownResources()).toEqual(['Alimentos5', 'Água6', 'Materiais7']);
    expect(screen.queryByText('Energia')).toBeNull();
  });

  it('mostra um valor inválido como indisponível, nunca como NaN ou Infinity', () => {
    render(
      <ResourceBar
        controller={createFakeController(
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

describe('ResourceBar: acompanha a economia da simulação (Fase 5)', () => {
  const expectedText = (resources: Record<string, number>) =>
    RESOURCE_IDS.map((id) => `${RESOURCE_DEFINITIONS[id].name}${format(resources[id] ?? NaN)}`);

  it('mostra o estado real a cada passo, igual ao snapshot e ao previsto pelas definições', () => {
    const controller = createGameController(initialState());
    render(<ResourceBar controller={controller} />);
    const atStart = shownResources();
    act(() => controller.clock.resume());

    act(() => {
      controller.clock.advance(3_000);
    });

    expect(shownResources()).toEqual(expectedText(controller.getSnapshot().resources));
    expect(shownResources()).toEqual(expectedText(expectedResourcesAfter(3)));
    expect(shownResources()).not.toEqual(atStart);
  });

  it('atualiza a cada passo, não só no final', () => {
    const controller = createGameController(initialState());
    render(<ResourceBar controller={controller} />);
    act(() => controller.clock.resume());

    const seen: string[][] = [];
    for (let tick = 1; tick <= 3; tick += 1) {
      act(() => {
        controller.clock.advance(1_000);
      });
      seen.push(shownResources());
    }

    expect(new Set(seen.map((texts) => texts.join('|'))).size).toBe(3);
    expect(seen[2]).toEqual(expectedText(expectedResourcesAfter(3)));
  });

  it('com o jogo pausado, o tempo passa e a barra não muda', () => {
    const controller = createGameController(initialState());
    render(<ResourceBar controller={controller} />);
    const atStart = shownResources();

    act(() => {
      controller.clock.advance(60_000);
    });

    expect(shownResources()).toEqual(atStart);
    expect(shownResources()).toEqual(expectedText(INITIAL_SCENARIO.initialResources));
  });

  it('pausar no meio congela os valores exibidos; retomar continua deles', () => {
    const controller = createGameController(initialState());
    render(<ResourceBar controller={controller} />);
    act(() => controller.clock.resume());
    act(() => {
      controller.clock.advance(2_000);
    });
    act(() => controller.clock.pause());
    const frozen = shownResources();

    act(() => {
      controller.clock.advance(20_000);
    });
    expect(shownResources()).toEqual(frozen);

    act(() => controller.clock.resume());
    act(() => {
      controller.clock.advance(1_000);
    });
    expect(shownResources()).toEqual(expectedText(expectedResourcesAfter(3)));
  });

  it('sem edifícios não há economia: os valores seguem iguais mesmo com a simulação em andamento', () => {
    const controller = createGameController({ ...initialState(), buildings: [] });
    render(<ResourceBar controller={controller} />);
    const atStart = shownResources();
    act(() => controller.clock.resume());

    act(() => {
      controller.clock.advance(5_000);
    });

    expect(controller.getSnapshot().tick).toBe(5);
    expect(shownResources()).toEqual(atStart);
  });
});
