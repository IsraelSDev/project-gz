import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { BuildingDefinitionId } from '@/game/content/buildings';
import type { PropKit } from '../props/propKit';
import { PALETTE } from '../scene/palette';
import type { SceneMaterials } from '../scene/materials';

const { metal, habitat, extractor, solar, farm, recycler, plant, glow } = PALETTE;

/**
 * Modelo visual provisório de um edifício. Convenções: centrado na origem, base em y = 0, frente
 * voltada para o SUL (-Z) com rotação 0. `size` é o footprint sem rotação em unidades de mundo.
 */
export interface BuildingModel {
  /** Parte sólida (cor por vértice): projeta e recebe sombras. */
  readonly solid: Mesh;
  /** Partes luminosas (janelas, indicadores), com material próprio. */
  readonly glowing: readonly Mesh[];
}

export type BuildingModelBuilder = (
  kit: PropKit,
  materials: SceneMaterials,
  size: { readonly width: number; readonly depth: number },
) => BuildingModel;

/** Módulo habitacional: cúpula clara com faixa azul, porta voltada para o sul e anexo técnico. */
const buildHabitat: BuildingModelBuilder = (kit, materials, size) => {
  const radius = Math.min(size.width, size.depth) * 0.34;
  const baseY = 0.7;
  const bandHeight = 0.9;
  const bandRadius = Math.sqrt(radius * radius - bandHeight * bandHeight);

  const solid = kit.merge('habitat', [
    kit.box({ w: size.width - 0.2, h: 0.2, d: size.depth - 0.2 }, metal.pad, { y: 0.1 }),
    kit.cylinder({ height: 0.5, bottom: radius * 2 + 0.3, tessellation: 28 }, habitat.ring, {
      y: 0.45,
    }),
    kit.sphere({ diameter: radius * 2, segments: 24, slice: 0.5 }, habitat.shell, { y: baseY }),
    kit.torus(
      { diameter: bandRadius * 2 + 0.06, thickness: 0.22, tessellation: 32 },
      habitat.band,
      {
        y: baseY + bandHeight,
      },
    ),
    // porta, moldura, marquise e degraus voltados para o sul (-Z)
    kit.box({ w: 1.4, h: 1.9, d: 0.22 }, habitat.band, { y: 1.15, z: -(radius - 0.06) }),
    kit.box({ w: 1.05, h: 1.7, d: 0.3 }, habitat.door, { y: 1.05, z: -(radius - 0.02) }),
    kit.box({ w: 1.9, h: 0.12, d: 0.9 }, habitat.ring, { y: 2.1, z: -(radius + 0.25) }),
    kit.box({ w: 1.6, h: 0.18, d: 0.8 }, metal.pad, { y: 0.29, z: -(radius + 0.45) }),
    // anexo técnico a leste, com faixa de teto
    kit.box({ w: 1.5, h: 1.3, d: 2.0 }, metal.hullLight, {
      x: size.width / 2 - 0.85,
      y: 0.85,
      z: 0.3,
    }),
    kit.box({ w: 1.56, h: 0.1, d: 2.06 }, habitat.band, {
      x: size.width / 2 - 0.85,
      y: 1.54,
      z: 0.3,
    }),
    // antena e respiro no topo
    kit.cylinder({ height: 1.5, bottom: 0.08, top: 0.05, tessellation: 6 }, metal.steel, {
      x: -0.3,
      y: baseY + radius + 0.5,
      z: 0.2,
    }),
    kit.cylinder({ height: 0.4, bottom: 0.5, top: 0.4, tessellation: 12 }, metal.hullDark, {
      x: 0.8,
      y: baseY + radius - 0.1,
      z: 0.2,
    }),
  ]);
  solid.material = materials.solid;

  const windowRadius = Math.sqrt(radius * radius - 1.2 * 1.2) * 1.03;
  const windows = [0.9, -0.9, 2.3, -2.3].map((angle) =>
    kit.sphere({ diameter: 0.5, segments: 8 }, glow.warm, {
      x: windowRadius * Math.sin(angle),
      y: baseY + 1.2,
      z: windowRadius * Math.cos(angle),
      sz: 0.45,
      ry: angle,
    }),
  );
  const lights = kit.merge('habitat-lights', windows);
  lights.material = materials.glowWarm;

  const beacon = kit.merge('habitat-beacon', [
    kit.sphere({ diameter: 0.24, segments: 6 }, glow.green, {
      x: -0.3,
      y: baseY + radius + 1.3,
      z: 0.2,
    }),
  ]);
  beacon.material = materials.glowGreen;

  return { solid, glowing: [lights, beacon] };
};

