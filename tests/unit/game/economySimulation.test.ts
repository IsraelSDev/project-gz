import { describe, expect, it, vi } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { startClockDriver } from '@/game/application/time/startClockDriver';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { advanceSimulationStep } from '@/game/domain/simulation/advanceSimulationStep';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';
import { validateGameState } from '@/game/domain/state/validateGameState';
import { expectedResourcesAfter } from '../../support/economyExpectations';
import { createFakeTimeEnvironment } from '../../support/fakeTimeEnvironment';
import { executeTestCommand, setMaterials } from '../../support/testCommands';

/*
 * A economia ligada aos ticks e ao relógio (Fase 5). Sem DOM, Babylon.js nem esperas reais: o tempo
 * real é o número passado a `clock.advance` ou o ambiente de tempo falso. A economia só existe dentro
 * do passo de simulação, então tudo o que vale para o tick vale para ela.
 */

const STEP_MS = 1000;
const initialState = () => createInitialGameState(INITIAL_SCENARIO);
const start = () => INITIAL_SCENARIO.initialResources;

function setup(options: { maxStepsPerAdvance?: number } = {}) {
  return createGameController(initialState(), { executeCommand: executeTestCommand, ...options });
}

function running(options: Parameters<typeof setup>[0] = {}) {
  const controller = setup(options);
  controller.clock.resume();
  return controller;
}

describe('passo de simulação: ordem tick → comandos → economia (Arquitetura §6.5)', () => {
  it('os comandos recebem o estado JÁ com o tick novo e ANTES da economia', () => {
    const seen: { tick: number; energy: number }[] = [];

    const next = advanceSimulationStep(initialState(), (state) => {
      seen.push({ tick: state.tick, energy: state.resources.energy });
      return state;
    });

    // A fase de comandos vê o tick incrementado e os estoques ainda sem a produção do passo.
    expect(seen).toEqual([{ tick: 1, energy: start().energy }]);
    expect(next.tick).toBe(1);
    expect(next.resources.energy).toBe(expectedResourcesAfter(1).energy);
  });

  it('a economia vê o resultado dos comandos do mesmo passo', () => {
    // O comando zera a energia: no mesmo passo, os consumidores ficam parados (sem estoque no início
    // do passo) e só a matriz solar produz. Prova que a economia roda DEPOIS dos comandos.
    const drainEnergy = (state: GameState): GameState => ({
      ...state,
      resources: { ...state.resources, energy: 0 },
    });

    const next = advanceSimulationStep(initialState(), drainEnergy);

    expect(next.resources.energy).toBeGreaterThan(0);
    expect(next.resources.water).toBe(start().water - 2);
    expect(validateGameState(next)).toEqual([]);
  });

  it('sem fase de comandos, só o tick e a economia atuam', () => {
    const next = advanceSimulationStep(initialState());

    expect(next.tick).toBe(1);
    expect(next.resources).toEqual(expectedResourcesAfter(1));
  });
});

describe('economia e relógio: pausa', () => {
  it('pausado, o tempo real passa e nenhum recurso muda (nem o snapshot é refeito)', () => {
    const controller = setup();
    const before = controller.getSnapshot();
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.clock.advance(60 * STEP_MS);

    expect(controller.getSnapshot()).toBe(before);
    expect(controller.getSnapshot().resources).toEqual(start());
    expect(listener).not.toHaveBeenCalled();
  });

  it('um comando aplicado com o jogo pausado não executa produção nem consumo', () => {
    const controller = setup();

    expect(controller.submitCommand(setMaterials(40))).toEqual({ ok: true, value: 'applied' });

    const { resources, tick } = controller.getSnapshot();
    expect(tick).toBe(0);
    expect(resources).toEqual({ ...start(), materials: 40 });
  });

  it('pausar interrompe a evolução e retomar continua de onde parou, sem perder nem repetir passos', () => {
    const controller = running();
    controller.clock.advance(3 * STEP_MS);
    const atPause = controller.getSnapshot();

    controller.clock.pause();
    controller.clock.advance(10 * STEP_MS);
    expect(controller.getSnapshot()).toBe(atPause);

    controller.clock.resume();
    controller.clock.advance(2 * STEP_MS);

    expect(controller.getSnapshot().tick).toBe(5);
    expect(controller.getSnapshot().resources).toEqual(expectedResourcesAfter(5));
  });

  it('pausar aplica o que estava na fila na hora, sem rodar a economia', () => {
    const controller = running();
    controller.clock.advance(STEP_MS);
    controller.submitCommand(setMaterials(77));

    controller.clock.pause();

    const { resources, tick } = controller.getSnapshot();
    expect(tick).toBe(1);
    expect(resources).toEqual({ ...expectedResourcesAfter(1), materials: 77 });
  });
});

