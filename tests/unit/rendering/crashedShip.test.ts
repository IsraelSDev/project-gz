import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { resolveEntityId } from '@/rendering/interaction/entityMetadata';
import { createSceneContext, type SceneContext } from '@/rendering/scene/createSceneContext';
import {
  createCrashedShip,
  CRASHED_SHIP_MODEL,
  type CrashedShip,
  type CrashedShipModel,
} from '@/rendering/world/crashedShip';
import { placedCenterToWorld } from '@/rendering/world/gridToWorld';
import type { HeightField } from '@/rendering/world/heightField';
import { minimalGlbDataUrl } from './minimalGlbFixture';

/*
 * Estes testes usam o NullEngine: provam montagem, troca de representação, fallback e descarte,
 * mas NÃO provam a aparência do modelo no WebGL real (verificada à parte, no navegador).
 */

const { terrain, crashedShip: ship } = INITIAL_SCENARIO;
const FIELD_HEIGHT = 0.4;
const field: HeightField = {
  heightAt: () => FIELD_HEIGHT,
  distanceToPlateau: () => 0,
  edgeDistance: () => 40,
};

/** Modelo do tamanho da nave (comprimento 14 num footprint de 16); a faixa aceita é 8–24. */
const validModel = (overrides: Partial<CrashedShipModel> = {}): CrashedShipModel => ({
  url: minimalGlbDataUrl({ halfLength: 7 }),
  scale: 1,
  yaw: 0,
  offset: { x: 0, y: 0, z: 0 },
  ...overrides,
});

interface Fixture {
  readonly context: SceneContext;
  readonly added: unknown[];
  readonly removed: unknown[];
  readonly engine: NullEngine;
}

const engines: NullEngine[] = [];
const contexts: SceneContext[] = [];
const ships: CrashedShip[] = [];

function makeFixture(): Fixture {
  const engine = new NullEngine();
  engines.push(engine);
  const real = createSceneContext(engine);
  contexts.push(real);
  const added: unknown[] = [];
  const removed: unknown[] = [];
  const context: SceneContext = {
    ...real,
    shadows: {
      add: (mesh) => {
        added.push(mesh);
        real.shadows.add(mesh);
      },
      remove: (mesh) => {
        removed.push(mesh);
        real.shadows.remove(mesh);
      },
    },
  };
  return { context, added, removed, engine };
}

function makeShip(context: SceneContext, model?: CrashedShipModel | null): CrashedShip {
  const created = createCrashedShip(context, ship, terrain, field, { model });
  ships.push(created);
  return created;
}

/** Quanto há na cena, para provar que descartar a nave devolve tudo ao estado anterior. */
const inventory = (context: SceneContext) => ({
  meshes: context.scene.meshes.length,
  nodes: context.scene.transformNodes.length,
  materials: context.scene.materials.length,
});

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const created of ships.splice(0)) {
    created.dispose();
  }
  for (const context of contexts.splice(0)) {
    context.dispose();
  }
  for (const engine of engines.splice(0)) {
    engine.dispose();
  }
  vi.restoreAllMocks();
});

describe('nave acidentada: representação procedural', () => {
  it('aparece na hora, na posição do cenário, sem esperar nenhum carregamento', () => {
    const { context } = makeFixture();
    const created = makeShip(context, validModel());

    const root = context.scene.getTransformNodeByName('crashed-ship');
    const center = placedCenterToWorld(ship, terrain.sizeCells);
    expect(created.source()).toBe('procedural');
    expect(context.scene.getMeshByName('ship-hull')).not.toBeNull();
    expect(root?.position.x).toBeCloseTo(center.x);
    expect(root?.position.z).toBeCloseTo(center.z);
    expect(root?.position.y).toBeCloseTo(FIELD_HEIGHT);
  });

  it('com `model: null` nunca tenta carregar um GLB', async () => {
    const { context } = makeFixture();
    const created = makeShip(context, null);

    await expect(created.ready).resolves.toBe('procedural');
    expect(context.scene.getTransformNodeByName('ship-model')).toBeNull();
    expect(console.info).not.toHaveBeenCalled();
  });

  it('o modelo padrão aponta para o caminho do manifesto', () => {
    expect(CRASHED_SHIP_MODEL.url).toMatch(/assets\/ships\/crashed-ship\.glb$/);
    expect(CRASHED_SHIP_MODEL.scale).toBe(15);
    expect(CRASHED_SHIP_MODEL.yaw).toBeCloseTo(Math.PI / 2);
  });
});

