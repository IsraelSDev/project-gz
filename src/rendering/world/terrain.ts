import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { SceneContext } from '../scene/createSceneContext';
import { PALETTE } from '../scene/palette';
import { gridPointToWorld, terrainWorldSize } from './gridToWorld';
import { plantCoverAt, rockCoverAt } from './groundFields';
import type { HeightField } from './heightField';
import { fbm, smoothstep, valueNoise } from './noise';
import type { TerrainSpec } from './WorldSnapshot';

const SUBDIVISIONS = 100;

const DUST = Color3.FromHexString(PALETTE.terrain.dust);
const SAND = Color3.FromHexString(PALETTE.terrain.sand);
const CLAY = Color3.FromHexString(PALETTE.terrain.clay);
const MOSS = Color3.FromHexString(PALETTE.terrain.moss);
const ROCK = Color3.FromHexString(PALETTE.terrain.rock);
/** Cor de névoa do horizonte: o plano distante, aceso e coberto de neblina, parece mais claro que seu token. */
const HORIZON_HAZE = Color3.Lerp(
  Color3.FromHexString(PALETTE.terrain.horizonGround),
  Color3.FromHexString(PALETTE.fog),
  0.45,
);

function terrainColor(
  x: number,
  z: number,
  y: number,
  slope: number,
  field: HeightField,
  seed: number,
): Color3 {
  // Variações amplas (≈ 30 unidades): regiões mais quentes ou mais rosadas, sem fronteira brusca.
  const warmth = smoothstep(0.32, 0.7, fbm(x * 0.035 + 31, z * 0.035 - 17, seed + 1));
  const rosy = smoothstep(0.42, 0.72, fbm(x * 0.05 - 70, z * 0.05 + 12, seed + 5));
  const mineral = valueNoise(x * 0.28, z * 0.28, seed + 9);
  let natural = Color3.Lerp(DUST, SAND, warmth);
  natural = Color3.Lerp(natural, CLAY, rosy * 0.7);
  // O solo acompanha o que cresce sobre ele: azul-esverdeado sob os bosques, cascalho arroxeado
  // nos campos de rochas. Os mesmos campos guiam a dispersão do cenário.
  natural = Color3.Lerp(
    natural,
    MOSS,
    plantCoverAt(x, z, seed) * (1 - smoothstep(2, 4.2, y)) * 0.5,
  );
  natural = Color3.Lerp(natural, ROCK, rockCoverAt(x, z, seed) * 0.2);

  // A rocha aparece nas elevações e nas encostas mais íngremes, de forma gradual.
  const exposedRock = Math.max(smoothstep(3.2, 6.5, y) * 0.5, smoothstep(0.4, 1, slope) * 0.32);
  natural = Color3.Lerp(natural, ROCK, exposedRock);

  const plateauBlend = smoothstep(0, 15, field.distanceToPlateau(x, z));
  let color = Color3.Lerp(DUST, natural, plateauBlend);
  // Na borda o terreno assume a cor do plano de horizonte, que o continua sem emenda visível.
  color = Color3.Lerp(color, HORIZON_HAZE, 1 - smoothstep(4, 14, field.edgeDistance(x, z)));
  const mottling = (mineral - 0.5) * 0.055 * plateauBlend;
  return new Color3(color.r + mottling, color.g + mottling, color.b + mottling);
}

