import { fbm, smoothstep } from './noise';
import { gridRectToWorldBounds, terrainWorldSize } from './gridToWorld';
import type { TerrainSpec } from './WorldSnapshot';

/** Largura (em unidades de mundo) da rampa entre a área construível plana e as colinas. */
const PLATEAU_BLEND = 15;
/** Distância da borda do terreno em que o anel de colinas começa a subir. */
const RIM_WIDTH = 22;
const RIM_HEIGHT = 5.2;

export interface HeightField {
  /** Altura do terreno (Y) no ponto de mundo (x, z). A área construível é exatamente plana (0). */
  heightAt(x: number, z: number): number;
  /** Distância até a área construível (0 dentro dela), em unidades de mundo. */
  distanceToPlateau(x: number, z: number): number;
}

/**
 * Relevo procedural do bioma: planalto plano para construção, colinas estratificadas e um anel
 * rochoso nas bordas. A forma depende somente dos dados do cenário.
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
    const broadHills = Math.max(0, fbm(x * 0.055, z * 0.055, seed) - 0.32) * 6.2;
    const ridgeSignal = 1 - Math.abs(fbm(x * 0.115 + 13, z * 0.115 - 29, seed + 17) - 0.5) * 2;
    const ridges = Math.max(0, ridgeSignal - 0.62) * 1.2;
    const detail = (fbm(x * 0.2 + 40, z * 0.2 - 40, seed + 7) - 0.5) * 0.28;
    const edgeDistance = Math.min(halfWidth - Math.abs(x), halfDepth - Math.abs(z));
    const rimT = 1 - smoothstep(0, RIM_WIDTH, edgeDistance);
    const rimVariation = Math.max(0, fbm(x * 0.075 + 83, z * 0.075 - 41, seed + 29) - 0.34);
    const brokenRim = rimT * RIM_HEIGHT * rimVariation * ramp;
    return ramp * (broadHills + ridges + detail) + brokenRim;
  };

  return { heightAt, distanceToPlateau };
}