describe('nave acidentada: modelo GLB', () => {
  it('mantém a nave procedural quando o GLB está ausente ou corrompido', async () => {
    const { context } = makeFixture();
    const before = inventory(context);
    const created = makeShip(
      context,
      validModel({ url: 'data:application/octet-stream;base64,broken' }),
    );
    const withShip = inventory(context);

    await expect(created.ready).resolves.toBe('procedural');

    expect(created.source()).toBe('procedural');
    expect(context.scene.getMeshByName('ship-hull')).not.toBeNull();
    expect(inventory(context)).toEqual(withShip);
    expect(console.info).toHaveBeenCalledTimes(1);
    created.dispose();
    expect(inventory(context)).toEqual(before);
  });

  it('troca o casco procedural pelo modelo, mantendo apenas a posição da nave', async () => {
    const { context, added, removed } = makeFixture();
    const created = makeShip(context, validModel());
    const hull = context.scene.getMeshByName('ship-hull');

    await expect(created.ready).resolves.toBe('glb');

    const root = context.scene.getTransformNodeByName('crashed-ship');
    const modelRoot = context.scene.getTransformNodeByName('ship-model');
    expect(created.source()).toBe('glb');
    expect(context.scene.getMeshByName('ship-hull')).toBeNull();
    expect(context.scene.getMeshByName('ship-canopy')).toBeNull();
    expect(context.scene.getMeshByName('ship-embers')).toBeNull();
    expect(context.scene.getMeshByName('ship-ground')).toBeNull();
    expect(modelRoot?.parent).toBe(root);
    expect(root?.position.y).toBeCloseTo(FIELD_HEIGHT);
    expect(removed).toContain(hull);

    const modelMeshes = ((modelRoot?.getChildMeshes() ?? []) as Mesh[]).filter(
      (mesh) => mesh.getTotalVertices() > 0,
    );
    expect(modelMeshes.length).toBeGreaterThan(0);
    for (const mesh of modelMeshes) {
      // Como o casco procedural: oculta o que está atrás, mas não é uma entidade selecionável.
      expect(mesh.isPickable).toBe(true);
      expect(mesh.receiveShadows).toBe(true);
      expect(resolveEntityId(mesh)).toBeNull();
      expect(added).toContain(mesh);
    }
  });

  it('aplica escala, giro e deslocamento do descritor antes de avaliar o tamanho', async () => {
    const { context } = makeFixture();
    // Comprimento 6 (abaixo do mínimo de 8) só passa porque a escala 3 o leva a 18.
    const created = makeShip(
      context,
      validModel({
        url: minimalGlbDataUrl({ halfLength: 3 }),
        scale: 3,
        yaw: Math.PI / 2,
        offset: { x: 1, y: 0.5, z: -2 },
      }),
    );

    await expect(created.ready).resolves.toBe('glb');

    const modelRoot = context.scene.getTransformNodeByName('ship-model');
    expect(modelRoot?.scaling.x).toBe(3);
    expect(modelRoot?.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(modelRoot?.position.x).toBe(1);
    expect(modelRoot?.position.y).toBe(0.5);
    expect(modelRoot?.position.z).toBe(-2);
  });

  it('segue o contrato de eixos: o loader espelha o X do glTF e mantém o Z (nariz em +X no arquivo)', async () => {
    const { context } = makeFixture();
    const created = makeShip(
      context,
      validModel({ url: minimalGlbDataUrl({ halfLength: 7, nodePosition: [2, 0, 3] }) }),
    );
    await created.ready;

    const center = placedCenterToWorld(ship, terrain.sizeCells);
    const mesh = (context.scene.getTransformNodeByName('ship-model')?.getChildMeshes() ?? []).find(
      (candidate) => candidate.getTotalVertices() > 0,
    );
    mesh?.computeWorldMatrix(true);
    const box = mesh?.getBoundingInfo().boundingBox;

    // No arquivo, o nó está em (+2, 0, +3); no mundo o X aparece invertido (-2) e o Z igual (+3).
    expect(box?.minimumWorld.x).toBeCloseTo(center.x - 2 - 7);
    expect(box?.maximumWorld.x).toBeCloseTo(center.x - 2 + 7);
    expect(box?.minimumWorld.z).toBeCloseTo(center.z + 3);
  });

  it('só troca o casco depois de os materiais do modelo compilarem', async () => {
    let release = (): void => undefined;
    const compiling = new Promise<void>((resolve) => {
      release = resolve;
    });
    const compile = vi
      .spyOn(StandardMaterial.prototype, 'forceCompilationAsync')
      .mockReturnValue(compiling);
    const { context } = makeFixture();
    const created = makeShip(context, validModel());

    await vi.waitFor(() => expect(compile).toHaveBeenCalled());

    // Modelo carregado, shaders pendentes: a nave procedural continua na cena e o modelo, oculto.
    expect(created.source()).toBe('procedural');
    expect(context.scene.getMeshByName('ship-hull')).not.toBeNull();
    expect(context.scene.getTransformNodeByName('ship-model')?.isEnabled(false)).toBe(false);

    release();
    await expect(created.ready).resolves.toBe('glb');
    expect(context.scene.getMeshByName('ship-hull')).toBeNull();
    expect(context.scene.getTransformNodeByName('ship-model')?.isEnabled(false)).toBe(true);
  });

  it('descartar durante a compilação libera o modelo e deixa a cena como estava', async () => {
    let release = (): void => undefined;
    const compiling = new Promise<void>((resolve) => {
      release = resolve;
    });
    const compile = vi
      .spyOn(StandardMaterial.prototype, 'forceCompilationAsync')
      .mockReturnValue(compiling);
    const { context } = makeFixture();
    const before = inventory(context);
    const created = makeShip(context, validModel());
    await vi.waitFor(() => expect(compile).toHaveBeenCalled());

    created.dispose();
    release();

    await expect(created.ready).resolves.toBe('procedural');
    expect(inventory(context)).toEqual(before);
  });

  it('mantém a nave procedural se os materiais do modelo não compilarem', async () => {
    vi.spyOn(StandardMaterial.prototype, 'forceCompilationAsync').mockRejectedValue(
      new Error('shader'),
    );
    const { context } = makeFixture();
    const created = makeShip(context, validModel());
    const withShip = inventory(context);

    await expect(created.ready).resolves.toBe('procedural');

    expect(context.scene.getMeshByName('ship-hull')).not.toBeNull();
    expect(context.scene.getTransformNodeByName('ship-model')).toBeNull();
    expect(inventory(context)).toEqual(withShip);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('recusa modelos sem malha ou fora da escala e mantém a nave procedural', async () => {
    const rejected = [
      validModel({ url: minimalGlbDataUrl({ withoutMesh: true }) }),
      validModel({ url: minimalGlbDataUrl({ halfLength: 0.5 }) }),
      validModel({ url: minimalGlbDataUrl({ halfLength: 50 }) }),
    ];
    for (const model of rejected) {
      const { context } = makeFixture();
      const created = makeShip(context, model);
      const withShip = inventory(context);

      await expect(created.ready).resolves.toBe('procedural');

      expect(context.scene.getMeshByName('ship-hull')).not.toBeNull();
      expect(context.scene.getTransformNodeByName('ship-model')).toBeNull();
      // O modelo recusado não deixa meshes, nós nem materiais para trás.
      expect(inventory(context)).toEqual(withShip);
    }
    expect(console.warn).toHaveBeenCalledTimes(rejected.length);
  });

  it('cancela o carregamento em curso ao descartar e não deixa nada na cena', async () => {
    const { context } = makeFixture();
    const before = inventory(context);
    const created = makeShip(context, validModel());

    created.dispose();

    await expect(created.ready).resolves.toBe('procedural');
    expect(inventory(context)).toEqual(before);
    expect(console.info).not.toHaveBeenCalled();
  });

  it('descarta meshes, nós, materiais e sombras do modelo carregado, uma única vez', async () => {
    const { context, removed } = makeFixture();
    const before = inventory(context);
    const created = makeShip(context, validModel());
    await created.ready;
    const modelMeshes = (
      context.scene.getTransformNodeByName('ship-model')?.getChildMeshes() ?? []
    ).filter((mesh) => mesh.getTotalVertices() > 0);
    expect(modelMeshes.length).toBeGreaterThan(0);

    created.dispose();
    created.dispose();

    expect(inventory(context)).toEqual(before);
    for (const mesh of modelMeshes) {
      expect(removed).toContain(mesh);
    }
    // Os materiais compartilhados da cena continuam utilizáveis por outros objetos.
    expect(context.scene.materials).toContain(context.materials.solid);
  });

  it('recriar a nave não a duplica', async () => {
    const { context } = makeFixture();
    const first = makeShip(context, validModel());
    await first.ready;
    first.dispose();

    const second = makeShip(context, validModel());
    await second.ready;

    expect(
      context.scene.transformNodes.filter((node) => node.name === 'crashed-ship'),
    ).toHaveLength(1);
    expect(context.scene.transformNodes.filter((node) => node.name === 'ship-model')).toHaveLength(
      1,
    );
    second.dispose();
    expect(
      context.scene.transformNodes.filter((node) => node.name === 'crashed-ship'),
    ).toHaveLength(0);
  });
});
