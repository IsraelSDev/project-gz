import { gridRectToWorldBounds, terrainWorldSize, type WorldBounds } from './gridToWorld';
import { plantCoverAt, rockCoverAt } from './groundFields';
import type { HeightField } from './heightField';
import { createRandom, smoothstep } from './noise';
import type { TerrainSpec } from './WorldSnapshot';

export type SceneryKind = 'stalk' | 'mushroom' | 'crystal' | 'rockSmall' | 'rockLarge';

export interface SceneryPlacement {
  readonly kind: SceneryKind;
  readonly x: number;
  readonly z: number;
  readonly scale: number;
  readonly yaw: number;
  /** Multiplicador da altura sobre a escala uniforme: varia a silhueta de cada instância. */
  readonly stretch: number;
}

/** Faixa livre ao redor da área construível, em unidades de mundo: nada do cenário nasce nela. */
export const SCENERY_CLEAR_MARGIN = 6;
/** Bosques e campos de rochas só são centrados a partir desta distância da colônia. */
const SITE_MIN_DISTANCE = SCENERY_CLEAR_MARGIN + 4;
/** Até esta distância da colônia os objetos ficam menores, para não disputar atenção com ela. */
const FULL_SCALE_DISTANCE = 16;
const NEAR_SCALE = 0.72;
/** Rochas grandes ficam nas encostas externas, longe da colônia e do enquadramento inicial. */
const LARGE_ROCK_MIN_DISTANCE = 18;
const MAX_LARGE_ROCKS = 3;
const MAX_SMALL_ROCKS = 32;
/** Distância mínima da borda do terreno. */
const EDGE_MARGIN = 8;
const MAX_PROPS = 240;
const SITE_CANDIDATES = 600;
const GROVE_COUNT = 15;
const ROCK_FIELD_COUNT = 6;
const LONE_PLANTS = 8;
/** Separação mínima entre centros de agrupamentos, para sobrarem áreas limpas entre eles. */
const ROCK_FIELD_SEPARATION = 14;
const GROVE_SEPARATION = 11;
const LONE_PLANT_SEPARATION = 7;
/** Declividade máxima (altura por unidade de distância) para plantas e rochas se assentarem. */
const MAX_PLANT_SLOPE = 0.5;
const MAX_ROCK_SLOPE = 1;
const MAX_PLANT_HEIGHT = 4.5;

type WeightedKind = readonly [SceneryKind, number];

/** Composição de cada tipo de bosque: o primeiro tipo domina e os outros dão variedade. */
const GROVE_STYLES: readonly (readonly WeightedKind[])[] = [
  [
    ['mushroom', 0.5],
    ['stalk', 0.35],
    ['crystal', 0.15],
  ],
  [
    ['stalk', 0.65],
    ['mushroom', 0.2],
    ['crystal', 0.15],
  ],
  [
    ['crystal', 0.5],
    ['stalk', 0.3],
    ['mushroom', 0.2],
  ],
];

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
  }
}

function pickWeighted(random: () => number, entries: readonly WeightedKind[]): SceneryKind {
  let roll = random();
  for (const [kind, weight] of entries) {
    roll -= weight;
    if (roll < 0) {
      return kind;
    }
  }
  return entries[0]![0];
}

/** Escala-base de cada espécie (em [0, 1] de variação); não passa de 1 para plantas. */
function plantScale(kind: SceneryKind, roll: number): number {
  switch (kind) {
    case 'stalk':
      return 0.62 + roll * 0.38;
    case 'mushroom':
      return 0.62 + roll * 0.32;
    case 'crystal':
      return 0.58 + roll * 0.34;
    default:
      return 1;
  }
}

interface Site {
  readonly x: number;
  readonly z: number;
  readonly distance: number;
  readonly height: number;
  readonly jitter: number;
}

/**
 * Distribui vegetação, rochas e destroços de forma determinística a partir da semente do cenário.
 * Função pura: não usa Math.random nem relógio, então a mesma entrada gera sempre a mesma cena.
 *
 * Nada nasce solto ao acaso: a vegetação forma bosques (centro maior e mais denso, bordas menores),
 * as rochas formam campos (uma rocha-âncora com satélites e, às vezes, um cristal) e sobram
 * trechos limpos entre eles. A área construível e a faixa ao redor dela ficam livres; perto da
 * colônia os objetos são menores.
 */
