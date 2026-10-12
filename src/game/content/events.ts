import type { ResourceId } from './resources';

export interface FixedResourceEffect {
  readonly kind: 'resource';
  readonly resourceId: ResourceId;
  readonly amount: number;
}

export interface RandomResourceEffect {
  readonly kind: 'random-resource';
  readonly resourceId: ResourceId;
  readonly min: number;
  readonly max: number;
}

export type GameEventEffect = FixedResourceEffect | RandomResourceEffect;

export interface GameEventChoice {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly effects: readonly GameEventEffect[];
}

export interface GameEventDefinition {
  readonly id: string;
  readonly triggerTick: number;
  readonly title: string;
  readonly description: string;
  readonly choices: readonly GameEventChoice[];
}

export const GAME_EVENT_DEFINITIONS = [
  {
    id: 'sealed-survival-pod',
    triggerTick: 60,
    title: 'Uma cápsula entre os destroços',
    description:
      'Os sensores localizaram uma cápsula de sobrevivência parcialmente soterrada. O selo ainda responde, mas a estrutura está instável.',
    choices: [
      {
        id: 'open-pod',
        label: 'Abrir a cápsula',
        description: 'Recuperar entre 20 e 35 unidades de alimentos intactos.',
        effects: [{ kind: 'random-resource', resourceId: 'food', min: 20, max: 35 }],
      },
      {
        id: 'salvage-parts',
        label: 'Desmontar os módulos',
        description: 'Recuperar entre 10 e 20 materiais e 5 unidades de energia.',
        effects: [
          { kind: 'random-resource', resourceId: 'materials', min: 10, max: 20 },
          { kind: 'resource', resourceId: 'energy', amount: 5 },
        ],
      },
    ],
  },
] as const satisfies readonly GameEventDefinition[];

export type GameEventId = (typeof GAME_EVENT_DEFINITIONS)[number]['id'];

export function isGameEventId(value: unknown): value is GameEventId {
  return (
    typeof value === 'string' &&
    GAME_EVENT_DEFINITIONS.some((definition) => definition.id === value)
  );
}
