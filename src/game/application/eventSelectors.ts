import { GAME_EVENT_DEFINITIONS } from '@/game/content/events';

export function selectGameEventDefinition(eventId: string | undefined) {
  return GAME_EVENT_DEFINITIONS.find((definition) => definition.id === eventId);
}
