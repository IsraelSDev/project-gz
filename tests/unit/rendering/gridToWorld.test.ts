import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { describe, expect, it } from 'vitest';
import {
  CELL_SIZE,
  gridPointToWorld,
  gridRectToWorldBounds,
  placedCenterToWorld,
  rotationToRadians,
  terrainWorldSize,
} from '@/rendering/world/gridToWorld';

const terrain = { width: 40, depth: 40 };

describe('gridToWorld', () => {
  it('centraliza o terreno na origem do mundo', () => {
    const center = gridPointToWorld({ x: 20, y: 20 }, terrain);

    expect(center.x).toBeCloseTo(0);
    expect(center.z).toBeCloseTo(0);
    expect(terrainWorldSize(terrain)).toEqual({ width: 80, depth: 80 });
  });

  it('x cresce para +X (leste) e y cresce para -Z (sul)', () => {
    const origin = gridPointToWorld({ x: 20, y: 20 }, terrain);
    const east = gridPointToWorld({ x: 21, y: 20 }, terrain);
    const south = gridPointToWorld({ x: 20, y: 21 }, terrain);

    expect(east.x - origin.x).toBeCloseTo(CELL_SIZE);
    expect(east.z - origin.z).toBeCloseTo(0);
    expect(south.z - origin.z).toBeCloseTo(-CELL_SIZE);
    expect(south.x - origin.x).toBeCloseTo(0);
  });

  it('coloca o canto noroeste do grid em (-X, +Z)', () => {
    const northWest = gridPointToWorld({ x: 0, y: 0 }, terrain);

    expect(northWest.x).toBeCloseTo(-40);
    expect(northWest.z).toBeCloseTo(40);
  });

  it('converte um retângulo do grid em limites do mundo', () => {
    const bounds = gridRectToWorldBounds({ x: 12, y: 12, width: 16, depth: 16 }, terrain);

    expect(bounds.minX).toBeCloseTo(-16);
    expect(bounds.maxX).toBeCloseTo(16);
    expect(bounds.minZ).toBeCloseTo(-16);
    expect(bounds.maxZ).toBeCloseTo(16);
  });

  it('usa o retângulo já rotacionado para achar o centro de um objeto', () => {
    const solar = { position: { x: 23, y: 23 }, size: { width: 3, depth: 2 } } as const;

    // Sem rotação ocupa 3x2: centro de grid (24.5, 24).
    const upright = placedCenterToWorld({ ...solar, rotation: 0 }, terrain);
    expect(upright.x).toBeCloseTo(9);
    expect(upright.z).toBeCloseTo(-8);

    // Com 90° ocupa 2x3: centro de grid (24, 24.5).
    const turned = placedCenterToWorld({ ...solar, rotation: 90 }, terrain);
    expect(turned.x).toBeCloseTo(8);
    expect(turned.z).toBeCloseTo(-9);
  });

  it('converte rotações em radianos', () => {
    expect(rotationToRadians(0)).toBe(0);
    expect(rotationToRadians(90)).toBeCloseTo(Math.PI / 2);
    expect(rotationToRadians(180)).toBeCloseTo(Math.PI);
    expect(rotationToRadians(270)).toBeCloseTo((3 * Math.PI) / 2);
  });

  it('a convenção documentada vale no Babylon: a frente (sul, -Z) gira no sentido horário visto de cima', () => {
    const south = new Vector3(0, 0, -1);
    const turn = (degrees: 0 | 90 | 180 | 270): Vector3 =>
      Vector3.TransformCoordinates(south, Matrix.RotationY(rotationToRadians(degrees)));

    // Horário visto de cima, com o norte para cima: sul -> oeste -> norte -> leste.
    expect(turn(0).x).toBeCloseTo(0);
    expect(turn(0).z).toBeCloseTo(-1);
    expect(turn(90).x).toBeCloseTo(-1); // oeste
    expect(turn(90).z).toBeCloseTo(0);
    expect(turn(180).z).toBeCloseTo(1); // norte
    expect(turn(270).x).toBeCloseTo(1); // leste
  });
});
