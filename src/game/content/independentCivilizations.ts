export const INDEPENDENT_CIVILIZATIONS = {
  'selari-commons': {
    id: 'selari-commons',
    name: 'Comunidade Selari',
    species: 'Selari',
    identity: 'Pequenos alienígenas azul-petróleo, de corpo arredondado e antenas em leque.',
    culture: 'Valorizam conhecimento compartilhado, jardins luminosos e decisões em assembleia.',
    government: 'Assembleia de círculos',
    development: 'estabelecida',
    discoveryPointId: 'crystal-spring',
    warmGreetingChange: 8,
    informationChange: 5,
    giftChange: 14,
    pactAcceptanceThreshold: 20,
  },
  'oruun-clans': {
    id: 'oruun-clans',
    name: 'Clãs Oruun',
    species: 'Oruun',
    identity: 'Criaturas baixas cor de cobre, com placas macias e olhos grandes.',
    culture: 'São cautelosos com desconhecidos e respeitam promessas mantidas.',
    government: 'Conselho de anciãos',
    development: 'avançada',
    discoveryPointId: 'echo-ruins',
    warmGreetingChange: 2,
    informationChange: 8,
    giftChange: 16,
    pactAcceptanceThreshold: 24,
  },
  'ithari-gardeners': {
    id: 'ithari-gardeners',
    name: 'Jardineiros Ithari',
    species: 'Ithari',
    identity: 'Aliens verde-limão, gordinhos, com quatro braços curtos e cristas folhosas.',
    culture: 'Cultivam ecossistemas em miniatura e tratam hospitalidade como compromisso.',
    government: 'Pacto das estufas',
    development: 'emergente',
    discoveryPointId: 'luminous-grove',
    warmGreetingChange: 6,
    informationChange: 6,
    giftChange: 10,
    pactAcceptanceThreshold: 18,
  },
} as const;

export type IndependentCivilizationId = keyof typeof INDEPENDENT_CIVILIZATIONS;
export type IndependentCivilization = (typeof INDEPENDENT_CIVILIZATIONS)[IndependentCivilizationId];

export function isIndependentCivilizationId(value: unknown): value is IndependentCivilizationId {
  return typeof value === 'string' && Object.hasOwn(INDEPENDENT_CIVILIZATIONS, value);
}

export function civilizationForDiscoveryPoint(
  pointId: string,
): IndependentCivilization | undefined {
  return Object.values(INDEPENDENT_CIVILIZATIONS).find(
    (civilization) => civilization.discoveryPointId === pointId,
  );
}
