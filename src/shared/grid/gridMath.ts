import { ROTATIONS, type GridPosition, type GridRect, type GridSize, type Rotation } from './types';

export function isRotation(value: unknown): value is Rotation {
  return ROTATIONS.some((rotation) => rotation === value);
}

/** Extensão ocupada por um footprint depois da rotação (90° e 270° trocam largura e profundidade). */
export function rotatedSize(size: GridSize, rotation: Rotation): GridSize {
  return rotation === 90 || rotation === 270
    ? { width: size.depth, depth: size.width }
    : { width: size.width, depth: size.depth };
}

/**
 * Retângulo ocupado por um objeto. `position` é a célula de menor x e menor y do retângulo
 * já rotacionado; a rotação acontece em torno do centro do retângulo.
 */
export function occupiedRect(position: GridPosition, size: GridSize, rotation: Rotation): GridRect {
  const rotated = rotatedSize(size, rotation);
  return { x: position.x, y: position.y, width: rotated.width, depth: rotated.depth };
}

export function rectContainsRect(outer: GridRect, inner: GridRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.depth <= outer.y + outer.depth
  );
}

export function rectsOverlap(a: GridRect, b: GridRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.depth && b.y < a.y + a.depth;
}
