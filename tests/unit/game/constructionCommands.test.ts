import { describe, expect, it, vi } from 'vitest';
import {
  createGameController,
  type GameController,
  type RejectedCommand,
} from '@/game/application/GameController';
import { placeBuilding } from '@/game/application/constructionUseCases';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { expectedResourcesAfter } from '../../support/economyExpectations';

/*
 * O comando de construção com o relógio e a fila (Arquitetura §7.2): com o jogo PAUSADO o comando
 * válido é aplicado na hora, sem avançar o tick nem rodar a economia; EM ANDAMENTO ele entra na fila,
 * é aplicado no início do próximo passo (depois do tick e antes da economia) e REVALIDADO ali.
 * Sem DOM, Babylon.js nem esperas reais: o tempo é o número passado a `clock.advance`.
 */

const STEP_MS = 1000;
const START = INITIAL_SCENARIO.initialResources;

// Posições livres do cenário inicial (ver placeBuildingCommand.test.ts).
const SPOT_A = { x: 24, y: 13 };
const SPOT_B = { x: 12, y: 24 };
const SPOT_C = { x: 24, y: 16 };

const solar = (position: { x: number; y: number }) =>
  ({ definitionId: 'solar-array', position, rotation: 0 }) as const;
const habitat = (position: { x: number; y: number }) =>
  ({ definitionId: 'habitat-module', position, rotation: 0 }) as const;

const create = () => createGameController(createInitialGameState(INITIAL_SCENARIO));
const running = () => {
  const controller = create();
  controller.clock.resume();
  return controller;
};
const buildingCount = (controller: GameController) => controller.getSnapshot().buildings.length;
const INITIAL_COUNT = INITIAL_SCENARIO.initialBuildings.length;

describe('construção com o jogo PAUSADO', () => {
  it('é aplicada na hora, sem avançar o tick e sem rodar a economia', () => {
    const controller = create();

    const result = placeBuilding(controller, solar(SPOT_A));

    expect(result).toEqual({ ok: true, value: 'applied' });
    const state = controller.getSnapshot();
    expect(state.tick).toBe(0);
    expect(state.buildings).toHaveLength(INITIAL_COUNT + 1);
    expect(state.buildings.at(-1)?.instanceId).toBe('building-1');
    // Só o custo mudou: a economia (água e energia) não rodou.
    expect(state.resources).toEqual({ ...START, materials: START.materials - 30 });
  });

  it('publica um único snapshot novo e registra o comando com o tick do estado', () => {
    const controller = create();
    const listener = vi.fn();
    controller.subscribe(listener);

    placeBuilding(controller, solar(SPOT_A));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.getCommandLog()).toHaveLength(1);
    expect(controller.getCommandLog()[0]).toMatchObject({ tick: 0, outcome: 'applied' });
  });

  it('o tempo real que passa pausado não executa nada (nem a construção nem a economia)', () => {
    const controller = create();
    placeBuilding(controller, solar(SPOT_A));
    const before = controller.getSnapshot();

    controller.clock.advance(60 * STEP_MS);

    expect(controller.getSnapshot()).toBe(before);
  });

  it('um pedido inválido é recusado na hora, sem alterar o estado nem registrar nada', () => {
    const controller = create();
    const before = controller.getSnapshot();
    const listener = vi.fn();
    controller.subscribe(listener);

    const result = placeBuilding(controller, solar({ x: 0, y: 0 }));

    expect(result).toEqual({ ok: false, error: 'OUT_OF_BUILDABLE_AREA' });
    expect(controller.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    expect(controller.getCommandLog()).toEqual([]);
  });

  it('um pedido repetido não gasta duas vezes: o segundo é recusado por sobreposição', () => {
    const controller = create();

    const first = placeBuilding(controller, solar(SPOT_A));
    const second = placeBuilding(controller, solar(SPOT_A));
    const third = placeBuilding(controller, solar(SPOT_A));

    expect(first).toEqual({ ok: true, value: 'applied' });
    expect(second).toEqual({ ok: false, error: 'OVERLAPS_BUILDING' });
    expect(third).toEqual({ ok: false, error: 'OVERLAPS_BUILDING' });
    expect(buildingCount(controller)).toBe(INITIAL_COUNT + 1);
    expect(controller.getSnapshot().resources.materials).toBe(START.materials - 30);
  });

  it('recursos insuficientes: recusa e não desconta nada', () => {
    const controller = create();
    // 150 de materiais: um habitat (80) cabe, o segundo (80) já não cabe.
    placeBuilding(controller, habitat(SPOT_A));
    const before = controller.getSnapshot();

    const result = placeBuilding(controller, habitat(SPOT_B));

    expect(result).toEqual({ ok: false, error: 'INSUFFICIENT_RESOURCES' });
    expect(controller.getSnapshot()).toBe(before);
    expect(controller.getSnapshot().resources.materials).toBe(START.materials - 80);
  });

  it('a seleção e os comandos de controle continuam funcionando (a construção não trava o relógio)', () => {
    const controller = create();
    placeBuilding(controller, solar(SPOT_A));

    controller.clock.resume();
    controller.clock.advance(STEP_MS);

    expect(controller.getSnapshot().tick).toBe(1);
  });
});

