import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import type { Node } from '@babylonjs/core/node';
import type { Scene } from '@babylonjs/core/scene';

export interface LoadedGlbAsset {
  /** Nós-raiz importados; o chamador define posição, escala e pai do asset. */
  readonly rootNodes: readonly Node[];
  /** Libera malhas, geometrias, materiais e animações carregados. Idempotente. */
  dispose(): void;
}

export type GlbAssetResult<T extends { dispose(): void }> =
  | { readonly source: 'glb'; readonly asset: LoadedGlbAsset; dispose(): void }
  | { readonly source: 'fallback'; readonly asset: T; readonly error: unknown; dispose(): void };

/** Resolve um caminho de `public/` respeitando o `base` configurado no Vite. */
export function resolvePublicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\/+/, '')}`;
}

function abortError(): DOMException {
  return new DOMException('O carregamento do modelo foi cancelado.', 'AbortError');
}

/**
 * Carrega um GLB em um AssetContainer isolado. A importação do plugin é tardia para não aumentar o
 * bundle inicial; quem chama mantém o modelo procedural como fallback se esta promise rejeitar.
 */
export async function loadGlbAsset(
  scene: Scene,
  source: string,
  signal?: AbortSignal,
): Promise<LoadedGlbAsset> {
  if (signal?.aborted) {
    throw abortError();
  }
  if (scene.isDisposed) {
    throw new Error('Não é possível carregar um modelo em uma cena descartada.');
  }

  await import('@babylonjs/loaders/glTF');
  if (signal?.aborted) {
    throw abortError();
  }

  let container: AssetContainer | undefined;
  try {
    container = await LoadAssetContainerAsync(source, scene, {
      pluginExtension: '.glb',
    });
    if (signal?.aborted) {
      throw abortError();
    }
    if (scene.isDisposed) {
      throw new Error('A cena foi descartada durante o carregamento do modelo.');
    }
    container.addAllToScene();
  } catch (error) {
    container?.dispose();
    throw error;
  }

  let disposed = false;
  return {
    rootNodes: container.rootNodes,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      container?.dispose();
    },
  };
}

/** Carrega GLB e cria a representação procedural existente em caso de falha de asset. */
export async function loadGlbAssetWithFallback<T extends { dispose(): void }>(
  scene: Scene,
  source: string,
  createFallback: (error: unknown) => T,
  signal?: AbortSignal,
): Promise<GlbAssetResult<T>> {
  try {
    const asset = await loadGlbAsset(scene, source, signal);
    return { source: 'glb', asset, dispose: asset.dispose };
  } catch (error) {
    if (signal?.aborted || scene.isDisposed) {
      throw error;
    }
    const asset = createFallback(error);
    let disposed = false;
    return {
      source: 'fallback',
      asset,
      error,
      dispose: () => {
        if (disposed) {
          return;
        }
        disposed = true;
        asset.dispose();
      },
    };
  }
}
