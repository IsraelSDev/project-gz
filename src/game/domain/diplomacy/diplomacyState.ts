import {
  INDEPENDENT_CIVILIZATIONS,
  isIndependentCivilizationId,
} from '@/game/content/independentCivilizations';
import type {
  CivilizationDiplomacyState,
  DiplomaticAction,
  DiplomacyState,
  GameState,
} from '@/game/domain/state/GameState';

const clampScore = (score: number) => Math.max(-100, Math.min(100, score));

function addHistory(
  relation: CivilizationDiplomacyState,
  tick: number,
  action: DiplomaticAction,
  relationshipChange = 0,
): CivilizationDiplomacyState {
  const nextScore = clampScore(relation.relationshipScore + relationshipChange);
  return {
    ...relation,
    relationshipScore: nextScore,
    history: [
      ...relation.history,
      { tick, action, relationshipChange: nextScore - relation.relationshipScore },
    ],
  };
}

export function createInitialDiplomacy(): DiplomacyState {
  return {
    civilizations: Object.keys(INDEPENDENT_CIVILIZATIONS).map((civilizationId) => ({
      civilizationId,
      contactStatus: 'unknown' as const,
      relationshipScore: 0,
      informationRequested: false,
      giftOffered: false,
      nonAggressionPact: 'none' as const,
      warStatus: 'none' as const,
      history: [],
    })),
  };
}

export function discoverIndependentCivilization(
  diplomacy: DiplomacyState,
  civilizationId: string,
  tick: number,
): DiplomacyState {
  if (!isIndependentCivilizationId(civilizationId)) return diplomacy;
  const target = diplomacy.civilizations.find((entry) => entry.civilizationId === civilizationId);
  if (!target || target.contactStatus !== 'unknown') return diplomacy;
  return {
    civilizations: diplomacy.civilizations.map((entry) =>
      entry.civilizationId === civilizationId
        ? {
            ...addHistory(entry, tick, 'civilization-discovered'),
            contactStatus: 'discovered' as const,
          }
        : entry,
    ),
  };
}

export type FirstContactStance = 'warm' | 'guarded';

/** Shared by the explicit diplomatic command and the existing narrative event path. */
export function establishDiplomaticContact(
  state: GameState,
  civilizationId: string,
  stance: FirstContactStance,
): GameState {
  if (!isIndependentCivilizationId(civilizationId)) return state;
  const target = state.diplomacy.civilizations.find(
    (entry) => entry.civilizationId === civilizationId,
  );
  if (!target || target.contactStatus !== 'discovered') return state;

  const civilization = INDEPENDENT_CIVILIZATIONS[civilizationId];
  const leader = state.characters.find(
    (character) => character.characterId === state.government.leaderId && character.alive,
  );
  const leadershipBonus = leader ? Math.floor(leader.skills.leadership / 2) : 0;
  const change = stance === 'warm' ? civilization.warmGreetingChange + leadershipBonus : -30;
  const updated = {
    ...addHistory(target, state.tick, 'contact-established', change),
    contactStatus: 'contacted' as const,
  };
  return {
    ...state,
    diplomacy: {
      civilizations: state.diplomacy.civilizations.map((entry) =>
        entry.civilizationId === civilizationId ? updated : entry,
      ),
    },
    events: state.events.map((event) =>
      event.eventId === `signal-${civilizationId}` &&
      (event.status === 'available' || event.status === 'active')
        ? { eventId: event.eventId, status: 'closed' as const }
        : event,
    ),
  };
}

export function deferDiplomaticContact(state: GameState, civilizationId: string): GameState {
  if (!isIndependentCivilizationId(civilizationId)) return state;
  const target = state.diplomacy.civilizations.find(
    (entry) => entry.civilizationId === civilizationId,
  );
  if (!target || target.contactStatus !== 'discovered') return state;
  const deferred = addHistory(target, state.tick, 'signal-deferred');
  return {
    ...state,
    diplomacy: {
      civilizations: state.diplomacy.civilizations.map((entry) =>
        entry.civilizationId === civilizationId ? deferred : entry,
      ),
    },
  };
}

export { addHistory, clampScore };
