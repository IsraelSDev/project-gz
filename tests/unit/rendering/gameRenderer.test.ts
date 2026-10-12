import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialWorldSnapshot } from '@/app/worldSnapshot';
import {
  createGameRenderer,
  getLiveRendererCount,
  type GameRenderer,
  type RendererStatus,
} from '@/rendering/GameRenderer';
import { resolveEntityId } from '@/rendering/interaction/entityMetadata';
import { placedCenterToWorld } from '@/rendering/world/gridToWorld';
import type { WorldSnapshot } from '@/rendering/world/WorldSnapshot';

/*
 * Estes testes usam o NullEngine do Babylon.js: verificam a montagem, a sincronização e o descarte
 * da cena e dos observadores, mas NÃO provam que o WebGL real funciona no navegador. Não há
 * ResizeObserver nem canvas aqui; resize e renderização real são verificados manualmente.
 */

// O renderizador só repassa o canvas para a engine; com NullEngine ele não é usado.
const fakeCanvas = {} as HTMLCanvasElement;

const created: GameRenderer[] = [];
const engines: NullEngine[] = [];

function mount(onStatusChange?: (status: RendererStatus) => void): GameRenderer {
  const renderer = createGameRenderer(fakeCanvas, {
    createEngine: () => {
      const engine = new NullEngine();
      engines.push(engine);
      return engine;
    },
    onStatusChange,
  });
  if (!renderer) {
    throw new Error('O renderizador deveria ter sido criado.');
  }
  created.push(renderer);
  return renderer;
}

const lastEngine = (): NullEngine => {
  const engine = engines.at(-1);
  if (!engine) {
    throw new Error('Nenhuma engine foi criada.');
  }
  return engine;
};

const lastScene = () => {
  const scene = lastEngine().scenes[0];
  if (!scene) {
    throw new Error('A engine não tem cena.');
  }
  return scene;
};

const buildingRoots = () =>
  lastScene().transformNodes.filter((node) => node.name.startsWith('building-'));

afterEach(() => {
  for (const renderer of created.splice(0)) {
    renderer.dispose();
  }
  engines.length = 0;
  vi.restoreAllMocks();
});

