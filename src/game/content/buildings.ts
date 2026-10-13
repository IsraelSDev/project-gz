import type { GridSize } from '@/shared/grid/types';
import type { ResourceRates } from './resources';
import type { TechnologyId } from './technologies';

/*
 * Definições estáticas de edifícios (docs/TECHNICAL_ARCHITECTURE.md §8).
 * Campos: identificação e footprint (Fase 2), produção e consumo (Fase 5) e custo de construção
 * (Fase 6). Os "requisitos" do contrato da Arquitetura §8 se resumem, no MVP, a posição válida e
 * recursos suficientes (regras de `game/domain/construction`); não há requisitos de tecnologia nem de
 * outros edifícios porque nada os usa ainda.
 */
export interface BuildingDefinition {
  readonly id: string;
  readonly name: string;
  readonly category:
    | 'shelter'
    | 'infrastructure'
    | 'food'
    | 'water'
    | 'energy'
    | 'industry'
    | 'research'
    | 'military';
  readonly requiredTechnologyId?: TechnologyId;
  /** Capacidade agregada de sobreviventes, apenas para estruturas habitacionais. */
  readonly housingCapacity?: number;
  /** Extensão em células com rotação 0 (width: eixo x, depth: eixo y do grid). */
  readonly footprint: GridSize;
  /**
   * Recursos gastos UMA vez, ao construir. Só é descontado quando a construção é válida e confirmada
   * (Arquitetura §20 e §21). Inteiros positivos; vazio significa que construir não custa nada.
   */
  readonly cost: ResourceRates;
  /**
   * Recursos que o edifício PRODUZ a cada tick em que opera. Vazio quando não produz nada.
   * Todas as taxas são inteiros positivos por tick (1 tick = 1 s de tempo de jogo).
   */
  readonly production: ResourceRates;
  /**
   * Recursos que o edifício CONSOME a cada tick em que opera (os insumos). Um edifício só opera em
   * um passo se o estoque cobrir TODO o seu consumo; do contrário fica parado e não produz nem
   * consome (regra de falta: Arquitetura §20.2). Vazio quando não consome nada.
   */
  readonly consumption: ResourceRates;
}

/*
 * Custos e taxas do protótipo (D-48, D-55, D-XX). O balanceamento inicial da Fase 9 é descrito na
 * documentação; população e abrigo continuam agregados.
 */
export const BUILDING_DEFINITIONS = {
  'habitat-module': {
    id: 'habitat-module',
    name: 'Módulo Habitacional',
    category: 'shelter',
    housingCapacity: 8,
    footprint: { width: 3, depth: 3 },
    cost: { materials: 80 },
    production: {},
    consumption: { energy: 2 },
  },
  'water-extractor': {
    id: 'water-extractor',
    name: 'Extrator de Água',
    category: 'water',
    footprint: { width: 2, depth: 2 },
    cost: { materials: 40 },
    production: { water: 4 },
    consumption: { energy: 3 },
  },
  'solar-array': {
    id: 'solar-array',
    name: 'Matriz Solar',
    category: 'energy',
    footprint: { width: 3, depth: 2 },
    cost: { materials: 30 },
    production: { energy: 6 },
    consumption: {},
  },
  'hydroponic-farm': {
    id: 'hydroponic-farm',
    name: 'Estufa Hidropônica',
    category: 'food',
    footprint: { width: 3, depth: 2 },
    cost: { materials: 40, water: 30 },
    production: { food: 4 },
    consumption: { water: 2, energy: 2 },
  },
  'materials-recycler': {
    id: 'materials-recycler',
    name: 'Reciclador de Materiais',
    category: 'industry',
    footprint: { width: 2, depth: 2 },
    cost: { materials: 50 },
    production: { materials: 3 },
    consumption: { energy: 3 },
  },
  'field-laboratory': {
    id: 'field-laboratory',
    name: 'Laboratório de Campo',
    category: 'research',
    footprint: { width: 2, depth: 2 },
    cost: { materials: 45 },
    production: {},
    consumption: { energy: 1 },
  },
  'protein-cultivator': {
    id: 'protein-cultivator',
    name: 'Cultivador de Proteínas',
    category: 'food',
    requiredTechnologyId: 'protein-cultures',
    footprint: { width: 3, depth: 2 },
    cost: { materials: 55, water: 20 },
    production: { food: 7 },
    consumption: { water: 2, energy: 3 },
  },
  'thermal-generator': {
    id: 'thermal-generator',
    name: 'Gerador Geotérmico',
    category: 'energy',
    requiredTechnologyId: 'thermal-engineering',
    footprint: { width: 2, depth: 2 },
    cost: { materials: 70 },
    production: { energy: 10 },
    consumption: {},
  },
  'guard-post': {
    id: 'guard-post',
    name: 'Posto de Defesa',
    category: 'military',
    footprint: { width: 3, depth: 2 },
    cost: { materials: 65 },
    production: {},
    consumption: { energy: 1 },
  },
} as const satisfies Readonly<Record<string, BuildingDefinition>>;

export type BuildingDefinitionId = keyof typeof BUILDING_DEFINITIONS;

export function isBuildingDefinitionId(value: string): value is BuildingDefinitionId {
  return Object.hasOwn(BUILDING_DEFINITIONS, value);
}

export function getBuildingDefinition(id: BuildingDefinitionId): BuildingDefinition {
  return BUILDING_DEFINITIONS[id];
}
