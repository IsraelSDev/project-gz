import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Scene } from '@babylonjs/core/scene';
import { afterEach, describe, expect, it } from 'vitest';
import { adaptGlbMaterialsToScene } from '@/rendering/assets/glbMaterials';

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

/** Caixa com uma cor por vértice (linear, como o glTF guarda). */
function boxWithColor(scene: Scene, name: string, linear: number, alpha = 0.5): Mesh {
  const box = CreateBox(name, { size: 1 }, scene);
  const colors = new Float32Array(box.getTotalVertices() * 4);
  for (let index = 0; index < colors.length; index += 4) {
    colors.set([linear, linear, linear, alpha], index);
  }
  box.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);
  return box;
}

function pbr(scene: Scene, name: string, roughness: number): PBRMaterial {
  const material = new PBRMaterial(name, scene);
  material.albedoColor = new Color3(0.214, 0.0, 1.0);
  material.emissiveColor = new Color3(0.214, 0.214, 0.0);
  material.roughness = roughness;
  material.metallic = 0.2;
  return material;
}

describe('materiais de GLB na cena do jogo', () => {
  it('troca PBR por StandardMaterial no espaço gama da cena, com brilho conforme a lisura', () => {
    const scene = makeScene();
    const rough = boxWithColor(scene, 'rough', 1);
    const smooth = boxWithColor(scene, 'smooth', 1);
    rough.material = pbr(scene, 'rough', 1);
    smooth.material = pbr(scene, 'smooth', 0.1);

    adaptGlbMaterialsToScene([rough, smooth], scene);

    const adapted = rough.material as StandardMaterial;
    expect(adapted).toBeInstanceOf(StandardMaterial);
    // 0,214 linear ≈ 0,5 em sRGB.
    expect(adapted.diffuseColor.r).toBeCloseTo(0.5, 2);
    expect(adapted.diffuseColor.b).toBeCloseTo(1, 5);
    expect(adapted.emissiveColor.g).toBeCloseTo(0.5, 2);
    const glossy = smooth.material as StandardMaterial;
    expect(glossy.specularColor.r).toBeGreaterThan(adapted.specularColor.r);
    expect(glossy.specularPower).toBeGreaterThan(adapted.specularPower);
  });

  it('converte as cores por vértice para gama uma vez por geometria, sem mexer no alfa', () => {
    const scene = makeScene();
    const box = boxWithColor(scene, 'box', 0.214);
    box.material = pbr(scene, 'box', 0.5);
    // Outra malha com a MESMA geometria (como primitivas que compartilham dados num GLB).
    const twin = new Mesh('twin', scene);
    box.geometry!.applyToMesh(twin);
    twin.material = box.material;

    adaptGlbMaterialsToScene([box, twin], scene);

    const colors = box.getVerticesData(VertexBuffer.ColorKind)!;
    expect(colors[0]).toBeCloseTo(0.5, 2);
    expect(colors[3]).toBe(0.5);
  });

  it('tira do passe transparente as malhas cujo alfa por vértice é todo 1', () => {
    const scene = makeScene();
    const opaque = boxWithColor(scene, 'opaque', 1, 1);
    const translucent = boxWithColor(scene, 'translucent', 1, 0.5);
    opaque.material = pbr(scene, 'opaque', 0.5);
    translucent.material = pbr(scene, 'translucent', 0.5);
    opaque.hasVertexAlpha = true;
    translucent.hasVertexAlpha = true;

    adaptGlbMaterialsToScene([opaque, translucent], scene);

    expect(opaque.hasVertexAlpha).toBe(false);
    expect(translucent.hasVertexAlpha).toBe(true);
  });

  it('compartilha um material convertido entre malhas e ignora materiais que não são PBR', () => {
    const scene = makeScene();
    const shared = pbr(scene, 'shared', 0.5);
    const a = boxWithColor(scene, 'a', 1);
    const b = boxWithColor(scene, 'b', 1);
    const plain = boxWithColor(scene, 'plain', 1);
    const standard = new StandardMaterial('plain', scene);
    a.material = shared;
    b.material = shared;
    plain.material = standard;

    adaptGlbMaterialsToScene([a, b, plain], scene);

    expect(a.material).toBe(b.material);
    expect(a.material).not.toBe(shared);
    expect(plain.material).toBe(standard);
  });

  it('libera só os materiais que criou, uma única vez', () => {
    const scene = makeScene();
    const original = pbr(scene, 'original', 0.5);
    const box = boxWithColor(scene, 'box', 1);
    box.material = original;

    const adapted = adaptGlbMaterialsToScene([box], scene);
    const created = box.material;
    adapted.dispose();
    adapted.dispose();

    expect(scene.materials).not.toContain(created);
    expect(scene.materials).toContain(original);
  });
});