export function scatterScenery(
  terrain: TerrainSpec,
  field: HeightField,
): readonly SceneryPlacement[] {
  const world = terrainWorldSize(terrain.sizeCells);
  const halfWidth = world.width / 2 - EDGE_MARGIN;
  const halfDepth = world.depth / 2 - EDGE_MARGIN;
  const plateau = gridRectToWorldBounds(terrain.buildableArea, terrain.sizeCells);
  const seed = terrain.seed;
  const placements: SceneryPlacement[] = [];
  let largeRocks = 0;
  let smallRocks = 0;

  const slopeAt = (x: number, z: number): number => {
    const step = 0.6;
    const dx = (field.heightAt(x + step, z) - field.heightAt(x - step, z)) / (2 * step);
    const dz = (field.heightAt(x, z + step) - field.heightAt(x, z - step)) / (2 * step);
    return Math.hypot(dx, dz);
  };

  /** Perto da colônia os objetos são menores; a escala cresce até FULL_SCALE_DISTANCE. */
  const nearColonyFactor = (x: number, z: number): number =>
    NEAR_SCALE +
    (1 - NEAR_SCALE) *
      smoothstep(SCENERY_CLEAR_MARGIN, FULL_SCALE_DISTANCE, field.distanceToPlateau(x, z));

  const place = (
    random: () => number,
    kind: SceneryKind,
    x: number,
    z: number,
    baseScale: number,
  ): SceneryPlacement | null => {
    const yaw = random() * Math.PI * 2;
    const variation = random();
    if (placements.length >= MAX_PROPS || Math.abs(x) > halfWidth || Math.abs(z) > halfDepth) {
      return null;
    }
    if (inside(plateau, x, z, 0) || field.distanceToPlateau(x, z) < SCENERY_CLEAR_MARGIN) {
      return null;
    }
    const isRock = kind === 'rockSmall' || kind === 'rockLarge';
    if (kind === 'rockSmall' && smallRocks >= MAX_SMALL_ROCKS) {
      return null;
    }
    if (kind === 'rockLarge' && largeRocks >= MAX_LARGE_ROCKS) {
      return null;
    }
    if (slopeAt(x, z) > (isRock ? MAX_ROCK_SLOPE : MAX_PLANT_SLOPE)) {
      return null;
    }
    if (!isRock && field.heightAt(x, z) > MAX_PLANT_HEIGHT) {
      return null;
    }

    const scale = baseScale * nearColonyFactor(x, z);
    const radius = propRadius(kind, scale);
    const crowded = placements.some(
      (placed) =>
        Math.hypot(placed.x - x, placed.z - z) <
          (radius + propRadius(placed.kind, placed.scale)) * 0.8 + 0.2,
    );
    if (crowded) {
      return null;
    }

    // Rochas variam mais de proporção (achatadas ou altas) do que as plantas.
    const stretch = isRock ? 0.7 + variation * 0.45 : 0.88 + variation * 0.28;
    const placement: SceneryPlacement = { kind, x, z, scale, yaw, stretch };
    placements.push(placement);
    if (kind === 'rockLarge') {
      largeRocks += 1;
    }
    if (kind === 'rockSmall') {
      smallRocks += 1;
    }
    return placement;
  };

  // Locais candidatos: pontos livres da colônia, sorteados uma única vez e reutilizados.
  const siteRandom = createRandom(seed ^ 0x51a3);
  const candidates: Site[] = [];
  for (let index = 0; index < SITE_CANDIDATES; index += 1) {
    const x = (siteRandom() * 2 - 1) * halfWidth;
    const z = (siteRandom() * 2 - 1) * halfDepth;
    const jitter = siteRandom();
    const distance = field.distanceToPlateau(x, z);
    if (distance >= SITE_MIN_DISTANCE && !inside(plateau, x, z, 0)) {
      candidates.push({ x, z, distance, height: field.heightAt(x, z), jitter });
    }
  }

  // Centros já escolhidos (campos de rochas e bosques): mantêm distância entre si.
  const claimed: Site[] = [];
  const pickSites = (
    count: number,
    separation: number,
    scoreOf: (site: Site) => number,
  ): Site[] => {
    const ranked = candidates
      .map((site) => ({ site, score: scoreOf(site) }))
      .sort((a, b) => b.score - a.score || a.site.x - b.site.x || a.site.z - b.site.z);
    const chosen: Site[] = [];
    for (const { site } of ranked) {
      if (chosen.length >= count) {
        break;
      }
      const tooClose = claimed.some(
        (other) => Math.hypot(other.x - site.x, other.z - site.z) < separation,
      );
      if (!tooClose && slopeAt(site.x, site.z) < MAX_PLANT_SLOPE) {
        chosen.push(site);
        claimed.push(site);
      }
    }
    return chosen;
  };

  // Campos de rochas: onde a rocha aflora, de preferência em terreno um pouco mais alto.
  const rockSites = pickSites(
    ROCK_FIELD_COUNT,
    ROCK_FIELD_SEPARATION,
    (site) =>
      rockCoverAt(site.x, site.z, seed) * 0.5 +
      smoothstep(0.6, 3, site.height) * 0.25 +
      site.jitter * 0.25,
  );
  const rockRandom = createRandom(seed ^ 0x7f4a);
  for (const site of rockSites) {
    const large =
      site.distance >= LARGE_ROCK_MIN_DISTANCE &&
      largeRocks < MAX_LARGE_ROCKS &&
      rockRandom() < 0.55;
    const anchorKind: SceneryKind = large ? 'rockLarge' : 'rockSmall';
    const anchorScale = large ? 0.45 + rockRandom() * 0.2 : 0.9 + rockRandom() * 0.25;
    let anchor: SceneryPlacement | null = null;
    for (let attempt = 0; attempt < 6 && anchor === null; attempt += 1) {
      const offset = attempt === 0 ? 0 : 1 + attempt * 0.4;
      const angle = rockRandom() * Math.PI * 2;
      anchor = place(
        rockRandom,
        anchorKind,
        site.x + Math.cos(angle) * offset,
        site.z + Math.sin(angle) * offset,
        anchorScale,
      );
    }
    if (anchor === null) {
      continue;
    }
    const anchorRadius = propRadius(anchor.kind, anchor.scale);
    const satellites = 2 + Math.floor(rockRandom() * 4);
    for (let index = 0; index < satellites; index += 1) {
      const scale = 0.5 + rockRandom() * 0.3;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const angle = rockRandom() * Math.PI * 2;
        const reach = anchorRadius + propRadius('rockSmall', scale) * (0.7 + rockRandom() * 0.8);
        const placed = place(
          rockRandom,
          'rockSmall',
          anchor.x + Math.cos(angle) * reach,
          anchor.z + Math.sin(angle) * reach,
          scale,
        );
        if (placed !== null) {
          break;
        }
      }
    }
    // Um cristal aflorando entre as rochas: acento violeta/ciano num campo cinza-arroxeado.
    if (rockRandom() < 0.5) {
      const angle = rockRandom() * Math.PI * 2;
      const reach = anchorRadius + 1.2;
      place(
        rockRandom,
        'crystal',
        anchor.x + Math.cos(angle) * reach,
        anchor.z + Math.sin(angle) * reach,
        plantScale('crystal', rockRandom()),
      );
    }
  }

  // Bosques: onde há cobertura vegetal, em terreno baixo.
  const groveSites = pickSites(
    GROVE_COUNT,
    GROVE_SEPARATION,
    (site) =>
      (plantCoverAt(site.x, site.z, seed) * 0.8 + site.jitter * 0.2) *
      (1 - smoothstep(2, 4.2, site.height)),
  );
  const groveRandom = createRandom(seed ^ 0x9e37);
  for (const site of groveSites) {
    const style = GROVE_STYLES[Math.floor(groveRandom() * GROVE_STYLES.length)]!;
    const radius = 3 + groveRandom() * 2.6;
    const count = Math.round(4 + radius * 0.9 + groveRandom() * 2);
    for (let index = 0; index < count; index += 1) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const angle = groveRandom() * Math.PI * 2;
        const reach = radius * groveRandom();
        const kind = pickWeighted(groveRandom, style);
        // Os exemplares do centro são os maiores; os da borda do bosque, menores.
        const scale = plantScale(kind, groveRandom()) * (1 - 0.25 * (reach / radius));
        const placed = place(
          groveRandom,
          kind,
          site.x + Math.cos(angle) * reach,
          site.z + Math.sin(angle) * reach,
          scale,
        );
        if (placed !== null) {
          break;
        }
      }
    }
  }

  // Poucos exemplares isolados, longe dos agrupamentos, para o chão limpo não parecer estéril.
  const loneRandom = createRandom(seed ^ 0x2c1b);
  let lone = 0;
  for (const site of candidates) {
    if (lone >= LONE_PLANTS) {
      break;
    }
    const apart = claimed.every(
      (other) => Math.hypot(other.x - site.x, other.z - site.z) >= LONE_PLANT_SEPARATION,
    );
    if (!apart || plantCoverAt(site.x, site.z, seed) < 0.15) {
      continue;
    }
    const kind = pickWeighted(loneRandom, GROVE_STYLES[0]!);
    if (place(loneRandom, kind, site.x, site.z, plantScale(kind, loneRandom())) !== null) {
      lone += 1;
    }
  }

  return placements;
}
