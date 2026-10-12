import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { PALETTE } from './palette';

/** Materiais compartilhados da cena: poucos e reutilizados (as cores vêm dos vértices). */
export interface SceneMaterials {
  /** Para meshes com cor por vértice (props, edifícios, nave). */
  readonly solid: StandardMaterial;
  readonly terrain: StandardMaterial;
  readonly horizon: StandardMaterial;
  /** Para o domo do céu (cor por vértice, sem iluminação nem neblina). */
  readonly sky: StandardMaterial;
  readonly moonLarge: StandardMaterial;
  readonly moonSmall: StandardMaterial;
  readonly glowWarm: StandardMaterial;
  readonly glowCyan: StandardMaterial;
  readonly glowEmber: StandardMaterial;
  readonly glowGreen: StandardMaterial;
  /** Marcador de seleção das construções: emissivo, sem iluminação e sem neblina. */
  readonly selection: StandardMaterial;
}

function matte(scene: Scene, name: string, hex: string): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.FromHexString(hex);
  material.specularColor = Color3.Black();
  return material;
}

function glow(scene: Scene, name: string, hex: string, fog = true): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.emissiveColor = Color3.FromHexString(hex);
  material.disableLighting = true;
  material.fogEnabled = fog;
  return material;
}

export function createMaterials(scene: Scene): SceneMaterials {
  const solid = new StandardMaterial('solid', scene);
  solid.diffuseColor = Color3.White();
  solid.specularColor = new Color3(0.14, 0.14, 0.14);
  solid.specularPower = 28;

  const terrain = new StandardMaterial('terrain', scene);
  terrain.diffuseColor = Color3.White();
  terrain.specularColor = Color3.Black();

  const sky = new StandardMaterial('sky', scene);
  sky.diffuseColor = Color3.Black();
  sky.specularColor = Color3.Black();
  sky.emissiveColor = Color3.White();
  sky.disableLighting = true;
  sky.backFaceCulling = false;
  sky.fogEnabled = false;

  return {
    solid,
    terrain,
    sky,
    horizon: matte(scene, 'horizon', PALETTE.terrain.horizonGround),
    moonLarge: glow(scene, 'moon-large', PALETTE.moonLarge, false),
    moonSmall: glow(scene, 'moon-small', PALETTE.moonSmall, false),
    glowWarm: glow(scene, 'glow-warm', PALETTE.glow.warm),
    glowCyan: glow(scene, 'glow-cyan', PALETTE.glow.cyan),
    glowEmber: glow(scene, 'glow-ember', PALETTE.glow.ember),
    glowGreen: glow(scene, 'glow-green', PALETTE.glow.green),
    selection: glow(scene, 'selection', PALETTE.selection, false),
  };
}
