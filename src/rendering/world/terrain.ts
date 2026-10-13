import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { SceneContext } from '../scene/createSceneContext';
import { PALETTE } from '../scene/palette';
import { gridPointToWorld, terrainWorldSize } from './gridToWorld';
import type { HeightField } from './heightField';
import { fbm, smoothstep, valueNoise } from './noise';
import type { TerrainSpec } from './WorldSnapshot';

const SUBDIVISIONS = 100;

const DUST = Color3.FromHexString(PALETTE.terrain.dust);
const SAND = Color3.FromHexString(PALETTE.terrain.sand);
const MOSS = Color3.FromHexString(PALETTE.terrain.moss);
const MOSS_DARK = Color3.FromHexString(PALETTE.terrain.mossDark);
const ROCK = Color3.FromHexString(PALETTE.terrain.rock);

function terrainColor(x: number, z: number, y: number, field: HeightField, seed: number): Color3 {
  const moisture = fbm(x * 0.075 + 31, z * 0.075 - 17, seed + 1);
  const localMoisture = fbm(x * 0.19 - 9, z * 0.19 + 23, seed + 3);
  const mineral = valueNoise(x * 0.28, z * 0.28, seed + 9);
  let natural = Color3.Lerp(DUST, SAND, smoothstep(0.28, 0.68, moisture));
  natural = Color3.Lerp(natural, MOSS, smoothstep(0.5, 0.76, moisture) * 0.48);
  natural = Color3.Lerp(natural, MOSS_DARK, smoothstep(0.76, 0.92, localMoisture) * 0.18);

  // A rocha aparece gradualmente nas elevações; não há faixas senoidais sobrepostas.
  const exposedRock = smoothstep(4, 8, y) * 0.55;
  natural = Color3.Lerp(natural, ROCK, exposedRock);
  const plateauBlend = smoothstep(0, 15, field.distanceToPlateau(x, z));
  const color = Color3.Lerp(DUST, natural, plateauBlend);
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

  for (let row = 0; row <= SUBDIVISIONS; row += 1) {
    for (let column = 0; column <= SUBDIVISIONS; column += 1) {
      const index = row * columns + column;
      const x = (column / SUBDIVISIONS) * world.width - world.width / 2;
      const z = ((SUBDIVISIONS - row) / SUBDIVISIONS) * world.depth - world.depth / 2;
      const y = field.heightAt(x, z);
      const color = terrainColor(x, z, y, field, terrain.seed);
      positions.set([x, y, z], index * 3);
      colors.set([color.r, color.g, color.b, 1], index * 4);
      uvs.set([column / SUBDIVISIONS, row / SUBDIVISIONS], index * 2);
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
