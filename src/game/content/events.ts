import type { ResourceRates } from '@/game/content/resources';
import type { IndependentCivilizationId } from './independentCivilizations';

/** Conteúdo narrativo da Fase 7. Textos do protótipo em pt-BR (D-60). */
export const EVENT_DEFINITIONS = {
  'wreck-signal': {
    id: 'wreck-signal',
    title: 'Um sinal entre os destroços',
    description:
      'Um pulso repetido emerge do transmissor da nave. A equipe acredita que uma resposta curta pode localizar a origem do sinal.',
    trigger: { kind: 'tick', minTick: 60 },
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
  'ruins-cache': {
    id: 'ruins-cache',
    title: 'Um arquivo sob as ruínas',
    description:
      'A expedição encontrou um compartimento que ainda contém dados e peças recuperáveis.',
    trigger: { kind: 'point-discovered', pointId: 'echo-ruins' } as EventDefinition['trigger'],
    options: [
      {
        id: 'decode-cache',
        label: 'Decodificar o arquivo',
        description: 'Gasta 3 de energia e recupera 12 de materiais.',
        cost: { energy: 3 },
        effects: { materials: 12 },
        consequence: 'O arquivo revela técnicas de fabricação: +12 materiais, −3 energia.',
      },
      {
        id: 'salvage-cache',
        label: 'Recuperar as peças',
        description: 'Gasta 2 de energia e recupera 8 de água.',
        cost: { energy: 2 },
        effects: { water: 8 },
        consequence: 'Peças intactas incluem recipientes de água: +8 água, −2 energia.',
      },
    ],
  },
  'signal-selari-commons': firstContactEvent(
    'signal-selari-commons',
    'Comunidade Selari',
    'Um padrão de luz se repete perto da Nascente Cristalina. A comunidade que o emite parece aguardar uma resposta.',
    'selari-commons',
  ),
  'signal-oruun-clans': firstContactEvent(
    'signal-oruun-clans',
    'Clãs Oruun',
    'As ruínas respondem com um pulso grave. Há alguém do outro lado, observando a expedição.',
    'oruun-clans',
  ),
  'signal-ithari-gardeners': firstContactEvent(
    'signal-ithari-gardeners',
    'Jardineiros Ithari',
    'As luzes do bosque se alinham em uma saudação. Uma sociedade local percebeu a presença da colônia.',
    'ithari-gardeners',
  ),
} as const satisfies Readonly<Record<string, EventDefinition>>;

function firstContactEvent(
  id: string,
  name: string,
  description: string,
  civilizationId: IndependentCivilizationId,
): EventDefinition {
  return {
    id,
    title: `Sinal de ${name}`,
    description,
    trigger: { kind: 'civilization-discovered', civilizationId },
    options: [
      {
        id: 'send-greeting',
        label: 'Responder com uma saudação',
        description: 'O líder da colônia abre um canal diplomático em tom cordial.',
        cost: {},
        effects: {},
        consequence:
          'O contato foi estabelecido; a reação inicial foi registrada no histórico diplomático.',
        diplomacyEffect: { civilizationId, stance: 'warm' },
      },
      {
        id: 'send-warning',
        label: 'Responder com hostilidade',
        description: 'A colônia estabelece contato, mas deixa claros seus limites.',
        cost: {},
        effects: {},
        consequence: 'O contato foi estabelecido em estado hostil. Nenhum combate é iniciado.',
        diplomacyEffect: { civilizationId, stance: 'guarded' },
      },
      {
        id: 'defer-contact',
        label: 'Manter o silêncio',
        description: 'A equipe arquiva o sinal; ainda será possível iniciar contato depois.',
        cost: {},
        effects: {},
        consequence:
          'O sinal foi arquivado. A civilização continua disponível para contato no painel diplomático.',
      },
    ],
  };
}

export interface EventOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly cost: ResourceRates;
  readonly effects: ResourceRates;
  readonly consequence: string;
  readonly diplomacyEffect?: {
    readonly civilizationId: IndependentCivilizationId;
    readonly stance: 'warm' | 'guarded';
  };
}

export interface EventDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly trigger:
    | { readonly kind: 'tick'; readonly minTick: number }
    | { readonly kind: 'point-discovered'; readonly pointId: string }
    | {
        readonly kind: 'civilization-discovered';
        readonly civilizationId: IndependentCivilizationId;
      };
  readonly options: readonly EventOption[];
}

export type EventId = keyof typeof EVENT_DEFINITIONS;

export function isEventId(value: unknown): value is EventId {
  return typeof value === 'string' && Object.hasOwn(EVENT_DEFINITIONS, value);
}

export function getEventDefinition(id: EventId): EventDefinition {
  return EVENT_DEFINITIONS[id];
}
