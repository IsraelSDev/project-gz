import type { ResourceRates } from './resources';
import type { EraId } from './developmentEras';

export type TechnologyCategory =
  'agriculture' | 'energy' | 'engineering' | 'science' | 'society' | 'military';

export const TECHNOLOGY_CATEGORY_LABELS: Readonly<Record<TechnologyCategory, string>> = {
  agriculture: 'Agricultura e alimentação',
  energy: 'Energia',
  engineering: 'Engenharia e construção',
  science: 'Ciência e exploração',
  society: 'Sociedade e administração',
  military: 'Defesa',
};

export type TechnologyEffect =
  | {
      readonly kind: 'production';
      readonly buildingIds: readonly string[];
      readonly resource: string;
      readonly amount: number;
    }
  | { readonly kind: 'construction-discount'; readonly percent: number }
  | { readonly kind: 'research-per-extra-lab'; readonly amount: number }
  | { readonly kind: 'governor-materials'; readonly amount: number }
  | { readonly kind: 'defense-per-post'; readonly amount: number };

export interface TechnologyDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly era: EraId;
  readonly category: TechnologyCategory;
  readonly cost: ResourceRates;
  readonly researchPoints: number;
  readonly prerequisites: readonly string[];
  readonly effect: TechnologyEffect;
  readonly effectDescription: string;
}

export const TECHNOLOGY_DEFINITIONS = {
  'protein-cultures': {
    id: 'protein-cultures',
    name: 'Culturas Proteicas',
    description: 'Cultivos resistentes ampliam a produção de alimento.',
    era: 'survival',
    category: 'agriculture',
    cost: { materials: 20, energy: 10 },
    researchPoints: 60,
    prerequisites: [],
    effect: {
      kind: 'production',
      buildingIds: ['protein-cultivator'],
      resource: 'food',
      amount: 2,
    },
    effectDescription: '+2 alimentos por tick em cada Cultivador de Proteínas.',
  },
  'thermal-engineering': {
    id: 'thermal-engineering',
    name: 'Engenharia Térmica',
    description: 'Aproveitamento estável do calor subterrâneo.',
    era: 'foundation',
    category: 'energy',
    cost: { materials: 30, energy: 20 },
    researchPoints: 100,
    prerequisites: ['protein-cultures'],
    effect: {
      kind: 'production',
      buildingIds: ['thermal-generator'],
      resource: 'energy',
      amount: 2,
    },
    effectDescription:
      'Desbloqueia o Gerador Geotérmico e acrescenta +2 energia por tick em cada gerador.',
  },
  'modular-construction': {
    id: 'modular-construction',
    name: 'Construção Modular',
    description: 'Componentes padronizados reduzem o consumo de materiais nas obras.',
    era: 'foundation',
    category: 'engineering',
    cost: { materials: 35, energy: 15 },
    researchPoints: 90,
    prerequisites: ['protein-cultures'],
    effect: { kind: 'construction-discount', percent: 10 },
    effectDescription: 'Reduz em 10% (arredondado para cima) o custo de materiais de construções.',
  },
  'agricultural-restoration': {
    id: 'agricultural-restoration',
    name: 'Restauração Agrícola',
    description: 'Microrganismos locais tornam as estufas mais produtivas.',
    era: 'industrial',
    category: 'agriculture',
    cost: { materials: 50, energy: 25 },
    researchPoints: 140,
    prerequisites: ['thermal-engineering'],
    effect: {
      kind: 'production',
      buildingIds: ['hydroponic-farm', 'protein-cultivator'],
      resource: 'food',
      amount: 2,
    },
    effectDescription: '+2 alimentos por tick em cada estufa e cultivador de proteínas.',
  },
  'materials-synthesis': {
    id: 'materials-synthesis',
    name: 'Síntese de Materiais',
    description: 'Processos de reciclagem recuperam matéria-prima com maior eficiência.',
    era: 'industrial',
    category: 'engineering',
    cost: { materials: 55, energy: 30 },
    researchPoints: 150,
    prerequisites: ['thermal-engineering', 'modular-construction'],
    effect: {
      kind: 'production',
      buildingIds: ['materials-recycler'],
      resource: 'materials',
      amount: 2,
    },
    effectDescription: '+2 materiais por tick em cada Reciclador de Materiais.',
  },
  'distributed-research': {
    id: 'distributed-research',
    name: 'Redes de Pesquisa',
    description: 'Laboratórios de diferentes assentamentos compartilham descobertas.',
    era: 'scientific',
    category: 'science',
    cost: { materials: 70, energy: 45 },
    researchPoints: 180,
    prerequisites: ['agricultural-restoration', 'materials-synthesis'],
    effect: { kind: 'research-per-extra-lab', amount: 1 },
    effectDescription:
      '+1 ponto de pesquisa por tick para cada laboratório além do primeiro, em qualquer assentamento.',
  },
  'civic-logistics': {
    id: 'civic-logistics',
    name: 'Logística Cívica',
    description: 'Administradores coordenam melhor a distribuição de recursos.',
    era: 'scientific',
    category: 'society',
    cost: { materials: 65, energy: 40 },
    researchPoints: 170,
    prerequisites: ['agricultural-restoration', 'materials-synthesis'],
    effect: { kind: 'governor-materials', amount: 1 },
    effectDescription:
      'Administradores qualificados geram +1 material por assentamento a cada 10 ticks.',
  },
  'planetary-grid': {
    id: 'planetary-grid',
    name: 'Rede Planetária',
    description: 'Uma malha unificada aproveita melhor as fontes de energia.',
    era: 'ascension',
    category: 'energy',
    cost: { materials: 100, energy: 60 },
    researchPoints: 240,
    prerequisites: ['distributed-research', 'civic-logistics'],
    effect: {
      kind: 'production',
      buildingIds: ['solar-array', 'thermal-generator'],
      resource: 'energy',
      amount: 2,
    },
    effectDescription: '+2 energia por tick em cada Matriz Solar e Gerador Geotérmico.',
  },
  'defensive-coordination': {
    id: 'defensive-coordination',
    name: 'Coordenação Defensiva',
    description: 'Sensores conectados reforçam as defesas dos postos planetários.',
    era: 'ascension',
    category: 'military',
    cost: { materials: 90, energy: 70 },
    researchPoints: 230,
    prerequisites: ['distributed-research', 'civic-logistics'],
    effect: { kind: 'defense-per-post', amount: 1 },
    effectDescription: '+1 defesa por Posto de Defesa durante confrontos.',
  },
} as const satisfies Readonly<Record<string, TechnologyDefinition>>;

export type TechnologyId = keyof typeof TECHNOLOGY_DEFINITIONS;
export function isTechnologyId(value: unknown): value is TechnologyId {
  return typeof value === 'string' && Object.hasOwn(TECHNOLOGY_DEFINITIONS, value);
}
