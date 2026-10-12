// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { TimeControls } from '@/presentation/hud/TimeControls';
import { trackSubscriptions } from '../../support/storeDoubles';

afterEach(cleanup);

const createController = () => createGameController(createInitialGameState(INITIAL_SCENARIO));

const group = () => screen.getByRole('group', { name: 'Velocidade da simulação' });
const speedButton = (label: string) => within(group()).getByRole('button', { name: label });
const toggle = () => screen.getByRole('button', { name: /^(Retomar|Pausar)$/ });
const tickText = () => document.querySelector('.time-controls__tick-value')?.textContent;
const statusChip = () => document.querySelector('.time-controls__status');

describe('TimeControls', () => {
  it('reflete o relógio real ao abrir: pausado, tick 0 e 1x ativo', () => {
    render(<TimeControls controller={createController()} />);

    expect(statusChip()?.textContent).toBe('Pausado');
    expect(statusChip()?.getAttribute('data-state')).toBe('paused');
    expect(tickText()).toBe('0');
    expect(toggle().textContent).toBe('Retomar');
    expect(speedButton('1×').getAttribute('aria-pressed')).toBe('true');
    expect(speedButton('2×').getAttribute('aria-pressed')).toBe('false');
    expect(speedButton('4×').getAttribute('aria-pressed')).toBe('false');
  });

  it('oferece exatamente as velocidades 1x, 2x e 4x', () => {
    render(<TimeControls controller={createController()} />);

    const labels = within(group())
      .getAllByRole('button')
      .map((button) => button.textContent);

    expect(labels).toEqual(['1×', '2×', '4×']);
  });

  it('retomar e pausar pelo botão atuam no relógio, e a interface acompanha', () => {
    const controller = createController();
    render(<TimeControls controller={controller} />);

    fireEvent.click(toggle());

    expect(controller.clock.getSnapshot().paused).toBe(false);
    expect(statusChip()?.textContent).toBe('Em andamento');
    expect(statusChip()?.getAttribute('data-state')).toBe('running');
    expect(toggle().textContent).toBe('Pausar');

    fireEvent.click(toggle());

    expect(controller.clock.getSnapshot().paused).toBe(true);
    expect(statusChip()?.textContent).toBe('Pausado');
  });

  it('escolher a velocidade atua no relógio e marca o botão ativo', () => {
    const controller = createController();
    render(<TimeControls controller={controller} />);

    fireEvent.click(speedButton('4×'));

    expect(controller.clock.getSnapshot().speed).toBe(4);
    expect(speedButton('4×').getAttribute('aria-pressed')).toBe('true');
    expect(speedButton('1×').getAttribute('aria-pressed')).toBe('false');
  });

  it('os controles funcionam com o jogo pausado e não retomam a simulação', () => {
    const controller = createController();
    render(<TimeControls controller={controller} />);

    fireEvent.click(speedButton('2×'));

    expect(controller.clock.getSnapshot()).toEqual({ paused: true, speed: 2 });
    expect(tickText()).toBe('0');
  });

  it('não guarda cópia: mudanças feitas direto no relógio aparecem na interface', () => {
    const controller = createController();
    render(<TimeControls controller={controller} />);

    act(() => {
      controller.clock.resume();
      controller.clock.setSpeed(4);
    });

    expect(statusChip()?.textContent).toBe('Em andamento');
    expect(speedButton('4×').getAttribute('aria-pressed')).toBe('true');
    expect(toggle().textContent).toBe('Pausar');
  });

  it('mostra o tick real do estado, que só avança quando passos são executados', () => {
    const controller = createController();
    render(<TimeControls controller={controller} />);

    act(() => controller.clock.advance(10_000)); // pausado: nada avança
    expect(tickText()).toBe('0');

    act(() => controller.clock.resume());
    act(() => {
      controller.clock.advance(3_000);
    });
    expect(tickText()).toBe('3');

    act(() => controller.clock.pause());
    act(() => {
      controller.clock.advance(5_000);
    });
    expect(tickText()).toBe('3');
  });

  it('formata o tick com separador de milhar (pt-BR)', () => {
    const controller = createGameController({
      ...createInitialGameState(INITIAL_SCENARIO),
      tick: 12_345,
    });
    render(<TimeControls controller={controller} />);

    expect(tickText()).toBe('12.345');
  });

  it('anuncia o estado do relógio para leitores de tela', () => {
    const controller = createController();
    render(<TimeControls controller={controller} />);
    const status = () => screen.getByRole('status').textContent;
    expect(status()).toBe('Simulação pausada.');

    act(() => {
      controller.clock.resume();
      controller.clock.setSpeed(2);
    });

    expect(status()).toBe('Simulação em andamento a 2×.');
  });

  it('tem região com nome, grupo de velocidade e botões com nomes acessíveis e foco de teclado', () => {
    render(<TimeControls controller={createController()} />);

    expect(screen.getByRole('region', { name: 'Tempo da simulação' })).toBeTruthy();
    for (const button of screen.getAllByRole('button')) {
      expect(button.getAttribute('type')).toBe('button');
      expect(button.tabIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('remove as assinaturas do estado e do relógio ao desmontar', () => {
    const real = createController();
    const controller = {
      ...trackSubscriptions(real),
      clock: trackSubscriptions(real.clock),
    };
    const { unmount } = render(<TimeControls controller={controller} />);
    expect(controller.activeSubscriptions()).toBe(1);
    expect(controller.clock.activeSubscriptions()).toBe(1);

    unmount();

    expect(controller.activeSubscriptions()).toBe(0);
    expect(controller.clock.activeSubscriptions()).toBe(0);
  });

  it('mantém uma assinatura de cada no StrictMode e as remove ao desmontar', () => {
    const real = createController();
    const controller = {
      ...trackSubscriptions(real),
      clock: trackSubscriptions(real.clock),
    };
    const { unmount } = render(
      <StrictMode>
        <TimeControls controller={controller} />
      </StrictMode>,
    );
    expect(controller.activeSubscriptions()).toBe(1);
    expect(controller.clock.activeSubscriptions()).toBe(1);

    unmount();

    expect(controller.activeSubscriptions()).toBe(0);
    expect(controller.clock.activeSubscriptions()).toBe(0);
  });
});
