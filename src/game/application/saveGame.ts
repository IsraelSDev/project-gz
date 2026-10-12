import { BUILDING_DEFINITIONS } from '@/game/content/buildings';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import type { GameController, GameStateReader } from '@/game/application/GameController';
import type { SaveProvider } from '@/game/application/ports/SaveProvider';
import { evaluatePlacementSpace } from '@/game/domain/construction/placement';
import { INITIAL_PLACEMENT_TERRAIN } from '@/game/domain/construction/placementTerrain';
import {
  GAME_STATE_SCHEMA_VERSION,
  type GameEventStatus,
  type GameState,
} from '@/game/domain/state/GameState';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import { validateGameState } from '@/game/domain/state/validateGameState';
import { err, ok, type Result } from '@/shared/result/result';

export const SAVE_FORMAT = 'alien-civilization-save';
export const SAVE_FORMAT_VERSION = 1;

export type SaveError =
  'NO_SAVE' | 'STORAGE_ERROR' | 'CORRUPT_SAVE' | 'INCOMPATIBLE_SAVE' | 'INVALID_STATE';

interface SaveEnvelope {
  readonly format: typeof SAVE_FORMAT;
  readonly formatVersion: typeof SAVE_FORMAT_VERSION;
  readonly state: GameState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key))
  );
}

function copySaveState(value: unknown): Result<GameState, SaveError> {
  if (!isRecord(value)) return err('CORRUPT_SAVE');
  if (typeof value.schemaVersion !== 'number') return err('CORRUPT_SAVE');
  if (value.schemaVersion !== GAME_STATE_SCHEMA_VERSION) return err('INCOMPATIBLE_SAVE');
  if (typeof value.contentVersion !== 'string') return err('CORRUPT_SAVE');
  if (value.contentVersion !== INITIAL_SCENARIO.contentVersion) return err('INCOMPATIBLE_SAVE');
  if (
    !hasExactKeys(value, [
      'schemaVersion',
      'contentVersion',
      'tick',
      'resources',
      'buildings',
      'nextEntityId',
      'events',
    ]) ||
    !isRecord(value.resources) ||
    !hasExactKeys(value.resources, ['food', 'water', 'materials', 'energy']) ||
    !Array.isArray(value.buildings) ||
    !Array.isArray(value.events)
  ) {
    return err('CORRUPT_SAVE');
  }

  const buildings: GameState['buildings'][number][] = [];
  for (const rawBuilding of value.buildings) {
    if (
      !isRecord(rawBuilding) ||
      !hasExactKeys(rawBuilding, ['instanceId', 'definitionId', 'position', 'rotation']) ||
      !isRecord(rawBuilding.position) ||
      !hasExactKeys(rawBuilding.position, ['x', 'y'])
    ) {
      return err('CORRUPT_SAVE');
    }
    buildings.push({
      instanceId: rawBuilding.instanceId as string,
      definitionId: rawBuilding.definitionId as GameState['buildings'][number]['definitionId'],
      position: { x: rawBuilding.position.x as number, y: rawBuilding.position.y as number },
      rotation: rawBuilding.rotation as GameState['buildings'][number]['rotation'],
    });
  }

  const events: GameState['events'][number][] = [];
  for (const rawEvent of value.events) {
    if (!isRecord(rawEvent) || typeof rawEvent.status !== 'string') {
      return err('CORRUPT_SAVE');
    }
    if (rawEvent.status === 'resolved') {
      if (
        !hasExactKeys(rawEvent, ['eventId', 'status', 'chosenOptionId', 'resolvedAtTick']) ||
        typeof rawEvent.chosenOptionId !== 'string'
      ) {
        return err('CORRUPT_SAVE');
      }
      events.push({
        eventId: rawEvent.eventId as GameState['events'][number]['eventId'],
        status: 'resolved',
        chosenOptionId: rawEvent.chosenOptionId,
        resolvedAtTick: rawEvent.resolvedAtTick as number,
      });
    } else {
      if (
        !['available', 'active', 'closed'].includes(rawEvent.status) ||
        !hasExactKeys(rawEvent, ['eventId', 'status'])
      ) {
        return err('CORRUPT_SAVE');
      }
      events.push({
        eventId: rawEvent.eventId as GameState['events'][number]['eventId'],
        status: rawEvent.status as Exclude<GameEventStatus, 'resolved'>,
      });
    }
  }

  const state = freezeDeep<GameState>({
    schemaVersion: value.schemaVersion,
    contentVersion: value.contentVersion,
    tick: value.tick as number,
    resources: {
      food: value.resources.food as number,
      water: value.resources.water as number,
      materials: value.resources.materials as number,
      energy: value.resources.energy as number,
    },
    buildings,
    nextEntityId: value.nextEntityId as number,
    events,
  });
  if (validateGameState(state).length > 0) return err('CORRUPT_SAVE');

  const placedBuildings: GameState['buildings'][number][] = [];
  let highestGeneratedId = 0;
  for (const building of state.buildings) {
    const placement = evaluatePlacementSpace(
      placedBuildings,
      building,
      INITIAL_PLACEMENT_TERRAIN,
      BUILDING_DEFINITIONS,
    );
    if (!placement.ok) return err('CORRUPT_SAVE');
    placedBuildings.push(building);

    const match = /^building-(\d+)$/.exec(building.instanceId);
    if (match) {
      const generatedId = Number(match[1]);
      if (!Number.isSafeInteger(generatedId) || String(generatedId) !== match[1]) {
        return err('CORRUPT_SAVE');
      }
      highestGeneratedId = Math.max(highestGeneratedId, generatedId);
    }
  }
  if (state.nextEntityId <= highestGeneratedId) return err('CORRUPT_SAVE');
  return ok(state);
}

/** Decodifica, valida o envelope e só então devolve um estado imutável pronto para aplicar. */
export function decodeGameSave(serializedSave: string): Result<GameState, SaveError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedSave) as unknown;
  } catch {
    return err('CORRUPT_SAVE');
  }
  if (
    !isRecord(parsed) ||
    !hasExactKeys(parsed, ['format', 'formatVersion', 'state']) ||
    parsed.format !== SAVE_FORMAT ||
    typeof parsed.formatVersion !== 'number'
  ) {
    return err('CORRUPT_SAVE');
  }
  if (parsed.formatVersion !== SAVE_FORMAT_VERSION) return err('INCOMPATIBLE_SAVE');
  return copySaveState(parsed.state);
}

export function encodeGameSave(state: GameState): string {
  const envelope: SaveEnvelope = {
    format: SAVE_FORMAT,
    formatVersion: SAVE_FORMAT_VERSION,
    state,
  };
  return JSON.stringify(envelope);
}

export async function saveGame(
  controller: GameStateReader,
  provider: SaveProvider,
): Promise<Result<GameState, SaveError>> {
  const snapshot = controller.getSnapshot();
  try {
    await provider.write(encodeGameSave(snapshot));
    return ok(snapshot);
  } catch {
    return err('STORAGE_ERROR');
  }
}

/** Só substitui o estado atual depois de ler, decodificar e validar o save inteiro. */
export async function loadGame(
  controller: Pick<GameController, 'replaceState'>,
  provider: SaveProvider,
): Promise<Result<GameState, SaveError>> {
  let serialized: string | null;
  try {
    serialized = await provider.read();
  } catch {
    return err('STORAGE_ERROR');
  }
  if (serialized === null) return err('NO_SAVE');

  const decoded = decodeGameSave(serialized);
  if (!decoded.ok) return decoded;
  const replaced = controller.replaceState(decoded.value);
  if (!replaced.ok) return err('INVALID_STATE');
  return decoded;
}
