import {
  INDEPENDENT_CIVILIZATIONS,
  isIndependentCivilizationId,
} from '@/game/content/independentCivilizations';
import { UNIT_DEFINITIONS, type MilitaryUnitType } from '@/game/content/military';
import {
  militaryActionCommand,
  type MilitaryActionCommand,
} from '@/game/domain/military/militaryCommands';
import type { GameController } from './GameController';

export const MILITARY_UNIT_CATALOG = Object.entries(UNIT_DEFINITIONS).map(([type, unit]) => ({
  type: type as MilitaryUnitType,
  ...unit,
}));
export type MilitaryAction = MilitaryActionCommand['action'];
export type MilitaryActionFields = { unitType?: MilitaryUnitType; civilizationId?: string };
export const describeMilitaryError = (error: string) => {
  switch (error) {
    case 'INSUFFICIENT_RESOURCES':
      return 'Materiais insuficientes para esta ordem.';
    case 'DIPLOMACY_REQUIREMENT_NOT_MET':
      return 'A relação, o contato ou o pacto impede esta ação.';
    case 'COMMAND_REJECTED':
      return 'A colônia não pode executar esta ordem agora.';
    case 'INVALID_STATE':
      return 'A ordem produziria um estado inválido e foi cancelada.';
    default:
      return 'Não foi possível executar esta ordem.';
  }
};

export const selectMilitaryUnit = (type: MilitaryUnitType) => UNIT_DEFINITIONS[type];
export const selectMilitaryCivilizationName = (id: string) =>
  isIndependentCivilizationId(id) ? INDEPENDENT_CIVILIZATIONS[id].name : id;

export function requestMilitaryAction(
  controller: GameController,
  action: MilitaryAction,
  fields: MilitaryActionFields = {},
) {
  return controller.submitCommand(militaryActionCommand(action, fields));
}
