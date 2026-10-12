import {
  BUILDING_DEFINITIONS,
  getBuildingDefinition,
  type BuildingDefinition,
  type BuildingDefinitionId,
} from '@/game/content/buildings';
import {
  RESOURCE_DEFINITIONS,
  RESOURCE_IDS,
  type ResourceId,
  type ResourceRates,
} from '@/game/content/resources';
import {
  evaluatePlacement,
  positionForAnchorCell,
  type PlacementErrorCode,
} from '@/game/domain/construction/placement';
import { INITIAL_PLACEMENT_TERRAIN } from '@/game/domain/construction/placementTerrain';
import type { GameState, ResourceStock } from '@/game/domain/state/GameState';
import { rotatedSize } from '@/shared/grid/gridMath';
import type { GridPosition, GridSize, Rotation } from '@/shared/grid/types';

/*
 * Consultas do modo de construção (docs/TECHNICAL_ARCHITECTURE.md §21). São puras e derivam tudo do
 * estado e do conteúdo: o catálogo, os custos e a prévia usam as MESMAS regras do comando
 * `PlaceBuilding` (`evaluatePlacement`), então a interface nunca decide sozinha o que é válido. A
 * interface só importa tipos de `game/domain` e `game/content`; por isso estas funções existem aqui.
 *
 * Devolvem objetos novos a cada chamada: use-as dentro de `useMemo` sobre as fatias de entrada.
 */

/** Uma linha de custo: quanto custa, quanto há e quanto falta (0 quando há o bastante). */
export interface CostLine {
  readonly id: ResourceId;
  readonly name: string;
  readonly amount: number;
  readonly available: number;
  readonly missing: number;
}

function costLines(resources: ResourceStock, cost: ResourceRates): readonly CostLine[] {
  const lines: CostLine[] = [];
  for (const id of RESOURCE_IDS) {
    const amount = Object.hasOwn(cost, id) ? cost[id] : undefined;
    if (amount !== undefined) {
      const available = resources[id];
      lines.push({
        id,
        name: RESOURCE_DEFINITIONS[id].name,
        amount,
        available,
        missing: Math.max(0, amount - available),
      });
    }
  }
  return lines;
}

export interface BuildCatalogEntry {
  readonly definitionId: BuildingDefinitionId;
  readonly name: string;
  readonly category: BuildingDefinition['category'];
  /** Extensão em células com rotação 0. */
  readonly footprint: GridSize;
  readonly cost: readonly CostLine[];
  /** `true` quando os recursos atuais cobrem o custo inteiro. */
  readonly affordable: boolean;
}

/** Edifícios que o jogador pode construir, na ordem do conteúdo, com o custo e a disponibilidade. */
export function selectBuildCatalog(resources: ResourceStock): readonly BuildCatalogEntry[] {
  return Object.values(BUILDING_DEFINITIONS).map((definition) => {
    const cost = costLines(resources, definition.cost);
    return {
      definitionId: definition.id,
      name: definition.name,
      category: definition.category,
      footprint: definition.footprint,
      cost,
      affordable: cost.every((line) => line.missing === 0),
    };
  });
}

/** O que a sessão de construção informa: qual edifício, a rotação e a célula apontada. */
export interface PlacementInput {
  readonly definitionId: BuildingDefinitionId | null;
  readonly rotation: Rotation;
  readonly cell: GridPosition | null;
}

export type PlacementStatus =
  | { readonly kind: 'no-position' }
  | { readonly kind: 'valid' }
  | { readonly kind: 'invalid'; readonly error: PlacementErrorCode };

/** Pedido de construção já resolvido (célula apontada convertida em `position`). */
export interface ResolvedPlacement {
  readonly definitionId: BuildingDefinitionId;
  readonly position: GridPosition;
  readonly rotation: Rotation;
}

export interface PlacementPreview {
  readonly definitionId: BuildingDefinitionId;
  readonly name: string;
  readonly rotation: Rotation;
  /** Extensão em células com rotação 0. */
  readonly footprint: GridSize;
  /** Extensão ocupada já considerando a rotação. */
  readonly occupied: GridSize;
  readonly cost: readonly CostLine[];
  /** O pedido a enviar ao controlador; `null` enquanto não há célula apontada. */
  readonly request: ResolvedPlacement | null;
  readonly status: PlacementStatus;
}

/**
 * Prévia da construção: o edifício, a posição resultante e se ela vale. É apenas uma consulta ao
 * estado: não altera o estado, não desconta recursos e não envia comando. `null` quando nenhum
 * edifício está em posicionamento.
 */
export function selectPlacementPreview(
  state: Pick<GameState, 'buildings' | 'resources'>,
  input: PlacementInput,
): PlacementPreview | null {
  if (input.definitionId === null) {
    return null;
  }
  const definition = getBuildingDefinition(input.definitionId);
  const base = {
    definitionId: input.definitionId,
    name: definition.name,
    rotation: input.rotation,
    footprint: definition.footprint,
    occupied: rotatedSize(definition.footprint, input.rotation),
    cost: costLines(state.resources, definition.cost),
  };

  if (input.cell === null) {
    return { ...base, request: null, status: { kind: 'no-position' } };
  }
  const request: ResolvedPlacement = {
    definitionId: input.definitionId,
    position: positionForAnchorCell(input.cell, definition.footprint, input.rotation),
    rotation: input.rotation,
  };
  const checked = evaluatePlacement(state, request, INITIAL_PLACEMENT_TERRAIN);
  return {
    ...base,
    request,
    status: checked.ok ? { kind: 'valid' } : { kind: 'invalid', error: checked.error },
  };
}
