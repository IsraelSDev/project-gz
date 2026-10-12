import { fbm, smoothstep } from './noise';
import { gridRectToWorldBounds, terrainWorldSize } from './gridToWorld';
import type { TerrainSpec } from './WorldSnapshot';

/** Largura (em unidades de mundo) da rampa entre a área construível plana e as colinas. */
const PLATEAU_BLEND = 9;
/** Distância da borda do terreno em que o anel de colinas começa a subir. */
const RIM_WIDTH = 14;
const RIM_HEIGHT = 9;

export interface HeightField {
  /** Altura do terreno (Y) no ponto de mundo (x, z). A área construível é exatamente plana (0). */
  heightAt(x: number, z: number): number;
  /** Distância até a área construível (0 dentro dela), em unidades de mundo. */
  distanceToPlateau(x: number, z: number): number;
}

/**
 * Relevo provisório: plano na área construível, com colinas suaves fora dela e um anel de colinas
 * nas bordas que esconde o limite do terreno. A forma é decidida só pelos dados do cenário.
 */
export function createHeightField(terrain: TerrainSpec): HeightField {
  const plateau = gridRectToWorldBounds(terrain.buildableArea, terrain.sizeCells);
  const world = terrainWorldSize(terrain.sizeCells);
  const halfWidth = world.width / 2;
  const halfDepth = world.depth / 2;
  const seed = terrain.seed;

  const distanceToPlateau = (x: number, z: number): number => {
    const dx = Math.max(plateau.minX - x, 0, x - plateau.maxX);
    const dz = Math.max(plateau.minZ - z, 0, z - plateau.maxZ);
    return Math.hypot(dx, dz);
  };

  const heightAt = (x: number, z: number): number => {
    const ramp = smoothstep(0, PLATEAU_BLEND, distanceToPlateau(x, z));
    if (ramp === 0) {
      return 0;
    }
    const hills = Math.max(0, fbm(x * 0.06, z * 0.06, seed) - 0.32) * 8;
    const detail = (fbm(x * 0.22 + 40, z * 0.22 - 40, seed + 7) - 0.5) * 0.6;
    const edgeDistance = Math.min(halfWidth - Math.abs(x), halfDepth - Math.abs(z));
    const rimT = 1 - smoothstep(0, RIM_WIDTH, edgeDistance);
    return ramp * (hills + detail) + rimT * rimT * RIM_HEIGHT * ramp;
  };

  return { heightAt, distanceToPlateau };
}
