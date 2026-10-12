import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { PointerEventTypes, PointerInfo } from '@babylonjs/core/Events/pointerEvents';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { createInitialWorldSnapshot } from '@/app/worldSnapshot';
import {
  createGameRenderer,
  type GameRenderer,
  type GameRendererOptions,
} from '@/rendering/GameRenderer';
import { resolveEntityId } from '@/rendering/interaction/entityMetadata';
import type { WorldSnapshot } from '@/rendering/world/WorldSnapshot';

/*
 * Apoio dos testes headless com o NullEngine do Babylon.js. A cena, o raio e a geometria são
 * reais; os eventos de ponteiro são SINTÉTICOS (entregues ao observável da cena). Nada disto prova
 * o mouse real, o canvas, o WebGL nem a sensação do clique no navegador: isso é verificado à mão.
 */

// O renderizador só repassa o canvas para a engine; com NullEngine ele não é usado.
const fakeCanvas = {} as HTMLCanvasElement;
type PointerEventInit = ConstructorParameters<typeof PointerInfo>[1];

export const headlessEngines: NullEngine[] = [];
const mounted: GameRenderer[] = [];

export interface HeadlessRenderer {
  readonly renderer: GameRenderer;
  readonly engine: NullEngine;
  readonly scene: Scene;
  readonly snapshot: WorldSnapshot;
}

export interface MountOptions {
  /** Callback de seleção por clique; sem ele o renderizador não registra picking. */
  readonly onPick?: (entityId: string | null) => void;
  /** Callback do modo de posicionamento (célula sob o ponteiro); sem ele não há entrada de posicionamento. */
  readonly onPlacementCell?: GameRendererOptions['onPlacementCell'];
  /** Sincroniza o snapshot inicial logo após criar (padrão: sim). */
  readonly sync?: boolean;
}

/** Cria um renderizador sobre um NullEngine e, por padrão, sincroniza o cenário inicial. */
export function mountHeadlessRenderer(options: MountOptions = {}): HeadlessRenderer {
  const renderer = createGameRenderer(fakeCanvas, {
    createEngine: () => {
      const engine = new NullEngine();
      headlessEngines.push(engine);
      return engine;
    },
    onPick: options.onPick,
    onPlacementCell: options.onPlacementCell,
  });
  if (!renderer) {
    throw new Error('O renderizador deveria ter sido criado.');
  }
  mounted.push(renderer);

  const engine = headlessEngines.at(-1);
  const scene = engine?.scenes[0];
  if (!engine || !scene) {
    throw new Error('A engine e a cena deveriam existir.');
  }
  const snapshot = createInitialWorldSnapshot();
  if (options.sync ?? true) {
    renderer.sync(snapshot);
    scene.render();
  }
  return { renderer, engine, scene, snapshot };
}

/** Descarta os renderizadores criados pelo teste (chamar em `afterEach`). */
export function cleanupHeadlessRenderers(): void {
  for (const renderer of mounted.splice(0)) {
    renderer.dispose();
  }
  headlessEngines.length = 0;
}

export function buildingNode(scene: Scene, instanceId: string) {
  const node = scene.transformNodes.find(
    (candidate) =>
      candidate.name.startsWith('building-') && resolveEntityId(candidate) === instanceId,
  );
  if (!node) {
    throw new Error(`Edifício ${instanceId} não encontrado na cena.`);
  }
  return node;
}

/** Posição em pixels do canvas de um ponto do mundo, como a câmera o enxerga. */
export function toScreen(scene: Scene, point: Vector3): { x: number; y: number } {
  const engine = scene.getEngine();
  const camera = scene.activeCamera;
  if (!camera) {
    throw new Error('A cena precisa de câmera.');
  }
  scene.render();
  const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const projected = Vector3.Project(
    point,
    Matrix.IdentityReadOnly,
    scene.getTransformMatrix(),
    viewport,
  );
  return { x: projected.x, y: projected.y };
}

/**
 * Entrega um evento de ponteiro sintético à cena. A câmera também observa `onPointerObservable` e
 * lê vários campos do evento, então o evento falso precisa ser completo (como o do navegador).
 */
export function pointer(scene: Scene, type: number, x: number, y: number, button = 0): void {
  scene.pointerX = x;
  scene.pointerY = y;
  const event = {
    button,
    buttons:
      type === PointerEventTypes.POINTERUP || type === PointerEventTypes.POINTERMOVE
        ? 0
        : 1 << button,
    pointerId: 1,
    pointerType: 'mouse',
    clientX: x,
    clientY: y,
    movementX: 0,
    movementY: 0,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: { setPointerCapture: () => undefined, releasePointerCapture: () => undefined },
    preventDefault: () => undefined,
  } as unknown as PointerEventInit;
  scene.onPointerObservable.notifyObservers(new PointerInfo(type, event, null), type);
}

/** Move o ponteiro (sem botão apertado) para o ponto. */
export function move(scene: Scene, point: { x: number; y: number }): void {
  pointer(scene, PointerEventTypes.POINTERMOVE, point.x, point.y);
}

/** Aperta e solta o botão principal no mesmo ponto. */
export function click(scene: Scene, point: { x: number; y: number }): void {
  pointer(scene, PointerEventTypes.POINTERDOWN, point.x, point.y);
  pointer(scene, PointerEventTypes.POINTERUP, point.x, point.y);
}

/** Um ponto sobre o edifício: o centro do footprint, um pouco acima do chão. */
export function onBuilding(scene: Scene, instanceId: string): { x: number; y: number } {
  const { position } = buildingNode(scene, instanceId);
  return toScreen(scene, new Vector3(position.x, position.y + 0.4, position.z));
}
