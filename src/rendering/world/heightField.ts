import { fbm, smoothstep } from './noise';
import { gridRectToWorldBounds, terrainWorldSize } from './gridToWorld';
import type { TerrainSpec } from './WorldSnapshot';

/** Largura (em unidades de mundo) da rampa entre a área construível plana e as colinas. */
const PLATEAU_BLEND = 15;
/** Largura da subida do anel de colinas, medida para dentro a partir da crista. */
const RIM_WIDTH = 15;
/** Raio de arredondamento dos cantos do terreno: o anel contorna o perímetro sem quinas. */
const RIM_CORNER_RADIUS = 16;
/** A crista do anel fica entre estas distâncias da borda e varia ao longo do perímetro. */
const RIM_CREST_MIN = 11;
const RIM_CREST_SPAN = 7;
const RIM_HEIGHT = 2.5;
/**
 * Faixa externa plana, ao nível do plano de horizonte (createSceneContext, y = -0.4). Sem encosta
 * na borda, o terreno se funde ao horizonte em vez de terminar numa linha escura.
 */
const APRON_WIDTH = 4;
const APRON_LEVEL = -0.35;

export interface HeightField {
  /** Altura do terreno (Y) no ponto de mundo (x, z). A área construível é exatamente plana (0). */
  heightAt(x: number, z: number): number;
  /** Distância até a área construível (0 dentro dela), em unidades de mundo. */
  distanceToPlateau(x: number, z: number): number;
  /** Distância até a borda do terreno (cantos arredondados), em unidades de mundo. */
  edgeDistance(x: number, z: number): number;
}

/**
 * Relevo procedural do bioma: planalto plano para construção, ondulações suaves ao redor, um anel
 * irregular de colinas com cristas em alturas diferentes e, fora dele, uma faixa plana ao nível do
 * horizonte (sem muralha na borda). A forma depende somente dos dados do cenário.
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

  // Distância com sinal até um retângulo de cantos arredondados (positiva para dentro).
  const edgeDistance = (x: number, z: number): number => {
    const qx = Math.abs(x) - (halfWidth - RIM_CORNER_RADIUS);
    const qz = Math.abs(z) - (halfDepth - RIM_CORNER_RADIUS);
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
    const inside = Math.min(Math.max(qx, qz), 0);
    return RIM_CORNER_RADIUS - (outside + inside);
  };

  const heightAt = (x: number, z: number): number => {
    const ramp = smoothstep(0, PLATEAU_BLEND, distanceToPlateau(x, z));
    if (ramp === 0) {
      return 0;
    }
    const toEdge = edgeDistance(x, z);

    // Ondulações amplas e baixas, sem vincos: o limiar é suavizado, não cortado.
    const swells = smoothstep(0.3, 0.76, fbm(x * 0.05, z * 0.05, seed, 3)) * 2.8;
    const ridgeSignal = 1 - Math.abs(fbm(x * 0.1 + 13, z * 0.1 - 29, seed + 17, 3) - 0.5) * 2;
    const ridges = smoothstep(0.5, 0.95, ridgeSignal) * 1;
    const detail = (fbm(x * 0.2 + 40, z * 0.2 - 40, seed + 7) - 0.5) * 0.24;
    // Mais perto da borda as ondulações dão lugar ao anel.
    const inland = smoothstep(APRON_WIDTH, APRON_WIDTH + 10, toEdge);
    const interior = (swells + ridges + detail) * inland;

    // Anel de colinas: crista a distância e altura variáveis; há trechos baixos entre as colinas.
    const crest = RIM_CREST_MIN + RIM_CREST_SPAN * fbm(x * 0.04 + 83, z * 0.04 - 41, seed + 29);
    const profile =
      (1 - smoothstep(crest, crest + RIM_WIDTH, toEdge)) * smoothstep(APRON_WIDTH, crest, toEdge);
    const crestHeight =
      0.4 + 0.9 * smoothstep(0.34, 0.7, fbm(x * 0.06 - 21, z * 0.06 + 57, seed + 37));
    const rim = profile * crestHeight * RIM_HEIGHT;

    const apron = APRON_LEVEL * (1 - inland);
    // Sob uma colina do anel as ondulações recuam, para as alturas não se somarem.
    return ramp * (interior * (1 - 0.6 * profile) + rim + apron);
  };

  return { heightAt, distanceToPlateau, edgeDistance };
}
