import { POINTS_OF_INTEREST } from '@/game/content/pointsOfInterest';
import { TECHNOLOGY_DEFINITIONS } from '@/game/content/technologies';
import type { GameController } from '@/game/application/GameController';
import { explorePointCommand } from '@/game/domain/exploration/exploreCommand';
import { startResearchCommand } from '@/game/domain/research/researchCommands';

/** Dados de catálogo projetados para a interface, sem regras duplicadas. */
export const selectTechnologyCatalog = () => Object.values(TECHNOLOGY_DEFINITIONS);
export const selectPointOfInterestCatalog = () => Object.values(POINTS_OF_INTEREST);

export function requestResearch(controller: GameController, technologyId: string) {
  return controller.submitCommand(startResearchCommand(technologyId));
}

export function requestPointExploration(controller: GameController, pointId: string) {
  return controller.submitCommand(explorePointCommand(pointId));
}
