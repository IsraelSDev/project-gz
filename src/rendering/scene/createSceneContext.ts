import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
// Necessário para que o Scene renderize os mapas de sombra (efeito colateral do módulo).
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Scene } from '@babylonjs/core/scene';
import { createMaterials, type SceneMaterials } from './materials';
import { PALETTE } from './palette';
import { clamp01 } from '../world/noise';

export interface ShadowCasters {
  add(mesh: AbstractMesh): void;
  remove(mesh: AbstractMesh): void;
}

/** Cena do Babylon.js com céu, neblina, luzes, sombras e materiais compartilhados. */
export interface SceneContext {
  readonly scene: Scene;
  readonly materials: SceneMaterials;
  readonly shadows: ShadowCasters;
  /** Libera luzes, sombras, meshes, materiais e a própria cena. Idempotente. */
  dispose(): void;
}

const SKY_RADIUS = 400;
/** Direção em que a luz do sol viaja (vem do noroeste, por cima). */
const SUN_DIRECTION = new Vector3(0.45, -0.75, -0.45).normalize();

function createSkyDome(scene: Scene, materials: SceneMaterials): void {
  const dome = CreateSphere('sky-dome', { diameter: SKY_RADIUS * 2, segments: 24 }, scene);
  const positions = dome.getVerticesData(VertexBuffer.PositionKind);
  if (positions) {
    const zenith = Color3.FromHexString(PALETTE.sky.zenith);
    const high = Color3.FromHexString(PALETTE.sky.high);
    const horizon = Color3.FromHexString(PALETTE.sky.horizon);
    const colors = new Float32Array((positions.length / 3) * 4);
    for (let index = 0; index < positions.length / 3; index += 1) {
      const t = clamp01((positions[index * 3 + 1] ?? 0) / SKY_RADIUS);
      const color =
        t < 0.3
          ? Color3.Lerp(horizon, high, t / 0.3)
          : Color3.Lerp(high, zenith, clamp01((t - 0.3) / 0.7));
      colors[index * 4] = color.r;
      colors[index * 4 + 1] = color.g;
      colors[index * 4 + 2] = color.b;
      colors[index * 4 + 3] = 1;
    }
    dome.setVerticesData(VertexBuffer.ColorKind, colors);
  }
  dome.material = materials.sky;
  dome.infiniteDistance = true;
  dome.isPickable = false;

  const largeMoon = CreateSphere('moon-large', { diameter: 46, segments: 20 }, scene);
  largeMoon.material = materials.moonLarge;
  largeMoon.position.set(190, 28, 340);
  const smallMoon = CreateSphere('moon-small', { diameter: 16, segments: 16 }, scene);
  smallMoon.material = materials.moonSmall;
  smallMoon.position.set(-70, 70, 370);
  for (const moon of [largeMoon, smallMoon]) {
    moon.infiniteDistance = true;
    moon.isPickable = false;
  }

  // Plano distante: evita ver o "vazio" além do terreno; a neblina o funde com o horizonte.
  const horizonGround = CreateGround('horizon-ground', { width: 1600, height: 1600 }, scene);
  horizonGround.position.y = -0.4;
  horizonGround.material = materials.horizon;
  horizonGround.isPickable = false;
}

export function createSceneContext(engine: AbstractEngine): SceneContext {
  const scene = new Scene(engine);
  const horizonColor = Color3.FromHexString(PALETTE.fog);
  scene.clearColor = new Color4(horizonColor.r, horizonColor.g, horizonColor.b, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0075;
  scene.fogColor = horizonColor;

  const materials = createMaterials(scene);
  createSkyDome(scene, materials);

  const fill = new HemisphericLight('sky-fill', new Vector3(0, 1, 0), scene);
  fill.diffuse = Color3.FromHexString(PALETTE.skyFill);
  fill.groundColor = Color3.FromHexString(PALETTE.groundBounce);
  fill.specular = Color3.Black();
  fill.intensity = 0.7;

  const sun = new DirectionalLight('sun', SUN_DIRECTION, scene);
  sun.position = SUN_DIRECTION.scale(-90);
  sun.diffuse = Color3.FromHexString(PALETTE.sun);
  sun.intensity = 1.35;
  sun.autoCalcShadowZBounds = true;

  // Sombras com cautela: um único mapa de 2048, filtragem de qualidade baixa.
  const generator = new ShadowGenerator(2048, sun);
  generator.usePercentageCloserFiltering = true;
  generator.filteringQuality = ShadowGenerator.QUALITY_LOW;
  generator.bias = 0.0025;
  generator.normalBias = 0.045;
  generator.setDarkness(0.25);

  let disposed = false;
  return {
    scene,
    materials,
    shadows: {
      add: (mesh) => generator.addShadowCaster(mesh),
      remove: (mesh) => generator.removeShadowCaster(mesh),
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      generator.dispose();
      scene.dispose();
    },
  };
}
