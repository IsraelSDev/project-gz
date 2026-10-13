import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createSceneContext, type SceneContext } from '@/rendering/scene/createSceneContext';
import { createCrashedShip, CRASHED_SHIP_MODEL } from '@/rendering/world/crashedShip';
import { CELL_SIZE, placedCenterToWorld } from '@/rendering/world/gridToWorld';
import type { HeightField } from '@/rendering/world/heightField';
// O Vite embute o arquivo como data URL: o teste lê o asset sem depender de APIs do Node.
import shipDataUrl from '../../../public/assets/ships/crashed-ship.glb?inline';

/*
 * Confere o GLB versionado da nave contra o contrato (docs/ART_ASSET_MANIFEST.md, `crashed-ship`).
 * A fonte do arquivo é scripts/blender/crashed_ship.py (`npm run asset:ship`). Estes testes não
 * avaliam a arte: só formato, orçamento, eixos e escala. A aparência é validada no navegador.
 */

const bytes = Uint8Array.from(atob(shipDataUrl.slice(shipDataUrl.indexOf(',') + 1)), (char) =>
  char.charCodeAt(0),
);
const view = new DataView(bytes.buffer);

interface GltfJson {
  readonly asset: { readonly version: string };
  readonly extensionsUsed?: readonly string[];
  readonly extensionsRequired?: readonly string[];
  readonly buffers: readonly { readonly uri?: string }[];
  readonly images?: readonly { readonly uri?: string; readonly bufferView?: number }[];
  readonly materials: readonly {
    readonly name?: string;
    readonly pbrMetallicRoughness?: { readonly baseColorTexture?: unknown };
  }[];
  readonly meshes: readonly {
    readonly primitives: readonly {
      readonly attributes: Record<string, number>;
      readonly indices: number;
    }[];
  }[];
  readonly accessors: readonly { readonly count: number }[];
}

function readJson(): GltfJson {
  expect(view.getUint32(0, true)).toBe(0x46546c67); // "glTF"
  expect(view.getUint32(4, true)).toBe(2);
  const length = view.getUint32(12, true);
  expect(view.getUint32(16, true)).toBe(0x4e4f534a); // "JSON"
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length))) as GltfJson;
}

describe('asset da nave: arquivo', () => {
  const gltf = readJson();

  it('é um GLB 2.0 autocontido, sem compressões que baixariam decodificadores de fora', () => {
    expect(gltf.asset.version).toBe('2.0');
    expect(gltf.buffers.every((buffer) => buffer.uri === undefined)).toBe(true);
    expect(gltf.images?.length).toBeGreaterThan(0);
    expect(
      gltf.images?.every((image) => image.uri === undefined && image.bufferView !== undefined),
    ).toBe(true);
    const extensions = [...(gltf.extensionsUsed ?? []), ...(gltf.extensionsRequired ?? [])];
    for (const forbidden of [
      'KHR_draco_mesh_compression',
      'EXT_meshopt_compression',
      'KHR_texture_basisu',
    ]) {
      expect(extensions).not.toContain(forbidden);
    }
  });

  it('mantém o GLB enviado dentro dos limites documentados de tamanho', () => {
    const triangles = gltf.meshes
      .flatMap((mesh) => mesh.primitives)
      .reduce((sum, primitive) => sum + gltf.accessors[primitive.indices]!.count / 3, 0);

    expect(triangles).toBe(597_772);
    expect(bytes.length).toBeLessThan(21 * 1024 * 1024);
  });

  it('inclui material texturizado e normais para o modelo', () => {
    expect(gltf.materials).toHaveLength(1);
    expect(gltf.materials[0]?.pbrMetallicRoughness?.baseColorTexture).toBeDefined();
    for (const primitive of gltf.meshes.flatMap((mesh) => mesh.primitives)) {
      expect(primitive.attributes).toHaveProperty('NORMAL');
      expect(primitive.attributes).toHaveProperty('TEXCOORD_0');
    }
  });
});

describe('asset da nave: no jogo', () => {
  const { terrain, crashedShip: ship } = INITIAL_SCENARIO;
  const field: HeightField = {
    heightAt: () => 0,
    distanceToPlateau: () => 0,
    edgeDistance: () => 40,
  };
  let engine: NullEngine;
  let context: SceneContext;

  beforeEach(() => {
    engine = new NullEngine();
    context = createSceneContext(engine);
  });

  afterEach(() => {
    context.dispose();
    engine.dispose();
  });

  it('é aceito pela integração, cabe no footprint e ocupa o eixo longo em X', async () => {
    const created = createCrashedShip(context, ship, terrain, field, {
      model: {
        ...CRASHED_SHIP_MODEL,
        url: shipDataUrl,
      },
    });

    await expect(created.ready).resolves.toBe('glb');

    const meshes = (
      context.scene.getTransformNodeByName('ship-model')?.getChildMeshes() ?? []
    ).filter((mesh) => mesh.getTotalVertices() > 0);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      minX = Math.min(minX, box.minimumWorld.x);
      maxX = Math.max(maxX, box.maximumWorld.x);
      minY = Math.min(minY, box.minimumWorld.y);
      maxY = Math.max(maxY, box.maximumWorld.y);
      minZ = Math.min(minZ, box.minimumWorld.z);
      maxZ = Math.max(maxZ, box.maximumWorld.z);
    }
    const center = placedCenterToWorld(ship, terrain.sizeCells);
    const halfLength = (ship.size.width * CELL_SIZE) / 2;
    const halfWidth = (ship.size.depth * CELL_SIZE) / 2;

    // Dentro do footprint (16 x 10): nada invade células vizinhas onde se pode construir.
    expect(minX).toBeGreaterThanOrEqual(center.x - halfLength);
    expect(maxX).toBeLessThanOrEqual(center.x + halfLength);
    expect(minZ).toBeGreaterThanOrEqual(center.z - halfWidth);
    expect(maxZ).toBeLessThanOrEqual(center.z + halfWidth);
    // Apoiada no chão (o nariz se enterra um pouco) e mais baixa que 6 unidades.
    expect(minY).toBeGreaterThan(-0.5);
    expect(minY).toBeLessThan(0.1);
    expect(maxY).toBeLessThan(6);
    // A conversão de yaw traz o eixo longo Z do arquivo para o eixo X do jogo.
    expect(maxX - minX).toBeGreaterThan(maxZ - minZ);

    created.dispose();
  });

  it('não deixa malhas da nave em modo transparente depois de adaptada à cena', async () => {
    vi.spyOn(console, 'warn');
    const created = createCrashedShip(context, ship, terrain, field, {
      model: {
        ...CRASHED_SHIP_MODEL,
        url: shipDataUrl,
      },
    });
    await created.ready;

    const meshes = context.scene.getTransformNodeByName('ship-model')?.getChildMeshes() ?? [];
    for (const mesh of meshes.filter((item) => item.getTotalVertices() > 0)) {
      expect(mesh.hasVertexAlpha).toBe(false);
      expect(mesh.material?.getClassName()).toBe('StandardMaterial');
    }
    expect(console.warn).not.toHaveBeenCalled();

    created.dispose();
    vi.restoreAllMocks();
  });
});
