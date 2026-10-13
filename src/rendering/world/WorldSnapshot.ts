import type { BuildingDefinitionId } from '@/game/content/buildings';
import type { GridPosition, GridRect, GridSize, Rotation } from '@/shared/grid/types';
import type { MilitaryUnitType } from '@/game/content/military';

/*
 * Contrato entre a aplicação e a renderização (docs/TECHNICAL_ARCHITECTURE.md §3.6 e §11).
 * `app/` monta este snapshot a partir do GameState e do cenário; `rendering/` só conhece estes
 * tipos, nunca o estado do jogo em tempo de execução. Tudo é em células do grid.
 */

/** Objeto posicionado no grid. `size` é o footprint com rotação 0. */
export interface PlacedSpec {
  readonly position: GridPosition;
  readonly size: GridSize;
  readonly rotation: Rotation;
}

export interface BuildingRenderSpec extends PlacedSpec {
  readonly instanceId: string;
  readonly definitionId: BuildingDefinitionId;
}

export interface MilitaryUnitRenderSpec extends PlacedSpec {
  readonly unitId: string;
  readonly type: MilitaryUnitType;
  readonly health: number;
  readonly supplied: boolean;
}

/**
 * Prévia de construção (Fase 6): o edifício que o jogador está posicionando, onde ficaria e se o
 * lugar vale. É só visual: vem pronta da aplicação (a regra de validade é do domínio) e nunca vira
 * estado do jogo.
 */
export interface PlacementPreviewSpec extends PlacedSpec {
  readonly definitionId: BuildingDefinitionId;
  readonly valid: boolean;
}

export interface TerrainSpec {
  readonly sizeCells: GridSize;
  readonly buildableArea: GridRect;
  /** Semente da variação visual (cenário e cores). Não é a semente do domínio. */
  readonly seed: number;
}

export interface WorldSnapshot {
  readonly terrain: TerrainSpec;
  readonly crashedShip: PlacedSpec;
  readonly buildings: readonly BuildingRenderSpec[];
  readonly units: readonly MilitaryUnitRenderSpec[];
}
