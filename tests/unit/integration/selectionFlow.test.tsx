// @vitest-environment jsdom
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { getLiveRendererCount, type GameRendererOptions } from '@/rendering/GameRenderer';
import { gridPointToWorld } from '@/rendering/world/gridToWorld';
import { buildingNode, click, onBuilding, toScreen } from '../../support/headlessRenderer';

/*
 * Fluxo completo clique 3D → store de seleção → painel React e marcador 3D, com o App real. A
 * engine é um NullEngine (injetado pelo mock abaixo) e os eventos de ponteiro são SINTÉTICOS: isto
 * NÃO prova o mouse real, o canvas nem o WebGL no navegador (verificação manual).
 */

const { engines } = vi.hoisted(() => ({ engines: [] as unknown[] }));

vi.mock('@/rendering/GameRenderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/rendering/GameRenderer')>();
  return {
    ...actual,
    createGameRenderer: (canvas: HTMLCanvasElement, options: GameRendererOptions = {}) =>
      actual.createGameRenderer(canvas, {
        ...options,
        createEngine: () => {
          const engine = new NullEngine();
          engines.push(engine);
          return engine;
        },
      }),
  };
});

afterEach(() => {
  cleanup();
  engines.length = 0;
});

const liveScene = (): Scene => {
  const engine = (engines as NullEngine[]).findLast((candidate) => !candidate.isDisposed);
  const scene = engine?.scenes[0];
  if (!scene) {
    throw new Error('Nenhuma cena ativa.');
  }
  return scene;
};

const markers = (scene: Scene) => scene.meshes.filter((mesh) => mesh.name === 'selection-marker');
const panel = () => screen.getByRole('complementary', { name: 'Construção selecionada' });
const selectedName = () => within(panel()).queryByRole('heading', { level: 3 })?.textContent;
const resourceTexts = () =>
  within(screen.getByRole('list', { name: 'Recursos da colônia' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);
const emptyTerrainPoint = (scene: Scene) => {
  const cell = gridPointToWorld({ x: 26.5, y: 14.5 }, { width: 40, depth: 40 });
  return toScreen(scene, new Vector3(cell.x, 0, cell.z));
};

describe('seleção de ponta a ponta (App + NullEngine, eventos sintéticos)', () => {
  it('abre com o HUD, sem seleção, e o canvas com o foco do teclado', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Civilização Alienígena');
    expect(resourceTexts()).toEqual(['Alimentos300', 'Água300', 'Materiais150', 'Energia100']);
    expect(within(panel()).getByText(/Selecione uma construção/)).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(document.activeElement).toBe(document.querySelector('canvas'));
    expect(getLiveRendererCount()).toBe(1);
  });

  it('clicar em uma construção mostra o painel e o marcador 3D dela', () => {
    render(<App />);
    const scene = liveScene();

    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));

    expect(selectedName()).toBe('Módulo Habitacional');
    expect(markers(scene)).toHaveLength(1);
    expect(markers(scene)[0]?.parent).toBe(buildingNode(scene, 'building-habitat-01'));
  });

  it('clicar em outra construção transfere o painel e o marcador', () => {
    render(<App />);
    const scene = liveScene();

    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));
    act(() => click(scene, onBuilding(scene, 'building-extractor-01')));

    expect(selectedName()).toBe('Extrator de Água');
    expect(markers(scene)).toHaveLength(1);
    expect(markers(scene)[0]?.parent).toBe(buildingNode(scene, 'building-extractor-01'));
  });

  it('clicar em uma área vazia limpa a seleção, o painel e o marcador', () => {
    render(<App />);
    const scene = liveScene();
    act(() => click(scene, onBuilding(scene, 'building-solar-01')));
    expect(selectedName()).toBe('Matriz Solar');

    act(() => click(scene, emptyTerrainPoint(scene)));

    expect(selectedName()).toBeUndefined();
    expect(within(panel()).getByText(/Selecione uma construção/)).toBeTruthy();
    expect(markers(scene)).toHaveLength(0);
  });

  it('clicar na nave não mostra informações de construção', () => {
    render(<App />);
    const scene = liveScene();
    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));
    const hull = scene.getMeshByName('ship-hull');
    if (!hull) {
      throw new Error('O casco da nave deveria existir.');
    }

    act(() => click(scene, toScreen(scene, hull.getBoundingInfo().boundingBox.centerWorld)));

    expect(selectedName()).toBeUndefined();
    expect(markers(scene)).toHaveLength(0);
  });

  it('a barra de recursos não muda ao selecionar (a seleção não toca o estado da partida)', () => {
    render(<App />);
    const scene = liveScene();
    const before = resourceTexts();

    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));
    act(() => click(scene, onBuilding(scene, 'building-solar-01')));
    act(() => click(scene, emptyTerrainPoint(scene)));

    expect(resourceTexts()).toEqual(before);
  });

  it('Esc no canvas limpa a seleção', () => {
    render(<App />);
    const scene = liveScene();
    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));
    expect(selectedName()).toBe('Módulo Habitacional');

    fireEvent.keyDown(document.querySelector('canvas') as HTMLCanvasElement, { key: 'Escape' });

    expect(selectedName()).toBeUndefined();
    expect(markers(scene)).toHaveLength(0);
  });

  it('fechar pelo botão limpa a seleção e devolve o foco ao canvas', () => {
    render(<App />);
    const scene = liveScene();
    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));
    const close = screen.getByRole('button', { name: 'Limpar seleção' });
    close.focus();
    expect(document.activeElement).toBe(close);

    fireEvent.click(close);

    expect(selectedName()).toBeUndefined();
    expect(markers(scene)).toHaveLength(0);
    expect(document.activeElement).toBe(document.querySelector('canvas'));
  });

  it('mudar a seleção não cria engine nem renderizador novos, também no StrictMode', () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    // StrictMode: criar → descartar → criar, sempre com um único renderizador ativo.
    const enginesAfterMount = engines.length;
    expect(getLiveRendererCount()).toBe(1);
    const scene = liveScene();

    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));
    act(() => click(scene, onBuilding(scene, 'building-solar-01')));
    act(() => click(scene, emptyTerrainPoint(scene)));
    fireEvent.keyDown(document.querySelector('canvas') as HTMLCanvasElement, { key: 'Escape' });

    expect(engines).toHaveLength(enginesAfterMount);
    expect(getLiveRendererCount()).toBe(1);
    expect(liveScene()).toBe(scene);
  });

  it('desmontar libera o renderizador e a engine', () => {
    const { unmount } = render(<App />);
    const scene = liveScene();
    act(() => click(scene, onBuilding(scene, 'building-habitat-01')));

    unmount();

    expect(getLiveRendererCount()).toBe(0);
    expect(scene.isDisposed).toBe(true);
    expect((engines as NullEngine[]).every((engine) => engine.isDisposed)).toBe(true);
  });
});
