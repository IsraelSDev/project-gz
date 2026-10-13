import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Material } from '@babylonjs/core/Materials/material';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';

export interface AdaptedMaterials {
  /** Libera os materiais criados (os originais continuam com o GLB). Idempotente. */
  dispose(): void;
}

function isPbr(material: Material | null): material is PBRMaterial {
  return material !== null && material.getClassName() === 'PBRMaterial';
}

/** Converte um canal de cor do espaço linear para o gama (sRGB). */
function toGamma(value: number): number {
  return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

/**
 * Os GLBs chegam com materiais PBR (metallic-roughness, cores lineares). A cena do jogo foi
 * calibrada para `StandardMaterial` e não tem mapa de ambiente: nela o PBR perde o reflexo do
 * ambiente e as cores escuras puxam para o tom quente da luz e da névoa (o grafite vira marrom).
 * Este adaptador troca cada material PBR por um `StandardMaterial` equivalente, no espaço gama do
 * resto da cena, e converte as cores por vértice (lineares no glTF) para o mesmo espaço. Materiais
 * que não são PBR ficam como estão.
 */
export function adaptGlbMaterialsToScene(
  meshes: readonly AbstractMesh[],
  scene: Scene,
): AdaptedMaterials {
  const created = new Map<Material, StandardMaterial>();
  // Malhas podem compartilhar a geometria: as cores de cada geometria são convertidas uma vez.
  const convertedGeometries = new Set<unknown>();

  for (const mesh of meshes) {
    const source = mesh.material;
    if (!isPbr(source)) {
      continue;
    }
    let adapted = created.get(source);
    if (!adapted) {
      adapted = new StandardMaterial(`${source.name}-scene`, scene);
      adapted.diffuseColor = source.albedoColor.toGammaSpace();
      adapted.emissiveColor = source.emissiveColor.toGammaSpace();
      // Brilho especular proporcional à lisura: vidro brilha, casco fosco quase não.
      const smoothness = 1 - (source.roughness ?? 1);
      const specular = 0.06 + 0.3 * smoothness;
      adapted.specularColor.set(specular, specular, specular);
      adapted.specularPower = 8 + 120 * smoothness * smoothness;
      adapted.alpha = source.alpha;
      adapted.backFaceCulling = source.backFaceCulling;
      adapted.diffuseTexture = source.albedoTexture;
      adapted.emissiveTexture = source.emissiveTexture;
      created.set(source, adapted);
    }
    mesh.material = adapted;

    const colors = mesh.getVerticesData(VertexBuffer.ColorKind);
    const geometry = (mesh as { geometry?: unknown }).geometry ?? mesh;
    if (!colors) {
      continue;
    }
    const stride = colors.length / mesh.getTotalVertices();
    let opaque = true;
    for (let index = 3; stride === 4 && index < colors.length; index += 4) {
      opaque &&= colors[index]! >= 0.999;
    }
    // O loader marca alfa por vértice sempre que COLOR_0 tem 4 componentes; com alfa todo 1 isso
    // só mandaria a malha para o passe transparente (sem escrita de profundidade) e o casco
    // cobriria os detalhes.
    if (opaque) {
      mesh.hasVertexAlpha = false;
    }
    if (!convertedGeometries.has(geometry)) {
      convertedGeometries.add(geometry);
      const converted = new Float32Array(colors.length);
      for (let index = 0; index < colors.length; index += 1) {
        // O alfa (quarto componente, quando existe) não tem espaço de cor.
        converted[index] =
          stride === 4 && index % 4 === 3 ? colors[index]! : toGamma(colors[index]!);
      }
      mesh.setVerticesData(VertexBuffer.ColorKind, converted, false, stride);
    }
  }

  let disposed = false;
  return {
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      for (const material of created.values()) {
        // As texturas pertencem ao GLB e são liberadas com ele.
        material.dispose(false, false);
      }
    },
  };
}
