import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { SceneContext } from '../scene/createSceneContext';
import { createCrashedShip } from './crashedShip';
import type { HeightField } from './heightField';
import { scatterScenery } from './scatter';
import { createScenery } from './scenery';
import { createBuildableGrid, createTerrainMesh } from './terrain';
import type { WorldSnapshot } from './WorldSnapshot';

/** Parte estática do mundo (terreno, cenário e nave), derivada do snapshot. */
export interface StaticWorld {
  /** Libera meshes e nós do mundo estático (materiais compartilhados ficam com a cena). */
  dispose(): void;
}

export function createStaticWorld(
  context: SceneContext,
  snapshot: WorldSnapshot,
  field: HeightField,
): StaticWorld {
  const terrainMesh: Mesh = createTerrainMesh(context, snapshot.terrain, field);
  const gridMeshes = createBuildableGrid(context, snapshot.terrain);
  const placements = scatterScenery(snapshot.terrain, field);
  const scenery = createScenery(context, placements, field);
  const ship = createCrashedShip(context, snapshot.crashedShip, snapshot.terrain, field);

  let disposed = false;
  return {
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      ship.dispose();
      scenery.dispose();
      for (const mesh of gridMeshes) {
        mesh.dispose(false, false);
      }
      terrainMesh.dispose(false, false);
    },
  };
}
