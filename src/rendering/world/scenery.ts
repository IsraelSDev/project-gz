import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
// Habilita thin instances em Mesh (efeito colateral do módulo).
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { createPropKit, type PropKit } from '../props/propKit';
import { PALETTE } from '../scene/palette';
import type { SceneContext } from '../scene/createSceneContext';
import type { HeightField } from './heightField';
import type { SceneryKind, SceneryPlacement } from './scatter';

const { plant, rock, metal, terrain } = PALETTE;

function buildStalk(kit: PropKit): Mesh {
  const blades = [0, 2.1, 4.2].map((yaw) =>
    kit.box({ w: 0.95, h: 0.05, d: 0.26 }, plant.leaf, {
      x: 0.38 * Math.cos(yaw),
      y: 0.6,
      z: -0.38 * Math.sin(yaw),
      ry: yaw,
      rz: 0.75,
    }),
  );
  return kit.merge('stalk', [
    kit.cylinder({ height: 2, bottom: 0.26, top: 0.1, tessellation: 6 }, plant.stalk, { y: 1 }),
    kit.cylinder({ height: 1.1, bottom: 0.14, top: 0.05, tessellation: 6 }, plant.stalk, {
      x: 0.42,
      y: 1.05,
      rz: -0.8,
    }),
    kit.sphere({ diameter: 0.6, segments: 6 }, plant.bulb, { y: 2.08 }),
    kit.sphere({ diameter: 0.34, segments: 6 }, plant.bulb, { x: 0.82, y: 1.5 }),
    ...blades,
  ]);
}

function buildMushroom(kit: PropKit): Mesh {
  return kit.merge('mushroom', [
    kit.cylinder({ height: 2.4, bottom: 0.5, top: 0.3, tessellation: 8 }, plant.stem, { y: 1.2 }),
    kit.sphere({ diameter: 2.4, segments: 10, slice: 0.5 }, plant.cap, { y: 2.3, sy: 0.75 }),
    kit.cylinder({ height: 0.1, bottom: 2.3, tessellation: 12 }, plant.stalk, { y: 2.28 }),
    kit.sphere({ diameter: 0.34, segments: 6 }, plant.capSpot, { x: 0.5, y: 3.0, z: 0.3 }),
    kit.sphere({ diameter: 0.26, segments: 6 }, plant.capSpot, { x: -0.55, y: 2.85, z: -0.2 }),
    kit.sphere({ diameter: 0.22, segments: 6 }, plant.capSpot, { x: 0.1, y: 3.1, z: -0.5 }),
  ]);
}

function buildCrystal(kit: PropKit): Mesh {
  const spire = (height: number, x: number, z: number, tilt: number, color: string): Mesh =>
    kit.cylinder({ height, bottom: 0.7, top: 0.01, tessellation: 6 }, color, {
      x,
      y: height / 2,
      z,
      rz: tilt,
    });
  return kit.merge('crystal', [
    spire(2.1, 0, 0, 0.05, plant.crystal),
    spire(1.4, 0.6, 0.2, -0.3, plant.crystalGlow),
    spire(1.0, -0.55, -0.25, 0.35, plant.crystal),
    kit.icosphere({ radius: 0.6 }, rock.dark, { y: 0.15, sy: 0.5 }),
  ]);
}

function buildRockSmall(kit: PropKit): Mesh {
  return kit.merge('rock-small', [
    kit.icosphere({ radius: 0.7 }, rock.base, { y: 0.3, sy: 0.7, sz: 0.85, ry: 0.6 }),
    kit.icosphere({ radius: 0.4 }, rock.light, { x: 0.55, y: 0.2, sy: 0.7, ry: 1.4 }),
  ]);
}

function buildRockLarge(kit: PropKit): Mesh {
  return kit.merge('rock-large', [
    kit.icosphere({ radius: 1.3 }, rock.base, { y: 0.8, sy: 0.75, sz: 0.9, ry: 0.4 }),
    kit.icosphere({ radius: 0.85 }, rock.light, { x: 1.2, y: 0.5, sy: 0.7, ry: 1.2 }),
    kit.icosphere({ radius: 0.65 }, rock.dark, { x: -1.0, y: 0.4, z: 0.6, sy: 0.8, ry: 2.2 }),
  ]);
}

function buildDebris(kit: PropKit): Mesh {
  return kit.merge('debris', [
    kit.box({ w: 1.0, h: 0.12, d: 0.55 }, metal.hull, { y: 0.1, ry: 0.4, rz: 0.12 }),
    kit.box({ w: 0.5, h: 0.4, d: 0.45 }, metal.burnt, { x: 0.9, y: 0.2, ry: 1.1 }),
    kit.box({ w: 0.7, h: 0.08, d: 0.35 }, metal.accent, {
      x: -0.7,
      y: 0.08,
      z: 0.4,
      ry: 2.0,
      rx: 0.15,
    }),
    kit.icosphere({ radius: 0.28 }, terrain.sand, { x: 0.2, y: 0.1, z: -0.5, sy: 0.6 }),
  ]);
}

const BUILDERS: Record<SceneryKind, (kit: PropKit) => Mesh> = {
  stalk: buildStalk,
  mushroom: buildMushroom,
  crystal: buildCrystal,
  rockSmall: buildRockSmall,
  rockLarge: buildRockLarge,
  debris: buildDebris,
};

export interface SceneryLayer {
  dispose(): void;
}

/**
 * Cria um mesh por tipo de objeto e o repete com thin instances (uma chamada de desenho por tipo).
 * As posições vêm de `scatterScenery`; o relevo define a altura de cada objeto.
 */
export function createScenery(
  context: SceneContext,
  placements: readonly SceneryPlacement[],
  field: HeightField,
): SceneryLayer {
  const kit = createPropKit(context.scene);
  const meshes: Mesh[] = [];

  for (const kind of Object.keys(BUILDERS) as SceneryKind[]) {
    const ofKind = placements.filter((placement) => placement.kind === kind);
    if (ofKind.length === 0) {
      continue;
    }
    const mesh = BUILDERS[kind](kit);
    mesh.material = context.materials.solid;
    mesh.isPickable = false;
    mesh.receiveShadows = true;

    const buffer = new Float32Array(ofKind.length * 16);
    ofKind.forEach((placement, index) => {
      const y = field.heightAt(placement.x, placement.z);
      Matrix.Compose(
        new Vector3(placement.scale, placement.scale, placement.scale),
        Quaternion.RotationYawPitchRoll(placement.yaw, 0, 0),
        new Vector3(placement.x, y, placement.z),
      ).copyToArray(buffer, index * 16);
    });
    mesh.thinInstanceSetBuffer('matrix', buffer, 16, true);
    mesh.thinInstanceRefreshBoundingInfo(true);

    context.shadows.add(mesh);
    meshes.push(mesh);
  }

  let disposed = false;
  return {
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const mesh of meshes) {
        context.shadows.remove(mesh);
        mesh.dispose(false, false);
      }
    },
  };
}
