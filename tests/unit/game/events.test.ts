import { describe, expect, it } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { EVENT_DEFINITIONS } from '@/game/content/events';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { resolveEventCommand } from '@/game/domain/events/resolveEventCommand';
import { advanceSimulationStep } from '@/game/domain/simulation/advanceSimulationStep';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';
import { validateGameState } from '@/game/domain/state/validateGameState';

const INITIAL = () => createInitialGameState(INITIAL_SCENARIO);
const noBuildings = (state = INITIAL()): GameState => ({ ...state, buildings: [] });
const activeState = (state = noBuildings()): GameState => ({
  ...state,
  events: state.events.map((event) =>
    event.eventId === 'wreck-signal' ? { ...event, status: 'active' as const } : event,
  ),
});
const advance = (state: GameState, count: number): GameState => {
  let current = state;
  for (let step = 0; step < count; step += 1) current = advanceSimulationStep(current);
  return current;
};

describe('eventos narrativos', () => {
  it('ativa o evento no tick definido quando a condição é atendida', () => {
    const next = advance(noBuildings(), 60);

    expect(next.tick).toBe(60);
    expect(next.events.find((event) => event.eventId === 'wreck-signal')?.status).toBe('active');
  });

  it('não ativa antes do tick mínimo', () => {
    const next = advance(noBuildings(), 59);

    expect(next.events.find((event) => event.eventId === 'wreck-signal')?.status).toBe('available');
  });

  it('não ativa novamente depois de resolvido', () => {
    const controller = createGameController(activeState());
    controller.submitCommand(resolveEventCommand('wreck-signal', 'answer-signal'));

    const next = advance(controller.getSnapshot(), 100);

    expect(next.events.find((event) => event.eventId === 'wreck-signal')).toMatchObject({
      status: 'resolved',
      chosenOptionId: 'answer-signal',
    });
  });

  it('a pausa impede o tick e o disparo; retomado, o próximo passo pode ativar', () => {
    const state = noBuildings({ ...INITIAL(), tick: 59 });
    const controller = createGameController(state);

    controller.clock.advance(120_000);
    expect(controller.getSnapshot().tick).toBe(59);
    expect(controller.getSnapshot().events[0]?.status).toBe('available');

    controller.clock.resume();
    controller.clock.advance(1_000);
    expect(controller.getSnapshot().tick).toBe(60);
    expect(controller.getSnapshot().events[0]?.status).toBe('active');
  });

  it('aplica exatamente o custo e o efeito da escolha', () => {
    const state = activeState();
    const before = state.resources;
    const controller = createGameController(state);
    const option = EVENT_DEFINITIONS['wreck-signal'].options[0]!;

    expect(controller.submitCommand(resolveEventCommand('wreck-signal', option.id))).toEqual({
      ok: true,
      value: 'applied',
    });
    expect(controller.getSnapshot().resources).toEqual({
      ...before,
      energy: before.energy - 4,
      materials: before.materials + 8,
    });
  });

  it('a alternativa também cobra materiais e concede a energia descrita', () => {
    const state = activeState();
    const before = state.resources;
    const controller = createGameController(state);

    expect(
      controller.submitCommand(resolveEventCommand('wreck-signal', 'salvage-transmitter')).ok,
    ).toBe(true);
    expect(controller.getSnapshot().resources).toEqual({
      ...before,
      materials: before.materials - 2,
      energy: before.energy + 6,
    });
  });

  it('recusa escolha desconhecida sem alterar recursos nem estado', () => {
    const controller = createGameController(activeState());
    const before = controller.getSnapshot();

    expect(controller.submitCommand(resolveEventCommand('wreck-signal', 'invalid-option'))).toEqual(
      {
        ok: false,
        error: 'INVALID_COMMAND',
      },
    );
    expect(controller.getSnapshot()).toBe(before);
  });

  it('recusa recursos insuficientes sem deixar estoque negativo ou mudar o estado', () => {
    const state = activeState();
    const controller = createGameController({
      ...state,
      resources: { ...state.resources, energy: 0 },
    });
    const before = controller.getSnapshot();

    expect(controller.submitCommand(resolveEventCommand('wreck-signal', 'answer-signal'))).toEqual({
      ok: false,
      error: 'INSUFFICIENT_RESOURCES',
    });
    expect(controller.getSnapshot()).toBe(before);
    expect(controller.getSnapshot().resources.energy).toBe(0);
  });

  it('não permite resolver duas vezes o mesmo evento', () => {
    const controller = createGameController(activeState());
    const first = controller.submitCommand(resolveEventCommand('wreck-signal', 'answer-signal'));
    const second = controller.submitCommand(
      resolveEventCommand('wreck-signal', 'salvage-transmitter'),
    );

    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, error: 'EVENT_NOT_ACTIVE' });
    expect(controller.getSnapshot().events[0]?.chosenOptionId).toBe('answer-signal');
  });

  it('revalida decisões enfileiradas e só aplica uma resolução', () => {
    const controller = createGameController(activeState());
    controller.clock.resume();
    const first = controller.submitCommand(resolveEventCommand('wreck-signal', 'answer-signal'));
    const second = controller.submitCommand(
      resolveEventCommand('wreck-signal', 'salvage-transmitter'),
    );
    controller.clock.advance(1_000);

    expect(first).toEqual({ ok: true, value: 'queued' });
    expect(second).toEqual({ ok: true, value: 'queued' });
    expect(controller.getCommandLog().filter((entry) => entry.outcome === 'rejected')).toHaveLength(
      1,
    );
    expect(controller.getSnapshot().events[0]?.chosenOptionId).toBe('answer-signal');
  });

  it('produz o mesmo resultado para o mesmo estado e os mesmos passos', () => {
    const run = () => JSON.stringify(advance(noBuildings(), 80));

    expect(run()).toBe(run());
  });

  it('mantém um registro de resolução válido e imutável', () => {
    const controller = createGameController(activeState());
    controller.submitCommand(resolveEventCommand('wreck-signal', 'answer-signal'));
    const resolved = controller.getSnapshot();

    expect(validateGameState(resolved)).toEqual([]);
    expect(resolved.events[0]).toMatchObject({ status: 'resolved', resolvedAtTick: 0 });
    expect(Object.isFrozen(resolved.events[0])).toBe(true);
  });
});