describe('construção com o jogo EM ANDAMENTO (fila de comandos)', () => {
  it('entra na fila: nada muda até o próximo passo', () => {
    const controller = running();
    const before = controller.getSnapshot();

    const result = placeBuilding(controller, solar(SPOT_A));

    expect(result).toEqual({ ok: true, value: 'queued' });
    expect(controller.getSnapshot()).toBe(before);
    expect(buildingCount(controller)).toBe(INITIAL_COUNT);
    expect(controller.getSnapshot().resources).toEqual(START);
  });

  it('é aplicada no início do próximo passo, depois do tick e ANTES da economia (que já a inclui)', () => {
    const controller = running();
    placeBuilding(controller, solar(SPOT_A));

    controller.clock.advance(STEP_MS);

    const state = controller.getSnapshot();
    expect(state.tick).toBe(1);
    expect(state.buildings).toHaveLength(INITIAL_COUNT + 1);
    // A nova matriz solar já produziu neste mesmo passo (6 de energia); o custo foi descontado uma vez.
    expect(state.resources.energy).toBe(expectedResourcesAfter(1).energy + 6);
    expect(state.resources.materials).toBe(START.materials - 30);
    expect(controller.getCommandLog()).toHaveLength(1);
    expect(controller.getCommandLog()[0]).toMatchObject({ tick: 1, outcome: 'applied' });
  });

  it('um pedido repetido na fila é revalidado: o segundo é recusado e o custo sai uma vez só', () => {
    const controller = running();
    const rejections: RejectedCommand[] = [];
    controller.subscribeRejections((rejection) => rejections.push(rejection));

    // Os dois são válidos quando enviados (a fila ainda não foi aplicada).
    expect(placeBuilding(controller, solar(SPOT_A))).toEqual({ ok: true, value: 'queued' });
    expect(placeBuilding(controller, solar(SPOT_A))).toEqual({ ok: true, value: 'queued' });
    controller.clock.advance(STEP_MS);

    expect(buildingCount(controller)).toBe(INITIAL_COUNT + 1);
    expect(controller.getSnapshot().resources.materials).toBe(START.materials - 30);
    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toMatchObject({
      outcome: 'rejected',
      error: 'OVERLAPS_BUILDING',
      tick: 1,
    });
    expect(controller.getCommandLog().map((entry) => entry.outcome)).toEqual([
      'applied',
      'rejected',
    ]);
  });

  it('recursos insuficientes na aplicação: o segundo pedido é recusado e nada é descontado por ele', () => {
    const controller = running();
    const rejections: RejectedCommand[] = [];
    controller.subscribeRejections((rejection) => rejections.push(rejection));

    // 150 de materiais: cada habitat (80) cabe sozinho, os dois juntos não.
    expect(placeBuilding(controller, habitat(SPOT_A)).ok).toBe(true);
    expect(placeBuilding(controller, habitat(SPOT_B)).ok).toBe(true);
    controller.clock.advance(STEP_MS);

    expect(buildingCount(controller)).toBe(INITIAL_COUNT + 1);
    expect(controller.getSnapshot().resources.materials).toBe(START.materials - 80);
    expect(rejections.map((rejection) => rejection.error)).toEqual(['INSUFFICIENT_RESOURCES']);
  });

  it('a ordem de chegada decide: os identificadores seguem a ordem em que foram aplicados', () => {
    const controller = running();
    placeBuilding(controller, solar(SPOT_A));
    placeBuilding(controller, solar(SPOT_B));
    placeBuilding(controller, solar(SPOT_C));

    controller.clock.advance(STEP_MS);

    const added = controller.getSnapshot().buildings.slice(INITIAL_COUNT);
    expect(added.map((building) => building.instanceId)).toEqual([
      'building-1',
      'building-2',
      'building-3',
    ]);
    expect(added.map((building) => building.position)).toEqual([SPOT_A, SPOT_B, SPOT_C]);
  });

  it('pausar aplica a fila na hora, em ordem, sem avançar o tick e sem rodar a economia', () => {
    const controller = running();
    controller.clock.advance(STEP_MS);
    const atTick1 = controller.getSnapshot();
    placeBuilding(controller, solar(SPOT_A));

    controller.clock.pause();

    const state = controller.getSnapshot();
    expect(state.tick).toBe(1);
    expect(state.buildings).toHaveLength(INITIAL_COUNT + 1);
    expect(state.resources).toEqual({
      ...atTick1.resources,
      materials: atTick1.resources.materials - 30,
    });
  });

  it('um pedido inválido no envio nem entra na fila', () => {
    const controller = running();

    const result = placeBuilding(controller, solar({ x: 14, y: 14 }));
    controller.clock.advance(STEP_MS);

    expect(result).toEqual({ ok: false, error: 'OVERLAPS_OBSTACLE' });
    expect(buildingCount(controller)).toBe(INITIAL_COUNT);
    expect(controller.getCommandLog()).toEqual([]);
  });

  it('a recusa tardia não deixa rastro no estado, só no log e no canal de feedback', () => {
    const controller = running();
    placeBuilding(controller, habitat(SPOT_A));
    placeBuilding(controller, habitat(SPOT_B));
    const listener = vi.fn();
    controller.subscribeRejections(listener);

    controller.clock.advance(STEP_MS);

    expect(listener).toHaveBeenCalledTimes(1);
    const state = controller.getSnapshot();
    expect(state.nextEntityId).toBe(2);
    expect(state.buildings.map((building) => building.position)).not.toContainEqual(SPOT_B);
  });

  it('quem cancela a assinatura de feedback deixa de ser chamado', () => {
    const controller = running();
    const listener = vi.fn();
    const unsubscribe = controller.subscribeRejections(listener);
    unsubscribe();
    unsubscribe();

    placeBuilding(controller, solar(SPOT_A));
    placeBuilding(controller, solar(SPOT_A));
    controller.clock.advance(STEP_MS);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('construção e tempo: determinismo e independência do FPS', () => {
  it('o mesmo tempo total dá o mesmo estado, com qualquer número de quadros', () => {
    const play = (frames: number) => {
      const controller = running();
      placeBuilding(controller, solar(SPOT_A));
      for (let frame = 0; frame < frames; frame += 1) {
        controller.clock.advance(4_000 / frames);
      }
      placeBuilding(controller, solar(SPOT_B));
      controller.clock.advance(2 * STEP_MS);
      return JSON.stringify(controller.getSnapshot());
    };

    const results = [1, 4, 16, 64].map(play);

    expect(new Set(results).size).toBe(1);
  });

  it('a nova construção entra na economia: uma matriz solar a mais aumenta o saldo de energia', () => {
    const base = running();
    const built = running();
    placeBuilding(built, solar(SPOT_A));

    base.clock.advance(5 * STEP_MS);
    built.clock.advance(5 * STEP_MS);

    // Cinco passos com a matriz extra (+6 por passo, incluindo o primeiro).
    expect(built.getSnapshot().resources.energy - base.getSnapshot().resources.energy).toBe(5 * 6);
  });
});
