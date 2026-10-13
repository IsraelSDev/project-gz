export const DEVELOPMENT_ERAS = [
  {
    id: 'survival',
    name: 'Sobrevivência',
    description: 'Consolidação dos recursos e da infraestrutura essencial.',
    requires: [] as readonly string[],
  },
  {
    id: 'foundation',
    name: 'Fundação',
    description: 'Infraestrutura e organização das primeiras cidades.',
    requires: ['protein-cultures'],
  },
  {
    id: 'industrial',
    name: 'Industrial',
    description: 'Produção especializada e expansão econômica.',
    requires: ['thermal-engineering', 'modular-construction'],
  },
  {
    id: 'scientific',
    name: 'Científica',
    description: 'Pesquisa avançada e administração coordenada.',
    requires: ['agricultural-restoration', 'materials-synthesis'],
  },
  {
    id: 'ascension',
    name: 'Ascensão',
    description: 'Tecnologias de escala planetária e defesa avançada.',
    requires: ['distributed-research', 'civic-logistics'],
  },
] as const;

export type EraId = (typeof DEVELOPMENT_ERAS)[number]['id'];

export function deriveCurrentEra(unlockedTechnologyIds: readonly string[]): EraId {
  let current: EraId = 'survival';
  for (const era of DEVELOPMENT_ERAS.slice(1)) {
    if (era.requires.every((id) => unlockedTechnologyIds.includes(id))) current = era.id;
    else break;
  }
  return current;
}

export function getEraIndex(eraId: EraId): number {
  return DEVELOPMENT_ERAS.findIndex((era) => era.id === eraId);
}
