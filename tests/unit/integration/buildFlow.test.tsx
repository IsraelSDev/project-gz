// @vitest-environment jsdom
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import {
  getLiveRendererCount,
  type GameRenderer,
  type GameRendererOptions,
} from '@/rendering/GameRenderer';
import { gridPointToWorld, placedCenterToWorld } from '@/rendering/world/gridToWorld';
import type { FakeTimeEnvironment } from '../../support/fakeTimeEnvironment';
import { buildingNode, click, move, onBuilding, toScreen } from '../../support/headlessRenderer';

/*
 * Fluxo de construção de ponta a ponta com o App real: o tempo vem de um ambiente de tempo FALSO e a
 * engine é um NullEngine; os eventos de ponteiro são SINTÉTICOS. Isto NÃO prova o mouse real, o
 * WebGL, a cor na tela nem a sensação da prévia no navegador (verificação manual).
 */

const harness = vi.hoisted(() => ({
  engines: [] as unknown[],
  envs: [] as unknown[],
  syncCalls: { count: 0 },
}));

vi.mock('@/platform/time/browserTimeEnvironment', async () => {
  const { createFakeTimeEnvironment } = await import('../../support/fakeTimeEnvironment');
  return {
    createBrowserTimeEnvironment: () => {
      const env = createFakeTimeEnvironment();
      harness.envs.push(env);
      return env;
    },
  };
});

vi.mock('@/rendering/GameRenderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/rendering/GameRenderer')>();
  return {
    ...actual,
    createGameRenderer: (canvas: HTMLCanvasElement, options: GameRendererOptions = {}) => {
      const renderer = actual.createGameRenderer(canvas, {
        ...options,
        createEngine: () => {
          const engine = new NullEngine();
          harness.engines.push(engine);
          return engine;
        },
      });
      if (!renderer) {
        return renderer;
      }
      const originalSync = renderer.sync;
      const counting: GameRenderer = {
        ...renderer,
        sync: (snapshot) => {
          harness.syncCalls.count += 1;
          originalSync(snapshot);
        },
      };
      return counting;
    },
  };
});

afterEach(() => {
  cleanup();
  harness.engines.length = 0;
  harness.envs.length = 0;
  harness.syncCalls.count = 0;
});

const TERRAIN = INITIAL_SCENARIO.terrain.sizeCells;
const START = INITIAL_SCENARIO.initialResources;
const INITIAL_COUNT = INITIAL_SCENARIO.initialBuildings.length;
// Células apontadas (o edifício fica centrado nelas).
const SOLAR_OK = { x: 25, y: 14 }; // matriz solar 3×2 em (24, 13)
const ON_SHIP = { x: 18, y: 15 };
const HABITAT_A = { x: 25, y: 14 }; // habitat 3×3 em (24, 13)
const HABITAT_B = { x: 13, y: 26 }; // habitat 3×3 em (12, 25)

const engines = () => harness.engines as NullEngine[];
const envs = () => harness.envs as FakeTimeEnvironment[];
const activeEnv = (): FakeTimeEnvironment => {
  const [env] = envs().filter((candidate) => candidate.pendingFrames() > 0);
  if (!env) {
    throw new Error('Nenhum driver ativo.');
  }
  return env;
};
const liveScene = (): Scene => {
  const scene = engines().findLast((engine) => !engine.isDisposed)?.scenes[0];
  if (!scene) {
    throw new Error('Nenhuma cena ativa.');
  }
  return scene;
};

const pass = (ms: number) => act(() => activeEnv().frame(ms));
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const canvas = () => {
  const element = document.querySelector('canvas');
  if (!element) {
    throw new Error('Canvas não encontrado.');
  }
  return element;
};

/** Pixel do centro de uma célula do grid, no chão. */
function cellScreen(scene: Scene, cell: { x: number; y: number }) {
  const world = gridPointToWorld({ x: cell.x + 0.5, y: cell.y + 0.5 }, TERRAIN);
  return toScreen(scene, new Vector3(world.x, 0, world.z));
}
const hover = (cell: { x: number; y: number }) =>
  act(() => move(liveScene(), cellScreen(liveScene(), cell)));
