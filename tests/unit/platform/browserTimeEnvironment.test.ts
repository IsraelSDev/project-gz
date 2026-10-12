// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserTimeEnvironment } from '@/platform/time/browserTimeEnvironment';

/*
 * Implementação do ambiente de tempo para o navegador, exercitada no jsdom com relógios falsos do
 * Vitest. Isto NÃO prova o `requestAnimationFrame` nem a visibilidade de um navegador real (aba em
 * segundo plano de verdade): isso é verificado à mão.
 */

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'hidden');
});

describe('createBrowserTimeEnvironment', () => {
  it('now devolve um tempo monotônico em milissegundos', () => {
    const env = createBrowserTimeEnvironment();

    const first = env.now();
    const second = env.now();

    expect(typeof first).toBe('number');
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it('requestFrame chama o callback no próximo quadro e cancelFrame o impede', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    const env = createBrowserTimeEnvironment();
    const kept = vi.fn();
    const cancelled = vi.fn();

    env.requestFrame(kept);
    env.cancelFrame(env.requestFrame(cancelled));
    expect(kept).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);

    expect(kept).toHaveBeenCalledOnce();
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('isHidden reflete document.hidden', () => {
    const env = createBrowserTimeEnvironment();
    expect(env.isHidden()).toBe(false);

    setHidden(true);

    expect(env.isHidden()).toBe(true);
  });

  it('onVisibilityChange avisa a cada mudança e para depois de cancelada', () => {
    const env = createBrowserTimeEnvironment();
    const listener = vi.fn();
    const unsubscribe = env.onVisibilityChange(listener);

    setHidden(true);
    setHidden(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setHidden(true);

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
