import { describe, expect, it } from 'vitest';
import { decodeGameSave, encodeGameSave, loadGame } from '@/game/application/saveGame';
import { createGameController } from '@/game/application/GameController';
import { calculateNeeds, POPULATION_RULES } from '@/game/content/population';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { advanceSimulationStep } from '@/game/domain/simulation/advanceSimulationStep';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { calculateHousingCapacity } from '@/game/domain/population/housingCapacity';
import type { GameState } from '@/game/domain/state/GameState';
import type { SaveProvider } from '@/game/application/ports/SaveProvider';

const initial = () => createInitialGameState(INITIAL_SCENARIO);

describe('sobrevivência agregada', () => {
  it('inicia com 8 sobreviventes, sem progresso ou resultado anterior', () => {
    expect(initial().population).toEqual({
      survivors: 8,
      shortageTicks: 0,
      stableTicks: 0,
      outcome: 'ongoing',
    });
    expect(calculateNeeds(8)).toEqual({ food: 2, water: 2 });
  });

  it('desconta alimento e água uma única vez depois da economia', () => {
    const next = advanceSimulationStep(initial());
    expect(next.tick).toBe(1);
    expect(next.resources).toMatchObject({ food: 298, water: 302 });
    expect(next.population.stableTicks).toBe(1);
  });

  it('não avança consumo enquanto o relógio está pausado e retoma na velocidade selecionada', () => {
    const controller = createGameController(initial());
    controller.clock.setSpeed(2);
    controller.clock.advance(2_000);
    expect(controller.getSnapshot().tick).toBe(0);
    controller.clock.resume();
    controller.clock.advance(1_000);
    expect(controller.getSnapshot().tick).toBe(2);
    expect(controller.getSnapshot().resources.food).toBe(296);
  });

  it('consome estoques parciais sem ficar negativo e perde um sobrevivente após 60 ticks de falta', () => {
    const dry: GameState = {
      ...initial(),
      resources: { ...initial().resources, food: 1, water: 0 },
    };
    let state = advanceSimulationStep(dry);
    expect(state.resources.food).toBe(0);
    expect(state.resources.water).toBe(2);
    expect(state.population.shortageTicks).toBe(1);
    for (let tick = 1; tick < POPULATION_RULES.shortageTicksBeforeLoss; tick += 1) {
      state = advanceSimulationStep(state);
    }
    expect(state.population).toMatchObject({ survivors: 7, shortageTicks: 0, outcome: 'ongoing' });
    expect(state.resources.food).toBeGreaterThanOrEqual(0);
    expect(state.resources.water).toBeGreaterThanOrEqual(0);
  });

  it.each(['food', 'water'] as const)(
    'conta falta contínua de %s sem misturar demanda dos dois recursos',
    (resource) => {
      const state = initial();
      const starved: GameState = {
        ...state,
        buildings: [],
        resources: { ...state.resources, [resource]: 0 },
      };
      const next = advanceSimulationStep(starved);
      expect(next.population.shortageTicks).toBe(1);
      expect(next.population.survivors).toBe(8);
      expect(next.resources[resource]).toBe(0);
    },
  );

  it('deriva a capacidade do abrigo a partir dos edifícios atuais', () => {
    expect(calculateHousingCapacity(initial().buildings)).toBe(8);
    expect(calculateHousingCapacity([])).toBe(0);
  });

  it('mantém os eventos no mesmo estado e pausa ao concluir o objetivo de estabilidade', () => {
    const ready: GameState = {
      ...initial(),
      population: { ...initial().population, stableTicks: 899 },
    };
    const controller = createGameController(ready);
    controller.clock.resume();
    controller.clock.advance(1_000);
    expect(controller.getSnapshot().events[0]).toMatchObject({
      eventId: 'wreck-signal',
      status: 'available',
    });
    expect(controller.getSnapshot().population.outcome).toBe('victory');
    expect(controller.clock.getSnapshot().paused).toBe(true);
  });

  it('ativa o evento narrativo no tick previsto sem aplicar seus efeitos duas vezes', () => {
    let state = initial();
    for (let tick = 0; tick < 60; tick += 1) state = advanceSimulationStep(state);
    expect(state.events[0]).toMatchObject({ eventId: 'wreck-signal', status: 'active' });
    expect(state.population.stableTicks).toBe(60);
  });

  it('encerra e pausa a partida quando a escassez elimina os sobreviventes', () => {
    const state = {
      ...initial(),
      buildings: [],
      resources: { ...initial().resources, food: 0, water: 0 },
    };
    const controller = createGameController(state);
    controller.clock.resume();
    for (let tick = 0; tick < 480; tick += 1) controller.clock.advance(1_000);
    expect(controller.getSnapshot().population).toMatchObject({ survivors: 0, outcome: 'defeat' });
    expect(controller.clock.getSnapshot().paused).toBe(true);
  });

  it('migra save v1 sem reaplicar tick, consumo ou evento ao carregar', async () => {
    let progressed = initial();
    for (let tick = 0; tick < 60; tick += 1) progressed = advanceSimulationStep(progressed);
    progressed = {
      ...progressed,
      events: progressed.events.map((event) =>
        event.eventId === 'wreck-signal'
          ? {
              eventId: 'wreck-signal',
              status: 'resolved',
              chosenOptionId: 'answer-signal',
              resolvedAtTick: 60,
            }
          : event,
      ),
    };
    const current = JSON.parse(encodeGameSave(progressed)) as {
      format: string;
      formatVersion: number;
      state: Record<string, unknown>;
    };
    const legacyState: Record<string, unknown> = { ...current.state };
    delete legacyState.population;
    delete legacyState.characters;
    delete legacyState.government;
    delete legacyState.relationships;
    delete legacyState.research;
    delete legacyState.exploration;
    delete legacyState.diplomacy;
    delete legacyState.military;
    legacyState.events = (legacyState.events as Array<{ eventId: string }>).filter(
      (event) => event.eventId === 'wreck-signal',
    );
    const legacy = JSON.stringify({
      ...current,
      state: { ...legacyState, schemaVersion: 1, contentVersion: '0.4.0' },
    });
    const decoded = decodeGameSave(legacy);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value).toMatchObject({
      schemaVersion: 6,
      contentVersion: '0.9.0',
      tick: progressed.tick,
      resources: progressed.resources,
      buildings: progressed.buildings,
      events: expect.arrayContaining([...progressed.events]),
      population: { survivors: 8, shortageTicks: 0, stableTicks: 0, outcome: 'ongoing' },
      characters: expect.any(Array),
      government: { leaderId: 'colonist-aru' },
    });
    expect(decoded.value.characters).toHaveLength(4);

    let stored = legacy;
    const provider: SaveProvider = {
      read: async () => stored,
      write: async (value) => {
        stored = value;
      },
    };
    const controller = createGameController(initial());
    expect((await loadGame(controller, provider)).ok).toBe(true);
    expect(controller.getSnapshot().resources).toEqual(progressed.resources);
    expect(controller.getSnapshot().tick).toBe(progressed.tick);
  });

  it('migra save v2 da Fase 9 preservando a população e acrescentando elenco uma única vez', () => {
    const current = JSON.parse(encodeGameSave(initial())) as { state: Record<string, unknown> };
    const progressedPopulation = {
      survivors: 7,
      shortageTicks: 4,
      stableTicks: 12,
      outcome: 'ongoing',
    };
    const legacyState: Record<string, unknown> = {
      ...current.state,
      schemaVersion: 2,
      contentVersion: '0.5.0',
      tick: 45,
      population: progressedPopulation,
    };
    delete legacyState.characters;
    delete legacyState.government;
    delete legacyState.relationships;
    delete legacyState.research;
    delete legacyState.exploration;
    delete legacyState.diplomacy;
    delete legacyState.military;
    legacyState.events = (legacyState.events as Array<{ eventId: string }>).filter(
      (event) => event.eventId === 'wreck-signal',
    );
    const migrated = decodeGameSave(
      JSON.stringify({ format: 'alien-civilization-save', formatVersion: 1, state: legacyState }),
    );
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.schemaVersion).toBe(6);
    expect(migrated.value.characters).toHaveLength(4);
    expect(migrated.value).toMatchObject({ tick: 45, population: progressedPopulation });
    expect(decodeGameSave(encodeGameSave(migrated.value))).toMatchObject({
      ok: true,
      value: { characters: migrated.value.characters },
    });
  });
});
