import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { createPropKit } from '../props/propKit';
import type { SceneContext } from '../scene/createSceneContext';

/** Espessura e altura das cantoneiras (unidades de mundo). */
const THICKNESS = 0.18;
const HEIGHT = 0.06;
/** Afastamento entre a borda do footprint e a cantoneira (a base do modelo é 0,2 menor que ele). */
const GAP = 0.3;
/** Altura do centro das cantoneiras sobre o terreno, acima das bases dos modelos. */
const LIFT = 0.12;

export interface SelectionMarker {
  /** Remove o marcador da cena. Idempotente. */
  dispose(): void;
}

/**
 * Indicação visual de seleção: quatro cantoneiras no chão ao redor do footprint da construção, num
 * único mesh com material emissivo compartilhado. Fica como filho do nó do edifício, então acompanha
 * sua posição e rotação, e nunca altera o material nem a geometria do edifício. Não é "pickable",
 * não projeta nem recebe sombra e não interfere no picking. A forma (e não só a cor) marca a
 * seleção.
 *
 * `size` é o footprint sem rotação, em unidades de mundo; a rotação vem do nó pai.
 */
export function createSelectionMarker(
  context: SceneContext,
  parent: TransformNode,
  size: { readonly width: number; readonly depth: number },
): SelectionMarker {
  const kit = createPropKit(context.scene);
  const arm = Math.min(1.6, Math.max(0.8, Math.min(size.width, size.depth) * 0.3));
  const halfWidth = size.width / 2 + GAP;
  const halfDepth = size.depth / 2 + GAP;
  // Branco: a cor vem do material emissivo, sem ser multiplicada pela cor de vértice.
  const white = '#ffffff';

  const parts: Mesh[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cornerX = sx * halfWidth;
      const cornerZ = sz * halfDepth;
      // Cada braço termina rente à borda externa do canto, formando um "L" de cantos retos.
      parts.push(
        kit.box({ w: arm, h: HEIGHT, d: THICKNESS }, white, {
          x: cornerX - sx * (arm / 2 - THICKNESS / 2),
          y: LIFT,
          z: cornerZ,
        }),
        kit.box({ w: THICKNESS, h: HEIGHT, d: arm }, white, {
          x: cornerX,
          y: LIFT,
          z: cornerZ - sz * (arm / 2 - THICKNESS / 2),
        }),
      );
    }
  }

  const mesh = kit.merge('selection-marker', parts);
  mesh.material = context.materials.selection;
  mesh.parent = parent;
  mesh.isPickable = false;
  mesh.receiveShadows = false;

  let disposed = false;
  return {
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      mesh.dispose(false, false);
    },
  };
}