/** Extrator de água: tanque nervurado, torre de perfuração e casa de bombas laranja. */
const buildExtractor: BuildingModelBuilder = (kit, materials, size) => {
  const towerX = 0.9;
  const towerZ = 0.8;
  const legs = [-0.4, 0.4].flatMap((dx) =>
    [-0.4, 0.4].map((dz) =>
      kit.cylinder({ height: 4.4, bottom: 0.14, top: 0.09, tessellation: 6 }, metal.steel, {
        x: towerX + dx,
        y: 2.3,
        z: towerZ + dz,
      }),
    ),
  );

  const solid = kit.merge('extractor', [
    kit.box({ w: size.width - 0.2, h: 0.2, d: size.depth - 0.2 }, metal.pad, { y: 0.1 }),
    // tanque
    kit.cylinder({ height: 2.4, bottom: 2.0, tessellation: 24 }, extractor.tank, {
      x: -0.7,
      y: 1.4,
      z: -0.4,
    }),
    kit.torus({ diameter: 2.04, thickness: 0.1, tessellation: 24 }, extractor.tankDark, {
      x: -0.7,
      y: 0.6,
      z: -0.4,
    }),
    kit.torus({ diameter: 2.04, thickness: 0.1, tessellation: 24 }, extractor.tankDark, {
      x: -0.7,
      y: 1.4,
      z: -0.4,
    }),
    kit.torus({ diameter: 2.04, thickness: 0.1, tessellation: 24 }, extractor.tankDark, {
      x: -0.7,
      y: 2.2,
      z: -0.4,
    }),
    kit.sphere({ diameter: 2.0, segments: 16, slice: 0.5 }, extractor.tank, {
      x: -0.7,
      y: 2.6,
      z: -0.4,
    }),
    kit.sphere({ diameter: 0.36, segments: 8 }, metal.steel, { x: -0.7, y: 3.6, z: -0.4 }),
    // torre e tubo de perfuração
    ...legs,
    kit.box({ w: 0.9, h: 0.06, d: 0.06 }, metal.steel, { x: towerX, y: 1.2, z: towerZ + 0.4 }),
    kit.box({ w: 0.9, h: 0.06, d: 0.06 }, metal.steel, { x: towerX, y: 2.7, z: towerZ - 0.4 }),
    kit.box({ w: 1.0, h: 0.35, d: 1.0 }, metal.hullDark, { x: towerX, y: 4.6, z: towerZ }),
    kit.box({ w: 1.9, h: 0.12, d: 0.12 }, metal.steel, { x: towerX - 0.5, y: 4.9, z: towerZ }),
    kit.cylinder({ height: 4.2, bottom: 0.22, tessellation: 10 }, extractor.pump, {
      x: towerX,
      y: 2.2,
      z: towerZ,
    }),
    // casa de bombas e tubulação
    kit.box({ w: 1.2, h: 0.9, d: 1.0 }, extractor.pump, { x: towerX, y: 0.65, z: -0.9 }),
    kit.cylinder({ height: 0.4, bottom: 0.4, tessellation: 10 }, metal.hullDark, {
      x: towerX + 0.3,
      y: 1.3,
      z: -0.9,
    }),
    kit.cylinder({ height: 1.8, bottom: 0.2, tessellation: 8 }, metal.steel, {
      x: 0.1,
      y: 0.5,
      z: -0.9,
      rz: Math.PI / 2,
    }),
    kit.cylinder({ height: 1.5, bottom: 0.2, tessellation: 8 }, metal.steel, {
      x: -0.7,
      y: 0.45,
      z: -1.35,
      rx: Math.PI / 2,
    }),
  ]);
  solid.material = materials.solid;

  const lamp = kit.merge('extractor-lamp', [
    kit.sphere({ diameter: 0.28, segments: 8 }, glow.cyan, { x: towerX - 0.3, y: 1.3, z: -1.45 }),
  ]);
  lamp.material = materials.glowCyan;

  return { solid, glowing: [lamp] };
};

