// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { placeBuilding } from '@/game/application/constructionUseCases';
import { BUILDING_DEFINITIONS } from '@/game/content/buildings';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';
import { createBuildActions } from '@/presentation/build/buildActions';
import { BuildPanel } from '@/presentation/build/BuildPanel';
import { ERROR_MESSAGES } from '@/presentation/build/buildMessages';
import { createBuildStore } from '@/session/buildStore';

afterEach(cleanup);

const START = INITIAL_SCENARIO.initialResources;
// Células apontadas (o edifício fica centrado nelas): livre, sobre a nave, sobre o habitat, fora da área.
const FREE = { x: 25, y: 14 };
const ON_SHIP = { x: 18, y: 15 };
const ON_HABITAT = { x: 15, y: 21 };
const OUTSIDE = { x: 2, y: 2 };

function setup(patch: Partial<GameState['resources']> = {}) {
  const state = createInitialGameState(INITIAL_SCENARIO);
  const controller = createGameController({
    ...state,
    resources: { ...state.resources, ...patch },
  });
  const build = createBuildStore();
  const actions = createBuildActions(controller, build);
  render(<BuildPanel controller={controller} build={build} actions={actions} />);
  return { controller, build, actions };
}

const toggle = () => screen.getByRole('button', { name: /^(Construir|Fechar construção)$/ });
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Construir' }));
const item = (name: RegExp) => screen.getByRole('button', { name });
const status = () => document.querySelector('.build-placement__status')?.textContent ?? '';
const feedback = () => document.querySelector('.build-panel__feedback')?.textContent ?? '';
const confirmButton = () => screen.queryByRole('button', { name: 'Confirmar construção' });
const buildingCount = (controller: { getSnapshot: () => GameState }) =>
  controller.getSnapshot().buildings.length;
const INITIAL_COUNT = INITIAL_SCENARIO.initialBuildings.length;

describe('BuildPanel: abrir e fechar', () => {
  it('começa fechado, só com o botão "Construir"', () => {
    setup();

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Edifícios disponíveis' })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('abrir mostra o catálogo e liga o botão ao conteúdo que ele controla', () => {
    setup();

    open();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    const bodyId = toggle().getAttribute('aria-controls');
    expect(bodyId).toBeTruthy();
    expect(document.getElementById(bodyId ?? '')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Edifícios disponíveis' })).toBeTruthy();
  });

  it('fechar com um edifício em posicionamento cancela o posicionamento', () => {
    const { build } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));
    act(() => build.hover(FREE));

    fireEvent.click(toggle());

    expect(build.getSnapshot().definitionId).toBeNull();
    expect(screen.queryByRole('list', { name: 'Edifícios disponíveis' })).toBeNull();
  });
});

