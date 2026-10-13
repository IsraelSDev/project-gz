import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { clampCameraAboveGround, type OrbitCameraState } from '@/rendering/camera/cameraRig';
import { createSceneContext } from '@/rendering/scene/createSceneContext';
import { PALETTE } from '@/rendering/scene/palette';
import { gridRectToWorldBounds, terrainWorldSize } from '@/rendering/world/gridToWorld';
import { createHeightField, type HeightField } from '@/rendering/world/heightField';
import {
  SCENERY_CLEAR_MARGIN,
  scatterScenery,
  type SceneryPlacement,
} from '@/rendering/world/scatter';
import { createScenery } from '@/rendering/world/scenery';
import { createTerrainMesh } from '@/rendering/world/terrain';
import type { TerrainSpec } from '@/rendering/world/WorldSnapshot';

const terrain: TerrainSpec = INITIAL_SCENARIO.terrain;
const plateau = gridRectToWorldBounds(terrain.buildableArea, terrain.sizeCells);

/** Alturas ao longo de um contorno do terreno a `distance` unidades da borda (do centro para fora). */
function ringHeights(field: HeightField, distance: number): number[] {
  const heights: number[] = [];
  for (let degrees = 0; degrees < 360; degrees += 3) {
    const dx = Math.cos((degrees * Math.PI) / 180);
    const dz = Math.sin((degrees * Math.PI) / 180);
    let radius = 0;
    while (field.edgeDistance(dx * radius, dz * radius) > distance && radius < 100) {
      radius += 0.05;
    }
    heights.push(field.heightAt(dx * radius, dz * radius));
  }
  return heights;
}

describe('relevo do terreno', () => {
  const field = createHeightField(terrain);

  it('é exatamente plano dentro da área construível', () => {
    for (let x = plateau.minX; x <= plateau.maxX; x += 2) {
      for (let z = plateau.minZ; z <= plateau.maxZ; z += 2) {
        expect(field.heightAt(x, z)).toBe(0);
        expect(field.distanceToPlateau(x, z)).toBe(0);
      }
    }
  });

  it('tem relevo fora da área construível e um anel de colinas irregular', () => {
    const crest = ringHeights(field, 12);

    expect(field.distanceToPlateau(plateau.maxX + 5, 0)).toBeCloseTo(5);
    expect(Math.max(...crest)).toBeGreaterThan(2.5);
    // As colinas têm alturas diferentes ao longo do perímetro: não formam uma muralha uniforme.
    expect(Math.max(...crest) - Math.min(...crest)).toBeGreaterThan(1.5);
  });

  it('termina na borda ao nível do horizonte, sem muralha nem degrau', () => {
    for (const distance of [0, 1, 2.5]) {
      for (const height of ringHeights(field, distance)) {
        expect(height).toBeGreaterThan(-0.5);
        expect(height).toBeLessThan(0.1);
      }
    }
  });

  it('não tem paredes: a declividade fica limitada em todo o terreno', () => {
    const step = 0.5;
    let steepest = 0;
    for (let x = -39; x <= 39; x += step) {
      for (let z = -39; z <= 39; z += step) {
        steepest = Math.max(
          steepest,
          Math.hypot(
            (field.heightAt(x + step, z) - field.heightAt(x, z)) / step,
            (field.heightAt(x, z + step) - field.heightAt(x, z)) / step,
          ),
        );
      }
    }

    expect(steepest).toBeLessThan(1.25);
  });

  it('sobe devagar a partir do planalto', () => {
    for (let distance = 0.5; distance <= 2; distance += 0.5) {
      for (let z = plateau.minZ; z <= plateau.maxZ; z += 4) {
        expect(field.heightAt(plateau.maxX + distance, z)).toBeLessThan(0.3);
      }
    }
  });

  it('é determinístico e sempre finito', () => {
    const again = createHeightField(terrain);

    for (const [x, z] of [
      [-30, 12],
      [22.5, -35],
      [0, 0],
      [39, 39],
    ] as const) {
      expect(again.heightAt(x, z)).toBe(field.heightAt(x, z));
      expect(Number.isFinite(field.heightAt(x, z))).toBe(true);
    }
  });
});

