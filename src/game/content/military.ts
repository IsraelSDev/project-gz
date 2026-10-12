export type MilitaryUnitType = 'scout' | 'guardian' | 'striker';

/** Perfis estáticos das tropas (custos, manutenção e atributos de combate). */
export const UNIT_DEFINITIONS: Readonly<
  Record<
    MilitaryUnitType,
    {
      name: string;
      cost: number;
      upkeep: number;
      attack: number;
      defense: number;
      health: number;
    }
  >
> = {
  scout: { name: 'Batedor', cost: 18, upkeep: 1, attack: 3, defense: 1, health: 5 },
  guardian: { name: 'Guardião', cost: 30, upkeep: 2, attack: 3, defense: 4, health: 9 },
  striker: { name: 'Atacante', cost: 26, upkeep: 2, attack: 6, defense: 1, health: 6 },
};
