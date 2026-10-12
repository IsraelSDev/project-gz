import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Engine } from '@babylonjs/core/Engines/engine';
import { createBuildingLayer } from './buildings/BuildingLayer';
import { createCameraRig } from './camera/cameraRig';
import { createBuildingPicking } from './interaction/BuildingPicking';
import { createSceneContext } from './scene/createSceneContext';
import { CELL_SIZE, gridRectCenterToWorld } from './world/gridToWorld';
import { createHeightField, type HeightField } from './world/heightField';
import { createStaticWorld, type StaticWorld } from './world/StaticWorld';
import type { WorldSnapshot } from './world/WorldSnapshot';

/**
 * Estado do renderizador, para a interface poder avisar o jogador (nada falha em silêncio):
 * `context-lost` é a perda do contexto WebGL (a engine tenta restaurar sozinha) e `failed` é uma
 * falha ao iniciar (por exemplo, WebGL indisponível).
 */
export type RendererStatus = 'running' | 'context-lost' | 'failed';

export interface FrameStats {
  readonly fps: number;
  readonly frameTimeMs: number;
}

/**
 * Limite padrão de quadros por segundo. Sem ele o `requestAnimationFrame` roda na taxa do monitor
 * (120, 144 ou 165 Hz) e gasta GPU e bateria à toa: a cena não tem animação que peça mais que isso
 * e a simulação nem depende dos quadros (Arquitetura §6.1).
 */
export const DEFAULT_MAX_FPS = 60;

export interface GameRendererOptions {
  /** Cria a engine; por padrão usa WebGL. Testes headless injetam um `NullEngine`. */
  readonly createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine;
  /**
   * Limite de quadros por segundo (padrão: `DEFAULT_MAX_FPS`). `null` remove o limite, útil para
   * medir a folga de desempenho (P-02), já que com o limite o FPS medido nunca passa dele.
   */
  readonly maxFps?: number | null;
  readonly onStatusChange?: (status: RendererStatus) => void;
  /**
   * Chamado a cada clique na cena com o `instanceId` da construção atingida, ou `null` se o clique
   * não atingiu uma construção. Registrado uma vez na criação; sem ele não há seleção por clique.
   */
  readonly onPick?: (entityId: string | null) => void;
}

export interface GameRenderer {
  /** Sincroniza a cena com o snapshot. Pode ser chamado várias vezes; não faz nada após o dispose. */
  sync(snapshot: WorldSnapshot): void;
  /**
   * Mostra o marcador de seleção na construção com este `instanceId` (ou em nenhuma, com `null`).
   * Um identificador inexistente é aceito e simplesmente não marca nada. Não recria a cena.
   */
  setSelectedEntity(entityId: string | null): void;
  getFrameStats(): FrameStats;
  /** Libera tudo (render loop, observadores, meshes, materiais, cena e engine). Idempotente. */
  dispose(): void;
}

const liveRenderers = new Set<GameRenderer>();

/** Quantidade de renderizadores ativos (deve ser no máximo 1; útil para diagnóstico e testes). */
export function getLiveRendererCount(): number {
  return liveRenderers.size;
}

function createBrowserEngine(canvas: HTMLCanvasElement): AbstractEngine {
  if (!Engine.isSupported()) {
    throw new Error('WebGL não é suportado neste navegador ou está desativado.');
  }
  return new Engine(canvas, true, { stencil: false, powerPreference: 'high-performance' }, true);
}

function reportFailure(error: unknown, options: GameRendererOptions): null {
  console.error('Falha ao iniciar o renderizador 3D:', error);
  options.onStatusChange?.('failed');
  return null;
}

/**
 * Cria a engine e a cena UMA vez e devolve o controle do ciclo de vida. O render loop só desenha;
 * ele não conhece nenhuma simulação. Quem chama é responsável por chamar `dispose()`.
 *
 * Se a inicialização falhar, nada fica para trás: o erro é registrado, `onStatusChange('failed')`
 * é chamado e o retorno é `null`.
 */
