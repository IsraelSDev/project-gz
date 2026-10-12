import { describe, expect, it, vi } from 'vitest';
import { createBuildStore } from '@/session/buildStore';

/*
 * Estado de sessão do modo de construção. Guarda só dados simples (identificador, rotação, célula) e
 * nunca toca na partida: cancelar, girar ou mover a prévia não envia comando nenhum.
 */

const cell = (x: number, y: number) => ({ x, y });

describe('createBuildStore', () => {
  it('começa inativo, sem posição, sem rotação e sem aviso', () => {
    const store = createBuildStore();

    expect(store.getSnapshot()).toEqual({
      definitionId: null,
      rotation: 0,
      cell: null,
      pinned: false,
      feedback: null,
    });
  });

  it('o snapshot é imutável e estável entre leituras', () => {
    const store = createBuildStore();
    store.start('solar-array');
    store.hover(cell(3, 4));

    const snapshot = store.getSnapshot();

    expect(store.getSnapshot()).toBe(snapshot);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.cell)).toBe(true);
  });

  it('é serializável e não guarda objetos gráficos', () => {
    const store = createBuildStore();
    store.start('habitat-module');
    store.pin(cell(1, 2));

    const json = JSON.stringify(store.getSnapshot());

    expect(JSON.parse(json)).toEqual(store.getSnapshot());
    expect(json).not.toMatch(/mesh|scene|node|function/i);
  });

  it('start ativa o posicionamento do edifício escolhido', () => {
    const store = createBuildStore();

    store.start('water-extractor');

    expect(store.getSnapshot().definitionId).toBe('water-extractor');
  });

  it('trocar de edifício mantém a rotação, a célula e a posição fixada', () => {
    const store = createBuildStore();
    store.start('solar-array');
    store.rotate();
    store.pin(cell(7, 8));

    store.start('habitat-module');

    expect(store.getSnapshot()).toMatchObject({
      definitionId: 'habitat-module',
      rotation: 90,
      cell: cell(7, 8),
      pinned: true,
    });
  });

  describe('hover (o ponteiro passando por uma célula)', () => {
    it('move a prévia enquanto a posição não está fixada', () => {
      const store = createBuildStore();
      store.start('solar-array');

      store.hover(cell(5, 6));
      store.hover(cell(6, 6));

      expect(store.getSnapshot().cell).toEqual(cell(6, 6));
      expect(store.getSnapshot().pinned).toBe(false);
    });

    it('é ignorado quando o modo não está ativo', () => {
      const store = createBuildStore();
      const listener = vi.fn();
      store.subscribe(listener);

      store.hover(cell(5, 6));

      expect(store.getSnapshot().cell).toBeNull();
      expect(listener).not.toHaveBeenCalled();
    });

    it('a mesma célula não notifica nem troca o snapshot', () => {
      const store = createBuildStore();
      store.start('solar-array');
      store.hover(cell(5, 6));
      const snapshot = store.getSnapshot();
      const listener = vi.fn();
      store.subscribe(listener);

      store.hover(cell(5, 6));

      expect(listener).not.toHaveBeenCalled();
      expect(store.getSnapshot()).toBe(snapshot);
    });

    it('é ignorado depois de fixar a posição (o ponteiro indo até os botões não a move)', () => {
      const store = createBuildStore();
      store.start('solar-array');
      store.pin(cell(5, 6));

      store.hover(cell(30, 30));
      store.hover(cell(31, 30));

      expect(store.getSnapshot().cell).toEqual(cell(5, 6));
    });
  });

  describe('pin (clique no terreno)', () => {
    it('fixa a posição e um novo clique a move', () => {
      const store = createBuildStore();
      store.start('solar-array');

      store.pin(cell(5, 6));
      expect(store.getSnapshot()).toMatchObject({ cell: cell(5, 6), pinned: true });

      store.pin(cell(9, 9));
      expect(store.getSnapshot()).toMatchObject({ cell: cell(9, 9), pinned: true });
    });

    it('é ignorado quando o modo não está ativo', () => {
      const store = createBuildStore();

      store.pin(cell(5, 6));

      expect(store.getSnapshot().pinned).toBe(false);
      expect(store.getSnapshot().cell).toBeNull();
    });
  });

  describe('rotate', () => {
    it('gira 90° no sentido horário e volta a 0° depois de quatro giros', () => {
      const store = createBuildStore();
      store.start('solar-array');
      const seen: number[] = [];

      for (let step = 0; step < 5; step += 1) {
        store.rotate();
        seen.push(store.getSnapshot().rotation);
      }

      expect(seen).toEqual([90, 180, 270, 0, 90]);
    });

    it('é ignorado quando o modo não está ativo', () => {
      const store = createBuildStore();

      store.rotate();

      expect(store.getSnapshot().rotation).toBe(0);
    });
  });

  describe('cancel', () => {
    it('volta ao estado inicial, inclusive o aviso, e notifica uma vez', () => {
      const store = createBuildStore();
      store.start('solar-array');
      store.rotate();
      store.pin(cell(5, 6));
      store.report({ kind: 'rejected', error: 'INSUFFICIENT_RESOURCES' });
      const listener = vi.fn();
      store.subscribe(listener);

      store.cancel();

      expect(store.getSnapshot()).toEqual({
        definitionId: null,
        rotation: 0,
        cell: null,
        pinned: false,
        feedback: null,
      });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('é idempotente: cancelar de novo não notifica', () => {
      const store = createBuildStore();
      store.start('solar-array');
      store.cancel();
      const listener = vi.fn();
      store.subscribe(listener);

      store.cancel();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('complete e report (resultado da construção)', () => {
    it('complete encerra o posicionamento e guarda o resultado', () => {
      const store = createBuildStore();
      store.start('solar-array');
      store.rotate();
      store.pin(cell(5, 6));

      store.complete({ kind: 'queued', definitionId: 'solar-array' });

      expect(store.getSnapshot()).toEqual({
        definitionId: null,
        rotation: 0,
        cell: null,
        pinned: false,
        feedback: { kind: 'queued', definitionId: 'solar-array' },
      });
    });

    it('report guarda o resultado sem encerrar o posicionamento', () => {
      const store = createBuildStore();
      store.start('solar-array');
      store.pin(cell(5, 6));

      store.report({ kind: 'rejected', error: 'OVERLAPS_BUILDING' });

      expect(store.getSnapshot()).toMatchObject({
        definitionId: 'solar-array',
        cell: cell(5, 6),
        feedback: { kind: 'rejected', error: 'OVERLAPS_BUILDING' },
      });
    });

    it('escolher um edifício limpa o aviso anterior', () => {
      const store = createBuildStore();
      store.complete({ kind: 'applied', definitionId: 'solar-array' });

      store.start('habitat-module');

      expect(store.getSnapshot().feedback).toBeNull();
    });

    it('clearFeedback limpa só o aviso', () => {
      const store = createBuildStore();
      store.start('solar-array');
      store.report({ kind: 'rejected', error: 'OVERLAPS_BUILDING' });

      store.clearFeedback();

      expect(store.getSnapshot().feedback).toBeNull();
      expect(store.getSnapshot().definitionId).toBe('solar-array');
    });
  });

  describe('assinaturas', () => {
    it('notifica a cada mudança real e o cancelamento da assinatura é idempotente', () => {
      const store = createBuildStore();
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      store.start('solar-array');
      store.hover(cell(1, 1));
      store.rotate();
      unsubscribe();
      unsubscribe();
      store.hover(cell(2, 2));

      expect(listener).toHaveBeenCalledTimes(3);
    });
  });
});
