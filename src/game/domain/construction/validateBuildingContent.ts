import type { BuildingDefinition } from '@/game/content/buildings';
import { validateBuildingEconomy } from '@/game/domain/economy/validateBuildingEconomy';
import { isTechnologyId } from '@/game/content/technologies';

const CATEGORIES: readonly string[] = [
  'shelter',
  'infrastructure',
  'food',
  'water',
  'energy',
  'industry',
  'research',
];

const isPositiveInteger = (value: unknown): boolean =>
  Number.isSafeInteger(value) && Number(value) > 0;

/**
 * Valida as definições estáticas de edifícios e devolve a lista de problemas (vazia quando o
 * conteúdo é válido). Não lança exceção. É a validação **manual** do conteúdo, sem biblioteca: parte
 * da pendência P-05 resolvida na Fase 6 (a validação de dados CARREGADOS fica para a Fase 8).
 *
 * Confere, para cada definição: `id` igual à chave, nome não vazio, categoria conhecida, footprint
 * com largura e profundidade inteiras e positivas e, pela validação econômica, custo, produção e
 * consumo (inteiros positivos de recursos que existem). Conteúdo inválido impede o jogo de começar
 * (`createInitialGameState`), em vez de falhar depois, no meio de uma construção.
 */
export function validateBuildingContent(
  definitions: Readonly<Record<string, BuildingDefinition>>,
): readonly string[] {
  const issues: string[] = [];

  for (const [key, definition] of Object.entries(definitions)) {
    if (definition.id !== key) {
      issues.push(`${key}: o id "${String(definition.id)}" deve ser igual à chave.`);
    }
    if (typeof definition.name !== 'string' || definition.name.trim() === '') {
      issues.push(`${key}: o nome não pode ser vazio.`);
    }
    if (!CATEGORIES.includes(definition.category)) {
      issues.push(`${key}: categoria desconhecida "${String(definition.category)}".`);
    }
    if (definition.requiredTechnologyId && !isTechnologyId(definition.requiredTechnologyId)) {
      issues.push(`${key}: tecnologia de desbloqueio desconhecida.`);
    }
    if (
      definition.housingCapacity !== undefined &&
      !isPositiveInteger(definition.housingCapacity)
    ) {
      issues.push(`${key}: housingCapacity deve ser um inteiro positivo.`);
    }
    const { footprint } = definition;
    if (
      typeof footprint !== 'object' ||
      footprint === null ||
      !isPositiveInteger(footprint.width) ||
      !isPositiveInteger(footprint.depth)
    ) {
      issues.push(`${key}: o footprint deve ter largura e profundidade inteiras e positivas.`);
    }
  }

  return [...issues, ...validateBuildingEconomy(definitions)];
}
