import { BUILDING_DEFINITIONS, type BuildingDefinition } from '@/game/content/buildings';
import { MAX_RESOURCE_AMOUNT, RESOURCE_IDS, type ResourceId } from '@/game/content/resources';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { ResourceStock } from '@/game/domain/state/GameState';
import { rateEntries, type RateEntry } from './resourceRates';

/** O que a economia lê de uma definição de edifício. */
export type EconomyDefinition = Pick<BuildingDefinition, 'production' | 'consumption'>;
export type EconomyDefinitions = Readonly<Record<string, EconomyDefinition>>;

/** O que a economia lê de um edifício construído. */
export interface EconomyBuilding {
  readonly definitionId: string;
}

interface BuildingFlow {
  readonly production: readonly RateEntry[];
  readonly consumption: readonly RateEntry[];
}

type MutableStock = Record<ResourceId, number>;

/**
 * DECIDE quais edifícios operam neste passo (regra de falta, Arquitetura §20.2).
 *
 * Os edifícios são avaliados na ORDEM do estado (a de construção): essa ordem é a prioridade.
 * Cada um tenta RESERVAR todo o seu consumo do estoque que sobrou. Se algum recurso não cobrir o
 * consumo, o edifício fica PARADO: não reserva nada, não consome e não produz. A disponibilidade é o
 * estoque do INÍCIO do passo; a produção do passo só pode pagar consumo a partir do passo seguinte.
 * Como cada reserva sai do estoque inicial, o consumo total nunca passa do que existe: o estoque não
 * fica negativo por construção.
 */
function selectOperatingBuildings(
  resources: ResourceStock,
  buildings: readonly EconomyBuilding[],
  definitions: EconomyDefinitions,
): readonly BuildingFlow[] {
  const unreserved: MutableStock = { ...resources };
  const operating: BuildingFlow[] = [];

  for (const building of buildings) {
    const definition = Object.hasOwn(definitions, building.definitionId)
      ? definitions[building.definitionId]
      : undefined;
    if (!definition) {
      throw new RangeError(`Definição de edifício desconhecida: "${building.definitionId}".`);
    }

    // Lê as duas taxas de todo edifício, mesmo parado, para que conteúdo inválido nunca passe calado.
    const flow: BuildingFlow = {
      production: rateEntries(definition.production),
      consumption: rateEntries(definition.consumption),
    };
    if (flow.consumption.some(([id, amount]) => unreserved[id] < amount)) {
      continue;
    }
    for (const [id, amount] of flow.consumption) {
      unreserved[id] -= amount;
    }
    operating.push(flow);
  }
  return operating;
}

/**
 * Passo econômico: itens 3 (produção) e 4 (consumo) da Arquitetura §6.5. Função pura e
 * determinística (não lê relógio, aleatoriedade nem ambiente) sobre inteiros, sem ponto flutuante.
 * O estoque de entrada não é alterado.
 *
 *  1. Decide quais edifícios operam (`selectOperatingBuildings`).
 *  2. Produção: soma a produção de cada edifício que opera, limitada ao teto técnico (D-51).
 *  3. Consumo: subtrai o consumo de cada edifício que opera.
 *
 * Lança `RangeError` se o resultado não for um inteiro seguro não negativo em todo recurso (estoque
 * de entrada inválido, taxa inválida ou bug): a simulação nunca produz valor inválido em silêncio.
 * Devolve a MESMA referência de `resources` quando nada muda (compartilhamento estrutural); caso
 * contrário, um novo objeto congelado.
 */
export function advanceEconomy(
  resources: ResourceStock,
  buildings: readonly EconomyBuilding[],
  definitions: EconomyDefinitions = BUILDING_DEFINITIONS,
): ResourceStock {
  const operating = selectOperatingBuildings(resources, buildings, definitions);
  const next: MutableStock = { ...resources };

  for (const { production } of operating) {
    for (const [id, amount] of production) {
      next[id] = Math.min(MAX_RESOURCE_AMOUNT, next[id] + amount);
    }
  }
  for (const { consumption } of operating) {
    for (const [id, amount] of consumption) {
      next[id] -= amount;
    }
  }

  for (const id of RESOURCE_IDS) {
    if (!Number.isSafeInteger(next[id]) || next[id] < 0) {
      throw new RangeError(
        `A economia produziu um valor inválido para "${id}": ${String(next[id])}.`,
      );
    }
  }
  return RESOURCE_IDS.every((id) => next[id] === resources[id]) ? resources : freezeDeep(next);
}
