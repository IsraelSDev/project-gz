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

const openSection = (label: string) =>
  act(() => screen.getByRole('button', { name: label }).click());

describe('GameHUD', () => {
  it('mantém recursos, população e controles de tempo na barra superior', () => {
    setup();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Civilização Alienígena');
    expect(
      within(screen.getByRole('list', { name: 'Recursos da colônia' })).getAllByRole('listitem'),
    ).toHaveLength(4);
    expect(screen.getByLabelText('População e capacidade').textContent).toContain('8/8');
    expect(screen.getByRole('button', { name: 'Retomar' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Sobrevivência' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Personagens e governo' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Como sobreviver' })).toBeNull();
    expect(screen.getByText(/Arrastar: girar/).textContent).toContain('W A S D');
  });

  it('abre uma única seção por vez e permite recolher o painel contextual', () => {
    setup();

    openSection('Diplomacia');
    expect(screen.getAllByRole('region', { name: 'Diplomacia' })).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Sobrevivência' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Personagens e governo' })).toBeNull();

    openSection('Diplomacia');
    expect(screen.queryByRole('complementary', { name: 'Painel da colônia' })).toBeNull();
  });

  it('abre os detalhes quando um edifício é selecionado e limpa a seleção pelo painel', () => {
    const { selection } = setup();
    act(() => selection.select('building-habitat-01'));

    expect(screen.getByRole('complementary', { name: 'Construção selecionada' })).toBeTruthy();
    expect(
      screen
        .getByRole('complementary', { name: 'Construção selecionada' })
        .textContent?.includes('Posição no grid'),
    ).toBe(true);
    act(() => screen.getByRole('button', { name: 'Limpar seleção' }).click());
    expect(selection.getSnapshot().selectedEntityId).toBeNull();
    expect(screen.getByRole('region', { name: 'Sobrevivência' })).toBeTruthy();
  });

  it('preserva nomeações de cargos pela seção de personagens e governo', () => {
    setup();
    openSection('Personagens e governo');
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

  it('mantém acessíveis construção, eventos, tutorial e salvamento pela navegação', () => {
    setup();

    openSection('Construção');
    expect(screen.getByRole('list', { name: 'Edifícios disponíveis' })).toBeTruthy();
    openSection('Eventos');
    expect(screen.getByText('Nenhum evento ativo no momento.')).toBeTruthy();
    openSection('Primeiros passos');
    expect(screen.getByRole('region', { name: 'Como sobreviver' })).toBeTruthy();
    act(() => screen.getByRole('button', { name: 'Fechar tutorial' }).click());
    expect(screen.getByRole('region', { name: 'Sobrevivência' })).toBeTruthy();
    openSection('Partida e salvamento');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Carregar' })).toBeTruthy();
  });
});
