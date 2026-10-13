import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadGlbAsset,
  loadGlbAssetWithFallback,
  resolvePublicAssetUrl,
} from '@/rendering/assets/glbAsset';
import { minimalGlbDataUrl } from './minimalGlbFixture';

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
