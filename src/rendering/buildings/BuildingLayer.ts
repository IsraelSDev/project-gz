import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { GridSize } from '@/shared/grid/types';
import { tagEntity } from '../interaction/entityMetadata';
import { createPropKit } from '../props/propKit';
import type { SceneContext } from '../scene/createSceneContext';
import { CELL_SIZE, placedCenterToWorld, rotationToRadians } from '../world/gridToWorld';
import type { BuildingRenderSpec } from '../world/WorldSnapshot';
import { BUILDING_MODELS } from './buildingModels';

interface BuildingEntry {
  readonly modelKey: string;
  readonly node: TransformNode;
  readonly solid: Mesh;
}

export interface BuildingLayer {
  /**
   * Sincroniza os objetos 3D com a lista de edifícios: cria os novos, remove os que sumiram e
   * atualiza a posição e a rotação dos existentes. A identidade é o `instanceId`.
   */
  sync(
    buildings: readonly BuildingRenderSpec[],
    terrainSize: GridSize,
    heightAt: (x: number, z: number) => number,
  ): void;
  /** Libera todos os edifícios. Idempotente. */
  dispose(): void;
}

export function createBuildingLayer(context: SceneContext): BuildingLayer {
  const kit = createPropKit(context.scene);
  const entries = new Map<string, BuildingEntry>();
  let disposed = false;

  const disposeEntry = (entry: BuildingEntry): void => {
    context.shadows.remove(entry.solid);
    entry.node.dispose(false, false);
  };

  const createEntry = (spec: BuildingRenderSpec): BuildingEntry => {
    const model = BUILDING_MODELS[spec.definitionId](kit, context.materials, {
      width: spec.size.width * CELL_SIZE,
      depth: spec.size.depth * CELL_SIZE,
    });
    const node = new TransformNode(`building-${spec.definitionId}`, context.scene);
    for (const mesh of [model.solid, ...model.glowing]) {
      mesh.parent = node;
    }
    model.solid.receiveShadows = true;
    context.shadows.add(model.solid);
    tagEntity(node, { kind: 'building', entityId: spec.instanceId });
    return {
      modelKey: `${spec.definitionId}|${spec.size.width}x${spec.size.depth}`,
      node,
      solid: model.solid,
    };
  };

  return {
    sync: (buildings, terrainSize, heightAt) => {
      if (disposed) {
        return;
      }
      const wanted = new Set(buildings.map((building) => building.instanceId));
      for (const [instanceId, entry] of entries) {
        if (!wanted.has(instanceId)) {
          disposeEntry(entry);
          entries.delete(instanceId);
        }
      }

      for (const spec of buildings) {
        const modelKey = `${spec.definitionId}|${spec.size.width}x${spec.size.depth}`;
        let entry = entries.get(spec.instanceId);
        if (entry && entry.modelKey !== modelKey) {
          disposeEntry(entry);
          entries.delete(spec.instanceId);
          entry = undefined;
        }
        if (!entry) {
          entry = createEntry(spec);
          entries.set(spec.instanceId, entry);
        }

        const center = placedCenterToWorld(spec, terrainSize);
        entry.node.position.set(center.x, heightAt(center.x, center.z), center.z);
        entry.node.rotation.y = rotationToRadians(spec.rotation);
      }
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const entry of entries.values()) {
        disposeEntry(entry);
      }
      entries.clear();
    },
  };
}
