// @vitest-environment jsdom
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import type { Scene } from '@babylonjs/core/scene';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { getBuildingDefinition } from '@/game/content/buildings';
import { RESOURCE_DEFINITIONS, RESOURCE_IDS } from '@/game/content/resources';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import {
  getLiveRendererCount,
  type GameRenderer,
  type GameRendererOptions,
} from '@/rendering/GameRenderer';
import { expectedResourcesAfter } from '../../support/economyExpectations';
import type { FakeTimeEnvironment } from '../../support/fakeTimeEnvironment';
import { click, onBuilding } from '../../support/headlessRenderer';

/*
 * Fluxo do relógio de ponta a ponta com o App real: o tempo e a visibilidade vêm de um ambiente de
 * tempo FALSO (nada de esperas reais) e a engine é um NullEngine. Isto NÃO prova o requestAnimationFrame,
 * a aba em segundo plano nem o desempenho de um navegador real (verificação manual).
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
      // Conta as sincronizações da cena: os ticks não podem refazê-la.
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

const engines = () => harness.engines as NullEngine[];
const envs = () => harness.envs as FakeTimeEnvironment[];

/** O ambiente de tempo do driver ATIVO (no StrictMode o primeiro foi parado). */
const activeEnv = (): FakeTimeEnvironment => {
  const active = envs().filter((env) => env.pendingFrames() > 0);
  const [env] = active;
  if (!env || active.length !== 1) {
    throw new Error(`Esperava exatamente um driver ativo, havia ${active.length}.`);
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

const tick = () => document.querySelector('.time-controls__tick-value')?.textContent;
const statusText = () => document.querySelector('.time-controls__status')?.textContent;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const panelName = () =>
  within(screen.getByRole('complementary', { name: 'Construção selecionada' })).queryByRole(
    'heading',
    { level: 3 },
  )?.textContent;
const resources = () =>
  within(screen.getByRole('list', { name: 'Recursos da colônia' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

/** Passa `ms` de tempo real no driver ativo, dentro de `act` (a interface reage aos ticks). */
const pass = (ms: number) => act(() => activeEnv().frame(ms));

describe('relógio de ponta a ponta (App + tempo falso + NullEngine)', () => {
  it('a partida abre pausada e os quadros não avançam o tick', () => {
    render(<App />);

    expect(statusText()).toBe('Pausado');
    expect(tick()).toBe('0');

    pass(5_000);
    pass(5_000);

    expect(tick()).toBe('0');
    expect(statusText()).toBe('Pausado');
  });

  it('retomar faz o tick avançar com o tempo real e a velocidade multiplica os ticks por segundo', () => {
    render(<App />);

    fireEvent.click(button('Retomar'));
    expect(statusText()).toBe('Em andamento');
    pass(1_000);
    expect(tick()).toBe('1');

    fireEvent.click(button('4×'));
    pass(1_000);
    expect(tick()).toBe('5');
  });

  it('Espaço pausa e retoma mantendo a velocidade selecionada', () => {
    render(<App />);
    const speedButton = button('4×');
    const pressSpace = (repeat = false) =>
      fireEvent.keyDown(speedButton, { key: ' ', code: 'Space', repeat });

    fireEvent.click(speedButton);
    pressSpace();
    expect(statusText()).toBe('Em andamento');
    expect(button('4×').getAttribute('aria-pressed')).toBe('true');
    pass(1_000);
    expect(tick()).toBe('4');

    pressSpace(true);
    expect(statusText()).toBe('Em andamento');
    pressSpace();
    expect(statusText()).toBe('Pausado');
    pass(2_000);
    expect(tick()).toBe('4');

    pressSpace();
    expect(statusText()).toBe('Em andamento');
    expect(button('4×').getAttribute('aria-pressed')).toBe('true');
    pass(1_000);
    expect(tick()).toBe('8');
  });

  it('o resultado não depende do FPS: muitos quadros curtos ou poucos longos dão o mesmo tick', () => {
    const { unmount } = render(<App />);
    fireEvent.click(button('Retomar'));
    for (let frame = 0; frame < 200; frame += 1) {
      pass(25);
    }
    const manyShortFrames = tick();
    unmount();
    harness.envs.length = 0;

    render(<App />);
    fireEvent.click(button('Retomar'));
    pass(5_000);

    expect(manyShortFrames).toBe('5');
    expect(tick()).toBe('5');
  });

  it('pausar, retomar e mudar a velocidade não recriam a engine, a cena, a câmera nem os meshes', () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    const enginesAfterMount = engines().length;
    const scene = liveScene();
    const camera = scene.activeCamera as ArcRotateCamera;
    const meshes = scene.meshes.length;
    const syncs = harness.syncCalls.count;

    fireEvent.click(button('Retomar'));
    fireEvent.click(button('2×'));
    pass(3_000);
    fireEvent.click(button('Pausar'));
    pass(3_000);
    fireEvent.click(button('Retomar'));
    fireEvent.click(button('4×'));
    pass(2_000);

    expect(engines()).toHaveLength(enginesAfterMount);
    expect(getLiveRendererCount()).toBe(1);
    expect(liveScene()).toBe(scene);
    expect(scene.activeCamera).toBe(camera);
    expect(scene.meshes).toHaveLength(meshes);
    // Os ticks nem sincronizam a cena de novo: só as construções alimentam a renderização.
    expect(harness.syncCalls.count).toBe(syncs);
  });

  it('a cena continua selecionável com o jogo pausado e também em andamento', () => {
    render(<App />);
    const scene = liveScene();

    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));
    expect(panelName()).toBe('Módulo Habitacional');

    fireEvent.click(button('Retomar'));
    pass(3_000);
    expect(panelName()).toBe('Módulo Habitacional');

    act(() => click(scene, onBuilding(scene, 'building-solar-01')));
    expect(panelName()).toBe('Matriz Solar');

    fireEvent.click(button('Pausar'));
    act(() => click(scene, onBuilding(scene, 'building-extractor-01')));
    expect(panelName()).toBe('Extrator de Água');
  });

  it('aba oculta pausa a simulação; ao voltar continua pausada e retomar não gera salto de tempo', () => {
    render(<App />);
    fireEvent.click(button('Retomar'));
    pass(2_000);
    expect(tick()).toBe('2');

    act(() => activeEnv().setHidden(true));
    expect(statusText()).toBe('Pausado');

    pass(60 * 60 * 1000); // uma hora com a aba oculta
    act(() => activeEnv().setHidden(false));
    expect(statusText()).toBe('Pausado');
    expect(tick()).toBe('2');

    fireEvent.click(button('Retomar'));
    pass(16);
    expect(tick()).toBe('2');
    pass(1_000);
    expect(tick()).toBe('3');
  });

  it('não há laço duplicado no StrictMode: um único driver ativo e tempo contado uma vez', () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    expect(envs().filter((env) => env.pendingFrames() > 0)).toHaveLength(1);
    expect(envs().filter((env) => env.visibilityListeners() > 0)).toHaveLength(1);

    fireEvent.click(button('Retomar'));
    pass(1_000);

    expect(tick()).toBe('1');
  });

  it('desmontar para o driver e libera a engine e as assinaturas', () => {
    const { unmount } = render(<App />);
    fireEvent.click(button('Retomar'));
    pass(1_000);

    unmount();

    expect(envs().every((env) => env.pendingFrames() === 0)).toBe(true);
    expect(envs().every((env) => env.visibilityListeners() === 0)).toBe(true);
    expect(engines().every((engine) => engine.isDisposed)).toBe(true);
    expect(getLiveRendererCount()).toBe(0);
  });
});

/*
 * Economia (Fase 5) de ponta a ponta: a barra de recursos do App real mostra o estado da simulação,
 * que só evolui com os ticks. Os valores esperados vêm de uma soma simples das definições dos
 * edifícios (tests/support/economyExpectations.ts), não de uma cópia da regra do domínio.
 */
const barText = (stockAfter: Record<string, number>) =>
  RESOURCE_IDS.map(
    (id) =>
      `${RESOURCE_DEFINITIONS[id].name}${new Intl.NumberFormat('pt-BR').format(stockAfter[id] ?? NaN)}`,
  );

/** Valor mostrado para um rótulo do painel da construção (par `dt`/`dd`). */
const panelFact = (label: string): string | null => {
  const term = within(screen.getByRole('complementary', { name: 'Construção selecionada' }))
    .queryAllByText(label)
    .find((element) => element.tagName === 'DT');
  return term?.nextElementSibling?.textContent ?? null;
};

describe('economia de ponta a ponta (App + tempo falso + NullEngine)', () => {
  it('abre com os estoques iniciais do cenário, e os quadros com o jogo pausado não os alteram', () => {
    render(<App />);

    expect(resources()).toEqual(barText(INITIAL_SCENARIO.initialResources));

    pass(5_000);
    pass(5_000);

    expect(resources()).toEqual(barText(INITIAL_SCENARIO.initialResources));
    expect(tick()).toBe('0');
  });

  it('retomar faz a economia andar com os ticks, e a velocidade multiplica os passos por segundo', () => {
    render(<App />);
    fireEvent.click(button('Retomar'));

    pass(1_000);
    expect(tick()).toBe('1');
    expect(resources()).toEqual(barText(expectedResourcesAfter(1)));

    fireEvent.click(button('4×'));
    pass(1_000);
    expect(tick()).toBe('5');
    expect(resources()).toEqual(barText(expectedResourcesAfter(5)));
  });

  it('o resultado não depende do FPS: muitos quadros curtos ou poucos longos dão os mesmos recursos', () => {
    const { unmount } = render(<App />);
    fireEvent.click(button('Retomar'));
    for (let frame = 0; frame < 200; frame += 1) {
      pass(25);
    }
    const manyShortFrames = resources();
    unmount();
    harness.envs.length = 0;

    render(<App />);
    fireEvent.click(button('Retomar'));
    pass(5_000);

    expect(manyShortFrames).toEqual(barText(expectedResourcesAfter(5)));
    expect(resources()).toEqual(manyShortFrames);
  });

  it('um quadro muito longo rende no máximo 10 passos de economia (teto de recuperação)', () => {
    render(<App />);
    fireEvent.click(button('Retomar'));

    pass(30_000);

    expect(tick()).toBe('10');
    expect(resources()).toEqual(barText(expectedResourcesAfter(10)));
  });

  it('pausar congela a economia na tela e retomar continua dali', () => {
    render(<App />);
    fireEvent.click(button('Retomar'));
    pass(2_000);

    fireEvent.click(button('Pausar'));
    pass(10_000);
    expect(resources()).toEqual(barText(expectedResourcesAfter(2)));

    fireEvent.click(button('Retomar'));
    pass(1_000);
    expect(resources()).toEqual(barText(expectedResourcesAfter(3)));
  });

  it('a seleção e o painel seguem funcionando com a economia em andamento, e o painel mostra produção e consumo', () => {
    render(<App />);
    const scene = liveScene();
    const syncs = harness.syncCalls.count;
    const extractor = getBuildingDefinition('water-extractor');

    act(() => click(scene, onBuilding(scene, 'building-extractor-01')));
    expect(panelName()).toBe('Extrator de Água');
    expect(panelFact('Produção por tick')).toBe(`Água ${extractor.production.water}`);
    expect(panelFact('Consumo por tick')).toBe(`Energia ${extractor.consumption.energy}`);

    fireEvent.click(button('Retomar'));
    pass(3_000);

    expect(panelName()).toBe('Extrator de Água');
    expect(panelFact('Produção por tick')).toBe(`Água ${extractor.production.water}`);
    expect(resources()).toEqual(barText(expectedResourcesAfter(3)));
    // A economia mexe nos recursos, não nas construções: a cena não é sincronizada de novo.
    expect(harness.syncCalls.count).toBe(syncs);
  });

  it('com a aba oculta a economia para; ao voltar continua parada até retomar', () => {
    render(<App />);
    fireEvent.click(button('Retomar'));
    pass(2_000);
    expect(resources()).toEqual(barText(expectedResourcesAfter(2)));

    act(() => activeEnv().setHidden(true));
    pass(60 * 60 * 1000);
    act(() => activeEnv().setHidden(false));
    expect(statusText()).toBe('Pausado');
    expect(resources()).toEqual(barText(expectedResourcesAfter(2)));

    fireEvent.click(button('Retomar'));
    pass(1_000);
    expect(resources()).toEqual(barText(expectedResourcesAfter(3)));
  });
});
