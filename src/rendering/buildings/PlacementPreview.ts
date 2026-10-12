import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { GridSize } from '@/shared/grid/types';
import { createPropKit } from '../props/propKit';
import { PALETTE } from '../scene/palette';
import type { SceneContext } from '../scene/createSceneContext';
import { CELL_SIZE, placedCenterToWorld, rotationToRadians } from '../world/gridToWorld';
import type { PlacementPreviewSpec } from '../world/WorldSnapshot';
import { BUILDING_MODELS } from './buildingModels';

/** Espessura e altura das barras da moldura e do "X" (unidades de mundo). */
const BAR_THICKNESS = 0.22;
const BAR_HEIGHT = 0.08;
/** Altura da moldura sobre o terreno, acima das bases dos modelos. */
const FRAME_LIFT = 0.1;
const FILL_HEIGHT = 0.04;
const GHOST_ALPHA = 0.6;
const FILL_ALPHA = 0.3;

export interface PlacementPreviewLayer {
  /**
   * Mostra, move ou esconde a prévia (`null` esconde). Só desenha: não altera o estado do jogo, não
   * desconta recursos e não participa do picking. Trocar só a validade ou a posição não recria
   * nada; trocar o edifício ou o tamanho recria a prévia.
   */
  update(
    spec: PlacementPreviewSpec | null,
    terrainSize: GridSize,
    heightAt: (x: number, z: number) => number,
  ): void;
  /** Libera a prévia, os materiais e os meshes. Idempotente. */
  dispose(): void;
}

interface PreviewMaterials {
  readonly ghostValid: StandardMaterial;
  readonly ghostInvalid: StandardMaterial;
  readonly fillValid: StandardMaterial;
  readonly fillInvalid: StandardMaterial;
  readonly lineValid: StandardMaterial;
  readonly lineInvalid: StandardMaterial;
}

/** Material emissivo plano (sem iluminação), para a moldura, o preenchimento e o "X". */
function flat(context: SceneContext, name: string, hex: string, alpha: number): StandardMaterial {
  const material = new StandardMaterial(name, context.scene);
  material.diffuseColor = Color3.Black();
  material.specularColor = Color3.Black();
  material.emissiveColor = Color3.FromHexString(hex);
  material.disableLighting = true;
  material.fogEnabled = false;
  material.alpha = alpha;
  return material;
}

/** Fantasma do edifício: as cores do modelo, translúcidas e com um tom de validade somado. */
function ghost(
  context: SceneContext,
  name: string,
  tint: string,
  strength: number,
): StandardMaterial {
  const material = new StandardMaterial(name, context.scene);
  material.diffuseColor = Color3.White();
  material.specularColor = Color3.Black();
  material.emissiveColor = Color3.FromHexString(tint).scale(strength);
  material.alpha = GHOST_ALPHA;
  return material;
}

function createMaterials(context: SceneContext): PreviewMaterials {
  const { valid, invalid } = PALETTE.placement;
  return {
    ghostValid: ghost(context, 'preview-ghost-valid', valid, 0.4),
    ghostInvalid: ghost(context, 'preview-ghost-invalid', invalid, 0.55),
    fillValid: flat(context, 'preview-fill-valid', valid, FILL_ALPHA),
    fillInvalid: flat(context, 'preview-fill-invalid', invalid, FILL_ALPHA),
    lineValid: flat(context, 'preview-line-valid', valid, 1),
    lineInvalid: flat(context, 'preview-line-invalid', invalid, 1),
  };
}

interface PreviewParts {
  readonly key: string;
  readonly root: TransformNode;
  readonly ghost: Mesh;
  readonly fill: Mesh;
  readonly frame: Mesh;
  /** "X" sobre o footprint: marca o inválido pela FORMA, não só pela cor. */
  readonly cross: Mesh;
}

/**
 * Camada da prévia de construção (Arquitetura §21.4). Mostra um fantasma translúcido do edifício
 * (que também mostra para onde a frente aponta, então a rotação fica visível), uma moldura com
 * preenchimento no chão e, SE inválida, um "X" por cima. A validade muda a cor e acrescenta o "X": a
 * indicação não depende só da cor. Nada aqui é "pickable", projeta sombra ou entra no estado.
 */
