import type { CommandHandler } from '@/game/domain/commands/simulationCommand';
import type { CharacterSkill, GovernmentOffice } from '@/game/content/characters';
import { err, ok } from '@/shared/result/result';

export const APPOINT_CHARACTER = 'AppointCharacter';
export const REMOVE_CHARACTER_FROM_OFFICE = 'RemoveCharacterFromOffice';

const OFFICE_SKILL: Readonly<Record<GovernmentOffice, CharacterSkill>> = {
  science: 'science',
  engineering: 'engineering',
  production: 'production',
};

export function appointCharacterCommand(office: GovernmentOffice | 'leader', characterId: string) {
  return { type: APPOINT_CHARACTER, office, characterId } as const;
}

export function removeCharacterFromOfficeCommand(office: GovernmentOffice | 'leader') {
  return { type: REMOVE_CHARACTER_FROM_OFFICE, office } as const;
}

export const handleAppointCharacter: CommandHandler = (state, command) => {
  const fields: Readonly<Record<string, unknown>> = { ...command };
  const { office, characterId } = fields;
  if (
    !['leader', 'science', 'engineering', 'production'].includes(String(office)) ||
    typeof characterId !== 'string'
  )
    return err('INVALID_COMMAND');

  const person = state.characters.find((candidate) => candidate.characterId === characterId);
  if (!person || !person.alive || !person.available) return err('COMMAND_REJECTED');
  const normalizedOffice = office as GovernmentOffice | 'leader';
  const skill = normalizedOffice === 'leader' ? 'leadership' : OFFICE_SKILL[normalizedOffice];
  if (person.skills[skill] < 2) return err('COMMAND_REJECTED');
  const alreadyAssigned =
    state.government.leaderId === characterId ||
    Object.values(state.government.offices).includes(characterId);
  if (alreadyAssigned) return err('COMMAND_REJECTED');

  return ok({
    ...state,
    government:
      normalizedOffice === 'leader'
        ? { ...state.government, leaderId: characterId }
        : {
            ...state.government,
            offices: { ...state.government.offices, [normalizedOffice]: characterId },
          },
  });
};

export const handleRemoveCharacterFromOffice: CommandHandler = (state, command) => {
  const office = ({ ...command } as Readonly<Record<string, unknown>>).office;
  if (!['leader', 'science', 'engineering', 'production'].includes(String(office))) {
    return err('INVALID_COMMAND');
  }
  const normalizedOffice = office as GovernmentOffice | 'leader';
  const currentHolder =
    normalizedOffice === 'leader'
      ? state.government.leaderId
      : state.government.offices[normalizedOffice];
  if (!currentHolder) return err('COMMAND_REJECTED');
  return ok({
    ...state,
    government:
      normalizedOffice === 'leader'
        ? { ...state.government, leaderId: null }
        : {
            ...state.government,
            offices: { ...state.government.offices, [normalizedOffice]: null },
          },
  });
};