const clickCell = (cell: { x: number; y: number }) =>
  act(() => click(liveScene(), cellScreen(liveScene(), cell)));
const key = (name: string) => act(() => void fireEvent.keyDown(canvas(), { key: name }));

const amountOf = (id: string) =>
  Number(
    (
      document.querySelector(`[data-resource="${id}"] .resource__amount`)?.textContent ?? ''
    ).replace(/\D/g, ''),
  );
const placementStatus = () => document.querySelector('.build-placement__status')?.textContent ?? '';
const feedback = () => document.querySelector('.build-panel__feedback')?.textContent ?? '';
const panelName = () =>
  within(screen.getByRole('complementary', { name: 'Construção selecionada' })).queryByRole(
    'heading',
    {
      level: 3,
    },
  )?.textContent;
const previewNode = (scene: Scene) =>
  scene.transformNodes.find((node) => node.name === 'placement-preview');
const crossMesh = (scene: Scene) => scene.getMeshByName('preview-cross');
const realBuildings = (scene: Scene) =>
  scene.transformNodes.filter((node) => node.name.startsWith('building-'));

function startPlacing(name: RegExp) {
  fireEvent.click(button('Construir'));
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('construir com o jogo pausado (App + tempo falso + NullEngine)', () => {
  it('prévia, fixar a posição, confirmar: o edifício aparece na cena e o custo no HUD', () => {
    render(<App />);
    const scene = liveScene();
    const syncsBefore = harness.syncCalls.count;
    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT);

    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);

    // A prévia aparece, é válida, e NADA mudou na partida.
    expect(previewNode(scene)).toBeDefined();
    expect(crossMesh(scene)?.isEnabled()).toBe(false);
    expect(placementStatus()).toContain('Posição válida.');
    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT);
    expect(amountOf('materials')).toBe(START.materials);
    expect(harness.syncCalls.count).toBe(syncsBefore);

    clickCell(SOLAR_OK);
    fireEvent.click(button('Confirmar construção'));

    // O edifício existe na cena, com o identificador do contador, na posição da prévia.
    const built = buildingNode(scene, 'building-1');
    const expected = placedCenterToWorld(
      { position: { x: 24, y: 13 }, size: { width: 3, depth: 2 }, rotation: 0 },
      TERRAIN,
    );
    expect(built.position.x).toBeCloseTo(expected.x, 5);
    expect(built.position.z).toBeCloseTo(expected.z, 5);
    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT + 1);
    expect(harness.syncCalls.count).toBe(syncsBefore + 1);
    // A prévia sumiu, o custo saiu do HUD (uma vez) e o tempo não andou.
    expect(previewNode(scene)).toBeUndefined();
    expect(amountOf('materials')).toBe(START.materials - 30);
    expect(document.querySelector('.time-controls__tick-value')?.textContent).toBe('0');
    expect(feedback()).toBe('Matriz Solar construído.');
  });

  it('fixar a posição com um clique: o ponteiro indo até os botões não a move', () => {
    render(<App />);
    const scene = liveScene();
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);
    clickCell(SOLAR_OK);
    const fixed = previewNode(scene)?.position.clone();

    hover({ x: 20, y: 26 });
    hover({ x: 13, y: 13 });

    expect(previewNode(scene)?.position.x).toBeCloseTo(fixed?.x ?? NaN, 5);
    expect(previewNode(scene)?.position.z).toBeCloseTo(fixed?.z ?? NaN, 5);
    // Um novo clique move a posição fixada.
    clickCell({ x: 20, y: 26 });
    expect(previewNode(scene)?.position.x).not.toBeCloseTo(fixed?.x ?? NaN, 1);
  });

  it('posição inválida: prévia com o X, motivo em texto, confirmação bloqueada e nada gasto', () => {
    render(<App />);
    const scene = liveScene();
    startPlacing(/Matriz Solar/);

    hover(ON_SHIP);

    expect(crossMesh(scene)?.isEnabled()).toBe(true);
    expect(placementStatus()).toContain('Sobrepõe a nave acidentada.');
    const confirm = button('Confirmar construção');
    expect(confirm.hasAttribute('disabled')).toBe(true);
    fireEvent.click(confirm);
    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT);
    expect(amountOf('materials')).toBe(START.materials);
  });

  it('recursos insuficientes: avisa o motivo e não constrói', () => {
    render(<App />);
    const scene = liveScene();
    // Dois habitats (80 + 80) não cabem em 150: constrói o primeiro e tenta o segundo.
    startPlacing(/Módulo Habitacional/);
    hover(HABITAT_A);
    clickCell(HABITAT_A);
    fireEvent.click(button('Confirmar construção'));
    expect(amountOf('materials')).toBe(START.materials - 80);

    fireEvent.click(screen.getByRole('button', { name: /Módulo Habitacional/ }));
    hover(HABITAT_B);

    expect(placementStatus()).toContain('Recursos insuficientes.');
    expect(crossMesh(scene)?.isEnabled()).toBe(true);
    expect(button('Confirmar construção').hasAttribute('disabled')).toBe(true);
    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT + 1);
  });

  it('girar com R: a prévia gira na cena e o painel mostra a rotação', () => {
    render(<App />);
    const scene = liveScene();
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);

    key('r');

    expect(previewNode(scene)?.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    expect(screen.getByText(/rotação 90°/)).toBeTruthy();
    key('R');
    expect(previewNode(scene)?.rotation.y).toBeCloseTo(Math.PI, 5);
  });

  it('o construído com rotação mantém a rotação na cena', () => {
    render(<App />);
    const scene = liveScene();
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);
    key('r');
    clickCell(SOLAR_OK);

    fireEvent.click(button('Confirmar construção'));

    expect(buildingNode(scene, 'building-1').rotation.y).toBeCloseTo(Math.PI / 2, 5);
  });

  it('Enter confirma e pressionar Enter de novo não gasta duas vezes', () => {
    render(<App />);
    const scene = liveScene();
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);
    clickCell(SOLAR_OK);

    key('Enter');
    key('Enter');
    key('Enter');

    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT + 1);
    expect(amountOf('materials')).toBe(START.materials - 30);
  });
});

