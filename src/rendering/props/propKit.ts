import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

/** Transformação de uma peça antes da fusão. Rotações em radianos; escalas não uniformes valem. */
export interface Placement {
  readonly x?: number;
  readonly y?: number;
  readonly z?: number;
  readonly rx?: number;
  readonly ry?: number;
  readonly rz?: number;
  readonly sx?: number;
  readonly sy?: number;
  readonly sz?: number;
}

/**
 * Construtor de props provisórios. Cada peça recebe uma cor por vértice e as peças de um objeto
 * são fundidas em UM mesh, que usa um único material compartilhado: poucos materiais e poucas
 * chamadas de desenho, sem texturas nem arquivos externos.
 */
export interface PropKit {
  box(size: { w: number; h: number; d: number }, color: string, at?: Placement): Mesh;
  cylinder(
    options: { height: number; bottom: number; top?: number; tessellation?: number },
    color: string,
    at?: Placement,
  ): Mesh;
  sphere(
    options: { diameter: number; segments?: number; slice?: number },
    color: string,
    at?: Placement,
  ): Mesh;
  torus(
    options: { diameter: number; thickness: number; tessellation?: number },
    color: string,
    at?: Placement,
  ): Mesh;
  icosphere(
    options: { radius: number; subdivisions?: number },
    color: string,
    at?: Placement,
  ): Mesh;
  /** Funde as peças em um único mesh (as peças originais são descartadas). */
  merge(name: string, parts: readonly Mesh[]): Mesh;
}

function paint(mesh: Mesh, hex: string): void {
  const color = Color3.FromHexString(hex);
  const vertexCount = mesh.getTotalVertices();
  const data = new Float32Array(vertexCount * 4);
  for (let index = 0; index < vertexCount; index += 1) {
    data[index * 4] = color.r;
    data[index * 4 + 1] = color.g;
    data[index * 4 + 2] = color.b;
    data[index * 4 + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, data);
}

function place(mesh: Mesh, at: Placement | undefined): void {
  if (!at) {
    return;
  }
  mesh.position.set(at.x ?? 0, at.y ?? 0, at.z ?? 0);
  mesh.rotation.set(at.rx ?? 0, at.ry ?? 0, at.rz ?? 0);
  mesh.scaling.set(at.sx ?? 1, at.sy ?? 1, at.sz ?? 1);
}

function finish(mesh: Mesh, hex: string, at: Placement | undefined): Mesh {
  paint(mesh, hex);
  place(mesh, at);
  return mesh;
}

export function createPropKit(scene: Scene): PropKit {
  return {
    box: (size, color, at) =>
      finish(CreateBox('part', { width: size.w, height: size.h, depth: size.d }, scene), color, at),
    cylinder: (options, color, at) =>
      finish(
        CreateCylinder(
          'part',
          {
            height: options.height,
            diameterBottom: options.bottom,
            diameterTop: options.top ?? options.bottom,
            tessellation: options.tessellation ?? 16,
          },
          scene,
        ),
        color,
        at,
      ),
    sphere: (options, color, at) =>
      finish(
        CreateSphere(
          'part',
          { diameter: options.diameter, segments: options.segments ?? 12, slice: options.slice },
          scene,
        ),
        color,
        at,
      ),
    torus: (options, color, at) =>
      finish(
        CreateTorus(
          'part',
          {
            diameter: options.diameter,
            thickness: options.thickness,
            tessellation: options.tessellation ?? 24,
          },
          scene,
        ),
        color,
        at,
      ),
    icosphere: (options, color, at) =>
      finish(
        CreateIcoSphere(
          'part',
          { radius: options.radius, subdivisions: options.subdivisions ?? 1, flat: true },
          scene,
        ),
        color,
        at,
      ),
    merge: (name, parts) => {
      const merged = Mesh.MergeMeshes([...parts], true, true, undefined, false, false);
      if (!merged) {
        throw new Error(`Não foi possível fundir as peças de "${name}".`);
      }
      merged.name = name;
      return merged;
    },
  };
}
