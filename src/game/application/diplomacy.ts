import { INDEPENDENT_CIVILIZATIONS } from '@/game/content/independentCivilizations';
import type { GameController } from '@/game/application/GameController';
import {
  diplomaticActionCommand,
  DIPLOMATIC_ACTION,
  type DiplomaticActionId,
} from '@/game/domain/diplomacy/diplomacyCommands';
import type { CivilizationDiplomacyState, GameState } from '@/game/domain/state/GameState';
import type { CommandErrorCode } from '@/game/domain/commands/simulationCommand';

function getStatus(relation: CivilizationDiplomacyState) {
  if (relation.contactStatus === 'unknown') return 'Desconhecida';
  if (relation.contactStatus === 'discovered') return 'Recém-descoberta';
  if (relation.relationshipScore <= -30) return 'Hostil';
  if (relation.relationshipScore < 0) return 'Tensa';
  if (relation.relationshipScore >= 20) return 'Amigável';
  return 'Neutra';
}

export function selectKnownCivilizations(state: Pick<GameState, 'diplomacy'>) {
  return state.diplomacy.civilizations
    .filter((relation) => relation.contactStatus !== 'unknown')
    .map((relation) => ({
      ...relation,
      statusLabel: getStatus(relation),
      civilization:
        INDEPENDENT_CIVILIZATIONS[
          relation.civilizationId as keyof typeof INDEPENDENT_CIVILIZATIONS
        ],
    }));
}

export function requestDiplomaticAction(
  controller: GameController,
  civilizationId: string,
  action: DiplomaticActionId,
) {
  return controller.submitCommand(diplomaticActionCommand(civilizationId, action));
}

export function subscribeToDiplomaticRejections(
  controller: GameController,
  onError: (error: CommandErrorCode) => void,
): () => void {
  return controller.subscribeRejections((rejection) => {
    if (rejection.command.type === DIPLOMATIC_ACTION) onError(rejection.error);
  });
}

export function describeDiplomaticError(error: CommandErrorCode): string {
  switch (error) {
    case 'DIPLOMACY_REQUIREMENT_NOT_MET':
      return 'Estabeleça contato e confira os requisitos desta ação.';
    case 'DIPLOMACY_ALREADY_COMPLETED':
      return 'Esta ação diplomática já foi concluída.';
    case 'INSUFFICIENT_RESOURCES':
      return 'Materiais insuficientes para oferecer o presente.';
    default:
      return 'Não foi possível concluir a ação diplomática.';
  }
}