describe('cancelar a prévia (App + tempo falso + NullEngine)', () => {
  it('Esc remove a prévia sem tocar na partida e preserva a seleção atual', () => {
    render(<App />);
    const scene = liveScene();
    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));
    expect(panelName()).toBe('Módulo Habitacional');
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);
    clickCell(SOLAR_OK);
    expect(previewNode(scene)).toBeDefined();
    const syncs = harness.syncCalls.count;

    key('Escape');

    expect(previewNode(scene)).toBeUndefined();
    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT);
    expect(amountOf('materials')).toBe(START.materials);
    expect(harness.syncCalls.count).toBe(syncs);
    // Esc cancelou a construção e NÃO limpou a seleção.
    expect(panelName()).toBe('Módulo Habitacional');
    expect(screen.queryByRole('button', { name: 'Confirmar construção' })).toBeNull();
  });

  it('sem construção em andamento, Esc continua limpando a seleção (regressão da Fase 3)', () => {
    render(<App />);
    const scene = liveScene();
    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));

    key('Escape');

    expect(panelName()).toBeUndefined();
  });

  it('o botão Cancelar faz o mesmo: sem comando, sem desconto', () => {
    render(<App />);
    const scene = liveScene();
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);

    fireEvent.click(button(/Cancelar/));

    expect(previewNode(scene)).toBeUndefined();
    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT);
    expect(amountOf('materials')).toBe(START.materials);
  });

  it('fechar o painel de construção cancela a prévia', () => {
    render(<App />);
    const scene = liveScene();
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);

    fireEvent.click(button('Fechar construção'));

    expect(previewNode(scene)).toBeUndefined();
    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT);
  });
});

describe('selecionar e construir não se confundem (App + tempo falso + NullEngine)', () => {
  it('no modo de construção o clique em uma construção NÃO a seleciona; ao sair, volta a selecionar', () => {
    render(<App />);
    const scene = liveScene();
    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));
    startPlacing(/Matriz Solar/);

    act(() => click(scene, onBuilding(scene, 'building-extractor-01')));

    // Continua selecionado o habitat; o clique só posicionou a prévia (sobre o extrator: inválida).
    expect(panelName()).toBe('Módulo Habitacional');
    expect(placementStatus()).toContain('Sobrepõe outra construção.');

    fireEvent.click(button(/Cancelar/));
    act(() => click(scene, onBuilding(scene, 'building-extractor-01')));

    expect(panelName()).toBe('Extrator de Água');
  });

  it('o edifício novo pode ser selecionado depois de construído e mostra produção e consumo', () => {
    render(<App />);
    const scene = liveScene();
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);
    clickCell(SOLAR_OK);
    fireEvent.click(button('Confirmar construção'));

    act(() => click(scene, onBuilding(scene, 'building-1')));

    expect(panelName()).toBe('Matriz Solar');
  });
});