/** Matriz solar: três painéis inclinados sobre mastros, gabinete de baterias e cabo no chão. */
const buildSolar: BuildingModelBuilder = (kit, materials, size) => {
  const tilt = -0.5;
  const panelCenterY = 1.45;
  // Posição de um ponto no plano do painel inclinado (localX ao longo do painel, localZ na inclinação).
  const onPanel = (cx: number, localX: number, localZ: number, lift: number) => ({
    x: cx + localX,
    y: panelCenterY + lift * Math.cos(tilt) - localZ * Math.sin(tilt),
    z: lift * Math.sin(tilt) + localZ * Math.cos(tilt),
  });

  const parts: Mesh[] = [
    kit.box({ w: size.width - 0.2, h: 0.12, d: size.depth - 0.2 }, metal.pad, { y: 0.06 }),
    kit.box({ w: 1.0, h: 0.9, d: 0.8 }, metal.hullLight, {
      x: size.width / 2 - 0.7,
      y: 0.57,
      z: -size.depth / 2 + 0.7,
    }),
    kit.box({ w: 4.2, h: 0.05, d: 0.09 }, metal.burnt, {
      x: -0.4,
      y: 0.14,
      z: -size.depth / 2 + 0.7,
    }),
  ];

  for (const cx of [-2, 0, 2]) {
    parts.push(
      kit.cylinder({ height: 1.1, bottom: 0.16, tessellation: 8 }, metal.steel, {
        x: cx,
        y: 0.62,
        z: 0.35,
      }),
      kit.box({ w: 1.8, h: 0.08, d: 2.5 }, solar.frame, { x: cx, y: panelCenterY, rx: tilt }),
    );
    const face = onPanel(cx, 0, 0, 0.045);
    parts.push(kit.box({ w: 1.64, h: 0.05, d: 2.34 }, solar.cell, { ...face, rx: tilt }));
    for (const localZ of [-0.6, 0, 0.6]) {
      const line = onPanel(cx, 0, localZ, 0.075);
      parts.push(kit.box({ w: 1.64, h: 0.03, d: 0.04 }, solar.cellLine, { ...line, rx: tilt }));
    }
    const spine = onPanel(cx, 0, 0, 0.075);
    parts.push(kit.box({ w: 0.04, h: 0.03, d: 2.34 }, solar.cellLine, { ...spine, rx: tilt }));
  }

  const solid = kit.merge('solar-array', parts);
  solid.material = materials.solid;

  const indicator = kit.merge('solar-indicator', [
    kit.sphere({ diameter: 0.16, segments: 6 }, glow.green, {
      x: size.width / 2 - 0.7,
      y: 0.85,
      z: -size.depth / 2 + 0.28,
    }),
  ]);
  indicator.material = materials.glowGreen;

  return { solid, glowing: [indicator] };
};

