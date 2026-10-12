// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import type { SaveProvider } from '@/game/application/ports/SaveProvider';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { createBuildActions } from '@/presentation/build/buildActions';
import { GameHUD } from '@/presentation/game-ui/GameHUD';
import { createBuildStore } from '@/session/buildStore';
import { createSelectionStore } from '@/session/selectionStore';

afterEach(cleanup);

const setup = () => {
  const initialState = createInitialGameState(INITIAL_SCENARIO);
  const controller = createGameController(initialState);
  const saveProvider: SaveProvider = {
    read: async () => null,
    write: async () => undefined,
  };
  const selection = createSelectionStore();
  const build = createBuildStore();
  const buildActions = createBuildActions(controller, build);
  render(
    <GameHUD
      controller={controller}
      selection={selection}
      build={build}
      buildActions={buildActions}
      saveProvider={saveProvider}
      initialState={initialState}
      onStateReplaced={() => undefined}
    />,
  );
  return { controller, selection, build };
};

describe('GameHUD', () => {
  it('compõe título, barra de recursos, painel vazio e a dica de controles', () => {
    setup();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Civilização Alienígena');
    expect(
      within(screen.getByRole('list', { name: 'Recursos da colônia' })).getAllByRole('listitem'),
    ).toHaveLength(4);
    expect(screen.getByRole('complementary', { name: 'Construção selecionada' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Sobrevivência' }).textContent).toContain(
      'Sobreviventes8',
    );
    expect(screen.getByRole('region', { name: 'Sobrevivência' }).textContent).toContain('Abrigo8');
    expect(screen.getByRole('region', { name: 'Como sobreviver' })).toBeTruthy();
    expect(screen.getByText(/Arrastar: girar/).textContent).toContain('W A S D');
  });

  it('tem hierarquia de títulos coerente: h1 do jogo, h2 do painel e h3 do nome da construção', () => {
    const { selection } = setup();
    act(() => selection.select('building-habitat-01'));

    const levels = screen.getAllByRole('heading').map((heading) => heading.tagName);

    expect(levels).toEqual(['H1', 'H2', 'H2', 'H3', 'H2', 'H3', 'H3', 'H2', 'H2', 'H2', 'H3']);
  });

  it('só oferece controles que funcionam: o de limpar a seleção aparece apenas com uma seleção', () => {
    const { selection } = setup();
    const names = () => screen.getAllByRole('button').map((button) => button.textContent?.trim());
    // Controles de tempo e o botão "Construir" (o catálogo só aparece com o painel aberto).
    expect(names()).toContain('Retomar');
    expect(
      within(screen.getByRole('list', { name: 'Personagens importantes' })).getByRole('button', {
        name: /Aru Nuvem/,
      }),
    ).toBeTruthy();
    expect(names()).toContain('Remover');
    expect(names()).not.toContain('Limpar seleção');
    const controlsBeforeSelection = names().length;

    act(() => selection.select('building-habitat-01'));

    expect(screen.getByRole('button', { name: 'Limpar seleção' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(controlsBeforeSelection + 1);
  });

  it('seleciona personagem separadamente e executa nomeação e remoção pela interface', () => {
    setup();
    const roster = within(screen.getByRole('list', { name: 'Personagens importantes' }));
    act(() => roster.getByRole('button', { name: /Veli Faísca/ }).click());
    const roles = within(screen.getByRole('region', { name: 'Cargos governamentais' }));
    act(() => roles.getByRole('button', { name: 'Remover Ciência' }).click());
    expect(roles.getByText('Vago')).toBeTruthy();
    act(() => roles.getByRole('button', { name: 'Nomear Ciência' }).click());
    expect(roles.getByText('Veli Faísca')).toBeTruthy();
    expect(
      screen
        .getAllByRole('status')
        .some((status) => status.textContent?.includes('nomeado: Ciência')),
    ).toBe(true);
  });
});