/** Malha do terreno: relevo e cores vêm só do campo de altura e da semente do cenário. */
export function createTerrainMesh(
  context: SceneContext,
  terrain: TerrainSpec,
  field: HeightField,
): Mesh {
  const world = terrainWorldSize(terrain.sizeCells);
  const columns = SUBDIVISIONS + 1;
  const positions = new Float32Array(columns * columns * 3);
  const colors = new Float32Array(columns * columns * 4);
  const uvs = new Float32Array(columns * columns * 2);

  const spacingX = world.width / SUBDIVISIONS;
  const spacingZ = world.depth / SUBDIVISIONS;
  const worldX = (column: number): number =>
    (column / SUBDIVISIONS) * world.width - world.width / 2;
  const worldZ = (row: number): number =>
    ((SUBDIVISIONS - row) / SUBDIVISIONS) * world.depth - world.depth / 2;

  const heights = new Float32Array(columns * columns);
  for (let row = 0; row <= SUBDIVISIONS; row += 1) {
    for (let column = 0; column <= SUBDIVISIONS; column += 1) {
      const index = row * columns + column;
      const x = worldX(column);
      const z = worldZ(row);
      heights[index] = field.heightAt(x, z);
      positions.set([x, heights[index]!, z], index * 3);
      uvs.set([column / SUBDIVISIONS, row / SUBDIVISIONS], index * 2);
    }
  }

  // As cores usam a declividade, calculada a partir das alturas já amostradas dos vizinhos.
  const heightAtVertex = (row: number, column: number): number =>
    heights[
      Math.min(SUBDIVISIONS, Math.max(0, row)) * columns +
        Math.min(SUBDIVISIONS, Math.max(0, column))
    ]!;
  for (let row = 0; row <= SUBDIVISIONS; row += 1) {
    for (let column = 0; column <= SUBDIVISIONS; column += 1) {
      const index = row * columns + column;
      const slope = Math.hypot(
        (heightAtVertex(row, column + 1) - heightAtVertex(row, column - 1)) / (2 * spacingX),
        (heightAtVertex(row + 1, column) - heightAtVertex(row - 1, column)) / (2 * spacingZ),
      );
      const color = terrainColor(
        worldX(column),
        worldZ(row),
        heights[index]!,
        slope,
        field,
        terrain.seed,
      );
      colors.set([color.r, color.g, color.b, 1], index * 4);
    }
  }

  // Mesma ordem de índices do CreateGround do Babylon.js (faces voltadas para cima).
  const indices: number[] = [];
  for (let row = 0; row < SUBDIVISIONS; row += 1) {
    for (let column = 0; column < SUBDIVISIONS; column += 1) {
      indices.push(
        column + 1 + (row + 1) * columns,
        column + 1 + row * columns,
        column + row * columns,
        column + (row + 1) * columns,
        column + 1 + (row + 1) * columns,
        column + row * columns,
      );
    }
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = uvs;
  vertexData.colors = colors;

  const mesh = new Mesh('terrain', context.scene);
  vertexData.applyToMesh(mesh);
  mesh.material = context.materials.terrain;
  mesh.receiveShadows = true;
  return mesh;
}

/** Grade e contorno da área construível (linhas finas, um mesh cada). */
export function createBuildableGrid(context: SceneContext, terrain: TerrainSpec): Mesh[] {
  const area = terrain.buildableArea;
  const lift = 0.05;
  const toWorld = (x: number, y: number): Vector3 => {
    const point = gridPointToWorld({ x, y }, terrain.sizeCells);
    return new Vector3(point.x, lift, point.z);
  };

  const lighter = (value: number): number => Math.min(1, value * 1.1);
  const gridLine = new Color4(lighter(DUST.r), lighter(DUST.g), lighter(DUST.b), 1);
  const lines: Vector3[][] = [];
  const lineColors: Color4[][] = [];
  for (let column = 1; column < area.width; column += 1) {
    lines.push([toWorld(area.x + column, area.y), toWorld(area.x + column, area.y + area.depth)]);
    lineColors.push([gridLine, gridLine]);
  }
  for (let row = 1; row < area.depth; row += 1) {
    lines.push([toWorld(area.x, area.y + row), toWorld(area.x + area.width, area.y + row)]);
    lineColors.push([gridLine, gridLine]);
  }
  const grid = CreateLineSystem('buildable-grid', { lines, colors: lineColors }, context.scene);

  const border = Color4.FromColor3(Color3.FromHexString(PALETTE.glow.warm), 1);
  const northWest = toWorld(area.x, area.y);
  const northEast = toWorld(area.x + area.width, area.y);
  const southEast = toWorld(area.x + area.width, area.y + area.depth);
  const southWest = toWorld(area.x, area.y + area.depth);
  const outline = CreateLineSystem(
    'buildable-border',
    {
      lines: [[northWest, northEast, southEast, southWest, northWest]],
      colors: [[border, border, border, border, border]],
    },
    context.scene,
  );

  for (const mesh of [grid, outline]) {
    mesh.isPickable = false;
  }
  return [grid, outline];
}