export function createGameRenderer(
  canvas: HTMLCanvasElement,
  options: GameRendererOptions = {},
): GameRenderer | null {
  let engine: AbstractEngine;
  try {
    engine = (options.createEngine ?? createBrowserEngine)(canvas);
  } catch (error) {
    return reportFailure(error, options);
  }
  // O limitador da engine usa um acumulador de tempo: em um monitor de 120 Hz desenha um quadro sim,
  // outro não, e em 144 Hz mantém a média em 60 (sem cair para ~48 como um "pular quadros" simples).
  const maxFps = options.maxFps === undefined ? DEFAULT_MAX_FPS : options.maxFps;
  if (maxFps !== null) {
    engine.maxFPS = maxFps;
  }
  const cleanups: (() => void)[] = [];
  let disposed = false;

  let sceneContext: ReturnType<typeof createSceneContext> | null = null;
  let cameraRig: ReturnType<typeof createCameraRig> | null = null;
  let buildingLayer: ReturnType<typeof createBuildingLayer> | null = null;
  let staticWorld: StaticWorld | null = null;
  let staticWorldKey: string | null = null;
  let heightField: HeightField | null = null;

  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    liveRenderers.delete(renderer);
    if (import.meta.env.DEV) {
      console.debug(`[renderer] descartado (ativos: ${liveRenderers.size})`);
    }
    engine.stopRenderLoop();
    for (const cleanup of cleanups.splice(0).reverse()) {
      cleanup();
    }
    buildingLayer?.dispose();
    staticWorld?.dispose();
    cameraRig?.dispose();
    sceneContext?.dispose();
    engine.dispose();
  };

  const sync = (snapshot: WorldSnapshot): void => {
    if (disposed || !sceneContext || !cameraRig || !buildingLayer) {
      return;
    }

    // Terreno e nave só são refeitos se os dados do cenário mudarem.
    const key = JSON.stringify([snapshot.terrain, snapshot.crashedShip]);
    if (key !== staticWorldKey) {
      const isFirstBuild = staticWorld === null;
      staticWorld?.dispose();
      heightField = createHeightField(snapshot.terrain);
      staticWorld = createStaticWorld(sceneContext, snapshot, heightField);
      staticWorldKey = key;

      if (isFirstBuild) {
        const area = snapshot.terrain.buildableArea;
        cameraRig.frame(
          gridRectCenterToWorld(area, snapshot.terrain.sizeCells),
          Math.max(area.width, area.depth) * CELL_SIZE,
        );
      }
    }

    const field = heightField;
    buildingLayer.sync(snapshot.buildings, snapshot.terrain.sizeCells, (x, z) =>
      field ? field.heightAt(x, z) : 0,
    );
  };

  const renderer: GameRenderer = {
    sync,
    setSelectedEntity: (entityId) => {
      if (!disposed) {
        buildingLayer?.setSelected(entityId);
      }
    },
    getFrameStats: () => ({ fps: engine.getFps(), frameTimeMs: engine.getDeltaTime() }),
    dispose,
  };

  try {
    sceneContext = createSceneContext(engine);
    cameraRig = createCameraRig(sceneContext.scene);
    cameraRig.setGroundHeight((x, z) => (heightField ? heightField.heightAt(x, z) : 0));
    buildingLayer = createBuildingLayer(sceneContext);

    const lostObserver = engine.onContextLostObservable.add(() => {
      options.onStatusChange?.('context-lost');
    });
    cleanups.push(() => engine.onContextLostObservable.remove(lostObserver));
    const restoredObserver = engine.onContextRestoredObservable.add(() => {
      options.onStatusChange?.('running');
    });
    cleanups.push(() => engine.onContextRestoredObservable.remove(restoredObserver));

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => engine.resize());
      resizeObserver.observe(canvas);
      cleanups.push(() => resizeObserver.disconnect());
    }

    const scene = sceneContext.scene;
    if (options.onPick) {
      const picking = createBuildingPicking(scene, options.onPick);
      cleanups.push(() => picking.dispose());
    }
    engine.runRenderLoop(() => scene.render());
  } catch (error) {
    dispose();
    return reportFailure(error, options);
  }

  liveRenderers.add(renderer);
  if (import.meta.env.DEV) {
    console.debug(`[renderer] criado (ativos: ${liveRenderers.size})`);
    if (liveRenderers.size > 1) {
      console.warn(
        `Há ${liveRenderers.size} renderizadores 3D ativos ao mesmo tempo; o esperado é no máximo 1.`,
      );
    }
  }
  return renderer;
}

// HMR do Vite. O renderizador é imperativo (engine, cena, listeners) e não pode ser trocado "a
// quente": este módulo se declara o limite de atualização de tudo o que está em `rendering/`.
//  1. `dispose`: antes de substituir o módulo, libera os renderizadores da versão antiga, sem
//     deixar engines órfãs (o dispose é idempotente, então a limpeza do React não conflita).
//  2. `accept`: recarrega a página, o que garante uma única engine com o código novo. Sem isso o
//     React Refresh manteria a cena antiga rodando com o código antigo.
// Mudanças de conteúdo (cenário) não passam por aqui: o App recalcula o snapshot e `sync` atualiza
// a cena ao vivo.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const renderer of [...liveRenderers]) {
      renderer.dispose();
    }
  });
  import.meta.hot.accept(() => {
    window.location.reload();
  });
}