describe('malha visual do terreno', () => {
  it('mantém a grade atual e reproduz geometria e cores com a mesma seed', () => {
    const engine = new NullEngine();
    const context = createSceneContext(engine);
    const first = createTerrainMesh(context, terrain, createHeightField(terrain));
    const repeat = createTerrainMesh(context, terrain, createHeightField(terrain));
    const otherTerrain = { ...terrain, seed: terrain.seed + 1 };
    const other = createTerrainMesh(context, otherTerrain, createHeightField(otherTerrain));

    expect(first.getTotalVertices()).toBe(10_201);
    expect(first.getVerticesData(VertexBuffer.PositionKind)).toEqual(
      repeat.getVerticesData(VertexBuffer.PositionKind),
    );
    expect(first.getVerticesData(VertexBuffer.ColorKind)).toEqual(
      repeat.getVerticesData(VertexBuffer.ColorKind),
    );
    expect(first.getVerticesData(VertexBuffer.ColorKind)).not.toEqual(
      other.getVerticesData(VertexBuffer.ColorKind),
    );

    const positions = first.getVerticesData(VertexBuffer.PositionKind);
    expect(positions).not.toBeNull();
    const plateau = gridRectToWorldBounds(terrain.buildableArea, terrain.sizeCells);
    for (let i = 0; i < positions!.length; i += 3) {
      const x = positions![i]!;
      const y = positions![i + 1]!;
      const z = positions![i + 2]!;
      if (x >= plateau.minX && x <= plateau.maxX && z >= plateau.minZ && z <= plateau.maxZ) {
        expect(y).toBe(0);
      }
    }

    context.dispose();
    engine.dispose();
  });

  it('mantém o planalto de uma cor só e varia o solo ao redor sem manchas extremas', () => {
    const engine = new NullEngine();
    const context = createSceneContext(engine);
    const field = createHeightField(terrain);
    const mesh = createTerrainMesh(context, terrain, field);
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind)!;
    const colors = mesh.getVerticesData(VertexBuffer.ColorKind)!;
    const dust = PALETTE.terrain.dust;
    const dustRgb = [1, 3, 5].map((offset) => parseInt(dust.slice(offset, offset + 2), 16) / 255);

    const brightness: number[] = [];
    for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
      const x = positions[vertex * 3]!;
      const z = positions[vertex * 3 + 2]!;
      const rgb = [colors[vertex * 4]!, colors[vertex * 4 + 1]!, colors[vertex * 4 + 2]!];
      if (field.distanceToPlateau(x, z) === 0) {
        rgb.forEach((channel, index) => expect(channel).toBeCloseTo(dustRgb[index]!, 5));
      } else if (field.distanceToPlateau(x, z) > 5 && field.edgeDistance(x, z) > 14) {
        brightness.push(0.3 * rgb[0]! + 0.59 * rgb[1]! + 0.11 * rgb[2]!);
      }
    }
    const mean = brightness.reduce((sum, value) => sum + value, 0) / brightness.length;
    const deviation = Math.sqrt(
      brightness.reduce((sum, value) => sum + (value - mean) ** 2, 0) / brightness.length,
    );

    expect(brightness.length).toBeGreaterThan(500);
    expect(deviation).toBeGreaterThan(0.02);
    expect(deviation).toBeLessThan(0.08);

    context.dispose();
    engine.dispose();
  });
});

const isRock = (placement: SceneryPlacement): boolean =>
  placement.kind === 'rockSmall' || placement.kind === 'rockLarge';
const isPlant = (placement: SceneryPlacement): boolean =>
  placement.kind === 'stalk' || placement.kind === 'mushroom' || placement.kind === 'crystal';
const distanceBetween = (a: SceneryPlacement, b: SceneryPlacement): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

/** Quantos grupos de objetos existem quando objetos a menos de `link` unidades se juntam. */
function groupCount(items: readonly SceneryPlacement[], link: number): number {
  const parent = items.map((_, index) => index);
  const root = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      current = parent[current]!;
    }
    return current;
  };
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (distanceBetween(items[i]!, items[j]!) < link) {
        parent[root(i)] = root(j);
      }
    }
  }
  return new Set(items.map((_, index) => root(index))).size;
}

