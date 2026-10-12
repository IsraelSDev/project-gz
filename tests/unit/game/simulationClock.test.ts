import { describe, expect, it, vi } from 'vitest';
import {
  createSimulationClock,
  DEFAULT_MAX_STEPS_PER_ADVANCE,
  SIMULATION_SPEEDS,
} from '@/game/application/time/SimulationClock';

/*
 * O relógio é lógica temporal pura: estes testes rodam em Node, sem DOM, sem Babylon.js e sem
 * esperas reais. O "tempo real" é o número que o teste passa a `advance`. Os tempos usam inteiros
 * (milissegundos) para a conta ser exata.
 */

function setup(maxStepsPerAdvance?: number) {
  const onStep = vi.fn();
  const clock = createSimulationClock({ onStep, maxStepsPerAdvance });
  return { clock, onStep };
}

/** Relógio já em andamento (retomado). */
function running(maxStepsPerAdvance?: number) {
  const context = setup(maxStepsPerAdvance);
  context.clock.resume();
  return context;
}

describe('SimulationClock: estado inicial e controles', () => {
  it('começa pausado, em 1x', () => {
    const { clock } = setup();

    expect(clock.getSnapshot()).toEqual({ paused: true, speed: 1 });
  });

  it('retoma e pausa', () => {
    const { clock } = setup();

    clock.resume();
    expect(clock.getSnapshot().paused).toBe(false);

    clock.pause();
    expect(clock.getSnapshot().paused).toBe(true);
  });

  it('aceita as velocidades 1x, 2x e 4x', () => {
    const { clock } = setup();

    expect([...SIMULATION_SPEEDS]).toEqual([1, 2, 4]);
    for (const speed of SIMULATION_SPEEDS) {
      expect(clock.setSpeed(speed)).toEqual({ ok: true, value: speed });
      expect(clock.getSnapshot().speed).toBe(speed);
    }
  });

  it.each([0, -1, 3, 8, 0.5, Number.NaN, Number.POSITIVE_INFINITY, '2' as unknown as number])(
    'rejeita a velocidade inválida %s com INVALID_SPEED e não altera o relógio',
    (speed) => {
      const { clock } = setup();
      clock.setSpeed(2);
      const before = clock.getSnapshot();

      expect(clock.setSpeed(speed)).toEqual({ ok: false, error: 'INVALID_SPEED' });

      expect(clock.getSnapshot()).toBe(before);
    },
  );

  it('os controles funcionam em qualquer estado (pausado ou em andamento)', () => {
    const { clock } = setup();

    clock.setSpeed(4);
    expect(clock.getSnapshot()).toEqual({ paused: true, speed: 4 });

    clock.resume();
    clock.setSpeed(2);
    expect(clock.getSnapshot()).toEqual({ paused: false, speed: 2 });
  });

  it('o snapshot é imutável e mantém a mesma referência enquanto nada muda', () => {
    const { clock } = setup();
    const initial = clock.getSnapshot();

    clock.pause();
    clock.setSpeed(1);
    expect(clock.getSnapshot()).toBe(initial);
    expect(Object.isFrozen(initial)).toBe(true);

    clock.resume();
    expect(clock.getSnapshot()).not.toBe(initial);
  });

  it('notifica só quando o estado realmente muda', () => {
    const { clock } = setup();
    const listener = vi.fn();
    clock.subscribe(listener);

    clock.pause();
    clock.setSpeed(1);
    clock.setSpeed(3);
    expect(listener).not.toHaveBeenCalled();

    clock.resume();
    clock.setSpeed(2);
    clock.pause();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('para de notificar quem cancelou a assinatura', () => {
    const { clock } = setup();
    const listener = vi.fn();
    const unsubscribe = clock.subscribe(listener);

    unsubscribe();
    clock.resume();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('SimulationClock: passos fixos', () => {
  it('executa um passo a cada 1000 ms de tempo real em 1x', () => {
    const { clock, onStep } = running();

    expect(clock.advance(999)).toBe(0);
    expect(onStep).not.toHaveBeenCalled();

    expect(clock.advance(1)).toBe(1);
    expect(onStep).toHaveBeenCalledTimes(1);

    expect(clock.advance(3000)).toBe(3);
    expect(onStep).toHaveBeenCalledTimes(4);
  });

  it('guarda a fração do passo entre as chamadas (nada se perde)', () => {
    const { clock } = running();

    const steps = [400, 400, 400].map((delta) => clock.advance(delta));

    expect(steps).toEqual([0, 0, 1]);
    // Sobraram 200 ms: faltam 800 para o próximo passo.
    expect(clock.advance(799)).toBe(0);
    expect(clock.advance(1)).toBe(1);
  });

  it('em 2x e 4x processa mais segundos de jogo por segundo real, sem mudar a duração do passo', () => {
    const { clock } = running();

    clock.setSpeed(2);
    expect(clock.advance(1000)).toBe(2);
    expect(clock.advance(500)).toBe(1);

    clock.setSpeed(4);
    expect(clock.advance(1000)).toBe(4);
    expect(clock.advance(250)).toBe(1);
  });

  it('trocar a velocidade no meio de um passo não faz o tempo pular nem voltar', () => {
    const { clock } = running();

    clock.advance(500); // meio passo em 1x
    clock.setSpeed(2);

    expect(clock.advance(249)).toBe(0); // 500 + 498 = 998 ms de jogo
    expect(clock.advance(1)).toBe(1); // 500 + 500 = 1000 ms de jogo
  });

  it('o resultado não depende do número de quadros: o mesmo tempo total dá o mesmo número de passos', () => {
    const totalMs = 10_000;
    const results = [1, 2, 10, 100, 1000].map((frames) => {
      const { clock, onStep } = running();
      for (let frame = 0; frame < frames; frame += 1) {
        clock.advance(totalMs / frames);
      }
      return onStep.mock.calls.length;
    });

    expect(results).toEqual([10, 10, 10, 10, 10]);
  });

  it('quadros irregulares (como os de um navegador) também dão o mesmo resultado', () => {
    const pattern = [10, 20, 30, 40]; // soma 100 ms
    const { clock, onStep } = running();

    for (let index = 0; index < 100; index += 1) {
      for (const delta of pattern) {
        clock.advance(delta);
      }
    }

    expect(onStep).toHaveBeenCalledTimes(10);
  });

  it('um quadro sem tempo transcorrido não executa nada', () => {
    const { clock, onStep } = running();

    expect(clock.advance(0)).toBe(0);
    expect(onStep).not.toHaveBeenCalled();
  });
});

describe('SimulationClock: pausa', () => {
  it('pausado, não executa passos, por maior que seja o tempo transcorrido', () => {
    const { clock, onStep } = setup();

    expect(clock.advance(60_000)).toBe(0);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('o tempo real passado em pausa NÃO é acumulado: ao retomar não há passos de uma vez', () => {
    const { clock, onStep } = setup();
    // Fracionário de propósito: um múltiplo de 1000 ms seria descartado de qualquer jeito.
    clock.advance(60_500);

    clock.resume();

    expect(clock.advance(0)).toBe(0);
    expect(clock.advance(999)).toBe(0);
    expect(onStep).not.toHaveBeenCalled();
    expect(clock.advance(1)).toBe(1);
  });

  it('pausar interrompe o avanço e retomar continua de onde parou (sem perder a fração)', () => {
    const { clock, onStep } = running();
    clock.advance(600);

    clock.pause();
    clock.advance(5_400);
    clock.resume();

    expect(clock.advance(399)).toBe(0);
    expect(clock.advance(1)).toBe(1);
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it('um passo que pausa o relógio interrompe o restante do lote', () => {
    const clock = createSimulationClock({
      onStep: () => {
        if (calls === 2) {
          clock.pause();
        }
        calls += 1;
      },
    });
    let calls = 1;
    clock.resume();

    expect(clock.advance(5_000)).toBe(2);

    expect(clock.getSnapshot().paused).toBe(true);
  });
});

describe('SimulationClock: limite de recuperação de atraso', () => {
  it('executa no máximo o limite de passos por chamada e DESCARTA o restante', () => {
    const { clock, onStep } = running(3);

    expect(clock.advance(60_000)).toBe(3);
    expect(onStep).toHaveBeenCalledTimes(3);

    // O atraso perdido não é cobrado depois.
    expect(clock.advance(0)).toBe(0);
    expect(clock.advance(999)).toBe(0);
  });

  it('mantém a fração do passo atual ao descartar, para o ritmo não pular', () => {
    const { clock } = running(3);

    expect(clock.advance(5_500)).toBe(3);

    expect(clock.advance(499)).toBe(0);
    expect(clock.advance(1)).toBe(1);
  });

  it('por padrão o limite é DEFAULT_MAX_STEPS_PER_ADVANCE, mesmo após uma hora sem quadros', () => {
    const { clock, onStep } = running();

    clock.advance(60 * 60 * 1000);

    expect(DEFAULT_MAX_STEPS_PER_ADVANCE).toBe(10);
    expect(onStep).toHaveBeenCalledTimes(DEFAULT_MAX_STEPS_PER_ADVANCE);
  });

  it('o limite vale em qualquer velocidade e o atraso gigante nunca vira milhares de passos', () => {
    const { clock, onStep } = running();
    clock.setSpeed(4);

    clock.advance(10 * 60 * 60 * 1000);

    expect(onStep).toHaveBeenCalledTimes(DEFAULT_MAX_STEPS_PER_ADVANCE);
  });

  it('um quadro lento normal (2 s a 4x) é totalmente recuperado, sem perda', () => {
    const { clock, onStep } = running();
    clock.setSpeed(4);

    clock.advance(2_000);

    expect(onStep).toHaveBeenCalledTimes(8);
  });
});

describe('SimulationClock: entradas inválidas e reinício', () => {
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'lança RangeError para um delta inválido (%s): é um bug do chamador, não uma falha esperada',
    (delta) => {
      const { clock, onStep } = running();

      expect(() => clock.advance(delta)).toThrow(RangeError);
      expect(onStep).not.toHaveBeenCalled();
    },
  );

  it('valida o delta também com o relógio pausado', () => {
    const { clock } = setup();

    expect(() => clock.advance(-5)).toThrow(RangeError);
  });

  it('reset volta ao estado de partida nova: pausado, 1x e sem atraso acumulado', () => {
    const { clock, onStep } = running();
    clock.setSpeed(4);
    clock.advance(900); // 3600 ms de jogo: 3 passos e 600 ms pendentes
    onStep.mockClear();

    clock.reset();

    expect(clock.getSnapshot()).toEqual({ paused: true, speed: 1 });
    clock.resume();
    expect(clock.advance(999)).toBe(0);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('reset notifica uma vez se o estado mudou e nenhuma se já estava no estado inicial', () => {
    const { clock } = setup();
    const listener = vi.fn();
    clock.subscribe(listener);

    clock.reset();
    expect(listener).not.toHaveBeenCalled();

    clock.resume();
    clock.setSpeed(2);
    listener.mockClear();
    clock.reset();
    expect(listener).toHaveBeenCalledOnce();
  });
});
