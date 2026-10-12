import { describe, expect, it, vi } from 'vitest';
import {
  createSimulationClock,
  DEFAULT_MAX_STEPS_PER_ADVANCE,
} from '@/game/application/time/SimulationClock';
import { startClockDriver } from '@/game/application/time/startClockDriver';
import { createFakeTimeEnvironment, runFrames } from '../../support/fakeTimeEnvironment';

/*
 * Driver do relógio com um ambiente de tempo FALSO: o tempo e a visibilidade só mudam quando o teste
 * manda. Rodam em Node, sem DOM, sem Babylon.js e sem esperas. Isto não prova o comportamento do
 * navegador real (rAF, visibilitychange), que é verificado à mão.
 */

function setup() {
  const onStep = vi.fn();
  const clock = createSimulationClock({ onStep });
  const env = createFakeTimeEnvironment(1_000_000);
  const stop = startClockDriver(clock, env);
  return { clock, env, onStep, stop };
}

describe('startClockDriver: loop de quadros', () => {
  it('agenda exatamente um quadro ao iniciar e um novo a cada quadro executado', () => {
    const { env } = setup();
    expect(env.pendingFrames()).toBe(1);

    env.frame(16);
    expect(env.pendingFrames()).toBe(1);

    env.frame(16);
    expect(env.pendingFrames()).toBe(1);
  });

  it('entrega ao relógio o tempo real transcorrido entre os quadros', () => {
    const { clock, env, onStep } = setup();
    clock.resume();

    env.frame(400);
    env.frame(400);
    expect(onStep).not.toHaveBeenCalled();

    env.frame(200);
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it('começa a contar do instante em que foi iniciado, não de um tempo anterior', () => {
    const onStep = vi.fn();
    const clock = createSimulationClock({ onStep });
    clock.resume();
    const env = createFakeTimeEnvironment(5_000_000);

    startClockDriver(clock, env);
    env.frame(10);

    expect(onStep).not.toHaveBeenCalled();
  });

  it('o resultado não depende do número de quadros (FPS)', () => {
    const stepsFor = (frames: number) => {
      const { clock, env, onStep } = setup();
      clock.resume();
      runFrames(env, frames, 10_000 / frames);
      return onStep.mock.calls.length;
    };

    expect([1, 10, 100, 1000].map(stepsFor)).toEqual([10, 10, 10, 10]);
  });

  it('pausado, os quadros continuam chegando mas nada avança', () => {
    const { env, onStep } = setup();

    runFrames(env, 100, 100);

    expect(onStep).not.toHaveBeenCalled();
    expect(env.pendingFrames()).toBe(1);
  });

  it('um relógio que andasse para trás não vira tempo negativo nem lança erro', () => {
    const { clock, env, onStep } = setup();
    clock.resume();

    expect(() => env.frame(-500)).not.toThrow();
    env.frame(1000);

    expect(onStep).toHaveBeenCalledTimes(1);
  });
});

describe('startClockDriver: ciclo de vida', () => {
  it('parar cancela o quadro agendado e a assinatura de visibilidade', () => {
    const { env, stop } = setup();
    expect(env.visibilityListeners()).toBe(1);

    stop();

    expect(env.pendingFrames()).toBe(0);
    expect(env.visibilityListeners()).toBe(0);
  });

  it('parar é idempotente e depois de parar nada mais avança nem é agendado', () => {
    const { clock, env, onStep, stop } = setup();
    clock.resume();

    stop();
    expect(() => stop()).not.toThrow();
    env.frame(5_000);
    env.setHidden(true);

    expect(onStep).not.toHaveBeenCalled();
    expect(env.pendingFrames()).toBe(0);
    expect(clock.getSnapshot().paused).toBe(false);
  });

  it('iniciar, parar e iniciar de novo (StrictMode) deixa um único loop ativo', () => {
    const onStep = vi.fn();
    const clock = createSimulationClock({ onStep });
    clock.resume();
    const env = createFakeTimeEnvironment();

    const stopFirst = startClockDriver(clock, env);
    stopFirst();
    startClockDriver(clock, env);

    expect(env.pendingFrames()).toBe(1);
    expect(env.visibilityListeners()).toBe(1);
    env.frame(1000);
    expect(onStep).toHaveBeenCalledTimes(1);
  });
});

describe('startClockDriver: aba em segundo plano', () => {
  it('pausa o relógio quando a aba fica oculta', () => {
    const { clock, env } = setup();
    clock.resume();

    env.setHidden(true);

    expect(clock.getSnapshot().paused).toBe(true);
  });

  it('ao voltar, a partida continua PAUSADA até o jogador retomar (nunca retoma sozinha)', () => {
    const { clock, env } = setup();
    clock.resume();
    env.setHidden(true);

    env.setHidden(false);

    expect(clock.getSnapshot().paused).toBe(true);
    env.frame(30_000);
    expect(clock.getSnapshot().paused).toBe(true);
  });

  it('o tempo passado oculto é descartado: uma hora depois não há rajada de ticks', () => {
    const { clock, env, onStep } = setup();
    clock.resume();
    env.frame(1000);
    expect(onStep).toHaveBeenCalledTimes(1);

    env.setHidden(true);
    env.frame(60 * 60 * 1000); // o navegador até pode chamar o quadro, mas nada deve avançar
    env.setHidden(false);
    clock.resume();
    env.frame(16);

    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it('sem nenhum quadro durante a ausência (rAF suspenso), o primeiro quadro após voltar não cobra o tempo oculto', () => {
    const { clock, env, onStep } = setup();
    clock.resume();
    env.frame(1000);
    onStep.mockClear();

    env.setHidden(true);
    env.elapse(60 * 60 * 1000); // uma hora e nenhum quadro
    env.setHidden(false);
    clock.resume(); // o jogador retoma de imediato
    env.frame(16);

    expect(onStep).not.toHaveBeenCalled();
  });

  it('mesmo sem o evento de visibilidade, quadros com a aba oculta não avançam nem acumulam', () => {
    const { clock, env, onStep } = setup();
    clock.resume();
    // Simula um navegador que entrega quadros com a aba oculta (sem avisar a mudança).
    const hiddenEnv = env as unknown as { isHidden: () => boolean };
    hiddenEnv.isHidden = () => true;

    env.frame(60_000);
    hiddenEnv.isHidden = () => false;
    env.frame(16);

    expect(onStep).not.toHaveBeenCalled();
  });

  it('ocultar e voltar com o jogo já pausado mantém tudo pausado e sem efeitos', () => {
    const { clock, env, onStep } = setup();

    env.setHidden(true);
    env.setHidden(false);
    env.frame(10_000);

    expect(clock.getSnapshot().paused).toBe(true);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('se a página já nasce oculta, o relógio fica pausado', () => {
    const onStep = vi.fn();
    const clock = createSimulationClock({ onStep });
    clock.resume();
    const env = createFakeTimeEnvironment();
    env.setHidden(true);

    startClockDriver(clock, env);

    expect(clock.getSnapshot().paused).toBe(true);
  });

  it('o limite de recuperação continua valendo mesmo se um quadro chegar muito atrasado', () => {
    const { clock, env, onStep } = setup();
    clock.resume();

    env.frame(10 * 60 * 1000);

    expect(onStep).toHaveBeenCalledTimes(DEFAULT_MAX_STEPS_PER_ADVANCE);
  });
});

describe('startClockDriver: erros inesperados', () => {
  it('um passo que lança pausa o relógio, o erro continua visível e o loop segue vivo', () => {
    const clock = createSimulationClock({
      onStep: () => {
        throw new Error('bug no passo');
      },
    });
    clock.resume();
    const env = createFakeTimeEnvironment();
    startClockDriver(clock, env);

    expect(() => env.frame(1000)).toThrow('bug no passo');

    expect(clock.getSnapshot().paused).toBe(true);
    expect(env.pendingFrames()).toBe(1);
    // Pausado, os quadros seguintes não repetem o erro.
    expect(() => env.frame(1000)).not.toThrow();
  });
});
