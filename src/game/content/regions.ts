import type { ResourceRates } from './resources';
import type { PointOfInterestId } from './pointsOfInterest';
import type { IndependentCivilizationId } from './independentCivilizations';

export const REGION_IDS = ['crash-site', 'crystal-spring', 'echo-ruins', 'luminous-grove'] as const;
export type RegionId = (typeof REGION_IDS)[number];

export interface RegionDefinition {
  readonly id: RegionId;
  readonly name: string;
  readonly environment: string;
  readonly opportunities: ResourceRates;
  readonly discoveryPointId?: PointOfInterestId;
  readonly civilizationId?: IndependentCivilizationId;
}

export const REGION_DEFINITIONS: Readonly<Record<RegionId, RegionDefinition>> = {
  'crash-site': {
    id: 'crash-site',
    name: 'Local da Queda',
    environment: 'Planície rochosa protegida pelos destroços da nave.',
    opportunities: {},
  },
  'crystal-spring': {
    id: 'crystal-spring',
    name: 'Nascente Cristalina',
    environment: 'Terreno úmido com veios minerais sob a crosta.',
    opportunities: { water: 4, materials: 2 },
    discoveryPointId: 'crystal-spring',
    civilizationId: 'selari-commons',
  },
  'echo-ruins': {
    id: 'echo-ruins',
    name: 'Ruínas de Eco',
    environment: 'Platô antigo, seco e rico em estruturas reaproveitáveis.',
    opportunities: { materials: 4, energy: 1 },
    discoveryPointId: 'echo-ruins',
    civilizationId: 'oruun-clans',
  },
  'luminous-grove': {
    id: 'luminous-grove',
    name: 'Bosque Luminescente',
    environment: 'Bosque de fungos luminosos e solo fértil.',
    opportunities: { food: 4, water: 1 },
    discoveryPointId: 'luminous-grove',
    civilizationId: 'ithari-gardeners',
  },
};

/** Custo do módulo urbano e do suprimento inicial enviado a partir do capital. */
export const SETTLEMENT_FOUNDING_COST: ResourceRates = {
  food: 30,
  water: 60,
  materials: 220,
  energy: 10,
};

export const SETTLEMENT_STARTER_BUILDINGS = [
  { definitionId: 'habitat-module', x: 0, y: 0 },
  { definitionId: 'solar-array', x: 4, y: 0 },
  { definitionId: 'solar-array', x: 8, y: 0 },
  { definitionId: 'water-extractor', x: 0, y: 4 },
  { definitionId: 'hydroponic-farm', x: 3, y: 4 },
] as const;

export const SETTLEMENT_STARTING_RESOURCES = {
  food: 30,
  water: 30,
  materials: 0,
  energy: 10,
} as const;
