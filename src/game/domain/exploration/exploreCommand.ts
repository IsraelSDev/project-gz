import { POINTS_OF_INTEREST } from '@/game/content/pointsOfInterest';
import { RESOURCE_IDS, MAX_RESOURCE_AMOUNT } from '@/game/content/resources';
import type { CommandHandler, SimulationCommand } from '@/game/domain/commands/simulationCommand';
import { err, ok } from '@/shared/result/result';

export const EXPLORE_POINT = 'ExplorePoint';
export interface ExplorePointCommand extends SimulationCommand {
  readonly type: typeof EXPLORE_POINT;
  readonly pointId: string;
}
export const explorePointCommand = (pointId: string): ExplorePointCommand => ({
  type: EXPLORE_POINT,
  pointId,
});

export const handleExplorePoint: CommandHandler = (state, command) => {
  const id = (command as { pointId?: unknown }).pointId;
  if (typeof id !== 'string' || !Object.hasOwn(POINTS_OF_INTEREST, id))
    return err('INVALID_COMMAND');
  const point = POINTS_OF_INTEREST[id]!;
  if (
    state.exploration.discoveredPointIds.includes(id) ||
    (point.requiredTechnologyId &&
      !state.research.unlockedTechnologyIds.includes(point.requiredTechnologyId))
  )
    return err('COMMAND_REJECTED');
  if (
    RESOURCE_IDS.some((resource) => state.resources[resource] < (point.surveyCost[resource] ?? 0))
  )
    return err('INSUFFICIENT_RESOURCES');
  const resources = { ...state.resources };
  for (const resource of RESOURCE_IDS)
    resources[resource] = Math.min(
      MAX_RESOURCE_AMOUNT,
      resources[resource] - (point.surveyCost[resource] ?? 0) + (point.reward[resource] ?? 0),
    );
  return ok({
    ...state,
    resources,
    exploration: { discoveredPointIds: [...state.exploration.discoveredPointIds, id] },
  });
};
