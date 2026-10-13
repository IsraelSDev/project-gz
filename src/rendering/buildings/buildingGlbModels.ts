import type { BuildingDefinitionId } from '@/game/content/buildings';
import { resolvePublicAssetUrl } from '../assets/glbAsset';

/** Modelos de producao enviados pelo usuario. A representacao procedural continua como fallback. */
export const BUILDING_GLB_MODELS: Partial<
  Record<BuildingDefinitionId, { readonly url: string; readonly scale: number }>
> = {
  'habitat-module': {
    url: resolvePublicAssetUrl('assets/buildings/habitat-1.glb'),
    scale: 6,
  },
  'water-extractor': {
    url: resolvePublicAssetUrl('assets/buildings/extrator-1.glb'),
    scale: 4,
  },
  'solar-array': {
    url: resolvePublicAssetUrl('assets/buildings/matriz_solar-1.glb'),
    scale: 4,
  },
  'hydroponic-farm': {
    url: resolvePublicAssetUrl('assets/buildings/reservatorio_agua-1.glb'),
    scale: 4,
  },
  'thermal-generator': {
    url: resolvePublicAssetUrl('assets/buildings/central_energia-1.glb'),
    scale: 4,
  },
};