describe('dispersão do cenário', () => {
  const field = createHeightField(terrain);
  const placements = scatterScenery(terrain, field);
  const scenery = placements;
  const rocks = scenery.filter(isRock);
  const plants = scenery.filter(isPlant);

  it('é determinística para a mesma semente e muda com outra semente', () => {
    expect(scatterScenery(terrain, field)).toEqual(placements);
    expect(scatterScenery({ ...terrain, seed: terrain.seed + 1 }, field)).not.toEqual(
      placements,
    );
  });

  it('gera vegetação e rochas em quantidade moderada', () => {
    const kinds = new Set(placements.map((placement) => placement.kind));

    expect(scenery.length).toBeGreaterThan(80);
    expect(scenery.length).toBeLessThanOrEqual(240);
    for (const kind of ['stalk', 'mushroom', 'crystal', 'rockSmall'] as const) {
      expect(kinds.has(kind)).toBe(true);
    }
  });

  it('agrupa as rochas em poucos campos, sem pedras soltas', () => {
    expect(rocks.length).toBeLessThanOrEqual(35);
    expect(groupCount(rocks, 4)).toBeGreaterThanOrEqual(3);
    expect(groupCount(rocks, 4)).toBeLessThanOrEqual(8);
    for (const rock of rocks) {
      expect(rocks.some((other) => other !== rock && distanceBetween(rock, other) < 4)).toBe(true);
    }
  });

  it('agrupa a vegetação em bosques e deixa áreas limpas', () => {
    const grouped = plants.filter(
      (plant) =>
        plants.filter((other) => other !== plant && distanceBetween(plant, other) < 6).length >= 2,
    );
    expect(grouped.length / plants.length).toBeGreaterThan(0.75);

    let cells = 0;
    let clean = 0;
    for (let x = -37.5; x < 40; x += 5) {
      for (let z = -37.5; z < 40; z += 5) {
        if (field.distanceToPlateau(x, z) < SCENERY_CLEAR_MARGIN) {
          continue;
        }
        cells += 1;
        if (!scenery.some((placement) => Math.hypot(placement.x - x, placement.z - z) < 5)) {
          clean += 1;
        }
      }
    }
    expect(clean / cells).toBeGreaterThan(0.35);
    expect(clean / cells).toBeLessThan(0.7);
  });

  it('mantém rochas grandes raras e pequenas, e rochas próximas à colônia menores', () => {
    const largeRocks = scenery.filter((placement) => placement.kind === 'rockLarge');

    expect(largeRocks.length).toBeLessThanOrEqual(3);
    for (const rock of largeRocks) {
      expect(rock.scale).toBeLessThanOrEqual(0.7);
      expect(field.distanceToPlateau(rock.x, rock.z)).toBeGreaterThan(18);
    }
    for (const rock of rocks) {
      expect(rock.scale).toBeLessThanOrEqual(1.2);
      if (field.distanceToPlateau(rock.x, rock.z) < 14) {
        expect(rock.scale).toBeLessThanOrEqual(1.1);
      }
    }
  });

  it('varia tamanho, proporção e rotação dos objetos', () => {
    const rockScales = rocks.map((rock) => rock.scale);

    expect(Math.max(...rockScales) - Math.min(...rockScales)).toBeGreaterThan(0.4);
    expect(new Set(scenery.map((placement) => placement.yaw)).size).toBe(scenery.length);
    for (const placement of scenery) {
      expect(placement.yaw).toBeGreaterThanOrEqual(0);
      expect(placement.yaw).toBeLessThan(Math.PI * 2);
      expect(placement.stretch).toBeGreaterThanOrEqual(isRock(placement) ? 0.7 : 0.88);
      expect(placement.stretch).toBeLessThanOrEqual(isRock(placement) ? 1.15 : 1.16);
    }
  });

  it('não sobrepõe objetos e só os assenta em declives suaves', () => {
    for (let i = 0; i < scenery.length; i += 1) {
      for (let j = i + 1; j < scenery.length; j += 1) {
        expect(distanceBetween(scenery[i]!, scenery[j]!)).toBeGreaterThan(0.8);
      }
    }
    for (const placement of scenery) {
      const step = 0.6;
      const slope = Math.hypot(
        (field.heightAt(placement.x + step, placement.z) -
          field.heightAt(placement.x - step, placement.z)) /
          (2 * step),
        (field.heightAt(placement.x, placement.z + step) -
          field.heightAt(placement.x, placement.z - step)) /
          (2 * step),
      );
      expect(slope).toBeLessThanOrEqual(isRock(placement) ? 1 : 0.5);
      if (isPlant(placement)) {
        expect(field.heightAt(placement.x, placement.z)).toBeLessThanOrEqual(4.5);
      }
    }
  });

  it('mantém a área construível livre e tudo dentro do terreno', () => {
    const world = terrainWorldSize(terrain.sizeCells);

    for (const placement of scenery) {
      const insidePlateau =
        placement.x > plateau.minX &&
        placement.x < plateau.maxX &&
        placement.z > plateau.minZ &&
        placement.z < plateau.maxZ;
      expect(insidePlateau).toBe(false);
      expect(field.distanceToPlateau(placement.x, placement.z)).toBeGreaterThanOrEqual(
        SCENERY_CLEAR_MARGIN,
      );
      if (placement.kind === 'stalk' || placement.kind === 'mushroom') {
        expect(placement.scale).toBeLessThanOrEqual(1);
      }
    }
    for (const placement of placements) {
      expect(Math.abs(placement.x)).toBeLessThan(world.width / 2);
      expect(Math.abs(placement.z)).toBeLessThan(world.depth / 2);
      expect(placement.scale).toBeGreaterThan(0);
    }
    for (const placement of scenery) {
      expect(Math.abs(placement.x)).toBeLessThan(world.width / 2 - 5);
      expect(Math.abs(placement.z)).toBeLessThan(world.depth / 2 - 5);
    }
  });

  it('mantém as garantias com outras sementes', () => {
    for (let offset = 1; offset <= 4; offset += 1) {
      const otherTerrain = { ...terrain, seed: terrain.seed + offset };
      const otherField = createHeightField(otherTerrain);
      const other = scatterScenery(otherTerrain, otherField);

      expect(other.length).toBeGreaterThan(80);
      expect(other.length).toBeLessThanOrEqual(240);
      expect(
        other.filter((placement) => placement.kind === 'rockLarge').length,
      ).toBeLessThanOrEqual(3);
      for (const placement of other) {
        expect(otherField.distanceToPlateau(placement.x, placement.z)).toBeGreaterThanOrEqual(
          SCENERY_CLEAR_MARGIN,
        );
      }
    }
  });

});

