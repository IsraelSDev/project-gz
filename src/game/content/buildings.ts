import type { GridSize } from '@/shared/grid/types';

/*
 * Definições estáticas de edifícios (docs/TECHNICAL_ARCHITECTURE.md §8).
 * Na Fase 2 existem só os campos necessários para posicionar e identificar os edifícios; custo,
 * produção, consumo e requisitos entram nas Fases 5 e 6.
 */
export interface BuildingDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: 'shelter' | 'infrastructure';
  /** Extensão em células com rotação 0 (width: eixo x, depth: eixo y do grid). */
  readonly footprint: GridSize;
}

export const BUILDING_DEFINITIONS = {
  'habitat-module': {
    id: 'habitat-module',
    name: 'Módulo Habitacional',
    category: 'shelter',
    footprint: { width: 3, depth: 3 },
  },
  'water-extractor': {
    id: 'water-extractor',
    name: 'Extrator de Água',
    category: 'infrastructure',
    footprint: { width: 2, depth: 2 },
  },
  'solar-array': {
    id: 'solar-array',
    name: 'Matriz Solar',
    category: 'infrastructure',
    footprint: { width: 3, depth: 2 },
  },
} as const satisfies Record<string, BuildingDefinition>;

export type BuildingDefinitionId = keyof typeof BUILDING_DEFINITIONS;

export function isBuildingDefinitionId(value: string): value is BuildingDefinitionId {
  return Object.hasOwn(BUILDING_DEFINITIONS, value);
}

export function getBuildingDefinition(id: BuildingDefinitionId): BuildingDefinition {
  return BUILDING_DEFINITIONS[id];
}
