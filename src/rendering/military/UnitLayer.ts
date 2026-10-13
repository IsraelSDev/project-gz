import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { SceneContext } from '../scene/createSceneContext';
import { placedCenterToWorld } from '../world/gridToWorld';
import type { MilitaryUnitRenderSpec } from '../world/WorldSnapshot';
import type { GridSize } from '@/shared/grid/types';

const COLORS: Readonly<Record<MilitaryUnitRenderSpec['type'], string>> = {
  scout: '#75e3d8',
  guardian: '#b9de74',
  striker: '#e990b2',
};

export interface UnitLayer {
  sync(
    units: readonly MilitaryUnitRenderSpec[],
    terrainSize: GridSize,
    heightAt: (x: number, z: number) => number,
  ): void;
  dispose(): void;
}

/** Aliens gordinhos e simples para a guarnição; posição vem do domínio e nunca é salva como mesh. */
export function createUnitLayer(context: SceneContext): UnitLayer {
  const entries = new Map<string, { node: TransformNode; type: string; supplied: boolean }>();
  const materials = new Map<string, StandardMaterial>();
  let disposed = false;
  const materialFor = (type: MilitaryUnitRenderSpec['type'], supplied: boolean) => {
    const key = `${type}:${supplied}`;
    let material = materials.get(key);
    if (!material) {
      material = new StandardMaterial(`unit-${key}`, context.scene);
      material.diffuseColor = Color3.FromHexString(supplied ? COLORS[type] : '#77758b');
      material.specularColor = Color3.Black();
      materials.set(key, material);
    }
    return material;
  };
  return {
    sync(units, terrainSize, heightAt) {
      if (disposed) return;
      const wanted = new Set(units.map((unit) => unit.unitId));
      for (const [id, entry] of entries)
        if (!wanted.has(id)) {
          entry.node.dispose(false, false);
          entries.delete(id);
        }
      for (const unit of units) {
        let entry = entries.get(unit.unitId);
        if (entry && (entry.type !== unit.type || entry.supplied !== unit.supplied)) {
          entry.node.dispose(false, false);
          entries.delete(unit.unitId);
          entry = undefined;
        }
        if (!entry) {
          const node = new TransformNode(`unit-${unit.unitId}`, context.scene);
          const body = CreateSphere(
            `unit-body-${unit.unitId}`,
            { diameter: 1.15, segments: 10 },
            context.scene,
          );
          body.scaling.y = 0.83;
          body.position.y = 0.68;
          body.parent = node;
          body.material = materialFor(unit.type, unit.supplied);
          body.isPickable = false;
          const eyeMaterial = context.materials.glowCyan;
          for (const side of [-1, 1]) {
            const eye = CreateSphere(
              `unit-eye-${unit.unitId}-${side}`,
              { diameter: 0.12, segments: 6 },
              context.scene,
            );
            eye.position.set(side * 0.19, 0.81, -0.48);
            eye.parent = node;
            eye.material = eyeMaterial;
            eye.isPickable = false;
          }
          const antenna = CreateSphere(
            `unit-crest-${unit.unitId}`,
            { diameter: 0.18, segments: 6 },
            context.scene,
          );
          antenna.position.y = 1.3;
          antenna.parent = node;
          antenna.material = context.materials.glowGreen;
          antenna.isPickable = false;
          entry = { node, type: unit.type, supplied: unit.supplied };
          entries.set(unit.unitId, entry);
        }
        const center = placedCenterToWorld(unit, terrainSize);
        entry.node.position.set(center.x, heightAt(center.x, center.z), center.z);
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) entry.node.dispose(false, false);
      entries.clear();
      for (const material of materials.values()) material.dispose();
      materials.clear();
    },
  };
}
