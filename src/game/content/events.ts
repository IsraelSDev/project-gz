import type { ResourceRates } from '@/game/content/resources';

/** Conteúdo narrativo da Fase 7. Textos do protótipo em pt-BR (D-60). */
export const EVENT_DEFINITIONS = {
  'wreck-signal': {
    id: 'wreck-signal',
    title: 'Um sinal entre os destroços',
    description:
      'Um pulso repetido emerge do transmissor da nave. A equipe acredita que uma resposta curta pode localizar a origem do sinal.',
    trigger: { minTick: 60 },
    options: [
      {
        id: 'answer-signal',
        label: 'Responder ao sinal',
        description: 'Gasta 4 de energia e recupera 8 de materiais do transmissor.',
        cost: { energy: 4 },
        effects: { materials: 8 },
        consequence: 'A resposta localiza uma liga útil nos destroços: +8 materiais, −4 energia.',
      },
      {
        id: 'salvage-transmitter',
        label: 'Desmontar o transmissor',
        description: 'Gasta 2 materiais para recuperar 6 de energia da bateria auxiliar.',
        cost: { materials: 2 },
        effects: { energy: 6 },
        consequence: 'A bateria auxiliar ainda funciona: +6 energia, −2 materiais.',
      },
    ],
  },
} as const satisfies Readonly<Record<string, EventDefinition>>;

export interface EventOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly cost: ResourceRates;
  readonly effects: ResourceRates;
  readonly consequence: string;
}

export interface EventDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly trigger: { readonly minTick: number };
  readonly options: readonly EventOption[];
}

export type EventId = keyof typeof EVENT_DEFINITIONS;

export function isEventId(value: unknown): value is EventId {
  return typeof value === 'string' && Object.hasOwn(EVENT_DEFINITIONS, value);
}

export function getEventDefinition(id: EventId): EventDefinition {
  return EVENT_DEFINITIONS[id];
}
