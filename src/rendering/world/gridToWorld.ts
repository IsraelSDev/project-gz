import { occupiedRect } from '@/shared/grid/gridMath';
import type { GridPosition, GridRect, GridSize, Rotation } from '@/shared/grid/types';
import type { PlacedSpec } from './WorldSnapshot';

/*
 * ÚNICO módulo que converte coordenadas do grid (domínio) para o espaço do Babylon.js.
 *
 * Sistema de coordenadas:
 *  - Babylon.js é left-handed com Y para cima. O terreno é centrado na origem (0, 0).
 *  - Grid -> mundo: x do grid cresce para +X (leste); y do grid cresce para o SUL, que é -Z.
 *    Logo, norte = +Z. Uma célula mede CELL_SIZE unidades de mundo.
 *  - Um ponto de grid contínuo (x, y) é medido nas bordas das células: a célula (i, j) vai de
 *    (i, j) a (i + 1, j + 1).
 *
 * Orientação (rotação):
 *  - Rotation é em graus, no sentido HORÁRIO visto de cima (norte para cima), em passos de 90°.
 *  - Os modelos são construídos com a frente voltada para o SUL (-Z) e rotação 0. Aplicar
 *    `rotation.y = rotationToRadians(r)` no Babylon gira no sentido horário visto de cima.
 *  - A rotação ocorre em torno do centro do retângulo ocupado, que não muda com a rotação.
 */

/** Tamanho de uma célula do grid em unidades de mundo. */
export const CELL_SIZE = 2;

export interface WorldPoint {
  readonly x: number;
  readonly z: number;
}

export interface WorldBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Converte um ponto de grid contínuo (em células) para o plano XZ do mundo. */
export function gridPointToWorld(point: GridPosition, terrainSize: GridSize): WorldPoint {
  return {
    x: (point.x - terrainSize.width / 2) * CELL_SIZE,
    z: (terrainSize.depth / 2 - point.y) * CELL_SIZE,
  };
}

export function gridRectToWorldBounds(rect: GridRect, terrainSize: GridSize): WorldBounds {
  const northWest = gridPointToWorld({ x: rect.x, y: rect.y }, terrainSize);
  const southEast = gridPointToWorld(
    { x: rect.x + rect.width, y: rect.y + rect.depth },
    terrainSize,
  );
  return {
    minX: northWest.x,
    maxX: southEast.x,
    minZ: southEast.z,
    maxZ: northWest.z,
  };
}

export function gridRectCenterToWorld(rect: GridRect, terrainSize: GridSize): WorldPoint {
  return gridPointToWorld({ x: rect.x + rect.width / 2, y: rect.y + rect.depth / 2 }, terrainSize);
}

/** Centro, em mundo, do retângulo ocupado por um objeto (já considerando a rotação). */
export function placedCenterToWorld(placed: PlacedSpec, terrainSize: GridSize): WorldPoint {
  return gridRectCenterToWorld(
    occupiedRect(placed.position, placed.size, placed.rotation),
    terrainSize,
  );
}

/** Valor para `node.rotation.y` no Babylon.js (horário visto de cima). */
export function rotationToRadians(rotation: Rotation): number {
  return (rotation * Math.PI) / 180;
}

/** Extensão do terreno em unidades de mundo. */
export function terrainWorldSize(terrainSize: GridSize): {
  readonly width: number;
  readonly depth: number;
} {
  return { width: terrainSize.width * CELL_SIZE, depth: terrainSize.depth * CELL_SIZE };
}
