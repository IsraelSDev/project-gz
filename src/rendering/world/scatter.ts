import { occupiedRect } from '@/shared/grid/gridMath';
import { gridRectToWorldBounds, terrainWorldSize, type WorldBounds } from './gridToWorld';
import type { HeightField } from './heightField';
import { createRandom, fbm, smoothstep } from './noise';
import type { PlacedSpec, TerrainSpec } from './WorldSnapshot';

export type SceneryKind = 'stalk' | 'mushroom' | 'crystal' | 'rockSmall' | 'rockLarge' | 'debris';

export interface SceneryPlacement {
  readonly kind: SceneryKind;
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  readonly yaw: number;
}

/** Margem (unidades de mundo) mantida livre ao redor da área construível. */
const CLEAR_MARGIN = 3;
/** Distância mínima da borda do terreno. */
const EDGE_MARGIN = 2.5;
const ATTEMPTS = 1600;
const MAX_PROPS = 440;
const DEBRIS_COUNT = 16;
const DEBRIS_RING = 3;

const inside = (bounds: WorldBounds, x: number, z: number, margin: number): boolean =>
  x > bounds.minX - margin &&
  x < bounds.maxX + margin &&
  z > bounds.minZ - margin &&
  z < bounds.maxZ + margin;

/**
 * Distribui vegetação, rochas e destroços de forma determinística a partir da semente do cenário.
 * Função pura: não usa Math.random nem relógio, então a mesma entrada gera sempre a mesma cena.
 * A área construível fica livre; os destroços ficam num anel ao redor da nave.
 */
export function scatterScenery(
  terrain: TerrainSpec,
  ship: PlacedSpec,
  field: HeightField,
): readonly SceneryPlacement[] {
  const random = createRandom(terrain.seed);
  const world = terrainWorldSize(terrain.sizeCells);
  const halfWidth = world.width / 2 - EDGE_MARGIN;
  const halfDepth = world.depth / 2 - EDGE_MARGIN;
  const plateau = gridRectToWorldBounds(terrain.buildableArea, terrain.sizeCells);
  const placements: SceneryPlacement[] = [];

  for (let attempt = 0; attempt < ATTEMPTS && placements.length < MAX_PROPS; attempt += 1) {
    const x = (random() * 2 - 1) * halfWidth;
    const z = (random() * 2 - 1) * halfDepth;
    const yaw = random() * Math.PI * 2;
    const roll = random();
    const sizeRoll = random();
    const densityRoll = random();

    if (inside(plateau, x, z, CLEAR_MARGIN)) {
      continue;
    }

    const moisture = fbm(x * 0.045 + 120, z * 0.045 - 60, terrain.seed + 3);
    const density = 0.18 + 0.75 * smoothstep(0.4, 0.7, moisture);
    if (densityRoll > density) {
      continue;
    }

    const height = field.heightAt(x, z);
    if (height > 3.5) {
      placements.push({
        kind: roll < 0.5 ? 'rockLarge' : 'rockSmall',
        x,
        z,
        scale: 0.8 + sizeRoll * 0.9,
        yaw,
      });
    } else if (moisture > 0.55) {
      if (roll < 0.55) {
        placements.push({ kind: 'stalk', x, z, scale: 0.8 + sizeRoll * 0.7, yaw });
      } else if (roll < 0.8) {
        placements.push({ kind: 'mushroom', x, z, scale: 0.8 + sizeRoll * 0.6, yaw });
      } else {
        placements.push({ kind: 'crystal', x, z, scale: 0.7 + sizeRoll * 0.8, yaw });
      }
    } else if (roll < 0.35) {
      placements.push({ kind: 'rockSmall', x, z, scale: 0.7 + sizeRoll * 0.9, yaw });
    } else if (roll < 0.6) {
      placements.push({ kind: 'stalk', x, z, scale: 0.6 + sizeRoll * 0.5, yaw });
    } else if (roll < 0.7) {
      placements.push({ kind: 'crystal', x, z, scale: 0.6 + sizeRoll * 0.6, yaw });
    }
  }

  const shipBounds = gridRectToWorldBounds(
    occupiedRect(ship.position, ship.size, ship.rotation),
    terrain.sizeCells,
  );
  let debris = 0;
  for (let attempt = 0; attempt < 400 && debris < DEBRIS_COUNT; attempt += 1) {
    const x =
      shipBounds.minX -
      DEBRIS_RING +
      random() * (shipBounds.maxX - shipBounds.minX + 2 * DEBRIS_RING);
    const z =
      shipBounds.minZ -
      DEBRIS_RING +
      random() * (shipBounds.maxZ - shipBounds.minZ + 2 * DEBRIS_RING);
    const yaw = random() * Math.PI * 2;
    const scale = 0.5 + random() * 0.8;
    if (inside(shipBounds, x, z, 0.5)) {
      continue;
    }
    placements.push({ kind: 'debris', x, z, scale, yaw });
    debris += 1;
  }

  return placements;
}