/** Estufa hidropônica: canteiros cobertos por uma estufa de vidro, plantas na frente e tanque ao lado. */
const buildFarm: BuildingModelBuilder = (kit, materials, size) => {
  const halfDepth = size.depth / 2;
  const plants = [-1.6, -0.55, 0.5, 1.55].map((x) =>
    kit.sphere({ diameter: 0.75, segments: 8 }, plant.leaf, {
      x,
      y: 0.75,
      z: -(halfDepth - 0.45),
      sy: 0.8,
    }),
  );
  const solid = kit.merge('farm', [
    kit.box({ w: size.width - 0.2, h: 0.2, d: size.depth - 0.2 }, metal.pad, { y: 0.1 }),
    kit.box({ w: size.width - 1.2, h: 0.4, d: size.depth - 1.0 }, farm.soil, { y: 0.4, x: -0.3 }),
    // estufa: estrutura, vidro e cumeeira
    kit.box({ w: size.width - 1.8, h: 1.5, d: size.depth - 1.8 }, farm.glass, { y: 1.15, x: -0.3 }),
    kit.box({ w: size.width - 1.6, h: 0.14, d: size.depth - 1.6 }, farm.frame, {
      y: 1.95,
      x: -0.3,
    }),
    kit.box({ w: size.width - 1.8, h: 0.5, d: 0.5 }, farm.glassDark, { y: 2.2, x: -0.3 }),
    ...[-1.7, -0.3, 1.1].map((x) =>
      kit.box({ w: 0.1, h: 1.6, d: size.depth - 1.7 }, farm.frame, { y: 1.15, x }),
    ),
    ...plants,
    // tanque de nutrientes a leste
    kit.cylinder({ height: 1.3, bottom: 1.0, tessellation: 16 }, extractor.tank, {
      x: size.width / 2 - 0.9,
      y: 0.85,
      z: halfDepth - 1.0,
    }),
    kit.cylinder({ height: 0.15, bottom: 1.1, tessellation: 16 }, extractor.tankDark, {
      x: size.width / 2 - 0.9,
      y: 1.55,
      z: halfDepth - 1.0,
    }),
  ]);
  solid.material = materials.solid;

  const lamps = kit.merge('farm-lamps', [
    kit.sphere({ diameter: 0.22, segments: 6 }, glow.green, {
      x: -0.3,
      y: 2.55,
      z: -(halfDepth - 1.0),
    }),
    kit.sphere({ diameter: 0.22, segments: 6 }, glow.green, {
      x: -0.3,
      y: 2.55,
      z: halfDepth - 1.0,
    }),
  ]);
  lamps.material = materials.glowGreen;

  return { solid, glowing: [lamps] };
};

/** Reciclador de materiais: corpo robusto, tremonha e esteira voltadas ao sul, chaminé e caixas. */
const buildRecycler: BuildingModelBuilder = (kit, materials, size) => {
  const halfDepth = size.depth / 2;
  const solid = kit.merge('recycler', [
    kit.box({ w: size.width - 0.2, h: 0.2, d: size.depth - 0.2 }, metal.pad, { y: 0.1 }),
    kit.box({ w: size.width - 1.0, h: 1.9, d: size.depth - 1.6 }, recycler.body, {
      y: 1.15,
      z: 0.5,
    }),
    kit.box({ w: size.width - 0.8, h: 0.16, d: size.depth - 1.4 }, recycler.bodyDark, {
      y: 2.18,
      z: 0.5,
    }),
    // tremonha inclinada e esteira voltadas para o sul (-Z)
    kit.box({ w: 1.6, h: 0.9, d: 1.1 }, recycler.hopper, { y: 1.55, z: -(halfDepth - 0.8) }),
    kit.box({ w: 1.2, h: 0.12, d: 1.8 }, metal.steel, {
      y: 0.55,
      z: -(halfDepth - 0.5),
      rx: -0.35,
    }),
    // chaminé
    kit.cylinder({ height: 2.0, bottom: 0.55, top: 0.4, tessellation: 12 }, metal.hullDark, {
      x: size.width / 2 - 0.9,
      y: 3.1,
      z: 0.7,
    }),
    // caixas de material reciclado
    kit.box({ w: 0.8, h: 0.7, d: 0.8 }, metal.hullLight, {
      x: -(size.width / 2 - 0.55),
      y: 0.55,
      z: -0.4,
    }),
    kit.box({ w: 0.6, h: 0.5, d: 0.6 }, metal.accent, {
      x: -(size.width / 2 - 0.5),
      y: 0.45,
      z: -1.2,
    }),
  ]);
  solid.material = materials.solid;

  const vent = kit.merge('recycler-vent', [
    kit.sphere({ diameter: 0.3, segments: 6 }, glow.ember, {
      x: size.width / 2 - 0.9,
      y: 4.15,
      z: 0.7,
    }),
    kit.box({ w: 1.0, h: 0.1, d: 0.1 }, glow.ember, { y: 1.6, z: -(halfDepth - 1.38) }),
  ]);
  vent.material = materials.glowEmber;

  return { solid, glowing: [vent] };
};

