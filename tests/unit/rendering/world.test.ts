import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { clampCameraAboveGround, type OrbitCameraState } from '@/rendering/camera/cameraRig';
import { createSceneContext } from '@/rendering/scene/createSceneContext';
import { gridRectToWorldBounds, terrainWorldSize } from '@/rendering/world/gridToWorld';
import { createHeightField } from '@/rendering/world/heightField';
import { scatterScenery } from '@/rendering/world/scatter';
import { createTerrainMesh } from '@/rendering/world/terrain';
import type { PlacedSpec, TerrainSpec } from '@/rendering/world/WorldSnapshot';

const terrain: TerrainSpec = INITIAL_SCENARIO.terrain;
const ship: PlacedSpec = INITIAL_SCENARIO.crashedShip;
const plateau = gridRectToWorldBounds(terrain.buildableArea, terrain.sizeCells);

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

  it('tem relevo fora da área construível e um anel de colinas nas bordas', () => {
    const world = terrainWorldSize(terrain.sizeCells);
    const corner = field.heightAt(-world.width / 2 + 1, -world.depth / 2 + 1);

    expect(field.distanceToPlateau(plateau.maxX + 5, 0)).toBeCloseTo(5);
    expect(corner).toBeGreaterThan(3);
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
});

describe('dispersão do cenário', () => {
  const field = createHeightField(terrain);
  const placements = scatterScenery(terrain, ship, field);

  it('é determinística para a mesma semente e muda com outra semente', () => {
    expect(scatterScenery(terrain, ship, field)).toEqual(placements);
    expect(scatterScenery({ ...terrain, seed: terrain.seed + 1 }, ship, field)).not.toEqual(
      placements,
    );
  });

  it('gera vegetação, rochas e destroços', () => {
    const kinds = new Set(placements.map((placement) => placement.kind));

    expect(placements.length).toBeGreaterThan(100);
    expect(placements.length).toBeLessThanOrEqual(356);
    expect(kinds.has('stalk')).toBe(true);
    expect(kinds.has('debris')).toBe(true);
  });

  it('mantém rochas grandes raras, pequenas e nas encostas externas', () => {
    const largeRocks = placements.filter((placement) => placement.kind === 'rockLarge');

    expect(largeRocks.length).toBeLessThanOrEqual(5);
    for (const rock of largeRocks) {
      expect(rock.scale).toBeLessThanOrEqual(0.88);
      expect(field.distanceToPlateau(rock.x, rock.z)).toBeGreaterThan(18);
      expect(field.heightAt(rock.x, rock.z)).toBeGreaterThan(5.5);
    }
  });

  it('mantém a área construível livre e tudo dentro do terreno', () => {
    const world = terrainWorldSize(terrain.sizeCells);
    const scenery = placements.filter((placement) => placement.kind !== 'debris');

    for (const placement of scenery) {
      const insidePlateau =
        placement.x > plateau.minX &&
        placement.x < plateau.maxX &&
        placement.z > plateau.minZ &&
        placement.z < plateau.maxZ;
      expect(insidePlateau).toBe(false);
      expect(field.distanceToPlateau(placement.x, placement.z)).toBeGreaterThan(4.5);
      if (placement.kind === 'stalk' || placement.kind === 'mushroom') {
        expect(placement.scale).toBeLessThanOrEqual(1);
      }
    }
    for (const placement of placements) {
      expect(Math.abs(placement.x)).toBeLessThan(world.width / 2);
      expect(Math.abs(placement.z)).toBeLessThan(world.depth / 2);
      expect(placement.scale).toBeGreaterThan(0);
    }
  });

  it('não coloca destroços sobre a nave', () => {
    const shipBounds = gridRectToWorldBounds({ ...ship.position, ...ship.size }, terrain.sizeCells);
    const debris = placements.filter((placement) => placement.kind === 'debris');

    expect(debris).toHaveLength(16);
    for (const piece of debris) {
      const onShip =
        piece.x > shipBounds.minX &&
        piece.x < shipBounds.maxX &&
        piece.z > shipBounds.minZ &&
        piece.z < shipBounds.maxZ;
      expect(onShip).toBe(false);
    }
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
