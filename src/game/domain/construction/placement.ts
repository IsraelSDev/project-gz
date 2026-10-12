import { BUILDING_DEFINITIONS, type BuildingDefinition } from '@/game/content/buildings';
import { RESOURCE_IDS, type ResourceId, type ResourceRates } from '@/game/content/resources';
import type { BuildingInstance, ResourceStock } from '@/game/domain/state/GameState';
import { occupiedRect, rectContainsRect, rectsOverlap, rotatedSize } from '@/shared/grid/gridMath';
import type { GridPosition, GridRect, GridSize, Rotation } from '@/shared/grid/types';
import { err, ok, type Result } from '@/shared/result/result';

/*
 * Regras de posicionamento e de custo da construção (docs/TECHNICAL_ARCHITECTURE.md §9 e §21).
 * Tudo aqui é puro e determinístico, sem Babylon.js nem React: o comando `PlaceBuilding` e a prévia
 * da interface usam ESTAS funções, então "posição válida" tem uma definição só.
 *
 * Convenção do grid (a mesma de `shared/grid/types.ts`): x cresce para LESTE e y para o SUL, em
 * células inteiras; a origem (0, 0) é a célula do canto noroeste do terreno. `position` é a célula de
 * menor x e menor y do retângulo ocupado JÁ ROTACIONADO. A rotação é em passos de 90° no sentido
 * horário, em torno do centro do retângulo; 90° e 270° trocam largura e profundidade.
 */

/** Por que uma posição ou construção foi recusada. O domínio devolve só o código (Arquitetura §14). */
export type PlacementErrorCode =
  'OUT_OF_BUILDABLE_AREA' | 'OVERLAPS_BUILDING' | 'OVERLAPS_OBSTACLE' | 'INSUFFICIENT_RESOURCES';

/** Onde se pode construir: a área construível e o que a ocupa sem ser um edifício (a nave). */
export interface PlacementTerrain {
  readonly buildableArea: GridRect;
  readonly obstacles: readonly GridRect[];
}

/** O que a regra lê de uma definição de edifício. */
export type ConstructionDefinition = Pick<BuildingDefinition, 'footprint' | 'cost'>;
export type ConstructionDefinitions = Readonly<Record<string, ConstructionDefinition>>;

/** O que a regra lê de um edifício já construído. */
export type PlacedBuilding = Pick<BuildingInstance, 'position' | 'rotation'> & {
  readonly definitionId: string;
};

export interface PlacementRequest {
  readonly definitionId: string;
  /** Célula de menor x e menor y do retângulo ocupado (já rotacionado). */
  readonly position: GridPosition;
  readonly rotation: Rotation;
}

function definitionOf(
  definitions: ConstructionDefinitions,
  definitionId: string,
): ConstructionDefinition {
  const definition = Object.hasOwn(definitions, definitionId)
    ? definitions[definitionId]
    : undefined;
  if (!definition) {
    throw new RangeError(`Definição de edifício desconhecida: "${definitionId}".`);
  }
  return definition;
}

/** Retângulo (já rotacionado) que a construção ocuparia. Lança `RangeError` se a definição não existir. */
export function placementRect(
  request: PlacementRequest,
  definitions: ConstructionDefinitions = BUILDING_DEFINITIONS,
): GridRect {
  const { footprint } = definitionOf(definitions, request.definitionId);
  return occupiedRect(request.position, footprint, request.rotation);
}

/**
 * Posição (célula de menor x e y) para que o retângulo ocupado fique CENTRADO na célula apontada.
 * Em extensões pares o centro cai na célula de menor índice entre as duas do meio. É assim que a
 * interface transforma "a célula sob o ponteiro" em `position`.
 */
export function positionForAnchorCell(
  cell: GridPosition,
  footprint: GridSize,
  rotation: Rotation,
): GridPosition {
  const size = rotatedSize(footprint, rotation);
  return { x: cell.x - Math.floor(size.width / 2), y: cell.y - Math.floor(size.depth / 2) };
}

/** Recursos que faltam para pagar o custo: `[recurso, quanto falta]`, na ordem de `RESOURCE_IDS`. */
export function missingForCost(
  resources: ResourceStock,
  cost: ResourceRates,
): readonly (readonly [ResourceId, number])[] {
  const missing: (readonly [ResourceId, number])[] = [];
  for (const id of RESOURCE_IDS) {
    const amount = Object.hasOwn(cost, id) ? cost[id] : undefined;
    if (amount !== undefined && resources[id] < amount) {
      missing.push([id, amount - resources[id]]);
    }
  }
  return missing;
}

/**
 * Valida só o ESPAÇO (sem olhar os recursos): dentro da área construível, sem sobrepor edifícios e
 * sem sobrepor obstáculos. Ordem das verificações (a primeira que falha decide o código): área,
 * edifícios, obstáculos. Devolve o retângulo ocupado quando é válido.
 */
export function evaluatePlacementSpace(
  buildings: readonly PlacedBuilding[],
  request: PlacementRequest,
  terrain: PlacementTerrain,
  definitions: ConstructionDefinitions = BUILDING_DEFINITIONS,
): Result<GridRect, Exclude<PlacementErrorCode, 'INSUFFICIENT_RESOURCES'>> {
  const rect = placementRect(request, definitions);

  if (!rectContainsRect(terrain.buildableArea, rect)) {
    return err('OUT_OF_BUILDABLE_AREA');
  }
  for (const building of buildings) {
    const existing = placementRect(building, definitions);
    if (rectsOverlap(rect, existing)) {
      return err('OVERLAPS_BUILDING');
    }
  }
  if (terrain.obstacles.some((obstacle) => rectsOverlap(rect, obstacle))) {
    return err('OVERLAPS_OBSTACLE');
  }
  return ok(rect);
}

/**
 * Valida a construção por inteiro: espaço (`evaluatePlacementSpace`) e, por último, os recursos.
 * Não altera nada. É a ÚNICA definição de construção válida: o comando a usa ao validar e ao
 * aplicar, e a prévia da interface a usa para mostrar o motivo.
 */
export function evaluatePlacement(
  state: { readonly buildings: readonly PlacedBuilding[]; readonly resources: ResourceStock },
  request: PlacementRequest,
  terrain: PlacementTerrain,
  definitions: ConstructionDefinitions = BUILDING_DEFINITIONS,
): Result<GridRect, PlacementErrorCode> {
  const space = evaluatePlacementSpace(state.buildings, request, terrain, definitions);
  if (!space.ok) {
    return space;
  }
  const { cost } = definitionOf(definitions, request.definitionId);
  if (missingForCost(state.resources, cost).length > 0) {
    return err('INSUFFICIENT_RESOURCES');
  }
  return space;
}
