import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { loadGlbAsset, resolvePublicAssetUrl, type LoadedGlbAsset } from '../assets/glbAsset';
import { adaptGlbMaterialsToScene, type AdaptedMaterials } from '../assets/glbMaterials';
import { createPropKit } from '../props/propKit';
import type { SceneContext } from '../scene/createSceneContext';
import { PALETTE } from '../scene/palette';
import { CELL_SIZE, gridPointToWorld, placedCenterToWorld, rotationToRadians } from './gridToWorld';
import type { HeightField } from './heightField';
import type { PlacedSpec, TerrainSpec } from './WorldSnapshot';

const { metal, glow } = PALETTE;

/**
 * Modelo GLB da nave (docs/ART_ASSET_MANIFEST.md, id `crashed-ship`), fornecido pelo usuário.
 * Se o arquivo faltar, falhar ao carregar ou for recusado, a nave procedural abaixo continua sendo
 * a representação exibida.
 *
 * O arquivo recebido tem escala normalizada (maior extensão = 1 unidade) e eixo longo em Z. O nó
 * abaixo o gira para o eixo X e escala para caber no footprint de 16 × 10 unidades;
 * comprimento horizontal entre 0,5× e 1,5× o maior lado é aceito (padrão: 8–24 unidades).
 * A posição da nave continua vindo do cenário; a rotação e a escala abaixo são conversão de asset.
 *  - sem compressão Draco/Meshopt/KTX2: o Babylon baixaria os decodificadores de um CDN externo.
 * `scale`, `yaw` e `offset` existem só para absorver pequenos desvios do arquivo exportado.
 */
export interface CrashedShipModel {
  /** URL final do GLB, já resolvida com o `base` do Vite. */
  readonly url: string;
  readonly scale: number;
  /** Rotação em Y (radianos) aplicada ao modelo dentro do nó da nave. */
  readonly yaw: number;
  readonly offset: { readonly x: number; readonly y: number; readonly z: number };
  /** Célula do mapa na qual centralizar o asset; quando definida, substitui x/z de `offset`. */
  readonly gridPosition?: { readonly x: number; readonly y: number };
}

export const CRASHED_SHIP_MODEL: CrashedShipModel = {
  url: resolvePublicAssetUrl('assets/ships/crashed-ship.glb'),
  scale: 15,
  yaw: Math.PI / 2,
  offset: { x: 0, y: 0, z: 0 },
};

/** Fuselagem rompida, centralizada na célula (12, 17) do mapa. */
export const CRASHED_SHIP_DEBRIS_MODEL: CrashedShipModel = {
  url: resolvePublicAssetUrl('assets/ships/destrocos-1.glb'),
  scale: 6.5,
  yaw: 0.38,
  offset: { x: 0, y: 0, z: 0 },
  gridPosition: { x: 12, y: 17 },
};

/** Faixa aceita para o comprimento do modelo, em múltiplos do maior lado do footprint. */
const MODEL_LENGTH_RANGE = { min: 0.5, max: 1.5 } as const;

export type CrashedShipSource = 'procedural' | 'glb';

export interface CrashedShipOptions {
  /** Modelo a carregar; por padrão `CRASHED_SHIP_MODEL`. `null` mantém só a nave procedural. */
  readonly model?: CrashedShipModel | null;
  /** Asset de destroços adicional; `null` desativa o carregamento. */
  readonly debrisModel?: CrashedShipModel | null;
}

export interface CrashedShip {
  /** Representação exibida agora. Começa `procedural`; vira `glb` se o modelo carregar e for aceito. */
  source(): CrashedShipSource;
  /** Resolve quando a tentativa de carregar o GLB termina, com a representação final. Nunca rejeita. */
  readonly ready: Promise<CrashedShipSource>;
  /** Libera nós, meshes, sombras e o GLB carregado e cancela um carregamento em curso. Idempotente. */
  dispose(): void;
}

