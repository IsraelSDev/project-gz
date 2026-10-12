import { calculateNeeds, POPULATION_RULES } from '@/game/content/population';
import type { GameSnapshot } from './GameController';
import { calculateHousingCapacity } from '@/game/domain/population/housingCapacity';

export interface PopulationSummary {
  readonly survivors: number;
  readonly capacity: number;
  readonly food: number;
  readonly water: number;
  readonly foodNeed: number;
  readonly waterNeed: number;
  readonly shortageTicks: number;
  readonly stableTicks: number;
  readonly shortageLimit: number;
  readonly stabilityGoal: number;
  readonly outcome: GameSnapshot['population']['outcome'];
}

export function selectPopulationSummary(state: GameSnapshot): PopulationSummary {
  const needs = calculateNeeds(state.population.survivors);
  return {
    survivors: state.population.survivors,
    capacity: calculateHousingCapacity(state.buildings),
    food: state.resources.food,
    water: state.resources.water,
    foodNeed: needs.food,
    waterNeed: needs.water,
    shortageTicks: state.population.shortageTicks,
    stableTicks: state.population.stableTicks,
    shortageLimit: POPULATION_RULES.shortageTicksBeforeLoss,
    stabilityGoal: POPULATION_RULES.stableTicksForVictory,
    outcome: state.population.outcome,
  };
}
