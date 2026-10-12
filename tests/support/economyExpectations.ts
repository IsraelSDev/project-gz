import { getBuildingDefinition } from '@/game/content/buildings';
import { RESOURCE_IDS, type ResourceId } from '@/game/content/resources';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import type { ResourceStock } from '@/game/domain/state/GameState';

/*
 * Expectativas econômicas do cenário inicial, calculadas À PARTE do domínio: uma soma simples das
 * definições dos edifícios do cenário, sem a regra de falta. Valem enquanto todos os edifícios
 * operam (o estoque inicial cobre o consumo; há um teste que prova essa premissa). Os testes de
 * fluxo as comparam com o que o jogo de fato produz, sem fixar os números provisórios do conteúdo.
 */

const zero = (): Record<ResourceId, number> => ({ food: 0, water: 0, materials: 0, energy: 0 });

/** Variação líquida por tick do cenário inicial: produção menos consumo de todos os edifícios. */
export function scenarioNetPerTick(): Readonly<Record<ResourceId, number>> {
  const net = zero();
  for (const placement of INITIAL_SCENARIO.initialBuildings) {
    const definition = getBuildingDefinition(placement.definitionId);
    for (const id of RESOURCE_IDS) {
      net[id] += (definition.production[id] ?? 0) - (definition.consumption[id] ?? 0);
    }
  }
  return net;
}

/** Consumo total por tick do cenário inicial (a demanda que o estoque inicial precisa cobrir). */
export function scenarioConsumptionPerTick(): Readonly<Record<ResourceId, number>> {
  const total = zero();
  for (const placement of INITIAL_SCENARIO.initialBuildings) {
    const definition = getBuildingDefinition(placement.definitionId);
    for (const id of RESOURCE_IDS) {
      total[id] += definition.consumption[id] ?? 0;
    }
  }
  return total;
}

/** Estoques esperados depois de `ticks` passos de edifícios, sem necessidades populacionais. */
export function expectedBuildingResourcesAfter(ticks: number): ResourceStock {
  const net = scenarioNetPerTick();
  const result = zero();
  for (const id of RESOURCE_IDS) {
    result[id] = INITIAL_SCENARIO.initialResources[id] + ticks * net[id];
  }
  return result;
}

/** Estoques esperados depois de `ticks` passos completos, incluindo sobrevivência. */
export function expectedResourcesAfter(ticks: number): ResourceStock {
  const result = { ...expectedBuildingResourcesAfter(ticks) };
  // Cada passo também cobra 2 alimentos e 2 águas da população inicial de 8 sobreviventes.
  result.food -= ticks * 2;
  result.water -= ticks * 2;
  return result;
}
