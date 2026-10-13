import {
  INDEPENDENT_CIVILIZATIONS,
  isIndependentCivilizationId,
} from '@/game/content/independentCivilizations';
import type { CommandHandler, SimulationCommand } from '@/game/domain/commands/simulationCommand';
import type {
  CivilizationDiplomacyState,
  DiplomaticAction,
  GameState,
} from '@/game/domain/state/GameState';
import { addHistory, establishDiplomaticContact } from './diplomacyState';
import { err, ok } from '@/shared/result/result';

export const DIPLOMATIC_ACTION = 'DiplomaticAction';
export type DiplomaticActionId =
  | 'establish-contact'
  | 'request-information'
  | 'offer-gift'
  | 'propose-non-aggression-pact'
  | 'end-negotiation'
  | 'provoke';

export interface DiplomaticActionCommand extends SimulationCommand {
  readonly type: typeof DIPLOMATIC_ACTION;
  readonly civilizationId: string;
  readonly action: string;
}

export function diplomaticActionCommand(
  civilizationId: string,
  action: DiplomaticActionId,
): DiplomaticActionCommand {
  return { type: DIPLOMATIC_ACTION, civilizationId, action };
}

const GIFT_COST = 10;

function updateRelation(
  state: GameState,
  civilizationId: string,
  update: (relation: CivilizationDiplomacyState) => CivilizationDiplomacyState,
): GameState | null {
  let found = false;
  const civilizations = state.diplomacy.civilizations.map((relation) => {
    if (relation.civilizationId !== civilizationId) return relation;
    found = true;
    return update(relation);
  });
  return found ? { ...state, diplomacy: { civilizations } } : null;
}

function append(
  relation: CivilizationDiplomacyState,
  tick: number,
  action: DiplomaticAction,
  change = 0,
): CivilizationDiplomacyState {
  return addHistory(relation, tick, action, change);
}

export const handleDiplomaticAction: CommandHandler = (state, command) => {
  const fields = command as { readonly civilizationId?: unknown; readonly action?: unknown };
  if (
    typeof fields.civilizationId !== 'string' ||
    !isIndependentCivilizationId(fields.civilizationId) ||
    typeof fields.action !== 'string' ||
    ![
      'establish-contact',
      'request-information',
      'offer-gift',
      'propose-non-aggression-pact',
      'end-negotiation',
      'provoke',
    ].includes(fields.action)
  ) {
    return err('INVALID_COMMAND');
  }

  const civilizationId = fields.civilizationId;
  const action = fields.action as DiplomaticActionId;
  const relation = state.diplomacy.civilizations.find(
    (entry) => entry.civilizationId === civilizationId,
  );
  if (!relation) return err('INVALID_COMMAND');

  if (action === 'establish-contact') {
    if (relation.contactStatus !== 'discovered') return err('DIPLOMACY_REQUIREMENT_NOT_MET');
    return ok(establishDiplomaticContact(state, civilizationId, 'warm'));
  }
  if (relation.contactStatus !== 'contacted') return err('DIPLOMACY_REQUIREMENT_NOT_MET');

  const civilization = INDEPENDENT_CIVILIZATIONS[civilizationId];
  if (action === 'provoke') {
    if (relation.warStatus === 'active' || relation.nonAggressionPact === 'active')
      return err('DIPLOMACY_REQUIREMENT_NOT_MET');
    if (relation.relationshipScore <= -100) return err('DIPLOMACY_ALREADY_COMPLETED');
    const next = updateRelation(state, civilizationId, (current) =>
      append(current, state.tick, 'provocation', -20),
    );
    return next ? ok(next) : err('INVALID_COMMAND');
  }
  if (action === 'request-information') {
    if (relation.informationRequested) return err('DIPLOMACY_ALREADY_COMPLETED');
    const next = updateRelation(state, civilizationId, (current) =>
      append(
        { ...current, informationRequested: true },
        state.tick,
        'information-requested',
        civilization.informationChange,
      ),
    );
    return next ? ok(next) : err('INVALID_COMMAND');
  }
  if (action === 'offer-gift') {
    if (relation.giftOffered) return err('DIPLOMACY_ALREADY_COMPLETED');
    if (state.resources.materials < GIFT_COST) return err('INSUFFICIENT_RESOURCES');
    const next = updateRelation(state, civilizationId, (current) =>
      append(
        { ...current, giftOffered: true },
        state.tick,
        'gift-offered',
        civilization.giftChange,
      ),
    );
    return next
      ? ok({
          ...next,
          resources: { ...state.resources, materials: state.resources.materials - GIFT_COST },
        })
      : err('INVALID_COMMAND');
  }
  if (action === 'propose-non-aggression-pact') {
    if (relation.nonAggressionPact !== 'none') return err('DIPLOMACY_ALREADY_COMPLETED');
    const accepted = relation.relationshipScore >= civilization.pactAcceptanceThreshold;
    const next = updateRelation(state, civilizationId, (current) => {
      const proposed = append(
        { ...current, nonAggressionPact: accepted ? 'active' : 'rejected' },
        state.tick,
        'pact-proposed',
      );
      return append(proposed, state.tick, accepted ? 'pact-accepted' : 'pact-rejected');
    });
    return next ? ok(next) : err('INVALID_COMMAND');
  }

  if (relation.nonAggressionPact !== 'active') return err('DIPLOMACY_REQUIREMENT_NOT_MET');
  const next = updateRelation(state, civilizationId, (current) =>
    append({ ...current, nonAggressionPact: 'ended' }, state.tick, 'pact-ended', -20),
  );
  if (!next) return err('INVALID_COMMAND');
  return ok(next);
};
