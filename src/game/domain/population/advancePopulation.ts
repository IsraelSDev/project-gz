import { calculateNeeds, POPULATION_RULES } from '@/game/content/population';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameState, PopulationState } from '@/game/domain/state/GameState';
import { calculateHousingCapacity } from './housingCapacity';

/** Regra compartilhada de necessidades para o capital e cidades, sem efeitos colaterais de elenco. */
export function advancePopulationRecord(
  population: PopulationState,
  resources: GameState['resources'],
  buildings: GameState['buildings'],
): {
  readonly population: PopulationState;
  readonly resources: GameState['resources'];
  readonly losesSurvivor: boolean;
} {
  if (population.outcome === 'defeat') return { population, resources, losesSurvivor: false };
  const needs = calculateNeeds(population.survivors);
  const food = Math.min(resources.food, needs.food);
  const water = Math.min(resources.water, needs.water);
  const supplied = food === needs.food && water === needs.water;
  const housed = calculateHousingCapacity(buildings) >= population.survivors;
  const shortageTicks = supplied ? 0 : population.shortageTicks + 1;
  const losesSurvivor = shortageTicks >= POPULATION_RULES.shortageTicksBeforeLoss;
  const survivors = Math.max(0, population.survivors - (losesSurvivor ? 1 : 0));
  const stableTicks = supplied && housed ? population.stableTicks + 1 : 0;
  let outcome: PopulationState['outcome'] = 'ongoing';
  if (survivors === 0) outcome = 'defeat';
  return {
    population: {
      survivors,
      shortageTicks: losesSurvivor ? 0 : shortageTicks,
      stableTicks,
      outcome,
    },
    resources:
      food === 0 && water === 0
        ? resources
        : freezeDeep({ ...resources, food: resources.food - food, water: resources.water - water }),
    losesSurvivor,
  };
}

/** Consome necessidades uma única vez após a economia; faltas parciais consomem o que houver. */
export function advancePopulation(state: GameState): GameState {
  const advanced = advancePopulationRecord(state.population, state.resources, state.buildings);
  if (advanced.population === state.population && advanced.resources === state.resources)
    return state;
  let characters = state.characters;
  let government = state.government;
  let settlements = state.settlements;
  if (advanced.losesSurvivor) {
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
      settlements = state.settlements.map((city) =>
        city.administratorId === lost.characterId ? { ...city, administratorId: null } : city,
      );
    }
  }
  return freezeDeep({
    ...state,
    resources: advanced.resources,
    population: advanced.population,
    characters,
    government,
    settlements,
  });
}
