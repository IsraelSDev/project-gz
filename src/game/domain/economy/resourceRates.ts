import { RESOURCE_IDS, type ResourceId, type ResourceRates } from '@/game/content/resources';

/**
 * Uma taxa válida é um inteiro seguro POSITIVO por tick. Zero não precisa ser declarado (recurso
 * ausente significa zero) e valores negativos, fracionários, NaN ou infinitos são rejeitados, não
 * corrigidos (Arquitetura §6.4). É a única definição de taxa válida: a validação do conteúdo e o
 * passo econômico usam esta função.
 */
export function isValidRateAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export type RateEntry = readonly [id: ResourceId, amount: number];

/**
 * Taxas como pares `[recurso, quantidade]`, SEMPRE na ordem de `RESOURCE_IDS` (determinística),
 * ignorando chaves que não são recursos. Lança `RangeError` se uma taxa for inválida: isso é erro de
 * conteúdo, não uma falha esperada do jogo.
 */
export function rateEntries(rates: ResourceRates): readonly RateEntry[] {
  const entries: RateEntry[] = [];
  for (const id of RESOURCE_IDS) {
    if (!Object.hasOwn(rates, id)) {
      continue;
    }
    const amount: unknown = rates[id];
    if (!isValidRateAmount(amount)) {
      throw new RangeError(
        `Taxa inválida para "${id}": ${String(amount)} (use um inteiro positivo por tick).`,
      );
    }
    entries.push([id, amount]);
  }
  return entries;
}