describe('camadas do cenário', () => {
  it('aplica a proporção da instância e enterra as rochas no relevo', () => {
    const engine = new NullEngine();
    const context = createSceneContext(engine);
    const flat: HeightField = {
      heightAt: () => 2,
      distanceToPlateau: () => 20,
      edgeDistance: () => 20,
    };
    const layer = createScenery(
      context,
      [
        { kind: 'stalk', x: 10, z: 10, scale: 0.8, yaw: 1, stretch: 1.1 },
        { kind: 'rockSmall', x: -10, z: 10, scale: 1, yaw: 2, stretch: 0.7 },
      ],
      flat,
    );

    const stalk = context.scene.getMeshByName('stalk') as Mesh;
    const rock = context.scene.getMeshByName('rock-small') as Mesh;
    const [stalkMatrix] = stalk.thinInstanceGetWorldMatrices();
    const [rockMatrix] = rock.thinInstanceGetWorldMatrices();

    expect(stalkMatrix!.m[5]).toBeCloseTo(0.8 * 1.1);
    expect(stalkMatrix!.m[13]).toBeCloseTo(2);
    expect(rockMatrix!.m[5]).toBeCloseTo(0.7);
    expect(rockMatrix!.m[13]).toBeLessThan(2);

    layer.dispose();
    context.dispose();
    engine.dispose();
  });
});

describe('câmera acima do terreno', () => {
  const makeCamera = (): OrbitCameraState => ({
    alpha: 0,
    beta: 1.2,
    radius: 20,
    lowerBetaLimit: 0.45,
    target: { x: 0, y: 0, z: 0 },
  });

  it('não altera a câmera quando ela já está acima do chão', () => {
    const camera = makeCamera();

    clampCameraAboveGround(camera, () => 0);

    expect(camera.beta).toBe(1.2);
  });

  it('aumenta a elevação (reduz beta) quando o terreno cobriria a câmera', () => {
    const camera = makeCamera();

    clampCameraAboveGround(camera, () => 7, 1.5);

    expect(camera.beta).toBeLessThan(1.2);
    expect(camera.radius * Math.cos(camera.beta)).toBeGreaterThanOrEqual(8.5);
  });

  it('respeita o limite inferior de beta mesmo com um terreno impossível', () => {
    const camera = makeCamera();

    clampCameraAboveGround(camera, () => 1000);

    expect(camera.beta).toBeGreaterThanOrEqual(0.45);
  });
});