describe('BuildPanel: catálogo, custos e disponibilidade', () => {
  it('lista todos os edifícios do conteúdo, com o tamanho e o custo', () => {
    setup();
    open();

    const catalog = within(screen.getByRole('list', { name: 'Edifícios disponíveis' }));
    const items = catalog.getAllByRole('listitem');

    expect(items).toHaveLength(Object.keys(BUILDING_DEFINITIONS).length);
    for (const definition of Object.values(BUILDING_DEFINITIONS)) {
      const text = items
        .map((entry) => entry.textContent)
        .find((t) => t?.includes(definition.name));
      expect(text, definition.name).toBeTruthy();
      expect(text).toContain(
        `${definition.footprint.width} × ${definition.footprint.depth} células`,
      );
    }
    expect(item(/Matriz Solar/).textContent).toContain(
      `Materiais ${BUILDING_DEFINITIONS['solar-array'].cost.materials}`,
    );
    expect(item(/Estufa Hidropônica/).textContent).toMatch(/Água 30 · Materiais 40/);
  });

  it('os custos vêm do conteúdo: nada é digitado na interface', () => {
    setup();
    open();

    for (const definition of Object.values(BUILDING_DEFINITIONS)) {
      for (const [id, amount] of Object.entries(definition.cost)) {
        const resourceName = {
          food: 'Alimentos',
          water: 'Água',
          materials: 'Materiais',
          energy: 'Energia',
        }[id];
        const element = screen.getByRole('button', { name: new RegExp(definition.name) });
        expect(element.textContent).toContain(`${resourceName} ${amount}`);
      }
    }
  });

  it('com recursos suficientes ninguém é marcado como inacessível', () => {
    setup();
    open();

    expect(screen.queryByText('Recursos insuficientes agora')).toBeNull();
  });

  it('o que não cabe no estoque diz isso em TEXTO (não só pela cor)', () => {
    setup({ materials: 35 });
    open();

    // 35 de materiais: a matriz solar (30) cabe; o habitat (80) não.
    expect(
      within(item(/Módulo Habitacional/)).getByText('Recursos insuficientes agora'),
    ).toBeTruthy();
    expect(within(item(/Matriz Solar/)).queryByText('Recursos insuficientes agora')).toBeNull();
    expect(item(/Módulo Habitacional/).getAttribute('data-affordable')).toBe('false');
  });

  it('o catálogo acompanha o estoque real: gastar recursos atualiza a disponibilidade', () => {
    const { controller } = setup({ materials: 80 });
    open();
    expect(
      within(item(/Módulo Habitacional/)).queryByText('Recursos insuficientes agora'),
    ).toBeNull();

    // Um comando gasta materiais fora do painel (o painel só lê o estado).
    act(() => {
      placeBuilding(controller, {
        definitionId: 'solar-array',
        position: { x: 24, y: 13 },
        rotation: 0,
      });
    });

    expect(
      within(item(/Módulo Habitacional/)).getByText('Recursos insuficientes agora'),
    ).toBeTruthy();
  });
});

