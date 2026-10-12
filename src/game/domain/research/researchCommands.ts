import { TECHNOLOGY_DEFINITIONS, isTechnologyId } from '@/game/content/technologies';
import type { CommandHandler, SimulationCommand } from '@/game/domain/commands/simulationCommand';
import { RESOURCE_IDS } from '@/game/content/resources';
import { err, ok } from '@/shared/result/result';

export const START_RESEARCH = 'StartResearch';
export interface StartResearchCommand extends SimulationCommand {
  readonly type: typeof START_RESEARCH;
  readonly technologyId: string;
}
export const startResearchCommand = (technologyId: string): StartResearchCommand => ({
  type: START_RESEARCH,
  technologyId,
});

function hasFieldLaboratory(state: import('@/game/domain/state/GameState').GameState): boolean {
  return (
    state.buildings.some((building) => building.definitionId === 'field-laboratory') ||
    state.settlements.some((city) =>
      city.buildings.some((building) => building.definitionId === 'field-laboratory'),
    )
  );
}

export const handleStartResearch: CommandHandler = (state, command) => {
  const id = (command as { technologyId?: unknown }).technologyId;
  if (typeof id !== 'string' || !isTechnologyId(id)) return err('INVALID_COMMAND');
  const tech = TECHNOLOGY_DEFINITIONS[id]!;
  if (
    state.research.activeTechnologyId !== null ||
    state.research.unlockedTechnologyIds.includes(id) ||
    !tech.prerequisites.every((required) =>
      state.research.unlockedTechnologyIds.includes(required),
    ) ||
    !hasFieldLaboratory(state)
  )
    return err('COMMAND_REJECTED');
  const scientistId = state.government.offices.science;
  const scientist = state.characters.find(
    (character) => character.characterId === scientistId && character.alive && character.available,
  );
  if (!scientist) return err('COMMAND_REJECTED');
  if (RESOURCE_IDS.some((resource) => state.resources[resource] < (tech.cost[resource] ?? 0)))
    return err('INSUFFICIENT_RESOURCES');
  const resources = { ...state.resources };
  for (const resource of RESOURCE_IDS) resources[resource] -= tech.cost[resource] ?? 0;
  return ok({
    ...state,
    resources,
    research: { ...state.research, activeTechnologyId: id, progress: 0 },
  });
};

export function advanceResearch(state: import('@/game/domain/state/GameState').GameState) {
  const id = state.research.activeTechnologyId;
  if (!id || !isTechnologyId(id) || !hasFieldLaboratory(state)) return state;
  const scientist = state.characters.find(
    (c) => c.characterId === state.government.offices.science && c.alive && c.available,
  );
  if (!scientist) return state;
  const progress = state.research.progress + Math.max(1, scientist.skills.science);
  const definition = TECHNOLOGY_DEFINITIONS[id]!;
  if (progress < definition.researchPoints)
    return { ...state, research: { ...state.research, progress } };
  return {
    ...state,
    research: {
      unlockedTechnologyIds: [...state.research.unlockedTechnologyIds, id],
      activeTechnologyId: null,
      progress: 0,
    },
  };
}

export function hasTechnology(
  state: Pick<import('@/game/domain/state/GameState').GameState, 'research'>,
  id: string | undefined,
): boolean {
  return !id || state.research.unlockedTechnologyIds.includes(id);
}