describe('GameRenderer (NullEngine)', () => {
  it('cria uma única engine e cena e registra o renderizador', () => {
    mount();

    expect(engines).toHaveLength(1);
    expect(lastEngine().scenes).toHaveLength(1);
    expect(getLiveRendererCount()).toBe(1);
  });

  it('cria um objeto 3D por edifício, identificado pelo instanceId de domínio', () => {
    const snapshot = createInitialWorldSnapshot();
    mount().sync(snapshot);

    const roots = buildingRoots();
    expect(roots).toHaveLength(3);
    expect(roots.map((root) => resolveEntityId(root)).sort()).toEqual(
      snapshot.buildings.map((building) => building.instanceId).sort(),
    );
    for (const root of roots) {
      const id = resolveEntityId(root);
      const meshes = root.getChildMeshes();
      expect(meshes.length).toBeGreaterThan(0);
      expect(meshes.every((mesh) => resolveEntityId(mesh) === id)).toBe(true);
    }
  });

  it('posiciona cada edifício a partir dos dados do grid', () => {
    const snapshot = createInitialWorldSnapshot();
    mount().sync(snapshot);

    for (const building of snapshot.buildings) {
      const root = buildingRoots().find((node) => resolveEntityId(node) === building.instanceId);
      const expected = placedCenterToWorld(building, snapshot.terrain.sizeCells);

      expect(root?.position.x).toBeCloseTo(expected.x);
      expect(root?.position.z).toBeCloseTo(expected.z);
    }
  });

  it('sincronizar duas vezes com os mesmos dados não duplica objetos', () => {
    const snapshot = createInitialWorldSnapshot();
    const renderer = mount();

    renderer.sync(snapshot);
    const meshesAfterFirst = lastScene().meshes.length;
    renderer.sync(snapshot);

    expect(lastScene().meshes).toHaveLength(meshesAfterFirst);
    expect(buildingRoots()).toHaveLength(3);
  });

  it('remove da cena o edifício removido dos dados e libera seus meshes', () => {
    const snapshot = createInitialWorldSnapshot();
    const renderer = mount();
    renderer.sync(snapshot);
    const meshesBefore = lastScene().meshes.length;

    const [removed, ...remaining] = snapshot.buildings;
    renderer.sync({ ...snapshot, buildings: remaining });

    expect(buildingRoots()).toHaveLength(2);
    expect(buildingRoots().some((root) => resolveEntityId(root) === removed?.instanceId)).toBe(
      false,
    );
    expect(lastScene().meshes.length).toBeLessThan(meshesBefore);
  });

  it('atualiza a posição de um edifício existente sem recriá-lo', () => {
    const snapshot = createInitialWorldSnapshot();
    const renderer = mount();
    renderer.sync(snapshot);
    const [first, ...others] = snapshot.buildings;
    if (!first) {
      throw new Error('O snapshot precisa ter edifícios.');
    }
    const before = buildingRoots().find((root) => resolveEntityId(root) === first.instanceId);
    const meshesBefore = lastScene().meshes.length;

    const moved: WorldSnapshot = {
      ...snapshot,
      buildings: [{ ...first, position: { x: 17, y: 25 } }, ...others],
    };
    renderer.sync(moved);

    const after = buildingRoots().find((root) => resolveEntityId(root) === first.instanceId);
    const expected = placedCenterToWorld(
      { ...first, position: { x: 17, y: 25 } },
      snapshot.terrain.sizeCells,
    );
    expect(after).toBe(before);
    expect(after?.position.x).toBeCloseTo(expected.x);
    expect(after?.position.z).toBeCloseTo(expected.z);
    expect(lastScene().meshes).toHaveLength(meshesBefore);
  });

  it('refaz o terreno quando o cenário muda sem deixar o terreno antigo para trás', () => {
    const snapshot = createInitialWorldSnapshot();
    const renderer = mount();
    renderer.sync(snapshot);
    const meshesBefore = lastScene().meshes.length;

    renderer.sync({
      ...snapshot,
      terrain: { ...snapshot.terrain, seed: snapshot.terrain.seed + 1 },
    });

    expect(lastScene().meshes.filter((mesh) => mesh.name === 'terrain')).toHaveLength(1);
    expect(lastScene().meshes).toHaveLength(meshesBefore);
  });

  it('dispose é idempotente e libera cena, engine e observadores', async () => {
    const onStatusChange = vi.fn();
    const renderer = mount(onStatusChange);
    renderer.sync(createInitialWorldSnapshot());
    const engine = lastEngine();
    const scene = lastScene();
    expect(engine.onContextLostObservable.observers).toHaveLength(1);

    renderer.dispose();
    expect(() => renderer.dispose()).not.toThrow();

    // O Babylon.js efetiva o Observable.remove() no próximo tick (o observador já fica inativo).
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(scene.isDisposed).toBe(true);
    expect(engine.isDisposed).toBe(true);
    expect(engine.onContextLostObservable.observers).toHaveLength(0);
    expect(engine.onContextRestoredObservable.observers).toHaveLength(0);
    expect(getLiveRendererCount()).toBe(0);

    // Depois do dispose, sincronizar não faz nada e não lança erro.
    expect(() => renderer.sync(createInitialWorldSnapshot())).not.toThrow();
  });

  it('simula o remonte do StrictMode (criar, descartar, criar) sem engines duplicadas', () => {
    const first = mount();
    first.sync(createInitialWorldSnapshot());
    first.dispose();
    expect(getLiveRendererCount()).toBe(0);

    const second = mount();
    second.sync(createInitialWorldSnapshot());

    expect(getLiveRendererCount()).toBe(1);
    expect(engines).toHaveLength(2);
    expect(engines[0]?.isDisposed).toBe(true);
    expect(engines[1]?.isDisposed).toBe(false);
  });

  it('avisa a interface sobre perda e restauração do contexto, e para de avisar após o dispose', () => {
    const statuses: RendererStatus[] = [];
    const renderer = mount((status) => statuses.push(status));
    const engine = lastEngine();

    engine.onContextLostObservable.notifyObservers(engine);
    engine.onContextRestoredObservable.notifyObservers(engine);
    renderer.dispose();
    engine.onContextLostObservable.notifyObservers(engine);

    expect(statuses).toEqual(['context-lost', 'running']);
  });

  it('não deixa nada para trás e avisa a interface quando a engine não pode ser criada', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const statuses: RendererStatus[] = [];

    const renderer = createGameRenderer(fakeCanvas, {
      createEngine: () => {
        throw new Error('WebGL indisponível');
      },
      onStatusChange: (status) => statuses.push(status),
    });

    expect(renderer).toBeNull();
    expect(statuses).toEqual(['failed']);
    expect(getLiveRendererCount()).toBe(0);
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
