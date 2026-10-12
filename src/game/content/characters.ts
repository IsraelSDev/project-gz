export type CharacterSkill = 'leadership' | 'science' | 'engineering' | 'production';
export type CharacterTrait = 'calm' | 'curious' | 'bold' | 'patient' | 'kind';
export type CharacterLifeStage = 'young' | 'adult' | 'elder';
export type GovernmentOffice = 'science' | 'engineering' | 'production';

export interface Character {
  readonly characterId: string;
  readonly name: string;
  readonly species: string;
  readonly lifeStage: CharacterLifeStage;
  readonly skills: Readonly<Record<CharacterSkill, number>>;
  readonly traits: readonly CharacterTrait[];
  readonly alive: boolean;
  readonly available: boolean;
}

export interface CharacterRelationship {
  readonly fromId: string;
  readonly toId: string;
  readonly affinity: number;
  readonly trust: number;
  readonly rivalry: number;
}

export interface Government {
  readonly leaderId: string | null;
  readonly offices: Readonly<Record<GovernmentOffice, string | null>>;
}

/** Elenco pequeno de indivíduos importantes; habitantes comuns continuam agregados. */
export const INITIAL_CHARACTERS: readonly Character[] = [
  {
    characterId: 'colonist-aru',
    name: 'Aru Nuvem',
    species: 'Nuvori',
    lifeStage: 'adult',
    skills: { leadership: 4, science: 2, engineering: 2, production: 2 },
    traits: ['calm', 'curious'],
    alive: true,
    available: true,
  },
  {
    characterId: 'colonist-veli',
    name: 'Veli Faísca',
    species: 'Nuvori',
    lifeStage: 'adult',
    skills: { leadership: 1, science: 4, engineering: 2, production: 1 },
    traits: ['curious', 'bold'],
    alive: true,
    available: true,
  },
  {
    characterId: 'colonist-koro',
    name: 'Koro Brasa',
    species: 'Nuvori',
    lifeStage: 'adult',
    skills: { leadership: 2, science: 1, engineering: 4, production: 2 },
    traits: ['patient', 'bold'],
    alive: true,
    available: true,
  },
  {
    characterId: 'colonist-miri',
    name: 'Miri Pétala',
    species: 'Nuvori',
    lifeStage: 'adult',
    skills: { leadership: 1, science: 2, engineering: 1, production: 4 },
    traits: ['kind', 'patient'],
    alive: true,
    available: true,
  },
];

export const INITIAL_GOVERNMENT: Government = {
  leaderId: 'colonist-aru',
  offices: { science: 'colonist-veli', engineering: 'colonist-koro', production: 'colonist-miri' },
};

export const INITIAL_RELATIONSHIPS = [
  { fromId: 'colonist-veli', toId: 'colonist-koro', affinity: 1, trust: 2, rivalry: 0 },
] as const;
