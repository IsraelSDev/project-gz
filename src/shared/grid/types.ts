/*
 * Tipos do grid discreto 2D (docs/TECHNICAL_ARCHITECTURE.md §9).
 *
 * Convenção do grid (vista de cima, norte para cima):
 *  - x cresce para LESTE; y cresce para o SUL.
 *  - Todas as medidas são em CÉLULAS inteiras.
 *  - "width" é a extensão em x e "depth" a extensão em y (não é altura vertical).
 *  - A posição de um retângulo é a célula de menor x e menor y que ele ocupa.
 */

export interface GridPosition {
  readonly x: number;
  readonly y: number;
}

export interface GridSize {
  readonly width: number;
  readonly depth: number;
}

export interface GridRect extends GridPosition, GridSize {}

/** Orientação em passos de 90°, no sentido horário visto de cima. */
export type Rotation = 0 | 90 | 180 | 270;

export const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];
