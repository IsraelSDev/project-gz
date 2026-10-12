import { POINTS_OF_INTEREST } from '@/game/content/pointsOfInterest';
import { TECHNOLOGY_DEFINITIONS } from '@/game/content/technologies';
import type { GameController } from '@/game/application/GameController';
import { explorePointCommand, EXPLORE_POINT } from '@/game/domain/exploration/exploreCommand';
import { startResearchCommand, START_RESEARCH } from '@/game/domain/research/researchCommands';
import { RESOURCE_DEFINITIONS, RESOURCE_IDS, type ResourceRates } from '@/game/content/resources';
import type { CommandErrorCode } from '@/game/domain/commands/simulationCommand';

/** Dados de catálogo projetados para a interface, sem regras duplicadas. */
function selectCosts(cost: ResourceRates) {
  return RESOURCE_IDS.flatMap((id) => {
    const amount = cost[id];
    return amount === undefined ? [] : [{ id, name: RESOURCE_DEFINITIONS[id].name, amount }];
  });
}

export const selectTechnologyCatalog = () =>
  Object.values(TECHNOLOGY_DEFINITIONS).map((technology) => ({
    ...technology,
    costLines: selectCosts(technology.cost),
  }));
export const selectPointOfInterestCatalog = () =>
  Object.values(POINTS_OF_INTEREST).map((point) => ({
    ...point,
    surveyCostLines: selectCosts(point.surveyCost),
    rewardLines: selectCosts(point.reward),
  }));

export function describeContentExpansionError(error: CommandErrorCode): string {
  switch (error) {
    case 'INSUFFICIENT_RESOURCES':
      return 'Recursos insuficientes para esta ação.';
    case 'COMMAND_REJECTED':
      return 'Ação indisponível. Confira os requisitos e se ela já foi concluída.';
    case 'INVALID_COMMAND':
      return 'Ação inválida.';
    case 'INVALID_STATE':
      return 'A ação não pôde ser aplicada porque o estado da partida é inválido.';
    case 'EVENT_NOT_ACTIVE':
      return 'Este evento não está mais ativo.';
    default:
      return 'Não foi possível concluir a ação.';
  }
}

export function requestResearch(controller: GameController, technologyId: string) {
  return controller.submitCommand(startResearchCommand(technologyId));
}

export function requestPointExploration(controller: GameController, pointId: string) {
  return controller.submitCommand(explorePointCommand(pointId));
}

export function subscribeToContentExpansionRejections(
  controller: GameController,
  onError: (message: string) => void,
): () => void {
  return controller.subscribeRejections((rejection) => {
    if (rejection.command.type === START_RESEARCH || rejection.command.type === EXPLORE_POINT) {
      onError(describeContentExpansionError(rejection.error));
    }
  });
}
