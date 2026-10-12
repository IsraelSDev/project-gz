import { describe, expect, it, vi } from 'vitest';
import { createSelectionStore } from '@/session/selectionStore';

// Código-fonte (texto) da camada, lido pelo Vite: o tsconfig dos testes não carrega os tipos do Node.
const sessionSources = import.meta.glob<string>('/src/session/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('store de seleção de sessão', () => {
  it('começa sem seleção', () => {
    const store = createSelectionStore();

    expect(store.getSnapshot()).toEqual({ selectedEntityId: null });
  });

  it('seleciona uma construção pelo identificador', () => {
    const store = createSelectionStore();

    store.select('building-habitat-01');

    expect(store.getSnapshot().selectedEntityId).toBe('building-habitat-01');
  });

  it('troca a construção selecionada', () => {
    const store = createSelectionStore();
    store.select('building-habitat-01');

    store.select('building-extractor-01');

    expect(store.getSnapshot().selectedEntityId).toBe('building-extractor-01');
  });

  it('limpa a seleção', () => {
    const store = createSelectionStore();
    store.select('building-habitat-01');

    store.clear();

    expect(store.getSnapshot().selectedEntityId).toBeNull();
  });

  it('notifica os assinantes a cada mudança real', () => {
    const store = createSelectionStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.select('a');
    store.select('b');
    store.clear();

    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('notifica com o novo estado já visível em getSnapshot', () => {
    const store = createSelectionStore();
    const seen: (string | null)[] = [];
    store.subscribe(() => seen.push(store.getSnapshot().selectedEntityId));

    store.select('a');
    store.clear();

    expect(seen).toEqual(['a', null]);
  });

  it('não notifica quando o valor não muda', () => {
    const store = createSelectionStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.clear();
    expect(listener).not.toHaveBeenCalled();

    store.select('a');
    store.select('a');
    expect(listener).toHaveBeenCalledOnce();

    store.clear();
    store.clear();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('devolve o mesmo snapshot enquanto nada muda e um novo quando algo muda', () => {
    const store = createSelectionStore();
    const initial = store.getSnapshot();

    expect(store.getSnapshot()).toBe(initial);
    store.clear();
    expect(store.getSnapshot()).toBe(initial);

    store.select('a');
    const selected = store.getSnapshot();
    expect(selected).not.toBe(initial);
    store.select('a');
    expect(store.getSnapshot()).toBe(selected);
  });

  it('expõe a seleção como estado somente leitura', () => {
    const store = createSelectionStore();
    store.select('a');
    const snapshot = store.getSnapshot();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => {
      (snapshot as { selectedEntityId: string | null }).selectedEntityId = 'outro';
    }).toThrow(TypeError);
    expect(store.getSnapshot().selectedEntityId).toBe('a');
  });

  it('para de notificar quem cancelou a assinatura', () => {
    const store = createSelectionStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.select('a');

    expect(listener).not.toHaveBeenCalled();
  });

  it('guarda só dados simples e serializáveis, sem objetos gráficos', () => {
    const store = createSelectionStore();
    store.select('building-habitat-01');

    const snapshot = store.getSnapshot();

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(Object.keys(snapshot)).toEqual(['selectedEntityId']);
  });

  it('não depende de React nem de Babylon.js (o ESLint também impõe isso)', () => {
    const sources = Object.values(sessionSources);
    expect(sources.length).toBeGreaterThan(0);

    for (const source of sources) {
      const imports = source.match(/^import .+$/gm) ?? [];
      expect(imports.some((line) => /react|babylon/i.test(line))).toBe(false);
    }
  });
});
