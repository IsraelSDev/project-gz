import { describe, expect, it, vi } from 'vitest';
import { createListenerSet } from '@/shared/store/listenerSet';

describe('conjunto de ouvintes', () => {
  it('chama cada ouvinte registrado a cada notificação', () => {
    const set = createListenerSet();
    const first = vi.fn();
    const second = vi.fn();
    set.subscribe(first);
    set.subscribe(second);

    set.notify();
    set.notify();

    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('não chama mais o ouvinte depois que a assinatura é cancelada', () => {
    const set = createListenerSet();
    const listener = vi.fn();
    const unsubscribe = set.subscribe(listener);

    unsubscribe();
    set.notify();

    expect(listener).not.toHaveBeenCalled();
  });

  it('cancelar duas vezes é seguro e não afeta os outros ouvintes', () => {
    const set = createListenerSet();
    const cancelled = vi.fn();
    const kept = vi.fn();
    const unsubscribe = set.subscribe(cancelled);
    set.subscribe(kept);

    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
    set.notify();

    expect(cancelled).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledOnce();
  });

  it('trata a mesma função registrada duas vezes como duas assinaturas independentes', () => {
    const set = createListenerSet();
    const listener = vi.fn();
    const first = set.subscribe(listener);
    set.subscribe(listener);

    first();
    set.notify();

    expect(listener).toHaveBeenCalledOnce();
  });

  it('cancelar durante a notificação impede a chamada de quem ainda não foi chamado', () => {
    const set = createListenerSet();
    const second = vi.fn();
    let cancelSecond = () => {};
    set.subscribe(() => cancelSecond());
    cancelSecond = set.subscribe(second);

    set.notify();

    expect(second).not.toHaveBeenCalled();
  });

  it('um ouvinte registrado durante a notificação só é chamado na próxima', () => {
    const set = createListenerSet();
    const late = vi.fn();
    set.subscribe(() => {
      set.subscribe(late);
    });

    set.notify();
    expect(late).not.toHaveBeenCalled();

    set.notify();
    expect(late).toHaveBeenCalledOnce();
  });
});