export function createPlacementPreviewLayer(context: SceneContext): PlacementPreviewLayer {
  const kit = createPropKit(context.scene);
  const materials = createMaterials(context);
  let parts: PreviewParts | null = null;
  let disposed = false;

  const disposeParts = (): void => {
    if (parts) {
      parts.root.dispose(false, false);
      parts = null;
    }
  };

  const build = (spec: PlacementPreviewSpec, key: string): PreviewParts => {
    const width = spec.size.width * CELL_SIZE;
    const depth = spec.size.depth * CELL_SIZE;
    const root = new TransformNode('placement-preview', context.scene);

    const model = BUILDING_MODELS[spec.definitionId](kit, context.materials, { width, depth });
    // Só o sólido vira fantasma: as partes luminosas usam materiais compartilhados com os edifícios
    // reais e não podem ser tocadas.
    for (const glowing of model.glowing) {
      glowing.dispose(false, false);
    }

    const halfW = width / 2 + 0.1;
    const halfD = depth / 2 + 0.1;
    const white = '#ffffff';
    const fill = kit.merge('preview-fill', [
      kit.box({ w: width, h: FILL_HEIGHT, d: depth }, white, { y: FILL_HEIGHT / 2 }),
    ]);
    const frame = kit.merge('preview-frame', [
      kit.box({ w: width + 0.2, h: BAR_HEIGHT, d: BAR_THICKNESS }, white, {
        y: FRAME_LIFT,
        z: -halfD,
      }),
      kit.box({ w: width + 0.2, h: BAR_HEIGHT, d: BAR_THICKNESS }, white, {
        y: FRAME_LIFT,
        z: halfD,
      }),
      kit.box({ w: BAR_THICKNESS, h: BAR_HEIGHT, d: depth + 0.2 }, white, {
        y: FRAME_LIFT,
        x: -halfW,
      }),
      kit.box({ w: BAR_THICKNESS, h: BAR_HEIGHT, d: depth + 0.2 }, white, {
        y: FRAME_LIFT,
        x: halfW,
      }),
    ]);
    const diagonal = Math.hypot(width, depth) * 0.9;
    const angle = Math.atan2(depth, width);
    const cross = kit.merge('preview-cross', [
      kit.box({ w: diagonal, h: BAR_HEIGHT, d: BAR_THICKNESS }, white, {
        y: FRAME_LIFT + 0.02,
        ry: angle,
      }),
      kit.box({ w: diagonal, h: BAR_HEIGHT, d: BAR_THICKNESS }, white, {
        y: FRAME_LIFT + 0.02,
        ry: -angle,
      }),
    ]);

    for (const mesh of [model.solid, fill, frame, cross]) {
      mesh.parent = root;
      mesh.isPickable = false;
      mesh.receiveShadows = false;
    }
    return { key, root, ghost: model.solid, fill, frame, cross };
  };

  return {
    update: (spec, terrainSize, heightAt) => {
      if (disposed) {
        return;
      }
      if (!spec) {
        disposeParts();
        return;
      }

      const key = `${spec.definitionId}|${spec.size.width}x${spec.size.depth}`;
      if (parts?.key !== key) {
        disposeParts();
        parts = build(spec, key);
      }
      const current = parts;

      const center = placedCenterToWorld(spec, terrainSize);
      current.root.position.set(center.x, heightAt(center.x, center.z), center.z);
      current.root.rotation.y = rotationToRadians(spec.rotation);

      current.ghost.material = spec.valid ? materials.ghostValid : materials.ghostInvalid;
      current.fill.material = spec.valid ? materials.fillValid : materials.fillInvalid;
      current.frame.material = spec.valid ? materials.lineValid : materials.lineInvalid;
      current.cross.material = materials.lineInvalid;
      current.cross.setEnabled(!spec.valid);
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      disposeParts();
      for (const material of Object.values(materials)) {
        material.dispose();
      }
    },
  };
}
