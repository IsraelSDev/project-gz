import { calculateNeeds, POPULATION_RULES } from '@/game/content/population';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameState, PopulationState } from '@/game/domain/state/GameState';
import { calculateHousingCapacity } from './housingCapacity';

/** Consome necessidades uma única vez após a economia; faltas parciais consomem o que houver. */
export function advancePopulation(state: GameState): GameState {
  if (state.population.outcome !== 'ongoing') return state;
  const needs = calculateNeeds(state.population.survivors);
  const food = Math.min(state.resources.food, needs.food);
  const water = Math.min(state.resources.water, needs.water);
  const supplied = food === needs.food && water === needs.water;
  const housed = calculateHousingCapacity(state.buildings) >= state.population.survivors;
  const shortageTicks = supplied ? 0 : state.population.shortageTicks + 1;
  const losesSurvivor = shortageTicks >= POPULATION_RULES.shortageTicksBeforeLoss;
  const survivors = Math.max(0, state.population.survivors - (losesSurvivor ? 1 : 0));
  const normalizedShortage = losesSurvivor ? 0 : shortageTicks;
  const stableTicks = supplied && housed ? state.population.stableTicks + 1 : 0;
  let outcome: PopulationState['outcome'] = 'ongoing';
  if (survivors === 0) outcome = 'defeat';
  else if (
    supplied &&
    housed &&
    stableTicks >= POPULATION_RULES.stableTicksForVictory &&
    survivors >= POPULATION_RULES.minimumSurvivorsForVictory
  )
    outcome = 'victory';

  const population: PopulationState = {
    survivors,
    shortageTicks: normalizedShortage,
    stableTicks,
    outcome,
  };
  let characters = state.characters;
  let government = state.government;
  if (losesSurvivor) {
    const lost = [...state.characters]
      .filter((character) => character.alive)
      .sort((a, b) => {
        const score = (person: typeof a) =>
          Object.values(person.skills).reduce((sum, skill) => sum + skill, 0);
        return score(a) - score(b) || a.characterId.localeCompare(b.characterId);
      })[0];
    if (lost) {
      characters = state.characters.map((character) =>
        character.characterId === lost.characterId
          ? { ...character, alive: false, available: false }
          : character,
      );
      government = {
        leaderId: government.leaderId === lost.characterId ? null : government.leaderId,
        offices: Object.fromEntries(
          Object.entries(government.offices).map(([office, holder]) => [
            office,
            holder === lost.characterId ? null : holder,
          ]),
        ) as typeof government.offices,
      };
    }
  }
  const resources =
    food === 0 && water === 0
      ? state.resources
      : freezeDeep({
          ...state.resources,
          food: state.resources.food - food,
          water: state.resources.water - water,
        });
  return freezeDeep({ ...state, resources, population, characters, government });
}
