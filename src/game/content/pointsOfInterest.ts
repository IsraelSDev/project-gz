import type { ResourceRates } from './resources';
import type { TechnologyId } from './technologies';

export const POINTS_OF_INTEREST: Readonly<Record<string, PointOfInterest>> = {
  'crystal-spring': {
    id: 'crystal-spring',
    name: 'Nascente Cristalina',
    description: 'Veios minerais filtram água sob a crosta.',
    surveyCost: { energy: 5 },
    reward: { water: 18, materials: 6 },
  },
  'echo-ruins': {
    id: 'echo-ruins',
    name: 'Ruínas de Eco',
    description: 'Estruturas antigas respondem ao sinal da nave.',
    surveyCost: { energy: 8 },
    reward: { materials: 10 },
    requiredTechnologyId: 'protein-cultures',
  },
  'luminous-grove': {
    id: 'luminous-grove',
    name: 'Bosque Luminescente',
    description:
      'Um jardim de fungos brilhantes cresce em padrões que parecem responder a visitantes.',
    surveyCost: { energy: 10 },
    reward: { food: 12 },
  },
};

export interface PointOfInterest {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly surveyCost: ResourceRates;
  readonly reward: ResourceRates;
  readonly requiredTechnologyId?: TechnologyId;
}
export type PointOfInterestId = 'crystal-spring' | 'echo-ruins' | 'luminous-grove';
