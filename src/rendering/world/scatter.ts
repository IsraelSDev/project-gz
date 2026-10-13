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

/** Início da faixa livre ao redor da área construível, em unidades de mundo. */
const CLEAR_MARGIN = 4.5;
/** A densidade de vegetação cresce gradualmente até esta distância da colônia. */
const FULL_DENSITY_DISTANCE = 14;
/** Rochas grandes ficam nas encostas externas, longe da colônia e do enquadramento inicial. */
const LARGE_ROCK_MIN_DISTANCE = 18;
const MAX_LARGE_ROCKS = 5;
const MAX_SMALL_ROCKS = 44;
/** Distância mínima da borda do terreno. */
const EDGE_MARGIN = 2.5;
const ATTEMPTS = 2200;
const MAX_PROPS = 340;
const DEBRIS_COUNT = 16;
const DEBRIS_RING = 3;

const inside = (bounds: WorldBounds, x: number, z: number, margin: number): boolean =>
  x > bounds.minX - margin &&
  x < bounds.maxX + margin &&
  z > bounds.minZ - margin &&
  z < bounds.maxZ + margin;

function propRadius(kind: SceneryKind, scale: number): number {
  switch (kind) {
    case 'rockLarge':
      return 1.7 * scale;
    case 'rockSmall':
      return 0.9 * scale;
    case 'mushroom':
      return 1.1 * scale;
    case 'crystal':
      return 0.75 * scale;
    case 'stalk':
      return 0.65 * scale;
    case 'debris':
      return 0;
  }
}

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
  let largeRocks = 0;
  let smallRocks = 0;

  for (let attempt = 0; attempt < ATTEMPTS && placements.length < MAX_PROPS; attempt += 1) {
    const x = (random() * 2 - 1) * halfWidth;
    const z = (random() * 2 - 1) * halfDepth;
    const yaw = random() * Math.PI * 2;
    const roll = random();
    const sizeRoll = random();
    const densityRoll = random();

    if (inside(plateau, x, z, 0)) {
      continue;
    }

    const plateauDistance = field.distanceToPlateau(x, z);
    if (plateauDistance < CLEAR_MARGIN) {
      continue;
    }

    const moisture = fbm(x * 0.045 + 120, z * 0.045 - 60, terrain.seed + 3);
    const plantClusters = smoothstep(
      0.36,
      0.66,
      fbm(x * 0.13 + 47, z * 0.13 - 28, terrain.seed + 19),
    );
    const rockClusters = smoothstep(
      0.52,
      0.75,
      fbm(x * 0.105 - 67, z * 0.105 + 35, terrain.seed + 31),
    );
    const plantCover = smoothstep(0.4, 0.7, moisture) * plantClusters;
    const groundCover = Math.max(plantCover, rockClusters * 0.42);
    const density =
      (0.055 + 0.62 * groundCover) *
      smoothstep(CLEAR_MARGIN, FULL_DENSITY_DISTANCE, plateauDistance);
    if (densityRoll > density) {
      continue;
    }

    const height = field.heightAt(x, z);
    let kind: SceneryKind | null = null;
    let scale = 1;
    if (height > 4.5) {
      if (
        height > 5.5 &&
        plateauDistance > LARGE_ROCK_MIN_DISTANCE &&
        largeRocks < MAX_LARGE_ROCKS &&
        roll < 0.14
      ) {
        kind = 'rockLarge';
        scale = 0.5 + sizeRoll * 0.38;
      } else if (roll < 0.42 && smallRocks < MAX_SMALL_ROCKS && rockClusters > 0.3) {
        kind = 'rockSmall';
        scale = 0.62 + sizeRoll * 0.34;
      }
    } else if (plantCover > 0.08) {
      if (roll < 0.55) {
        kind = 'stalk';
        scale = 0.62 + sizeRoll * 0.38;
      } else if (roll < 0.8) {
        kind = 'mushroom';
        scale = 0.62 + sizeRoll * 0.32;
      } else if (roll < 0.94) {
        kind = 'crystal';
        scale = 0.58 + sizeRoll * 0.34;
      }
    } else if (roll < 0.35 + rockClusters * 0.28 && smallRocks < MAX_SMALL_ROCKS) {
      kind = 'rockSmall';
      scale = 0.62 + sizeRoll * 0.34;
    } else if (roll < 0.42) {
      kind = 'stalk';
      scale = 0.62 + sizeRoll * 0.38;
    } else if (roll < 0.52) {
      kind = 'crystal';
      scale = 0.58 + sizeRoll * 0.34;
    }

    if (kind === null) {
      continue;
    }

    const radius = propRadius(kind, scale);
    const overlaps = placements.some(
      (placed) =>
        placed.kind !== 'debris' &&
        Math.hypot(placed.x - x, placed.z - z) <
          radius + propRadius(placed.kind, placed.scale) + 0.45,
    );
    if (overlaps) {
      continue;
    }

    placements.push({ kind, x, z, scale, yaw });
    if (kind === 'rockLarge') {
      largeRocks += 1;
    }
    if (kind === 'rockSmall') {
      smallRocks += 1;
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