/**
 * Nave de exploração acidentada. A versão procedural, feita de primitivas, é criada na hora: o jogo
 * não espera rede e há sempre uma nave na cena. Em paralelo tenta-se carregar o GLB; se ele for
 * aceito, substitui o casco procedural. O
 * comprimento do modelo procedural segue o eixo X local (nariz para -X, enterrado e inclinado); a
 * posição e a orientação vêm dos dados do cenário nos dois casos.
 */
export function createCrashedShip(
  context: SceneContext,
  ship: PlacedSpec,
  terrainSpec: TerrainSpec,
  field: HeightField,
  options: CrashedShipOptions = {},
): CrashedShip {
  const model = options.model === undefined ? CRASHED_SHIP_MODEL : options.model;
  const debrisModel =
    options.debrisModel === undefined
      ? options.model === undefined
        ? CRASHED_SHIP_DEBRIS_MODEL
        : null
      : options.debrisModel;
  const kit = createPropKit(context.scene);
  const center = placedCenterToWorld(ship, terrainSpec.sizeCells);

  const root = new TransformNode('crashed-ship', context.scene);
  root.position.set(center.x, field.heightAt(center.x, center.z), center.z);
  root.rotation.y = rotationToRadians(ship.rotation);

  // Casco: elipsoide + motor + nariz + asas, uma asa quebrada, deriva torta e estruturas expostas.
  const hull = kit.merge('ship-hull', [
    kit.sphere({ diameter: 2, segments: 20 }, metal.hull, { sx: 7, sy: 1.7, sz: 1.9 }),
    kit.cylinder({ height: 3.2, bottom: 3.3, top: 3.0, tessellation: 20 }, metal.hullDark, {
      x: 6.2,
      rz: Math.PI / 2,
    }),
    kit.cylinder({ height: 3.4, bottom: 2.7, top: 0.05, tessellation: 18 }, metal.hullLight, {
      x: -6.4,
      rz: Math.PI / 2,
    }),
    kit.sphere({ diameter: 0.9, segments: 8 }, metal.accent, { x: -8.0, y: -0.05 }),
    kit.box({ w: 3.6, h: 0.1, d: 2.0 }, metal.accent, { x: -1.2, y: 1.6, rz: 0.04 }),
    kit.box({ w: 2.2, h: 0.1, d: 1.3 }, metal.burnt, { x: 2.3, y: 1.58, z: 0.3, ry: 0.3 }),
    // asa esquerda inteira
    kit.box({ w: 4.4, h: 0.25, d: 4.8 }, metal.hullDark, {
      x: 0.9,
      y: -0.25,
      z: 3.9,
      ry: 0.3,
      rx: 0.05,
    }),
    kit.box({ w: 1.0, h: 0.28, d: 1.6 }, metal.accent, { x: 1.9, y: -0.25, z: 6.2, ry: 0.3 }),
    // asa direita quebrada
    kit.box({ w: 2.4, h: 0.25, d: 2.6 }, metal.hullDark, { x: 1.3, y: -0.3, z: -3.0, ry: -0.3 }),
    // deriva torta
    kit.box({ w: 2.4, h: 2.4, d: 0.22 }, metal.hull, { x: 5.4, y: 2.3, z: 0.3, rx: 0.32 }),
    kit.box({ w: 1.2, h: 1.0, d: 0.2 }, metal.hullDark, { x: 5.0, y: 1.6, z: -0.6, rx: -0.4 }),
    // bocais do motor
    kit.cylinder({ height: 1.6, bottom: 1.5, top: 1.2, tessellation: 14 }, metal.burnt, {
      x: 8.0,
      z: 1.0,
      rz: Math.PI / 2,
    }),
    kit.cylinder({ height: 1.6, bottom: 1.5, top: 1.2, tessellation: 14 }, metal.burnt, {
      x: 8.0,
      z: -1.0,
      rz: Math.PI / 2,
    }),
    // trens de pouso tortos
    kit.cylinder({ height: 1.9, bottom: 0.22, top: 0.16, tessellation: 8 }, metal.steel, {
      x: -1.6,
      y: -1.7,
      z: 1.7,
      rx: 0.35,
    }),
    kit.cylinder({ height: 1.9, bottom: 0.22, top: 0.16, tessellation: 8 }, metal.steel, {
      x: -1.4,
      y: -1.5,
      z: -1.9,
      rx: -0.7,
      rz: 0.2,
    }),
    // estrutura exposta na avaria
    kit.box({ w: 0.12, h: 1.6, d: 0.12 }, metal.steel, { x: 2.4, y: 1.9, z: 0.2, rz: 0.4 }),
    kit.box({ w: 0.12, h: 1.3, d: 0.12 }, metal.steel, { x: 2.9, y: 1.8, z: 0.6, rz: -0.5 }),
    kit.box({ w: 0.12, h: 1.1, d: 0.12 }, metal.steel, { x: 3.2, y: 1.7, z: -0.1, rx: 0.5 }),
    // antena torta com prato
    kit.cylinder({ height: 2.2, bottom: 0.07, top: 0.05, tessellation: 6 }, metal.steel, {
      x: 2.6,
      y: 2.7,
      z: -0.9,
      rz: 0.7,
    }),
    kit.sphere({ diameter: 0.9, segments: 10, slice: 0.5 }, metal.hullLight, {
      x: 3.5,
      y: 3.5,
      z: -0.9,
      rz: -0.8,
    }),
  ]);
  hull.material = context.materials.solid;
  hull.receiveShadows = true;

  const canopy = kit.merge('ship-canopy', [
    kit.sphere({ diameter: 2, segments: 16 }, glow.cyan, {
      x: -3.4,
      y: 1.25,
      sx: 1.6,
      sy: 0.8,
      sz: 1.0,
    }),
  ]);
  canopy.material = context.materials.glowCyan;

  const embers = kit.merge('ship-embers', [
    kit.sphere({ diameter: 1.0, segments: 8 }, glow.ember, { x: 8.55, z: 1.0 }),
    kit.sphere({ diameter: 1.0, segments: 8 }, glow.ember, { x: 8.55, z: -1.0 }),
    kit.sphere({ diameter: 0.5, segments: 6 }, glow.ember, { x: 3.1, y: 1.65, z: 0.1 }),
  ]);
  embers.material = context.materials.glowEmber;

  // Casco inclinado: cauda para cima, nariz afundando no terreno.
  const tilt = new TransformNode('ship-tilt', context.scene);
  tilt.parent = root;
  tilt.position.y = 1.9;
  tilt.rotation.z = 0.12;
  tilt.rotation.x = -0.06;
  // O casco é "pickable" de propósito: sem metadados de entidade o clique nele resolve para "nada
  // selecionado", mas ele passa a ocultar o que está atrás. Se não fosse, clicar na nave (visto de
  // um ângulo em que ela fica na frente de uma construção) selecionaria a construção por engano.
  for (const part of [hull, canopy, embers]) {
    part.parent = tilt;
  }

  const proceduralCasters: Mesh[] = [hull];
  for (const caster of proceduralCasters) {
    context.shadows.add(caster);
  }

  let source: CrashedShipSource = 'procedural';
  let disposed = false;
  let modelAsset: LoadedGlbAsset | null = null;
  let modelMaterials: AdaptedMaterials | null = null;
  let debrisAsset: LoadedGlbAsset | null = null;
  let debrisMaterials: AdaptedMaterials | null = null;
  let modelCasters: readonly AbstractMesh[] = [];
  const loading = new AbortController();
  const footprintLength = Math.max(ship.size.width, ship.size.depth) * CELL_SIZE;

  /**
   * Troca o casco procedural pelo modelo carregado, só depois de os materiais dele compilarem: o
   * Babylon não desenha malhas com material pendente, e trocar antes deixaria a cena sem nave por
   * alguns instantes. Se o modelo for recusado, libera-o e deixa a nave procedural como estava. O
   * modelo entra na cena sem metadados de entidade: continua "pickable" para ocultar o que está
   * atrás (como o casco procedural), mas clicar nele não seleciona nada.
   */
  const adoptModel = async (asset: LoadedGlbAsset, placement: CrashedShipModel): Promise<void> => {
    const modelRoot = new TransformNode('ship-model', context.scene);
    modelRoot.parent = root;
    modelRoot.position.set(placement.offset.x, placement.offset.y, placement.offset.z);
    modelRoot.rotation.y = placement.yaw;
    modelRoot.scaling.setAll(placement.scale);
    modelRoot.setEnabled(false);
    for (const node of asset.rootNodes) {
      node.parent = modelRoot;
    }
    // Daqui em diante o descarte da nave também libera o GLB, mesmo se ele ainda estiver compilando.
    modelAsset = asset;

    const discard = (reason: string): void => {
      console.warn(`[nave] Modelo GLB recusado (${reason}); mantida a nave procedural.`);
      modelAsset = null;
      modelMaterials?.dispose();
      modelMaterials = null;
      asset.dispose();
      modelRoot.dispose(false, false);
    };

    const meshes = modelRoot.getChildMeshes().filter((mesh) => mesh.getTotalVertices() > 0);
    const rejection = modelRejection(root, modelRoot, meshes, footprintLength);
    if (rejection !== null) {
      discard(rejection);
      return;
    }
    // Os materiais PBR do arquivo viram StandardMaterial, o modelo de luz do resto da cena.
    modelMaterials = adaptGlbMaterialsToScene(meshes, context.scene);
    try {
      await Promise.all(meshes.map((mesh) => mesh.material?.forceCompilationAsync(mesh)));
    } catch (error) {
      if (!disposed) {
        discard(`os materiais não compilaram: ${String(error)}`);
      }
      return;
    }
    if (disposed) {
      return;
    }

    for (const mesh of meshes) {
      mesh.isPickable = true;
      mesh.receiveShadows = true;
      context.shadows.add(mesh);
    }
    for (const caster of proceduralCasters) {
      context.shadows.remove(caster);
    }
    tilt.dispose(false, false);
    modelRoot.setEnabled(true);
    modelCasters = [...modelCasters, ...meshes];
    source = 'glb';
  };

  const adoptDebrisModel = async (
    asset: LoadedGlbAsset,
    placement: CrashedShipModel,
  ): Promise<void> => {
    const debrisRoot = new TransformNode('ship-debris-1', context.scene);
    debrisRoot.parent = root;
    let offsetX = placement.offset.x;
    let offsetZ = placement.offset.z;
    if (placement.gridPosition !== undefined) {
      const target = gridPointToWorld(
        { x: placement.gridPosition.x + 0.5, y: placement.gridPosition.y + 0.5 },
        terrainSpec.sizeCells,
      );
      const dx = target.x - root.position.x;
      const dz = target.z - root.position.z;
      const cos = Math.cos(root.rotation.y);
      const sin = Math.sin(root.rotation.y);
      offsetX = cos * dx - sin * dz;
      offsetZ = sin * dx + cos * dz;
    }
    debrisRoot.position.set(offsetX, placement.offset.y, offsetZ);
    debrisRoot.rotation.y = placement.yaw;
    debrisRoot.scaling.setAll(placement.scale);
    debrisRoot.setEnabled(false);
    root.computeWorldMatrix(true);
    const worldPosition = Vector3.TransformCoordinates(
      new Vector3(offsetX, 0, offsetZ),
      root.getWorldMatrix(),
    );
    debrisRoot.position.y = field.heightAt(worldPosition.x, worldPosition.z) - root.position.y;
    for (const node of asset.rootNodes) {
      node.parent = debrisRoot;
    }
    debrisAsset = asset;

    const discard = (reason: string): void => {
      console.warn(`[destroços] Modelo GLB recusado (${reason}); mantido o restante da nave.`);
      debrisAsset = null;
      debrisMaterials?.dispose();
      debrisMaterials = null;
      asset.dispose();
      debrisRoot.dispose(false, false);
    };

    const meshes = debrisRoot.getChildMeshes().filter((mesh) => mesh.getTotalVertices() > 0);
    const rejection = modelRejection(root, debrisRoot, meshes, 6);
    if (rejection !== null) {
      discard(rejection);
      return;
    }
    debrisMaterials = adaptGlbMaterialsToScene(meshes, context.scene);
    try {
      await Promise.all(meshes.map((mesh) => mesh.material?.forceCompilationAsync(mesh)));
    } catch (error) {
      if (!disposed) {
        discard(`os materiais não compilaram: ${String(error)}`);
      }
      return;
    }
    if (disposed) {
      return;
    }

    for (const mesh of meshes) {
      mesh.isPickable = true;
      mesh.receiveShadows = true;
      context.shadows.add(mesh);
    }
    debrisRoot.setEnabled(true);
    modelCasters = [...modelCasters, ...meshes];
  };

  const loadShipModel = async (): Promise<void> => {
    if (model === null) {
      return;
    }
    try {
      const asset = await loadGlbAsset(context.scene, model.url, loading.signal);
      if (disposed) {
        asset.dispose();
      } else {
        await adoptModel(asset, model);
      }
    } catch (error) {
      if (!disposed) {
        console.info('[nave] Modelo GLB indisponível; mantida a nave procedural.', error);
      }
    }
  };

  const loadDebrisModel = async (): Promise<void> => {
    if (debrisModel === null) {
      return;
    }
    try {
      const asset = await loadGlbAsset(context.scene, debrisModel.url, loading.signal);
      if (disposed) {
        asset.dispose();
      } else {
        await adoptDebrisModel(asset, debrisModel);
      }
    } catch (error) {
      if (!disposed) {
        console.info('[destroços] Modelo GLB indisponível; nave mantida sem este asset.', error);
      }
    }
  };

  const ready = Promise.all([loadShipModel(), loadDebrisModel()]).then(() => source);

  return {
    source: () => source,
    ready,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      loading.abort();
      for (const caster of [...proceduralCasters, ...modelCasters]) {
        context.shadows.remove(caster);
      }
      modelAsset?.dispose();
      modelMaterials?.dispose();
      debrisAsset?.dispose();
      debrisMaterials?.dispose();
      root.dispose(false, false);
    },
  };
}

/** Motivo para recusar o modelo carregado, ou `null` se ele serve (tem malha e tamanho coerente). */
function modelRejection(
  root: TransformNode,
  modelRoot: TransformNode,
  meshes: readonly AbstractMesh[],
  footprintLength: number,
): string | null {
  if (meshes.length === 0) {
    return 'o arquivo não tem nenhuma malha';
  }
  root.computeWorldMatrix(true);
  modelRoot.computeWorldMatrix(true);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    minX = Math.min(minX, box.minimumWorld.x);
    maxX = Math.max(maxX, box.maximumWorld.x);
    minZ = Math.min(minZ, box.minimumWorld.z);
    maxZ = Math.max(maxZ, box.maximumWorld.z);
  }
  const length = Math.max(maxX - minX, maxZ - minZ);
  const min = footprintLength * MODEL_LENGTH_RANGE.min;
  const max = footprintLength * MODEL_LENGTH_RANGE.max;
  if (!Number.isFinite(length) || length < min || length > max) {
    return `comprimento de ${length.toFixed(1)} unidades fora da faixa de ${min} a ${max}`;
  }
  return null;
}