describe('BuildPanel: posicionar e a prévia', () => {
  it('escolher um edifício o marca (aria-pressed) e pede para apontar o terreno', () => {
    const { build } = setup();
    open();

    fireEvent.click(item(/Matriz Solar/));

    expect(item(/Matriz Solar/).getAttribute('aria-pressed')).toBe('true');
    expect(item(/Extrator de Água/).getAttribute('aria-pressed')).toBe('false');
    expect(build.getSnapshot().definitionId).toBe('solar-array');
    expect(status()).toContain('Aponte para o terreno');
    expect(confirmButton()?.hasAttribute('disabled')).toBe(true);
  });

  it('sem edifício escolhido, orienta o jogador e não oferece confirmar', () => {
    setup();
    open();

    expect(screen.getByText('Escolha um edifício para ver a prévia no terreno.')).toBeTruthy();
    expect(confirmButton()).toBeNull();
  });

  it('numa posição válida diz "válida" com ✔ e libera a confirmação', () => {
    const { build } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));

    act(() => build.hover(FREE));

    expect(status()).toContain('Posição válida.');
    expect(status()).toContain('✔');
    expect(confirmButton()?.hasAttribute('disabled')).toBe(false);
  });

  it.each([
    ['fora da área de construção', OUTSIDE, 'Fora da área de construção.'],
    ['sobre a nave', ON_SHIP, 'Sobrepõe a nave acidentada.'],
    ['sobre outra construção', ON_HABITAT, 'Sobrepõe outra construção.'],
  ])('%s: explica o motivo em texto, marca ✖ e bloqueia a confirmação', (_name, cell, message) => {
    const { build } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));

    act(() => build.hover(cell));

    expect(status()).toContain(message);
    expect(status()).toContain('✖');
    expect(confirmButton()?.hasAttribute('disabled')).toBe(true);
  });

  it('recursos insuficientes: diz o motivo e o quanto falta de cada recurso', () => {
    const { build } = setup({ materials: 10 });
    open();
    fireEvent.click(item(/Matriz Solar/));

    act(() => build.hover(FREE));

    expect(status()).toContain('Recursos insuficientes.');
    const cost = within(screen.getByRole('list', { name: 'Custo da construção' }));
    expect(cost.getByText(/faltam 20/)).toBeTruthy();
    expect(confirmButton()?.hasAttribute('disabled')).toBe(true);
  });

  it('mostra o tamanho ocupado e a rotação, e girar troca largura e profundidade', () => {
    const { build } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));
    act(() => build.hover(FREE));
    expect(screen.getByText(/Ocupa 3 × 2 células · rotação 0°/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Girar 90°/ }));

    expect(screen.getByText(/Ocupa 2 × 3 células · rotação 90°/)).toBeTruthy();
    expect(build.getSnapshot().rotation).toBe(90);
  });

  it('a validade acompanha a rotação (o mesmo ponto muda de válido para inválido)', () => {
    const { build } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));
    // 3×2 centrado em (27, 26): x 26..29 passa da área (x < 28); girado (2×3) ocupa x 26..28 e
    // y 25..28, que cabe.
    act(() => build.hover({ x: 27, y: 26 }));
    expect(status()).toContain('Fora da área de construção.');

    fireEvent.click(screen.getByRole('button', { name: /Girar 90°/ }));

    expect(status()).toContain('Posição válida.');
  });

  it('as teclas R e Esc funcionam com o foco no painel', () => {
    const { build } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));
    const panel = screen.getByRole('list', { name: 'Edifícios disponíveis' });

    fireEvent.keyDown(panel, { key: 'r' });
    fireEvent.keyDown(panel, { key: 'R' });
    expect(build.getSnapshot().rotation).toBe(180);

    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(build.getSnapshot().definitionId).toBeNull();
  });

  it('as teclas do painel não fazem nada quando não há edifício em posicionamento', () => {
    const { build } = setup();
    open();
    const listener = vi.fn();
    build.subscribe(listener);

    fireEvent.keyDown(screen.getByRole('list', { name: 'Edifícios disponíveis' }), { key: 'r' });

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('BuildPanel: confirmar', () => {
  it('com o jogo pausado constrói na hora, desconta o custo e encerra o posicionamento', () => {
    const { controller, build } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));
    act(() => build.hover(FREE));

    fireEvent.click(confirmButton() as HTMLElement);

    expect(buildingCount(controller)).toBe(INITIAL_COUNT + 1);
    expect(controller.getSnapshot().resources.materials).toBe(START.materials - 30);
    expect(controller.getSnapshot().tick).toBe(0);
    expect(build.getSnapshot().definitionId).toBeNull();
    expect(confirmButton()).toBeNull();
    expect(feedback()).toBe('Matriz Solar construído.');
  });

  it('cliques repetidos em "Confirmar" não gastam duas vezes', () => {
    const { controller, build, actions } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));
    act(() => build.hover(FREE));
    const button = confirmButton() as HTMLElement;

    fireEvent.click(button);
    fireEvent.click(button);
    act(() => {
      actions.confirm();
      actions.confirm();
    });

    expect(buildingCount(controller)).toBe(INITIAL_COUNT + 1);
    expect(controller.getSnapshot().resources.materials).toBe(START.materials - 30);
    expect(controller.getSnapshot().nextEntityId).toBe(2);
  });

  it('em andamento a construção vai para a fila e o aviso diz isso; ela aparece no próximo passo', () => {
    const { controller, build } = setup();
    controller.clock.resume();
    open();
    fireEvent.click(item(/Matriz Solar/));
    act(() => build.hover(FREE));

    fireEvent.click(confirmButton() as HTMLElement);

    expect(feedback()).toContain('construção enviada; será aplicada no próximo passo');
    expect(buildingCount(controller)).toBe(INITIAL_COUNT);
    expect(controller.getSnapshot().resources.materials).toBe(START.materials);

    act(() => {
      controller.clock.advance(1_000);
    });
    expect(buildingCount(controller)).toBe(INITIAL_COUNT + 1);
    expect(controller.getSnapshot().resources.materials).toBe(START.materials - 30);
  });

  it('sem posição apontada não há o que confirmar', () => {
    const { controller, actions, build } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));
    const before = controller.getSnapshot();

    act(() => actions.confirm());

    expect(controller.getSnapshot()).toBe(before);
    expect(build.getSnapshot().definitionId).toBe('solar-array');
  });

  it('confirmar uma posição inválida (por exemplo, por Enter) é recusado pelo domínio e avisa o motivo', () => {
    const { controller, build, actions } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));
    act(() => build.hover(ON_SHIP));
    const before = controller.getSnapshot();

    act(() => actions.confirm());

    expect(controller.getSnapshot()).toBe(before);
    expect(feedback()).toBe('Construção recusada: Sobrepõe a nave acidentada.');
    // O posicionamento continua para o jogador corrigir.
    expect(build.getSnapshot().definitionId).toBe('solar-array');
  });

  it('a recusa tardia de um comando enfileirado aparece para o jogador', () => {
    const { build } = setup();
    open();

    act(() => build.report({ kind: 'rejected', error: 'INSUFFICIENT_RESOURCES' }));

    expect(feedback()).toBe('Construção recusada: Recursos insuficientes.');
    expect(document.querySelector('.build-panel__feedback')?.getAttribute('role')).toBe('status');
  });
});