describe('construir com o jogo em andamento (fila de comandos)', () => {
  it('a confirmação vai para a fila: o edifício e o custo só aparecem no próximo passo', () => {
    render(<App />);
    const scene = liveScene();
    fireEvent.click(button('Retomar'));
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);
    clickCell(SOLAR_OK);

    fireEvent.click(button('Confirmar construção'));

    expect(feedback()).toContain('será aplicada no próximo passo');
    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT);
    expect(amountOf('materials')).toBe(START.materials);

    pass(1_000);

    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT + 1);
    expect(amountOf('materials')).toBe(START.materials - 30);
    expect(buildingNode(scene, 'building-1')).toBeDefined();
  });

  it('a prévia e a simulação convivem: os ticks seguem e a prévia fica onde está', () => {
    render(<App />);
    const scene = liveScene();
    fireEvent.click(button('Retomar'));
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);
    clickCell(SOLAR_OK);
    const syncs = harness.syncCalls.count;

    pass(3_000);

    expect(document.querySelector('.time-controls__tick-value')?.textContent).toBe('3');
    expect(previewNode(scene)).toBeDefined();
    expect(placementStatus()).toContain('Posição válida.');
    // Os ticks (economia) não sincronizam a cena de novo, com ou sem prévia.
    expect(harness.syncCalls.count).toBe(syncs);
  });

  it('a recusa tardia chega ao jogador: o segundo pedido enfileirado perde os recursos e avisa', () => {
    render(<App />);
    const scene = liveScene();
    fireEvent.click(button('Retomar'));

    startPlacing(/Módulo Habitacional/);
    hover(HABITAT_A);
    clickCell(HABITAT_A);
    fireEvent.click(button('Confirmar construção'));
    // Segundo habitat: ainda é válido no envio (o primeiro está na fila e nada foi descontado).
    // O painel segue aberto depois de confirmar: escolhe o catálogo de novo.
    fireEvent.click(screen.getByRole('button', { name: /Módulo Habitacional/ }));
    hover(HABITAT_B);
    clickCell(HABITAT_B);
    expect(placementStatus()).toContain('Posição válida.');
    fireEvent.click(button('Confirmar construção'));

    pass(1_000);

    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT + 1);
    expect(amountOf('materials')).toBe(START.materials - 80);
    expect(feedback()).toBe('Construção recusada: Recursos insuficientes.');
  });

  it('pausar com um pedido na fila o aplica na hora, sem avançar o tempo', () => {
    render(<App />);
    const scene = liveScene();
    fireEvent.click(button('Retomar'));
    pass(1_000);
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);
    clickCell(SOLAR_OK);
    fireEvent.click(button('Confirmar construção'));

    fireEvent.click(button('Pausar'));

    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT + 1);
    expect(document.querySelector('.time-controls__tick-value')?.textContent).toBe('1');
  });
});

describe('ciclo de vida', () => {
  it('no StrictMode há uma só engine e a construção funciona', () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    const scene = liveScene();

    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);
    clickCell(SOLAR_OK);
    fireEvent.click(button('Confirmar construção'));

    expect(getLiveRendererCount()).toBe(1);
    expect(realBuildings(scene)).toHaveLength(INITIAL_COUNT + 1);
    expect(amountOf('materials')).toBe(START.materials - 30);
  });

  it('desmontar com a prévia ativa libera tudo sem erro', () => {
    const { unmount } = render(<App />);
    startPlacing(/Matriz Solar/);
    hover(SOLAR_OK);

    unmount();

    expect(engines().every((engine) => engine.isDisposed)).toBe(true);
    expect(getLiveRendererCount()).toBe(0);
  });
});