const buildLaboratory: BuildingModelBuilder = (kit, materials, size) => {
  const solid = kit.merge('field-laboratory', [
    kit.box({ w: size.width - 0.15, h: 0.18, d: size.depth - 0.15 }, metal.pad, { y: 0.09 }),
    kit.box({ w: size.width - 0.45, h: 1.5, d: size.depth - 0.45 }, metal.hullLight, { y: 0.85 }),
    kit.box({ w: 0.12, h: 2.1, d: 0.12 }, metal.steel, { x: -0.55, y: 2.55, z: -0.35 }),
    kit.box({ w: 0.12, h: 2.1, d: 0.12 }, metal.steel, { x: 0.55, y: 2.55, z: -0.35 }),
    kit.box({ w: 1.25, h: 0.1, d: 0.9 }, solar.cell, { y: 2.9, z: -0.35 }),
  ]);
  solid.material = materials.solid;
  return { solid, glowing: [] };
};

const buildThermalGenerator: BuildingModelBuilder = (kit, materials, size) => {
  const solid = kit.merge('thermal-generator', [
    kit.box({ w: size.width - 0.15, h: 0.18, d: size.depth - 0.15 }, metal.pad, { y: 0.09 }),
    kit.cylinder({ height: 1.5, bottom: 1.15, top: 0.95, tessellation: 12 }, metal.hullDark, {
      x: -0.48,
      y: 0.9,
      z: 0.35,
    }),
    kit.cylinder({ height: 0.75, bottom: 0.66, top: 0.66, tessellation: 12 }, metal.steel, {
      x: -0.48,
      y: 1.9,
      z: 0.35,
    }),
    kit.box({ w: 0.7, h: 1.1, d: 0.7 }, metal.hullLight, { x: 0.55, y: 0.7, z: -0.32 }),
    kit.cylinder({ height: 1.9, bottom: 0.22, top: 0.18, tessellation: 8 }, metal.steel, {
      x: 0.55,
      y: 2.15,
      z: -0.32,
    }),
  ]);
  solid.material = materials.solid;
  const vent = kit.merge('thermal-vent', [
    kit.sphere({ diameter: 0.28, segments: 8 }, glow.cyan, { x: -0.48, y: 2.65, z: 0.35 }),
  ]);
  vent.material = materials.glowCyan;
  return { solid, glowing: [vent] };
};

/** Um construtor por definição: o compilador exige um modelo para cada `BuildingDefinitionId`. */
export const BUILDING_MODELS: Record<BuildingDefinitionId, BuildingModelBuilder> = {
  'habitat-module': buildHabitat,
  'water-extractor': buildExtractor,
  'solar-array': buildSolar,
  'hydroponic-farm': buildFarm,
  'materials-recycler': buildRecycler,
  'field-laboratory': buildLaboratory,
  'protein-cultivator': buildFarm,
  'thermal-generator': buildThermalGenerator,
};
