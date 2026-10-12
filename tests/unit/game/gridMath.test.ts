import { describe, expect, it } from 'vitest';
import {
  isRotation,
  occupiedRect,
  rectContainsRect,
  rectsOverlap,
  rotatedSize,
} from '@/shared/grid/gridMath';

describe('gridMath', () => {
  it('troca largura e profundidade em 90° e 270°, e mantém em 0° e 180°', () => {
    const size = { width: 3, depth: 2 };

    expect(rotatedSize(size, 0)).toEqual({ width: 3, depth: 2 });
    expect(rotatedSize(size, 90)).toEqual({ width: 2, depth: 3 });
    expect(rotatedSize(size, 180)).toEqual({ width: 3, depth: 2 });
    expect(rotatedSize(size, 270)).toEqual({ width: 2, depth: 3 });
  });

  it('mantém a posição (célula de menor x e y) ao calcular o retângulo ocupado', () => {
    expect(occupiedRect({ x: 23, y: 23 }, { width: 3, depth: 2 }, 90)).toEqual({
      x: 23,
      y: 23,
      width: 2,
      depth: 3,
    });
  });

  it('valida rotações em passos de 90°', () => {
    expect([0, 90, 180, 270].every(isRotation)).toBe(true);
    expect(isRotation(45)).toBe(false);
    expect(isRotation('90')).toBe(false);
  });

  it('detecta contenção e sobreposição, sem contar bordas que apenas se tocam', () => {
    const area = { x: 12, y: 12, width: 16, depth: 16 };

    expect(rectContainsRect(area, { x: 12, y: 12, width: 16, depth: 16 })).toBe(true);
    expect(rectContainsRect(area, { x: 27, y: 12, width: 2, depth: 2 })).toBe(false);
    expect(rectContainsRect(area, { x: 11, y: 12, width: 2, depth: 2 })).toBe(false);

    const a = { x: 0, y: 0, width: 2, depth: 2 };
    expect(rectsOverlap(a, { x: 1, y: 1, width: 2, depth: 2 })).toBe(true);
    expect(rectsOverlap(a, { x: 2, y: 0, width: 2, depth: 2 })).toBe(false);
    expect(rectsOverlap(a, { x: 0, y: 2, width: 2, depth: 2 })).toBe(false);
  });
});
