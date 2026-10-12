// Habilita scene.createPickingRay (efeito colateral do módulo), usado por pickGroundPoint.
import '@babylonjs/core/Culling/ray';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { GridPosition, GridSize } from '@/shared/grid/types';
import { worldToGridCell, type WorldPoint } from '../world/gridToWorld';

/**
 * Ponto do plano do chão (y = 0) sob o ponto (x, y) em pixels do canvas, ou `null` se o raio não
 * encontra o chão (aponta para o céu ou para o horizonte). A área construível é exatamente plana
 * em y = 0 (`heightField`), então o plano é exato onde se pode construir; fora dela o relevo sobe e
 * o resultado é apenas aproximado, o que não importa porque ali a posição é inválida de qualquer
 * jeito. Não usa `scene.pick`: um edifício na frente não muda a célula apontada.
 */
export function pickGroundPoint(scene: Scene, x: number, y: number): WorldPoint | null {
  const camera = scene.activeCamera;
  if (!camera) {
    return null;
  }
  const ray = scene.createPickingRay(x, y, Matrix.Identity(), camera);
  const slope = ray.direction.y;
  if (slope >= -1e-6) {
    return null;
  }
  const distance = -ray.origin.y / slope;
  if (!Number.isFinite(distance) || distance < 0) {
    return null;
  }
  return {
    x: ray.origin.x + ray.direction.x * distance,
    z: ray.origin.z + ray.direction.z * distance,
  };
}

/** Célula do grid sob o ponto (x, y) em pixels do canvas, ou `null` se não há chão ali. */
export function pickGridCell(
  scene: Scene,
  x: number,
  y: number,
  terrainSize: GridSize,
): GridPosition | null {
  const point = pickGroundPoint(scene, x, y);
  return point ? worldToGridCell(point, terrainSize) : null;
}
