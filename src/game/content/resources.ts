/*
 * Recursos do MVP (docs/GAME_DESIGN.md §8.3). A escala das quantidades (inteiros em unidades
 * escaladas, D-14) e as regras de produção e consumo são definidas na Fase 5.
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
