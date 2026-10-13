import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadGlbAsset,
  loadGlbAssetWithFallback,
  resolvePublicAssetUrl,
} from '@/rendering/assets/glbAsset';

const engines: NullEngine[] = [];

function makeScene(): Scene {
  const engine = new NullEngine();
  engines.push(engine);
  return new Scene(engine);
}

afterEach(() => {
  for (const engine of engines.splice(0)) {
    engine.dispose();
  }
});

function minimalGlbDataUrl(): string {
  const binaryLength = 44;
  const gltf = {
    asset: { version: '2.0', generator: 'Civilização Alienígena test fixture' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: 42 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [-1, 0, 0],
        max: [1, 1, 0],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
  };
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength;
  const bytes = new Uint8Array(totalLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(0x20, 20, 20 + jsonLength);
  bytes.set(json, 20);
  const binHeader = 20 + jsonLength;
  view.setUint32(binHeader, binaryLength, true);
  view.setUint32(binHeader + 4, 0x004e4942, true);
  const binary = new DataView(bytes.buffer, binHeader + 8, binaryLength);
  binary.setFloat32(0, -1, true);
  binary.setFloat32(4, 0, true);
  binary.setFloat32(8, 0, true);
  binary.setFloat32(12, 1, true);
  binary.setFloat32(16, 0, true);
  binary.setFloat32(20, 0, true);
  binary.setFloat32(24, 0, true);
  binary.setFloat32(28, 1, true);
  binary.setFloat32(32, 0, true);
  binary.setUint16(36, 0, true);
  binary.setUint16(38, 1, true);
  binary.setUint16(40, 2, true);
  const encoded = btoa(String.fromCharCode(...bytes));
  return `data:application/octet-stream;base64,${encoded}`;
}

describe('pipeline de modelos GLB', () => {
  it('resolve assets de public usando o base path do Vite', () => {
    expect(resolvePublicAssetUrl('/assets/planet/model.glb')).toBe(
      `${import.meta.env.BASE_URL}assets/planet/model.glb`,
    );
  });

  it('carrega o GLB em container isolado e libera os recursos uma única vez', async () => {
    const scene = makeScene();
    const asset = await loadGlbAsset(scene, minimalGlbDataUrl());

    expect(asset.rootNodes).toHaveLength(1);
    expect(scene.meshes.length).toBeGreaterThan(0);
    asset.dispose();
    asset.dispose();
    expect(scene.meshes).toHaveLength(0);
  });

  it('rejeita cancelamento e falha de carregamento sem deixar meshes na cena', async () => {
    const scene = makeScene();
    const abort = new AbortController();
    abort.abort();

    await expect(loadGlbAsset(scene, minimalGlbDataUrl(), abort.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    await expect(
      loadGlbAsset(scene, 'data:application/octet-stream;base64,broken'),
    ).rejects.toThrow();
    expect(scene.meshes).toHaveLength(0);
  });

  it('usa o fallback procedural quando o asset não pode ser carregado e libera-o uma vez', async () => {
    const scene = makeScene();
    let disposeCount = 0;
    const result = await loadGlbAssetWithFallback(
      scene,
      'data:application/octet-stream;base64,broken',
      () => ({
        dispose: () => {
          disposeCount += 1;
        },
      }),
    );

    expect(result.source).toBe('fallback');
    if (result.source !== 'fallback') {
      throw new Error('Esperava a representação procedural de fallback.');
    }
    expect(result.error).toBeDefined();
    result.dispose();
    result.dispose();
    expect(disposeCount).toBe(1);
    expect(scene.meshes).toHaveLength(0);
  });
});
