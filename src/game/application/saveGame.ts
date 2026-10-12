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
import {
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
  migrateV4ToV5,
  migrateV5ToV6,
} from './saveMigrations';
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
  if (value.schemaVersion === 1) {
    if (value.contentVersion !== '0.4.0') return err('INCOMPATIBLE_SAVE');
    if (
      !hasExactKeys(value, [
        'schemaVersion',
        'contentVersion',
        'tick',
        'resources',
        'buildings',
        'nextEntityId',
        'events',
      ])
    )
      return err('CORRUPT_SAVE');
    if (!Array.isArray(value.events) || !value.events.every(isRecord)) return err('CORRUPT_SAVE');
    return copySaveState(migrateV1ToV2(value as unknown as Parameters<typeof migrateV1ToV2>[0]));
  }
  if (value.schemaVersion === 2) {
    if (value.contentVersion !== '0.5.0') return err('INCOMPATIBLE_SAVE');
    if (
      !hasExactKeys(value, [
        'schemaVersion',
        'contentVersion',
        'tick',
        'resources',
        'buildings',
        'nextEntityId',
        'events',
        'population',
      ])
    )
      return err('CORRUPT_SAVE');
    if (!Array.isArray(value.events) || !value.events.every(isRecord)) return err('CORRUPT_SAVE');
    return copySaveState(migrateV2ToV3(value as unknown as Parameters<typeof migrateV2ToV3>[0]));
  }
  if (value.schemaVersion === 3) {
    if (value.contentVersion !== '0.6.0') return err('INCOMPATIBLE_SAVE');
    if (
      !hasExactKeys(value, [
        'schemaVersion',
        'contentVersion',
        'tick',
        'resources',
        'buildings',
        'nextEntityId',
        'events',
        'population',
        'characters',
        'government',
        'relationships',
      ])
    )
      return err('CORRUPT_SAVE');
    if (!Array.isArray(value.events) || !value.events.every(isRecord)) return err('CORRUPT_SAVE');
    return copySaveState(migrateV3ToV4(value as unknown as Parameters<typeof migrateV3ToV4>[0]));
  }
  if (value.schemaVersion === 4) {
    if (value.contentVersion !== '0.7.0') return err('INCOMPATIBLE_SAVE');
    if (
      !hasExactKeys(value, [
        'schemaVersion',
        'contentVersion',
        'tick',
        'resources',
        'buildings',
        'nextEntityId',
        'events',
        'population',
        'characters',
        'government',
        'relationships',
        'research',
        'exploration',
      ])
    )
      return err('CORRUPT_SAVE');
    if (
      !Array.isArray(value.events) ||
      !value.events.every(isRecord) ||
      !isRecord(value.exploration) ||
      !hasExactKeys(value.exploration, ['discoveredPointIds']) ||
      !Array.isArray(value.exploration.discoveredPointIds)
    )
      return err('CORRUPT_SAVE');
    return copySaveState(migrateV4ToV5(value as unknown as Parameters<typeof migrateV4ToV5>[0]));
  }
  if (value.schemaVersion === 5) {
    if (value.contentVersion !== '0.8.0') return err('INCOMPATIBLE_SAVE');
    if (
      !hasExactKeys(value, [
        'schemaVersion',
        'contentVersion',
        'tick',
        'resources',
        'buildings',
        'nextEntityId',
        'events',
        'population',
        'characters',
        'government',
        'relationships',
        'research',
        'exploration',
        'diplomacy',
      ])
    )
      return err('CORRUPT_SAVE');
    if (
      !Array.isArray(value.events) ||
      !value.events.every(isRecord) ||
      !isRecord(value.diplomacy) ||
      !hasExactKeys(value.diplomacy, ['civilizations']) ||
      !Array.isArray(value.diplomacy.civilizations)
    )
      return err('CORRUPT_SAVE');
    return copySaveState(migrateV5ToV6(value as unknown as Parameters<typeof migrateV5ToV6>[0]));
  }
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
      'population',
      'characters',
      'government',
      'relationships',
      'research',
      'exploration',
      'diplomacy',
      'military',
    ]) ||
    !isRecord(value.resources) ||
    !hasExactKeys(value.resources, ['food', 'water', 'materials', 'energy']) ||
    !Array.isArray(value.buildings) ||
    !Array.isArray(value.events) ||
    !isRecord(value.population) ||
    !hasExactKeys(value.population, ['survivors', 'shortageTicks', 'stableTicks', 'outcome']) ||
    !Array.isArray(value.characters) ||
    !isRecord(value.government) ||
    !hasExactKeys(value.government, ['leaderId', 'offices']) ||
    !isRecord(value.government.offices) ||
    !hasExactKeys(value.government.offices, ['science', 'engineering', 'production']) ||
    !Array.isArray(value.relationships) ||
    !isRecord(value.research) ||
    !hasExactKeys(value.research, ['unlockedTechnologyIds', 'activeTechnologyId', 'progress']) ||
    !Array.isArray(value.research.unlockedTechnologyIds) ||
    !isRecord(value.exploration) ||
    !hasExactKeys(value.exploration, ['discoveredPointIds']) ||
    !Array.isArray(value.exploration.discoveredPointIds) ||
    !isRecord(value.diplomacy) ||
    !hasExactKeys(value.diplomacy, ['civilizations']) ||
    !Array.isArray(value.diplomacy.civilizations) ||
    !isRecord(value.military) ||
    !hasExactKeys(value.military, ['nextUnitId', 'units', 'battle', 'history']) ||
    !Array.isArray(value.military.units) ||
    !Array.isArray(value.military.history)
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
    population: {
      survivors: value.population.survivors as number,
      shortageTicks: value.population.shortageTicks as number,
      stableTicks: value.population.stableTicks as number,
      outcome: value.population.outcome as GameState['population']['outcome'],
    },
    characters: value.characters as GameState['characters'],
    government: value.government as unknown as GameState['government'],
    relationships: value.relationships as GameState['relationships'],
    research: value.research as unknown as GameState['research'],
    exploration: value.exploration as unknown as GameState['exploration'],
    diplomacy: value.diplomacy as unknown as GameState['diplomacy'],
    military: value.military as unknown as GameState['military'],
  });
  const stateIssues = validateGameState(state);
  if (stateIssues.length > 0) return err('CORRUPT_SAVE');

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