describe('BuildPanel: cancelar não altera a partida', () => {
  it('"Cancelar" encerra o posicionamento sem enviar comando, sem descontar e sem trocar o estado', () => {
    const { controller, build } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));
    act(() => build.pin(FREE));
    const before = controller.getSnapshot();

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));

    expect(build.getSnapshot().definitionId).toBeNull();
    expect(controller.getSnapshot()).toBe(before);
    expect(controller.getCommandLog()).toEqual([]);
    expect(confirmButton()).toBeNull();
  });

  it('mover, girar e trocar de edifício na prévia não alteram a partida', () => {
    const { controller, build } = setup();
    open();
    const before = controller.getSnapshot();
    const listener = vi.fn();
    controller.subscribe(listener);

    fireEvent.click(item(/Matriz Solar/));
    act(() => build.hover(FREE));
    act(() => build.hover(ON_SHIP));
    fireEvent.click(screen.getByRole('button', { name: /Girar 90°/ }));
    fireEvent.click(item(/Estufa Hidropônica/));
    act(() => build.pin(OUTSIDE));

    expect(controller.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    expect(controller.getCommandLog()).toEqual([]);
  });
});

describe('BuildPanel: mensagens e acessibilidade', () => {
  it('todo código de erro tem um texto para o jogador', () => {
    for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
      expect(message.length, code).toBeGreaterThan(5);
    }
    expect(Object.keys(ERROR_MESSAGES).sort()).toEqual(
      [
        'COMMAND_REJECTED',
        'INSUFFICIENT_RESOURCES',
        'INVALID_COMMAND',
        'INVALID_STATE',
        'OUT_OF_BUILDABLE_AREA',
        'OVERLAPS_BUILDING',
        'OVERLAPS_OBSTACLE',
      ].sort(),
    );
  });

  it('o posicionamento é um grupo com nome e os botões têm nomes claros', () => {
    const { build } = setup();
    open();
    fireEvent.click(item(/Matriz Solar/));
    act(() => build.hover(FREE));

    expect(screen.getByRole('group', { name: 'Posicionar Matriz Solar' })).toBeTruthy();
    for (const name of [/Girar 90°/, 'Confirmar construção', /Cancelar/]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Construção');
  });

  it('o aviso do resultado é uma região de status (anunciada por leitores de tela)', () => {
    setup();
    open();

    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  it('fechado, o painel não re-renderiza a cada tick (não lê o estado)', () => {
    const state = createInitialGameState(INITIAL_SCENARIO);
    const controller = createGameController(state);
    const build = createBuildStore();
    const actions = createBuildActions(controller, build);
    const onRender = vi.fn();
    render(
      <Profiler id="build" onRender={onRender}>
        <BuildPanel controller={controller} build={build} actions={actions} />
      </Profiler>,
    );
    act(() => controller.clock.resume());
    const afterMount = onRender.mock.calls.length;

    for (let second = 0; second < 5; second += 1) {
      act(() => {
        controller.clock.advance(1_000);
      });
    }

    expect(controller.getSnapshot().tick).toBe(5);
    expect(onRender).toHaveBeenCalledTimes(afterMount);
  });
});
