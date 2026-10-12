import { describe, expect, it } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { decodeGameSave, encodeGameSave, loadGame, saveGame } from '@/game/application/saveGame';
import { toWorldSnapshot } from '@/app/worldSnapshot';
import type { SaveProvider } from '@/game/application/ports/SaveProvider';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { resolveEventCommand } from '@/game/domain/events/resolveEventCommand';
import {
  executeSimulationCommand,
  type SimulationCommand,
} from '@/game/domain/commands/simulationCommand';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';

function memoryProvider(initial: string | null = null): SaveProvider & {
  getValue(): string | null;
  failRead: boolean;
  failWrite: boolean;
} {
  let value = initial;
  return {
    failRead: false,
    failWrite: false,
    getValue: () => value,
    async read() {
      if (this.failRead) throw new Error('read failed');
      return value;
    },
    async write(serialized: string) {
      if (this.failWrite) throw new Error('write failed');
      value = serialized;
    },
  };
}

function evolvedState(): GameState {
  const initial = createInitialGameState(INITIAL_SCENARIO);
  const built = executeSimulationCommand(initial, {
    type: 'PlaceBuilding',
    definitionId: 'solar-array',
    position: { x: 24, y: 13 },
    rotation: 90,
  } as SimulationCommand);
  if (!built.ok) throw new Error(built.error);

  const active: GameState = {
    ...built.value,
    tick: 72,
    events: built.value.events.map((event) =>
      event.eventId === 'wreck-signal' ? { ...event, status: 'active' as const } : event,
    ),
  };
  const controller = createGameController(active);
  const resolved = controller.submitCommand(resolveEventCommand('wreck-signal', 'answer-signal'));
  if (!resolved.ok) throw new Error(resolved.error);
  return controller.getSnapshot();
}

