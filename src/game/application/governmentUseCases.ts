import type { CommandErrorCode } from '@/game/domain/commands/simulationCommand';
import {
  appointCharacterCommand,
  removeCharacterFromOfficeCommand,
} from '@/game/domain/government/governmentCommands';
import type { GovernmentOffice } from '@/game/content/characters';
import type { CommandOutcome, GameController } from './GameController';
import type { Result } from '@/shared/result/result';

export function appointCharacter(
  controller: Pick<GameController, 'submitCommand'>,
  office: GovernmentOffice | 'leader',
  characterId: string,
): Result<CommandOutcome, CommandErrorCode> {
  return controller.submitCommand(appointCharacterCommand(office, characterId));
}

export function removeCharacterFromOffice(
  controller: Pick<GameController, 'submitCommand'>,
  office: GovernmentOffice | 'leader',
): Result<CommandOutcome, CommandErrorCode> {
  return controller.submitCommand(removeCharacterFromOfficeCommand(office));
}