describe('economia e relógio: ticks e velocidade', () => {
  it.each([1, 2, 5, 10])(
    'depois de %i passos os estoques são os previstos pelas definições',
    (ticks) => {
      const controller = running();

      controller.clock.advance(ticks * STEP_MS);

      expect(controller.getSnapshot().tick).toBe(ticks);
      expect(controller.getSnapshot().resources).toEqual(expectedResourcesAfter(ticks));
    },
  );

  it('cada passo publica um snapshot com a economia aplicada; as construções não mudam', () => {
    const controller = running();
    const buildings = controller.getSnapshot().buildings;
    const waterByTick: number[] = [];
    controller.subscribe(() => waterByTick.push(controller.getSnapshot().resources.water));

    controller.clock.advance(3 * STEP_MS);

    expect(waterByTick).toEqual([1, 2, 3].map((tick) => expectedResourcesAfter(tick).water));
    expect(controller.getSnapshot().buildings).toBe(buildings);
  });

  it('a velocidade multiplica os passos por segundo real, não a quantidade por passo', () => {
    const afterFourSeconds = (speed: number) => {
      const controller = running();
      controller.clock.setSpeed(speed);
      for (let second = 0; second < 4; second += 1) {
        controller.clock.advance(STEP_MS);
      }
      return controller.getSnapshot();
    };

    for (const speed of [1, 2, 4]) {
      const snapshot = afterFourSeconds(speed);

      expect(snapshot.tick).toBe(4 * speed);
      expect(snapshot.resources).toEqual(expectedResourcesAfter(4 * speed));
    }
  });

  it('trocar a velocidade no meio não perde nem duplica passos', () => {
    const controller = running();
    controller.clock.advance(2 * STEP_MS);
    controller.clock.setSpeed(4);
    controller.clock.advance(STEP_MS);
    controller.clock.setSpeed(2);
    controller.clock.advance(STEP_MS);

    // 2 + 4 + 2 passos.
    expect(controller.getSnapshot().tick).toBe(8);
    expect(controller.getSnapshot().resources).toEqual(expectedResourcesAfter(8));
  });

  it('não depende do FPS: o mesmo tempo total dá exatamente os mesmos recursos com qualquer número de quadros', () => {
    const finalStates = [1, 5, 25, 100, 500].map((frames) => {
      const controller = running();
      for (let frame = 0; frame < frames; frame += 1) {
        controller.clock.advance(8_000 / frames);
      }
      return JSON.stringify(controller.getSnapshot());
    });

    expect(new Set(finalStates).size).toBe(1);
    expect(JSON.parse(finalStates[0] ?? '{}').resources).toEqual(expectedResourcesAfter(8));
  });

  it('é determinística: a mesma partida duas vezes dá o mesmo estado', () => {
    const play = () => {
      const controller = running();
      controller.clock.setSpeed(2);
      for (let frame = 0; frame < 60; frame += 1) {
        controller.clock.advance(137);
      }
      return JSON.stringify(controller.getSnapshot());
    };

    expect(play()).toBe(play());
  });

  it('o teto de recuperação também limita a economia: um quadro gigante rende só o máximo de passos', () => {
    const controller = running({ maxStepsPerAdvance: 3 });

    controller.clock.advance(60 * 60 * 1000);

    expect(controller.getSnapshot().tick).toBe(3);
    expect(controller.getSnapshot().resources).toEqual(expectedResourcesAfter(3));
  });

  it('os comandos da fila entram antes da economia do mesmo passo', () => {
    const controller = running();
    controller.submitCommand(setMaterials(500));

    controller.clock.advance(STEP_MS);

    const { resources } = controller.getSnapshot();
    expect(resources.materials).toBe(500);
    expect(resources.water).toBe(expectedResourcesAfter(1).water);
  });
});

describe('economia e aba em segundo plano', () => {
  it('com a aba oculta a economia para; ao voltar continua parada até o jogador retomar', () => {
    const env = createFakeTimeEnvironment();
    const controller = createGameController(initialState());
    const stop = startClockDriver(controller.clock, env);

    controller.clock.resume();
    env.frame(STEP_MS);
    expect(controller.getSnapshot().resources).toEqual(expectedResourcesAfter(1));

    env.setHidden(true);
    env.elapse(60 * 60 * 1000);
    env.frame(STEP_MS);
    env.setHidden(false);
    env.frame(5 * STEP_MS);

    expect(controller.clock.getSnapshot().paused).toBe(true);
    expect(controller.getSnapshot().resources).toEqual(expectedResourcesAfter(1));

    controller.clock.resume();
    env.frame(STEP_MS);
    expect(controller.getSnapshot().resources).toEqual(expectedResourcesAfter(2));
    stop();
  });
});
