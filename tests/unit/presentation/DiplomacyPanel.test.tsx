// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { explorePointCommand } from '@/game/domain/exploration/exploreCommand';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { DiplomacyPanel } from '@/presentation/game-ui/DiplomacyPanel';

afterEach(cleanup);

function setup() {
  const controller = createGameController(createInitialGameState(INITIAL_SCENARIO));
  render(<DiplomacyPanel controller={controller} />);
  return controller;
}

describe('DiplomacyPanel', () => {
  it('orienta a explorar quando nenhuma sociedade foi descoberta', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Diplomacia' }).textContent).toContain(
      'Explore pontos de interesse',
    );
  });

  it('mostra identidade inicial, oculta dados restritos e libera ações após primeiro contato', () => {
    const controller = setup();
    act(() => controller.submitCommand(explorePointCommand('crystal-spring')));

    expect(screen.getByRole('list', { name: 'Civilizações descobertas' }).textContent).toContain(
      'Comunidade Selari',
    );
    expect(screen.getByText(/Espécie:/).parentElement?.textContent).toContain('Selari');
    expect(screen.queryByText(/Governo:/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar contato' }));
    expect(screen.getByText(/Relação:/).parentElement?.textContent).toContain('Neutra');
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar informações' }));
    expect(screen.getByText(/Governo:/).parentElement?.textContent).toContain(
      'Assembleia de círculos',
    );
    expect(screen.getByText(/Informações solicitadas/)).toBeTruthy();
  });

  it('explica custo e exibe o resultado de presente e acordo', () => {
    const controller = setup();
    act(() => controller.submitCommand(explorePointCommand('crystal-spring')));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar contato' }));
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar informações' }));

    const materialsBefore = controller.getSnapshot().resources.materials;
    fireEvent.click(screen.getByRole('button', { name: /Oferecer presente/ }));
    expect(controller.getSnapshot().resources.materials).toBe(materialsBefore - 10);
    expect(
      screen.getByRole('button', { name: 'Presente já enviado' }).hasAttribute('disabled'),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Propor não agressão' }));
    expect(screen.getByText(/Pacto de não agressão:/).parentElement?.textContent).toContain(
      'Ativo',
    );
    expect(screen.getByRole('button', { name: 'Encerrar o pacto' })).toBeTruthy();
  });
});
