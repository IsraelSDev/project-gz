import type { GridPosition, GridRect, GridSize, Rotation } from '@/shared/grid/types';
import type { BuildingDefinitionId } from './buildings';
import type { ResourceId } from './resources';

/*
 * Cenário inicial da partida: dados estáticos, separados do estado mutável (arquitetura §3.5).
 * Todas as posições e extensões são em células do grid (x: leste, y: sul).
 */
export interface InitialBuildingPlacement {
  /** Identificador estável da instância (nunca derivado de nome de mesh). */
  readonly instanceId: string;
  readonly definitionId: BuildingDefinitionId;
  readonly position: GridPosition;
  readonly rotation: Rotation;
}

export interface ScenarioDefinition {
  readonly id: string;
  readonly contentVersion: string;
  readonly terrain: {
    readonly sizeCells: GridSize;
    /** Área plana onde será permitido construir. */
    readonly buildableArea: GridRect;
    /** Semente da variação visual do terreno e do cenário (não é a semente do domínio). */
    readonly seed: number;
  };
  /**
   * A nave acidentada é um elemento de cenário (landmark) e não uma instância do estado: na Fase 2
   * ela é imutável. Quando houver reparo ou recuperação de componentes, ela passa para o estado.
   */
  readonly crashedShip: {
    readonly position: GridPosition;
    readonly size: GridSize;
    readonly rotation: Rotation;
  };
  /**
   * Estoques iniciais, em inteiros na unidade exibida (D-47). Valores provisórios, sem balanceamento
   * final (P-21). As taxas de produção e consumo ficam nas definições dos edifícios.
   */
  readonly initialResources: Readonly<Record<ResourceId, number>>;
  readonly initialBuildings: readonly InitialBuildingPlacement[];
}

export const INITIAL_SCENARIO = {
  id: 'crash-site',
  // 0.6.0: elenco importante e cargos administrativos (Fase 10).
  contentVersion: '0.6.0',
  terrain: {
    sizeCells: { width: 40, depth: 40 },
    buildableArea: { x: 12, y: 12, width: 16, depth: 16 },
    seed: 7241,
  },
  crashedShip: {
    position: { x: 14, y: 13 },
    size: { width: 8, depth: 5 },
    rotation: 0,
  },
  initialResources: {
    food: 300,
    water: 300,
    materials: 150,
    energy: 100,
  },
  initialBuildings: [
    {
      instanceId: 'building-habitat-01',
      definitionId: 'habitat-module',
      position: { x: 14, y: 20 },
      rotation: 0,
    },
    {
      instanceId: 'building-extractor-01',
      definitionId: 'water-extractor',
      position: { x: 21, y: 20 },
      rotation: 0,
    },
    {
      // footprint 3x2 girado 90°: ocupa 2 células em x e 3 em y a partir de (23, 23).
      instanceId: 'building-solar-01',
      definitionId: 'solar-array',
      position: { x: 23, y: 23 },
      rotation: 90,
    },
  ],
} as const satisfies ScenarioDefinition;