describe('save versionado', () => {
  it('salva e carrega recursos, edifícios, tick e decisão de evento', async () => {
    const savedState = evolvedState();
    const source = createGameController(savedState);
    const provider = memoryProvider();
    const target = createGameController(createInitialGameState(INITIAL_SCENARIO));
    target.clock.setSpeed(4);
    target.clock.resume();

    expect((await saveGame(source, provider)).ok).toBe(true);
    const result = await loadGame(target, provider);

    expect(result).toEqual({ ok: true, value: savedState });
    expect(target.getSnapshot()).toEqual(savedState);
    expect(target.getSnapshot().buildings.at(-1)).toMatchObject({
      instanceId: 'building-1',
      position: { x: 24, y: 13 },
      rotation: 90,
    });
    expect(toWorldSnapshot(target.getSnapshot(), INITIAL_SCENARIO).buildings.at(-1)).toMatchObject({
      instanceId: 'building-1',
      definitionId: 'solar-array',
      position: { x: 24, y: 13 },
      rotation: 90,
    });
    expect(target.getSnapshot().tick).toBe(72);
    expect(target.getSnapshot().events[0]).toMatchObject({
      status: 'resolved',
      chosenOptionId: 'answer-signal',
      resolvedAtTick: 72,
    });
    expect(target.clock.getSnapshot()).toEqual({ paused: true, speed: 1 });
  });

  it('não repete decisões após carregar e mantém o evento resolvido', async () => {
    const state = evolvedState();
    const controller = createGameController(createInitialGameState(INITIAL_SCENARIO));
    expect((await loadGame(controller, memoryProvider(encodeGameSave(state)))).ok).toBe(true);
    const before = controller.getSnapshot();

    expect(controller.submitCommand(resolveEventCommand('wreck-signal', 'answer-signal'))).toEqual({
      ok: false,
      error: 'EVENT_NOT_ACTIVE',
    });
    expect(controller.getSnapshot().resources).toEqual(before.resources);
    for (let step = 0; step < 8; step += 1) {
      controller.clock.resume();
      controller.clock.advance(10_000);
      controller.clock.pause();
    }
    expect(controller.getSnapshot().events[0]).toMatchObject({
      status: 'resolved',
      chosenOptionId: 'answer-signal',
    });
  });

  it('rejeita JSON corrompido, campos extras e chaves perigosas', () => {
    const envelope = JSON.parse(encodeGameSave(createInitialGameState(INITIAL_SCENARIO))) as {
      state: Record<string, unknown>;
    };
    const malformed = JSON.stringify({
      ...envelope,
      state: { ...envelope.state, resources: null },
    });
    const extraKey = JSON.stringify({
      ...envelope,
      state: { ...envelope.state, unexpected: true },
    });
    const dangerousResource = JSON.stringify({
      ...envelope,
      state: {
        ...envelope.state,
        resources: JSON.parse(
          '{"food":300,"water":300,"materials":150,"energy":100,"__proto__":{"polluted":true}}',
        ),
      },
    });

    expect(decodeGameSave('{')).toEqual({ ok: false, error: 'CORRUPT_SAVE' });
    expect(decodeGameSave(malformed)).toEqual({ ok: false, error: 'CORRUPT_SAVE' });
    expect(decodeGameSave(extraKey)).toEqual({ ok: false, error: 'CORRUPT_SAVE' });
    expect(decodeGameSave(dangerousResource)).toEqual({ ok: false, error: 'CORRUPT_SAVE' });
  });

  it('rejeita esquema, conteúdo e formato incompatíveis', () => {
    const envelope = JSON.parse(encodeGameSave(createInitialGameState(INITIAL_SCENARIO))) as {
      formatVersion: number;
      state: Record<string, unknown>;
    };

    expect(decodeGameSave(JSON.stringify({ ...envelope, formatVersion: 99 }))).toEqual({
      ok: false,
      error: 'INCOMPATIBLE_SAVE',
    });
    expect(
      decodeGameSave(
        JSON.stringify({ ...envelope, state: { ...envelope.state, schemaVersion: 99 } }),
      ),
    ).toEqual({ ok: false, error: 'INCOMPATIBLE_SAVE' });
    expect(
      decodeGameSave(
        JSON.stringify({
          ...envelope,
          state: { ...envelope.state, contentVersion: 'unknown-content' },
        }),
      ),
    ).toEqual({ ok: false, error: 'INCOMPATIBLE_SAVE' });
  });

  it('rejeita posicionamento e dados de evento inconsistentes', () => {
    const envelope = JSON.parse(encodeGameSave(evolvedState())) as {
      state: Record<string, unknown>;
    };
    const buildings = envelope.state.buildings as Record<string, unknown>[];
    const events = envelope.state.events as Record<string, unknown>[];

    const invalidPosition = JSON.stringify({
      ...envelope,
      state: {
        ...envelope.state,
        buildings: buildings.map((building) => ({
          ...building,
          position: { x: 13, y: 13 },
        })),
      },
    });
    const invalidEvent = JSON.stringify({
      ...envelope,
      state: {
        ...envelope.state,
        events: events.map((event) => ({ ...event, resolvedAtTick: 99 })),
      },
    });
    const invalidCounter = JSON.stringify({
      ...envelope,
      state: {
        ...envelope.state,
        nextEntityId: 1,
        buildings: [...buildings, { ...buildings.at(-1), instanceId: 'building-2' }],
      },
    });

    expect(decodeGameSave(invalidPosition).ok).toBe(false);
    expect(decodeGameSave(invalidEvent).ok).toBe(false);
    expect(decodeGameSave(invalidCounter).ok).toBe(false);
  });

  it('save ausente e erros de armazenamento preservam o estado atual', async () => {
    const controller = createGameController(evolvedState());
    const before = controller.getSnapshot();
    const missing = await loadGame(controller, memoryProvider());
    const failedRead = memoryProvider();
    failedRead.failRead = true;
    const readFailure = await loadGame(controller, failedRead);
    const failedWrite = memoryProvider();
    failedWrite.failWrite = true;
    const writeFailure = await saveGame(controller, failedWrite);

    expect(missing).toEqual({ ok: false, error: 'NO_SAVE' });
    expect(readFailure).toEqual({ ok: false, error: 'STORAGE_ERROR' });
    expect(writeFailure).toEqual({ ok: false, error: 'STORAGE_ERROR' });
    expect(controller.getSnapshot()).toBe(before);
  });

  it('uma carga inválida não altera estado nem relógio em andamento', async () => {
    const controller = createGameController(createInitialGameState(INITIAL_SCENARIO));
    controller.clock.resume();
    controller.clock.setSpeed(2);
    const stateBefore = controller.getSnapshot();
    const clockBefore = controller.clock.getSnapshot();

    expect(await loadGame(controller, memoryProvider('{corrupt'))).toEqual({
      ok: false,
      error: 'CORRUPT_SAVE',
    });
    expect(controller.getSnapshot()).toBe(stateBefore);
    expect(controller.clock.getSnapshot()).toEqual(clockBefore);
  });

  it('usa o snapshot imutável do instante em que salvar foi solicitado', async () => {
    const controller = createGameController(evolvedState());
    let finishWrite: (() => void) | undefined;
    let serialized = '';
    const provider: SaveProvider = {
      read: async () => serialized,
      write: async (value) => {
        serialized = value;
        await new Promise<void>((resolve) => {
          finishWrite = resolve;
        });
      },
    };
    const request = saveGame(controller, provider);
    const snapshotAtRequest = controller.getSnapshot();
    controller.clock.resume();
    controller.clock.advance(1_000);
    finishWrite?.();

    expect(await request).toEqual({ ok: true, value: snapshotAtRequest });
    expect(decodeGameSave(serialized)).toEqual({ ok: true, value: snapshotAtRequest });
  });
});
