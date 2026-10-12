import { describe, expect, it, vi } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { selectBuildingDetails, selectResourceEntries } from '@/game/application/selectors';
import { getBuildingDefinition } from '@/game/content/buildings';
import { RESOURCE_DEFINITIONS, RESOURCE_IDS } from '@/game/content/resources';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';

const createController = () => createGameController(createInitialGameState(INITIAL_SCENARIO));

// Código-fonte (texto) da camada, lido pelo Vite: o tsconfig dos testes não carrega os tipos do Node.
const applicationSources = import.meta.glob<string>('/src/game/application/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('GameController', () => {
  it('expõe um snapshot inicial válido, derivado do cenário', () => {
    const snapshot = createController().getSnapshot();

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.contentVersion).toBe(INITIAL_SCENARIO.contentVersion);
    expect(snapshot.tick).toBe(0);
    expect(snapshot.resources).toEqual(INITIAL_SCENARIO.initialResources);
    expect(snapshot.buildings.map((building) => building.instanceId)).toEqual(
      INITIAL_SCENARIO.initialBuildings.map((building) => building.instanceId),
    );
  });

  it('devolve o mesmo snapshot (mesma referência) enquanto o estado não muda', () => {
    const controller = createController();

    const first = controller.getSnapshot();

    expect(controller.getSnapshot()).toBe(first);
    expect(controller.getSnapshot()).toBe(first);
  });

  it('entrega um snapshot imutável e serializável', () => {
    const snapshot = createController().getSnapshot();

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.resources)).toBe(true);
    expect(Object.isFrozen(snapshot.buildings)).toBe(true);
    expect(() => {
      (snapshot as { tick: number }).tick = 1;
    }).toThrow(TypeError);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('aceita assinar e cancelar a assinatura, inclusive cancelar duas vezes', () => {
    const controller = createController();
    const listener = vi.fn();

    const unsubscribe = controller.subscribe(listener);
    expect(typeof unsubscribe).toBe('function');

    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
    // Sem comandos nesta fase, o estado é estático: ninguém é notificado.
    expect(listener).not.toHaveBeenCalled();
  });

  it('lê o estado sem Babylon.js: roda em Node, sem DOM, e a camada não importa a engine', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');

    const sources = Object.values(applicationSources);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      const imports = (source.match(/^import .+$/gm) ?? []).join('\n');
      expect(imports).not.toMatch(/babylon|react|rendering|presentation|session/i);
    }
  });
});

describe('definições de recursos', () => {
  it('têm um nome para cada recurso e id coerente com a chave', () => {
    for (const id of RESOURCE_IDS) {
      expect(RESOURCE_DEFINITIONS[id].id).toBe(id);
      expect(RESOURCE_DEFINITIONS[id].name.trim()).not.toBe('');
    }
  });
});

describe('seletores de recursos', () => {
  const state = createInitialGameState(INITIAL_SCENARIO);

  it('listam os recursos do estado, com nome do conteúdo e quantidade do estado', () => {
    const entries = selectResourceEntries(state);

    expect(entries.map((entry) => entry.id)).toEqual([...RESOURCE_IDS]);
    for (const entry of entries) {
      expect(entry.name).toBe(RESOURCE_DEFINITIONS[entry.id].name);
      expect(entry.amount).toBe(state.resources[entry.id]);
    }
  });

  it('refletem uma mudança de valor no estado (nada é fixo no seletor)', () => {
    const changed: GameState = { ...state, resources: { ...state.resources, water: 1234 } };

    const water = selectResourceEntries(changed).find((entry) => entry.id === 'water');

    expect(water?.amount).toBe(1234);
  });

  it('não inventam um recurso ausente do estado', () => {
    const withoutEnergy = Object.fromEntries(
      Object.entries(state.resources).filter(([id]) => id !== 'energy'),
    );
    const partial = { ...state, resources: withoutEnergy } as unknown as GameState;

    const entries = selectResourceEntries(partial);

    expect(entries.map((entry) => entry.id)).toEqual(['food', 'water', 'materials']);
  });

  it('marcam como indisponível (null) um valor inválido, sem exibi-lo como número', () => {
    const invalid = {
      ...state,
      resources: { ...state.resources, food: Number.NaN, water: Number.POSITIVE_INFINITY },
    };

    const entries = selectResourceEntries(invalid);

    expect(entries.find((entry) => entry.id === 'food')?.amount).toBeNull();
    expect(entries.find((entry) => entry.id === 'water')?.amount).toBeNull();
    expect(entries.find((entry) => entry.id === 'materials')?.amount).toBe(
      state.resources.materials,
    );
  });
});

describe('seletor de detalhes da construção', () => {
  const state = createInitialGameState(INITIAL_SCENARIO);

  it('combina a instância do estado com a definição do conteúdo', () => {
    const details = selectBuildingDetails(state, 'building-habitat-01');
    const definition = getBuildingDefinition('habitat-module');

    expect(details).toEqual({
      instanceId: 'building-habitat-01',
      definitionId: 'habitat-module',
      name: definition.name,
      category: definition.category,
      position: { x: 14, y: 20 },
      rotation: 0,
      occupied: { width: 3, depth: 3 },
    });
  });

  it('informa a área ocupada já considerando a rotação', () => {
    // A matriz solar é 3x2 e está girada em 90°: ocupa 2 células em x e 3 em y.
    const details = selectBuildingDetails(state, 'building-solar-01');

    expect(details?.rotation).toBe(90);
    expect(details?.occupied).toEqual({ width: 2, depth: 3 });
  });

  it('devolve null para um identificador que não existe no estado', () => {
    expect(selectBuildingDetails(state, 'nao-existe')).toBeNull();
    expect(selectBuildingDetails(state, '')).toBeNull();
    expect(selectBuildingDetails(state, 'BUILDING-HABITAT-01')).toBeNull();
  });
});
