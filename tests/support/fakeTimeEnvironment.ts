import type { TimeEnvironment } from '@/game/application/ports/TimeEnvironment';

/*
 * Ambiente de tempo FALSO para os testes: o tempo só anda quando o teste manda (`frame`) e a
 * visibilidade só muda quando o teste manda (`setHidden`). Nada de esperas reais, `setTimeout` ou
 * `requestAnimationFrame`. Não prova o comportamento do navegador real.
 */

export interface FakeTimeEnvironment extends TimeEnvironment {
  /** Avança o tempo em `ms` e executa os quadros agendados até aquele instante (um por agendamento). */
  frame(ms: number): void;
  /** Passa `ms` de tempo SEM executar quadros (como um navegador que suspende o rAF com a aba oculta). */
  elapse(ms: number): void;
  /** Muda a visibilidade e avisa quem assinou, como o evento `visibilitychange`. */
  setHidden(hidden: boolean): void;
  /** Quadros agendados e ainda não executados nem cancelados. */
  pendingFrames(): number;
  /** Assinaturas de visibilidade ativas. */
  visibilityListeners(): number;
}

export function createFakeTimeEnvironment(initialTime = 0): FakeTimeEnvironment {
  let time = initialTime;
  let hidden = false;
  let nextHandle = 1;
  const frames = new Map<number, () => void>();
  const listeners = new Set<() => void>();

  return {
    now: () => time,
    requestFrame: (callback) => {
      const handle = nextHandle;
      nextHandle += 1;
      frames.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle) => {
      frames.delete(handle);
    },
    isHidden: () => hidden,
    onVisibilityChange: (listener) => {
      const entry = () => listener();
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
      };
    },

    frame: (ms) => {
      time += ms;
      const due = [...frames.values()];
      frames.clear();
      for (const callback of due) {
        callback();
      }
    },
    elapse: (ms) => {
      time += ms;
    },
    setHidden: (next) => {
      hidden = next;
      for (const listener of [...listeners]) {
        listener();
      }
    },
    pendingFrames: () => frames.size,
    visibilityListeners: () => listeners.size,
  };
}

/** Roda `count` quadros de `frameMs` cada (o tempo total é `count * frameMs`). */
export function runFrames(env: FakeTimeEnvironment, count: number, frameMs: number): void {
  for (let index = 0; index < count; index += 1) {
    env.frame(frameMs);
  }
}
