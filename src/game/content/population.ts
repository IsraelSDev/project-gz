/** Valores agregados do protótipo de sobrevivência; um tick equivale a um segundo de jogo. */
export const POPULATION_RULES = {
  initialSurvivors: 8,
  survivorsPerFoodUnit: 4,
  survivorsPerWaterUnit: 4,
  shortageTicksBeforeLoss: 60,
  stableTicksForVictory: 900,
  minimumSurvivorsForVictory: 6,
} as const;

export function calculateNeeds(survivors: number): {
  readonly food: number;
  readonly water: number;
} {
  return {
    food: Math.ceil(survivors / POPULATION_RULES.survivorsPerFoodUnit),
    water: Math.ceil(survivors / POPULATION_RULES.survivorsPerWaterUnit),
  };
}
