import { describe, expect, it, vi } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';
import {
  executeTestCommand,
  setMaterials,
  spendMaterials,
  type SetMaterials,
} from '../../support/testCommands';

/*
 * Controlador com relógio e fila de comandos. O tempo real é o número passado a `clock.advance`
 * (sem DOM, sem Babylon.js, sem esperas). Os comandos são comandos de TESTE: nenhum comando de
 * simulação concreto existe na Fase 4.
 */

const STEP_MS = 1000;
const initialState = () => createInitialGameState(INITIAL_SCENARIO);
const START_MATERIALS = INITIAL_SCENARIO.initialResources.materials;

function setup(options: { maxStepsPerAdvance?: number; commandLogLimit?: number } = {}) {
  const controller = createGameController(initialState(), {
    executeCommand: executeTestCommand,
    ...options,
  });
  return controller;
}

/** Controlador já em andamento (jogo retomado). */
function running(options: Parameters<typeof setup>[0] = {}) {
  const controller = setup(options);
  controller.clock.resume();
  return controller;
}

describe('GameController: estado inicial e tick', () => {
  it('a partida nasce pausada, no tick 0, a 1x', () => {
    const controller = setup();

    expect(controller.clock.getSnapshot()).toEqual({ paused: true, speed: 1 });
    expect(controller.getSnapshot().tick).toBe(0);
  });

  it('recusa um estado inicial inválido (erro de conteúdo ou de programação)', () => {
    const invalid = { ...initialState(), tick: -1 } as GameState;

    expect(() => createGameController(invalid)).toThrow(/Estado inicial inválido/);
  });

  it('pausado, o tempo real passa e o tick NÃO avança (nem o snapshot muda)', () => {
    const controller = setup();
    const before = controller.getSnapshot();
    const listener = vi.fn();
    controller.subscribe(listener);

    expect(controller.clock.advance(60_000)).toBe(0);

    expect(controller.getSnapshot()).toBe(before);
    expect(controller.getSnapshot().tick).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('em andamento, o tick avança um por passo e só quando um passo é executado', () => {
    const controller = running();

    controller.clock.advance(STEP_MS - 1);
    expect(controller.getSnapshot().tick).toBe(0);

    controller.clock.advance(1);
    expect(controller.getSnapshot().tick).toBe(1);

    controller.clock.advance(3 * STEP_MS);
    expect(controller.getSnapshot().tick).toBe(4);
  });

  it('o tick não depende do FPS: o mesmo tempo total dá o mesmo estado final com qualquer número de quadros', () => {
    const finalStates = [1, 5, 25, 100, 500].map((frames) => {
      const controller = running();
      for (let frame = 0; frame < frames; frame += 1) {
        controller.clock.advance(5_000 / frames);
      }
      return JSON.stringify(controller.getSnapshot());
    });

    expect(new Set(finalStates).size).toBe(1);
    expect(JSON.parse(finalStates[0] ?? '{}').tick).toBe(5);
  });

  it('a velocidade muda quantos passos acontecem por segundo real, não a duração do passo', () => {
    const at = (speed: number) => {
      const controller = running();
      controller.clock.setSpeed(speed);
      controller.clock.advance(2_000);
      return controller.getSnapshot().tick;
    };

    expect([at(1), at(2), at(4)]).toEqual([2, 4, 8]);
  });

  it('limita a recuperação de atraso: um quadro gigante não vira milhares de ticks', () => {
    const controller = running({ maxStepsPerAdvance: 2 });

    controller.clock.advance(60 * 60 * 1000);

    expect(controller.getSnapshot().tick).toBe(2);
  });

  it('publica um novo snapshot por passo e mantém a referência do que não mudou', () => {
    const controller = running();
    const before = controller.getSnapshot();
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.clock.advance(3 * STEP_MS);

    expect(listener).toHaveBeenCalledTimes(3);
    const after = controller.getSnapshot();
    expect(after).not.toBe(before);
    // As construções não mudam a cada passo; os recursos mudam, porque a economia roda (Fase 5).
    expect(after.buildings).toBe(before.buildings);
    expect(after.resources).not.toBe(before.resources);
    expect(Object.isFrozen(after)).toBe(true);
    expect(Object.isFrozen(after.resources)).toBe(true);
  });

  it('o snapshot é estável entre leituras enquanto não há passo nem comando', () => {
    const controller = running();
    controller.clock.advance(STEP_MS);

    expect(controller.getSnapshot()).toBe(controller.getSnapshot());
  });

  it('pausar e retomar não perdem estado: o tick continua de onde parou', () => {
    const controller = running();
    controller.clock.advance(3 * STEP_MS);

    controller.clock.pause();
    controller.clock.advance(10 * STEP_MS);
    controller.clock.resume();
    controller.clock.advance(STEP_MS);

    expect(controller.getSnapshot().tick).toBe(4);
  });

  it('o estado da partida não contém paused, speed nem seleção', () => {
    const controller = running();
    controller.clock.setSpeed(4);
    controller.clock.advance(STEP_MS);

    const json = JSON.stringify(controller.getSnapshot());

    expect(json).not.toMatch(/paused|speed|selected/i);
    expect(Object.keys(controller.getSnapshot()).sort()).toEqual(
      [
        'buildings',
        'contentVersion',
        'events',
        'nextEntityId',
        'population',
        'resources',
        'schemaVersion',
        'tick',
      ].sort(),
    );
  });
});

describe('GameController: comandos de controle', () => {
  it('funcionam com o jogo pausado e não alteram o GameState', () => {
    const controller = setup();
    const before = controller.getSnapshot();

    controller.clock.setSpeed(4);
    controller.clock.resume();
    controller.clock.pause();
    controller.clock.setSpeed(2);

    expect(controller.clock.getSnapshot()).toEqual({ paused: true, speed: 2 });
    expect(controller.getSnapshot()).toBe(before);
  });

  it('uma velocidade inválida é recusada com INVALID_SPEED e nada muda', () => {
    const controller = setup();
    const clockBefore = controller.clock.getSnapshot();

    expect(controller.clock.setSpeed(3)).toEqual({ ok: false, error: 'INVALID_SPEED' });

    expect(controller.clock.getSnapshot()).toBe(clockBefore);
  });
});

describe('GameController: comandos de simulação com o jogo pausado', () => {
  it('um comando válido é aplicado imediatamente, sem avançar o tick', () => {
    const controller = setup();
    const listener = vi.fn();
    controller.subscribe(listener);

    const result = controller.submitCommand(setMaterials(500));

    expect(result).toEqual({ ok: true, value: 'applied' });
    expect(controller.getSnapshot().resources.materials).toBe(500);
    expect(controller.getSnapshot().tick).toBe(0);
    expect(controller.clock.getSnapshot().paused).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('aplicar comandos nunca avança o tempo por conta própria', () => {
    const controller = setup();

    for (let index = 0; index < 20; index += 1) {
      controller.submitCommand(setMaterials(index));
    }

    expect(controller.getSnapshot().tick).toBe(0);
  });

  it('um comando inválido (tipo desconhecido) é recusado e não altera o estado', () => {
    const controller = setup();
    const before = controller.getSnapshot();

    const result = controller.submitCommand({ type: 'Inexistente' });

    expect(result).toEqual({ ok: false, error: 'INVALID_COMMAND' });
    expect(controller.getSnapshot()).toBe(before);
    expect(controller.getCommandLog()).toEqual([]);
  });

  it('um comando recusado pelas regras (COMMAND_REJECTED) não altera o estado', () => {
    const controller = setup();
    const before = controller.getSnapshot();

    const result = controller.submitCommand(spendMaterials(START_MATERIALS + 1));

    expect(result).toEqual({ ok: false, error: 'COMMAND_REJECTED' });
    expect(controller.getSnapshot()).toBe(before);
  });

  it('um comando que produziria um estado inválido é recusado com INVALID_STATE', () => {
    const controller = setup();
    const before = controller.getSnapshot();

    const result = controller.submitCommand(setMaterials(-5));

    expect(result).toEqual({ ok: false, error: 'INVALID_STATE' });
    expect(controller.getSnapshot()).toBe(before);
  });

  it('registra o comando aplicado com o tick em que ocorreu', () => {
    const controller = running();
    controller.clock.advance(2 * STEP_MS);
    controller.clock.pause();

    controller.submitCommand(setMaterials(10));

    expect(controller.getCommandLog()).toEqual([
      { tick: 2, command: setMaterials(10), outcome: 'applied' },
    ]);
  });
});

describe('GameController: comandos de simulação em andamento', () => {
  it('um comando válido entra na fila e é aplicado no próximo passo, não antes', () => {
    const controller = running();
    const before = controller.getSnapshot();

    const result = controller.submitCommand(setMaterials(500));

    expect(result).toEqual({ ok: true, value: 'queued' });
    expect(controller.getSnapshot()).toBe(before);

    controller.clock.advance(STEP_MS - 1);
    expect(controller.getSnapshot().resources.materials).toBe(START_MATERIALS);

    controller.clock.advance(1);
    expect(controller.getSnapshot().resources.materials).toBe(500);
    expect(controller.getSnapshot().tick).toBe(1);
  });

  it('é aplicado no início do passo: o registro leva o tick do passo que o aplicou', () => {
    const controller = running();
    controller.clock.advance(3 * STEP_MS);

    controller.submitCommand(setMaterials(77));
    controller.clock.advance(STEP_MS);

    expect(controller.getCommandLog()).toEqual([
      { tick: 4, command: setMaterials(77), outcome: 'applied' },
    ]);
  });

  it('o passo avança o tick e aplica os comandos juntos, publicando UM snapshot', () => {
    const controller = running();
    controller.submitCommand(setMaterials(11));
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.clock.advance(STEP_MS);

    expect(listener).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().tick).toBe(1);
    expect(controller.getSnapshot().resources.materials).toBe(11);
  });

  it('um comando inválido é recusado na hora, não entra na fila e não altera o estado', () => {
    const controller = running();
    const before = controller.getSnapshot();

    expect(controller.submitCommand({ type: 'Inexistente' })).toEqual({
      ok: false,
      error: 'INVALID_COMMAND',
    });
    expect(controller.submitCommand(setMaterials(-1))).toEqual({
      ok: false,
      error: 'INVALID_STATE',
    });
    controller.clock.advance(STEP_MS);

    // Os comandos recusados não deixam rastro: os materiais (que a economia não toca) seguem iguais.
    expect(controller.getSnapshot().resources.materials).toBe(before.resources.materials);
    expect(controller.getSnapshot().buildings).toBe(before.buildings);
    expect(controller.getCommandLog()).toEqual([]);
  });

  it('aplica a fila em ordem de chegada (FIFO), dentro do mesmo passo', () => {
    const controller = running();

    controller.submitCommand(setMaterials(10));
    controller.submitCommand(setMaterials(20));
    controller.submitCommand(setMaterials(30));
    controller.clock.advance(STEP_MS);

    // Cada comando substitui o valor: o último da fila é o que fica.
    expect(controller.getSnapshot().resources.materials).toBe(30);
    expect(
      controller.getCommandLog().map((entry) => (entry.command as SetMaterials).value),
    ).toEqual([10, 20, 30]);
  });

  it('a fila é esvaziada a cada passo: comandos de passos diferentes seguem a ordem dos passos', () => {
    const controller = running();

    controller.submitCommand(setMaterials(10));
    controller.clock.advance(STEP_MS);
    controller.submitCommand(setMaterials(20));
    controller.clock.advance(STEP_MS);

    expect(controller.getSnapshot().resources.materials).toBe(20);
    expect(controller.getCommandLog().map((entry) => entry.tick)).toEqual([1, 2]);
  });

  it('REVALIDA o comando ao aplicar: a aplicação é a decisão definitiva', () => {
    const controller = running();
    // Os dois cabem no estado atual (a fila ainda não foi aplicada), mas não cabem juntos.
    expect(controller.submitCommand(spendMaterials(START_MATERIALS - 50))).toEqual({
      ok: true,
      value: 'queued',
    });
    expect(controller.submitCommand(spendMaterials(START_MATERIALS - 50))).toEqual({
      ok: true,
      value: 'queued',
    });

    controller.clock.advance(STEP_MS);

    expect(controller.getSnapshot().resources.materials).toBe(50);
    expect(controller.getCommandLog()).toEqual([
      { tick: 1, command: spendMaterials(START_MATERIALS - 50), outcome: 'applied' },
      {
        tick: 1,
        command: spendMaterials(START_MATERIALS - 50),
        outcome: 'rejected',
        error: 'COMMAND_REJECTED',
      },
    ]);
  });

  it('pausar aplica NA HORA o que estava na fila, em ordem e sem avançar o tick', () => {
    const controller = running();
    controller.clock.advance(2 * STEP_MS);
    controller.submitCommand(setMaterials(10));
    controller.submitCommand(setMaterials(20));
    expect(controller.getSnapshot().resources.materials).toBe(START_MATERIALS);

    controller.clock.pause();

    expect(controller.getSnapshot().resources.materials).toBe(20);
    expect(controller.getSnapshot().tick).toBe(2);
    expect(controller.getCommandLog().map((entry) => entry.tick)).toEqual([2, 2]);
  });

  it('a ordem de chegada é preservada entre o que estava na fila ao pausar e o que vem depois', () => {
    const controller = running();
    controller.submitCommand(setMaterials(10));

    controller.clock.pause();
    controller.submitCommand(setMaterials(20));

    expect(controller.getSnapshot().resources.materials).toBe(20);
    expect(
      controller.getCommandLog().map((entry) => (entry.command as SetMaterials).value),
    ).toEqual([10, 20]);
  });

  it('retomar depois de pausar começa com a fila vazia (nada é aplicado duas vezes)', () => {
    const controller = running();
    controller.submitCommand(spendMaterials(100));
    controller.clock.pause();
    controller.clock.resume();

    controller.clock.advance(STEP_MS);

    expect(controller.getSnapshot().resources.materials).toBe(START_MATERIALS - 100);
    expect(controller.getCommandLog()).toHaveLength(1);
  });
});

describe('GameController: determinismo e log', () => {
  /** Roteiro fixo: a cada passo lógico, comandos em andamento e, no fim, um comando pausado. */
  function playScript(frameMs: number) {
    const controller = setup();
    controller.clock.resume();
    const framesPerStep = STEP_MS / frameMs;
    const advanceStep = () => {
      for (let frame = 0; frame < framesPerStep; frame += 1) {
        controller.clock.advance(frameMs);
      }
    };

    advanceStep();
    controller.submitCommand(spendMaterials(30));
    controller.submitCommand(setMaterials(5000));
    controller.submitCommand({ type: 'Inexistente' });
    advanceStep();
    controller.submitCommand(setMaterials(900));
    controller.submitCommand(spendMaterials(1000));
    advanceStep();
    controller.clock.pause();
    controller.submitCommand(spendMaterials(100));

    return {
      state: JSON.stringify(controller.getSnapshot()),
      log: JSON.stringify(controller.getCommandLog()),
    };
  }

  it('o mesmo estado inicial e a mesma sequência de comandos produzem o mesmo resultado', () => {
    expect(playScript(STEP_MS)).toEqual(playScript(STEP_MS));
  });

  it('o resultado não muda com o número de quadros por passo (FPS)', () => {
    const reference = playScript(STEP_MS);

    expect(playScript(STEP_MS / 4)).toEqual(reference);
    expect(playScript(STEP_MS / 20)).toEqual(reference);
    expect(JSON.parse(reference.state).tick).toBe(3);
    expect(JSON.parse(reference.state).resources.materials).toBe(800);
  });

  it('o log de comandos tem tamanho limitado e guarda os mais recentes', () => {
    const controller = setup({ commandLogLimit: 3 });

    for (let value = 1; value <= 5; value += 1) {
      controller.submitCommand(setMaterials(value));
    }

    expect(
      controller.getCommandLog().map((entry) => (entry.command as SetMaterials).value),
    ).toEqual([3, 4, 5]);
  });

  it('o log devolvido é uma cópia: alterá-lo não afeta o controlador', () => {
    const controller = setup();
    controller.submitCommand(setMaterials(1));

    (controller.getCommandLog() as unknown[]).length = 0;

    expect(controller.getCommandLog()).toHaveLength(1);
  });
});
