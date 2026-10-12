// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { GameHUD } from '@/presentation/game-ui/GameHUD';
import { createSelectionStore } from '@/session/selectionStore';

afterEach(cleanup);

const setup = () => {
  const controller = createGameController(createInitialGameState(INITIAL_SCENARIO));
  const selection = createSelectionStore();
  render(<GameHUD controller={controller} selection={selection} />);
  return { controller, selection };
};

describe('GameHUD', () => {
  it('compõe título, barra de recursos, painel vazio e a dica de controles', () => {
    setup();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Civilização Alienígena');
    expect(
      within(screen.getByRole('list', { name: 'Recursos da colônia' })).getAllByRole('listitem'),
    ).toHaveLength(4);
    expect(screen.getByRole('complementary', { name: 'Construção selecionada' })).toBeTruthy();
    expect(screen.getByText(/Arrastar: girar/).textContent).toContain('W A S D');
  });

  it('tem hierarquia de títulos coerente: h1 do jogo, h2 do painel e h3 do nome da construção', () => {
    const { selection } = setup();
    act(() => selection.select('building-habitat-01'));

    const levels = screen.getAllByRole('heading').map((heading) => heading.tagName);

    expect(levels).toEqual(['H1', 'H2', 'H3']);
  });

  it('só oferece controles que funcionam: o de limpar a seleção aparece apenas com uma seleção', () => {
    const { selection } = setup();
    const names = () => screen.getAllByRole('button').map((button) => button.textContent?.trim());
    expect(names()).toEqual(['Retomar', '1×', '2×', '4×']);

    act(() => selection.select('building-habitat-01'));

    expect(screen.getByRole('button', { name: 'Limpar seleção' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });
});
