import { TECHNOLOGY_DEFINITIONS, type TechnologyEffect } from '@/game/content/technologies';
import type { ResourceRates } from '@/game/content/resources';

export interface TechnologyModifiers {
  readonly productionByBuilding: Readonly<Record<string, ResourceRates>>;
  readonly constructionMaterialDiscountPercent: number;
  readonly researchPerExtraLab: number;
  readonly governorMaterialsPerTenTicks: number;
  readonly defensePerPost: number;
}

export function getTechnologyModifiers(unlockedIds: readonly string[]): TechnologyModifiers {
  const production: Record<string, Record<string, number>> = {};
  let constructionMaterialDiscountPercent = 0;
  let researchPerExtraLab = 0;
  let governorMaterialsPerTenTicks = 0;
  let defensePerPost = 0;
  const apply = (effect: TechnologyEffect) => {
    switch (effect.kind) {
      case 'production':
        for (const buildingId of effect.buildingIds) {
          const rates = production[buildingId] ?? (production[buildingId] = {});
          rates[effect.resource] = (rates[effect.resource] ?? 0) + effect.amount;
        }
        break;
      case 'construction-discount':
        constructionMaterialDiscountPercent += effect.percent;
        break;
      case 'research-per-extra-lab':
        researchPerExtraLab += effect.amount;
        break;
      case 'governor-materials':
        governorMaterialsPerTenTicks += effect.amount;
        break;
      case 'defense-per-post':
        defensePerPost += effect.amount;
        break;
    }
  };
  for (const id of new Set(unlockedIds)) {
    if (Object.hasOwn(TECHNOLOGY_DEFINITIONS, id))
      apply(TECHNOLOGY_DEFINITIONS[id as keyof typeof TECHNOLOGY_DEFINITIONS].effect);
  }
  return {
    productionByBuilding: production as Readonly<Record<string, ResourceRates>>,
    constructionMaterialDiscountPercent,
    researchPerExtraLab,
    governorMaterialsPerTenTicks,
    defensePerPost,
  };
}

export function applyConstructionDiscount(
  cost: ResourceRates,
  unlockedIds: readonly string[],
): ResourceRates {
  const percent = getTechnologyModifiers(unlockedIds).constructionMaterialDiscountPercent;
  if (percent <= 0 || cost.materials === undefined) return cost;
  return { ...cost, materials: Math.max(1, Math.ceil((cost.materials * (100 - percent)) / 100)) };
}
