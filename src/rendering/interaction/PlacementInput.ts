import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { Scene } from '@babylonjs/core/scene';
import type { GridPosition, GridSize } from '@/shared/grid/types';
import { pickGridCell } from './groundPicking';

/** Mesma tolerância de clique da seleção: acima disso o gesto é um arrasto (girar a câmera). */
const CLICK_TOLERANCE_PX = 6;
const PRIMARY_BUTTON = 0;

export type PlacementCellSource = 'hover' | 'click';

export interface PlacementInput {
  /** Liga ou desliga o modo de posicionamento. Desligado, nenhum evento de ponteiro é tratado. */
  setActive(active: boolean): void;
  /** Remove o observador de ponteiro. Idempotente. */
  dispose(): void;
}

/**
 * Entrada do modo de construção: um observador de ponteiro na cena que transforma o ponteiro em
 * CÉLULAS do grid. O ponteiro passando por uma célula nova chama `onCell(cell, 'hover')` (só quando a
 * célula muda) e um clique do botão principal (apertar e soltar sem arrastar) chama
 * `onCell(cell, 'click')`. O renderizador não conhece as regras: quem o cria decide o que a célula
 * significa. A seleção por clique é suspensa à parte (o `BuildingPicking` recebe `isEnabled`).
 */
export function createPlacementInput(
  scene: Scene,
  getTerrainSize: () => GridSize | null,
  onCell: (cell: GridPosition, source: PlacementCellSource) => void,
): PlacementInput {
  let active = false;
  let press: { readonly x: number; readonly y: number } | null = null;
  let lastCell: GridPosition | null = null;

  const cellAt = (): GridPosition | null => {
    const terrainSize = getTerrainSize();
    return terrainSize ? pickGridCell(scene, scene.pointerX, scene.pointerY, terrainSize) : null;
  };

  const observer = scene.onPointerObservable.add(
    (info) => {
      if (!active) {
        return;
      }

      if (info.type === PointerEventTypes.POINTERMOVE) {
        const cell = cellAt();
        if (cell && (!lastCell || lastCell.x !== cell.x || lastCell.y !== cell.y)) {
          lastCell = cell;
          onCell(cell, 'hover');
        }
        return;
      }

      if (info.type === PointerEventTypes.POINTERDOWN) {
        press =
          info.event.button === PRIMARY_BUTTON ? { x: scene.pointerX, y: scene.pointerY } : null;
        return;
      }

      // POINTERUP
      const start = press;
      press = null;
      if (!start || info.event.button !== PRIMARY_BUTTON) {
        return;
      }
      if (Math.hypot(scene.pointerX - start.x, scene.pointerY - start.y) <= CLICK_TOLERANCE_PX) {
        const cell = cellAt();
        if (cell) {
          lastCell = cell;
          onCell(cell, 'click');
        }
      }
    },
    PointerEventTypes.POINTERMOVE | PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERUP,
  );

  return {
    setActive: (next) => {
      active = next;
      press = null;
      lastCell = null;
    },
    dispose: () => {
      scene.onPointerObservable.remove(observer);
    },
  };
}
