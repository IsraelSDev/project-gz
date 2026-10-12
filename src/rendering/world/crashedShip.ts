import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { createPropKit } from '../props/propKit';
import type { SceneContext } from '../scene/createSceneContext';
import { PALETTE } from '../scene/palette';
import { placedCenterToWorld, rotationToRadians } from './gridToWorld';
import type { HeightField } from './heightField';
import type { PlacedSpec, TerrainSpec } from './WorldSnapshot';

const { metal, terrain, glow } = PALETTE;

export interface CrashedShip {
  dispose(): void;
}

/**
 * Nave de exploração acidentada, modelada com primitivas. O comprimento segue o eixo X local
 * (nariz para -X, enterrado e inclinado); a posição e a orientação vêm dos dados do cenário.
 */
export function createCrashedShip(
  context: SceneContext,
  ship: PlacedSpec,
  terrainSpec: TerrainSpec,
  field: HeightField,
): CrashedShip {
  const kit = createPropKit(context.scene);
  const center = placedCenterToWorld(ship, terrainSpec.sizeCells);

  const root = new TransformNode('crashed-ship', context.scene);
  root.position.set(center.x, field.heightAt(center.x, center.z), center.z);
  root.rotation.y = rotationToRadians(ship.rotation);

  // Casco: elipsoide + motor + nariz + asas, uma asa quebrada, deriva torta e estruturas expostas.
  const hull = kit.merge('ship-hull', [
    kit.sphere({ diameter: 2, segments: 20 }, metal.hull, { sx: 7, sy: 1.7, sz: 1.9 }),
    kit.cylinder({ height: 3.2, bottom: 3.3, top: 3.0, tessellation: 20 }, metal.hullDark, {
      x: 6.2,
      rz: Math.PI / 2,
    }),
    kit.cylinder({ height: 3.4, bottom: 2.7, top: 0.05, tessellation: 18 }, metal.hullLight, {
      x: -6.4,
      rz: Math.PI / 2,
    }),
    kit.sphere({ diameter: 0.9, segments: 8 }, metal.accent, { x: -8.0, y: -0.05 }),
    kit.box({ w: 3.6, h: 0.1, d: 2.0 }, metal.accent, { x: -1.2, y: 1.6, rz: 0.04 }),
    kit.box({ w: 2.2, h: 0.1, d: 1.3 }, metal.burnt, { x: 2.3, y: 1.58, z: 0.3, ry: 0.3 }),
    // asa esquerda inteira
    kit.box({ w: 4.4, h: 0.25, d: 4.8 }, metal.hullDark, {
      x: 0.9,
      y: -0.25,
      z: 3.9,
      ry: 0.3,
      rx: 0.05,
    }),
    kit.box({ w: 1.0, h: 0.28, d: 1.6 }, metal.accent, { x: 1.9, y: -0.25, z: 6.2, ry: 0.3 }),
    // asa direita quebrada
    kit.box({ w: 2.4, h: 0.25, d: 2.6 }, metal.hullDark, { x: 1.3, y: -0.3, z: -3.0, ry: -0.3 }),
    // deriva torta
    kit.box({ w: 2.4, h: 2.4, d: 0.22 }, metal.hull, { x: 5.4, y: 2.3, z: 0.3, rx: 0.32 }),
    kit.box({ w: 1.2, h: 1.0, d: 0.2 }, metal.hullDark, { x: 5.0, y: 1.6, z: -0.6, rx: -0.4 }),
    // bocais do motor
    kit.cylinder({ height: 1.6, bottom: 1.5, top: 1.2, tessellation: 14 }, metal.burnt, {
      x: 8.0,
      z: 1.0,
      rz: Math.PI / 2,
    }),
    kit.cylinder({ height: 1.6, bottom: 1.5, top: 1.2, tessellation: 14 }, metal.burnt, {
      x: 8.0,
      z: -1.0,
      rz: Math.PI / 2,
    }),
    // trens de pouso tortos
    kit.cylinder({ height: 1.9, bottom: 0.22, top: 0.16, tessellation: 8 }, metal.steel, {
      x: -1.6,
      y: -1.7,
      z: 1.7,
      rx: 0.35,
    }),
    kit.cylinder({ height: 1.9, bottom: 0.22, top: 0.16, tessellation: 8 }, metal.steel, {
      x: -1.4,
      y: -1.5,
      z: -1.9,
      rx: -0.7,
      rz: 0.2,
    }),
    // estrutura exposta na avaria
    kit.box({ w: 0.12, h: 1.6, d: 0.12 }, metal.steel, { x: 2.4, y: 1.9, z: 0.2, rz: 0.4 }),
    kit.box({ w: 0.12, h: 1.3, d: 0.12 }, metal.steel, { x: 2.9, y: 1.8, z: 0.6, rz: -0.5 }),
    kit.box({ w: 0.12, h: 1.1, d: 0.12 }, metal.steel, { x: 3.2, y: 1.7, z: -0.1, rx: 0.5 }),
    // antena torta com prato
    kit.cylinder({ height: 2.2, bottom: 0.07, top: 0.05, tessellation: 6 }, metal.steel, {
      x: 2.6,
      y: 2.7,
      z: -0.9,
      rz: 0.7,
    }),
    kit.sphere({ diameter: 0.9, segments: 10, slice: 0.5 }, metal.hullLight, {
      x: 3.5,
      y: 3.5,
      z: -0.9,
      rz: -0.8,
    }),
  ]);
  hull.material = context.materials.solid;
  hull.receiveShadows = true;

  const canopy = kit.merge('ship-canopy', [
    kit.sphere({ diameter: 2, segments: 16 }, glow.cyan, {
      x: -3.4,
      y: 1.25,
      sx: 1.6,
      sy: 0.8,
      sz: 1.0,
    }),
  ]);
  canopy.material = context.materials.glowCyan;

  const embers = kit.merge('ship-embers', [
    kit.sphere({ diameter: 1.0, segments: 8 }, glow.ember, { x: 8.55, z: 1.0 }),
    kit.sphere({ diameter: 1.0, segments: 8 }, glow.ember, { x: 8.55, z: -1.0 }),
    kit.sphere({ diameter: 0.5, segments: 6 }, glow.ember, { x: 3.1, y: 1.65, z: 0.1 }),
  ]);
  embers.material = context.materials.glowEmber;

  // Casco inclinado: cauda para cima, nariz afundando no terreno.
  const tilt = new TransformNode('ship-tilt', context.scene);
  tilt.parent = root;
  tilt.position.y = 1.9;
  tilt.rotation.z = 0.12;
  tilt.rotation.x = -0.06;
  for (const part of [hull, canopy, embers]) {
    part.parent = tilt;
    part.isPickable = false;
  }

  // Terra revolvida no nariz e marca de queimado sob a nave (não inclinadas).
  const ground = kit.merge('ship-ground', [
    kit.cylinder({ height: 0.05, bottom: 17, tessellation: 32 }, metal.burnt, {
      y: 0.07,
      sz: 0.62,
    }),
    kit.sphere({ diameter: 4, segments: 10, slice: 0.5 }, terrain.sand, {
      x: -8.4,
      y: 0,
      sx: 1.3,
      sy: 0.55,
      sz: 1.0,
    }),
    kit.sphere({ diameter: 2.4, segments: 8, slice: 0.5 }, terrain.dust, {
      x: -6.6,
      y: 0,
      z: 1.8,
      sy: 0.4,
    }),
  ]);
  ground.material = context.materials.solid;
  ground.parent = root;
  ground.isPickable = false;
  ground.receiveShadows = true;

  const shadowCasters: Mesh[] = [hull];
  for (const caster of shadowCasters) {
    context.shadows.add(caster);
  }

  let disposed = false;
  return {
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const caster of shadowCasters) {
        context.shadows.remove(caster);
      }
      root.dispose(false, false);
    },
  };
}
