/*
 * Recursos do MVP (docs/GAME_DESIGN.md §8.3).
 *
 * Unidade (D-47): os estoques são INTEIROS e a unidade armazenada é a própria unidade exibida
 * (escala 1). Taxas de produção e consumo são inteiros por tick (1 tick = 1 s de tempo de jogo).
 * Não existe ponto flutuante nas regras econômicas. Se algum sistema futuro precisar de frações,
 * a escala muda por migração do esquema do estado (Fase 8), não por arredondamento escondido.
 */
export const RESOURCE_IDS = ['food', 'water', 'materials', 'energy'] as const;

export type ResourceId = (typeof RESOURCE_IDS)[number];

export interface ResourceDefinition {
  readonly id: ResourceId;
  /** Nome exibido ao jogador (idioma e estratégia de textos: pendência P-10). */
  readonly name: string;
}

export const RESOURCE_DEFINITIONS: Readonly<Record<ResourceId, ResourceDefinition>> = {
  food: { id: 'food', name: 'Alimentos' },
  water: { id: 'water', name: 'Água' },
  materials: { id: 'materials', name: 'Materiais' },
  energy: { id: 'energy', name: 'Energia' },
};

/**
 * Quantidade de recursos POR TICK. Cada valor é um inteiro positivo; recurso ausente significa
 * zero. Usada para produção e consumo dos edifícios (`game/content/buildings.ts`).
 */
export type ResourceRates = Readonly<Partial<Record<ResourceId, number>>>;

/**
 * Teto TÉCNICO de um estoque (D-51): o maior inteiro seguro. Uma produção que ultrapassaria o teto
 * é limitada a ele, em vez de gerar um valor que o JavaScript não representa com exatidão. Não é
 * uma capacidade de armazenamento do jogo (isso é decisão de design, pendência P-19).
 */
export const MAX_RESOURCE_AMOUNT = Number.MAX_SAFE_INTEGER;
