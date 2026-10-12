import type { ResourceRates } from './resources';

export const TECHNOLOGY_DEFINITIONS: Readonly<Record<string, TechnologyDefinition>> = {
  'protein-cultures': {
    id: 'protein-cultures',
    name: 'Culturas Proteicas',
    description: 'Cultivos resistentes ampliam a produção de alimento.',
    cost: { materials: 20, energy: 10 },
    researchPoints: 60,
    prerequisites: [],
  },
  'thermal-engineering': {
    id: 'thermal-engineering',
    name: 'Engenharia Térmica',
    description: 'Aproveitamento estável do calor subterrâneo.',
    cost: { materials: 30, energy: 20 },
    researchPoints: 100,
    prerequisites: ['protein-cultures'],
  },
};

export interface TechnologyDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cost: ResourceRates;
  readonly researchPoints: number;
  readonly prerequisites: readonly string[];
}
export type TechnologyId = 'protein-cultures' | 'thermal-engineering';
export function isTechnologyId(value: unknown): value is TechnologyId {
  return typeof value === 'string' && Object.hasOwn(TECHNOLOGY_DEFINITIONS, value);
}
