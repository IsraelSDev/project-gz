import { RESOURCE_IDS } from '@/game/content/resources';
import type { EconomyDefinitions } from './advanceEconomy';
import { isValidRateAmount } from './resourceRates';

/** A parte econômica de uma definição: o custo de construção (Fase 6) e as taxas por tick (Fase 5). */
export type EconomyContent = EconomyDefinitions[string] & { readonly cost?: unknown };

/**
 * Valida a parte econômica das definições de edifícios e devolve a lista de problemas (vazia
 * quando o conteúdo é válido). Não lança exceção. Cada taxa e cada custo precisam ser um inteiro
 * positivo, de um recurso que exista (D-51). Conteúdo inválido é erro de programação ou de dados, e
 * o estado inicial recusa começar com ele (`createInitialGameState`).
 */
export function validateBuildingEconomy(
  definitions: Readonly<Record<string, EconomyContent>>,
): readonly string[] {
  const issues: string[] = [];

  for (const [definitionId, definition] of Object.entries(definitions)) {
    const sections = [
      ['cost', definition.cost],
      ['production', definition.production],
      ['consumption', definition.consumption],
    ] as const;

    for (const [field, rates] of sections) {
      const label = `${definitionId}.${field}`;
      const value: unknown = rates;
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        issues.push(`${label} deve ser um objeto de taxas por recurso.`);
        continue;
      }
      for (const [key, amount] of Object.entries(value)) {
        if (!RESOURCE_IDS.some((id) => id === key)) {
          issues.push(`${label} tem um recurso desconhecido: "${key}".`);
        } else if (!isValidRateAmount(amount)) {
          issues.push(`${label}.${key} deve ser um inteiro positivo.`);
        }
      }
    }
  }

  return issues;
}
