import { describe, expect, it } from 'vitest';
import { BUILDING_DEFINITIONS, getBuildingDefinition } from '@/game/content/buildings';
import { RESOURCE_IDS } from '@/game/content/resources';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import {
  executeSimulationCommand,
  type SimulationCommand,
} from '@/game/domain/commands/simulationCommand';
import {
  BUILDING_ID_PREFIX,
  createPlaceBuildingHandler,
  placeBuildingCommand,
} from '@/game/domain/construction/placeBuildingCommand';
import type { ConstructionDefinitions } from '@/game/domain/construction/placement';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { GameState } from '@/game/domain/state/GameState';
import { validateGameState } from '@/game/domain/state/validateGameState';
import type { Rotation } from '@/shared/grid/types';

/*
 * O comando `PlaceBuilding` no domínio (sem relógio, controlador, interface nem cena). Posições
 * livres do cenário inicial (área construível x 12..28, y 12..28; nave em x 14..22, y 13..18;
 * habitat em (14, 20), extrator em (21, 20) e matriz solar em (23, 23) girada):
 */
const FREE_A = { x: 24, y: 13 };
const FREE_B = { x: 12, y: 24 };
const FREE_C = { x: 24, y: 16 };

const initial = () => createInitialGameState(INITIAL_SCENARIO);
const withResources = (state: GameState, patch: Partial<GameState['resources']>): GameState => ({
  ...state,
  resources: { ...state.resources, ...patch },
});

function place(
  state: GameState,
  definitionId: keyof typeof BUILDING_DEFINITIONS,
  position = FREE_A,
  rotation: Rotation = 0,
) {
  return executeSimulationCommand(
    state,
    placeBuildingCommand({ definitionId, position, rotation }),
  );
}

describe('PlaceBuilding: construção válida', () => {
  it('cria o edifício com posição, rotação e identificador do contador', () => {
    const state = initial();

    const result = place(state, 'solar-array', FREE_A, 90);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const built = result.value.buildings.at(-1);
    expect(built).toEqual({
      instanceId: 'building-1',
      definitionId: 'solar-array',
      position: FREE_A,
      rotation: 90,
    });
    expect(result.value.buildings).toHaveLength(state.buildings.length + 1);
    expect(result.value.nextEntityId).toBe(2);
  });

  it('preserva os edifícios iniciais (as mesmas instâncias, na mesma ordem)', () => {
    const state = initial();

    const result = place(state, 'solar-array');

    expect(result.ok && result.value.buildings.slice(0, state.buildings.length)).toEqual(
      state.buildings,
    );
    expect(result.ok && result.value.buildings[0]).toBe(state.buildings[0]);
  });

  it('o estado resultante é válido, congelado e serializável', () => {
    const result = place(initial(), 'habitat-module', FREE_B);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(validateGameState(result.value)).toEqual([]);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.buildings)).toBe(true);
    expect(Object.isFrozen(result.value.buildings.at(-1))).toBe(true);
    expect(JSON.parse(JSON.stringify(result.value))).toEqual(result.value);
  });

  it('não guarda referências ao comando nem a objetos gráficos', () => {
    const command = placeBuildingCommand({
      definitionId: 'solar-array',
      position: { ...FREE_A },
      rotation: 0,
    });

    const result = executeSimulationCommand(initial(), command);

    expect(result.ok && result.value.buildings.at(-1)?.position).not.toBe(command.position);
    expect(JSON.stringify(result.ok && result.value)).not.toMatch(/mesh|scene|node|function/i);
  });

  it('não altera o estado de entrada', () => {
    const state = freezeDeep(initial());
    const before = JSON.stringify(state);

    place(state, 'solar-array');
    place(state, 'solar-array', { x: 0, y: 0 });

    expect(JSON.stringify(state)).toBe(before);
  });

  it('é determinística: o mesmo estado e o mesmo comando dão o mesmo resultado', () => {
    const run = () => JSON.stringify(place(initial(), 'hydroponic-farm', FREE_B, 180));

    expect(run()).toBe(run());
  });
});

describe('PlaceBuilding: desconto dos recursos', () => {
  it.each(Object.values(BUILDING_DEFINITIONS))(
    'desconta exatamente o custo de $name e só ele',
    (definition) => {
      const state = {
        ...withResources(initial(), {
          food: 500,
          water: 500,
          materials: 500,
          energy: 500,
        }),
        research: {
          unlockedTechnologyIds: ['protein-cultures', 'thermal-engineering'],
          activeTechnologyId: null,
          progress: 0,
        },
      };

      const result = place(state, definition.id, FREE_B);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      for (const id of RESOURCE_IDS) {
        const cost = getBuildingDefinition(definition.id).cost[id] ?? 0;
        expect(result.value.resources[id], `${definition.id}/${id}`).toBe(
          state.resources[id] - cost,
        );
      }
    },
  );

  it('um custo em vários recursos desconta todos (estufa: materiais e água)', () => {
    const state = initial();

    const result = place(state, 'hydroponic-farm', FREE_B);

    expect(result.ok && result.value.resources).toEqual({
      ...state.resources,
      materials: state.resources.materials - 40,
      water: state.resources.water - 30,
    });
  });

  it('o tick e a economia não participam: construir não avança o tempo nem produz', () => {
    const state = initial();

    const result = place(state, 'solar-array');

    expect(result.ok && result.value.tick).toBe(state.tick);
    expect(result.ok && result.value.resources.energy).toBe(state.resources.energy);
  });

  it('o estoque que cobre o custo exatamente é suficiente e fica em zero', () => {
    const state = withResources(initial(), { materials: 30 });

    const result = place(state, 'solar-array');

    expect(result.ok && result.value.resources.materials).toBe(0);
  });
});

describe('PlaceBuilding: operações inválidas não alteram nada', () => {
  type PlaceArgs = [
    definitionId: keyof typeof BUILDING_DEFINITIONS,
    position?: { x: number; y: number },
    rotation?: Rotation,
  ];
  const cases: readonly [string, () => GameState, PlaceArgs, string][] = [
    [
      'recursos insuficientes',
      () => withResources(initial(), { materials: 29 }),
      ['solar-array'],
      'INSUFFICIENT_RESOURCES',
    ],
    [
      'falta de um dos recursos do custo',
      () => withResources(initial(), { water: 29 }),
      ['hydroponic-farm', FREE_B],
      'INSUFFICIENT_RESOURCES',
    ],
    ['fora da área construível', initial, ['solar-array', { x: 2, y: 2 }], 'OUT_OF_BUILDABLE_AREA'],
    [
      'só parte dentro da área',
      initial,
      ['solar-array', { x: 27, y: 27 }],
      'OUT_OF_BUILDABLE_AREA',
    ],
    ['sobre um edifício inicial', initial, ['solar-array', { x: 14, y: 21 }], 'OVERLAPS_BUILDING'],
    ['sobre a nave', initial, ['solar-array', { x: 18, y: 14 }], 'OVERLAPS_OBSTACLE'],
  ];

  it.each(cases)(
    '%s: recusa com o código certo, sem desconto e sem consumir identificador',
    (_name, makeState, args, code) => {
      const state = freezeDeep(makeState());
      const before = JSON.stringify(state);

      const result = place(state, ...args);

      expect(result).toEqual({ ok: false, error: code });
      expect(JSON.stringify(state)).toBe(before);
    },
  );

  it('uma recusa não consome identificador: a construção seguinte recebe o mesmo número', () => {
    const state = initial();

    const refused = place(state, 'solar-array', { x: 2, y: 2 });
    const accepted = place(state, 'solar-array');

    expect(refused.ok).toBe(false);
    expect(accepted.ok && accepted.value.buildings.at(-1)?.instanceId).toBe('building-1');
  });

  it('construir duas vezes no mesmo lugar: a segunda é recusada e o custo é cobrado só uma vez', () => {
    const first = place(initial(), 'solar-array');
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = place(first.value, 'solar-array');

    expect(second).toEqual({ ok: false, error: 'OVERLAPS_BUILDING' });
    expect(first.value.resources.materials).toBe(initial().resources.materials - 30);
  });
});

describe('PlaceBuilding: comando malformado', () => {
  const command = (patch: Record<string, unknown>): SimulationCommand => ({
    ...placeBuildingCommand({ definitionId: 'solar-array', position: FREE_A, rotation: 0 }),
    ...patch,
  });

  it.each([
    ['definição desconhecida', { definitionId: 'castelo' }],
    ['definição herdada (__proto__)', { definitionId: '__proto__' }],
    ['definição herdada (constructor)', { definitionId: 'constructor' }],
    ['definição que não é texto', { definitionId: 42 }],
    ['definição ausente', { definitionId: undefined }],
    ['rotação inválida', { rotation: 45 }],
    ['rotação como texto', { rotation: '90' }],
    ['rotação ausente', { rotation: undefined }],
    ['posição ausente', { position: undefined }],
    ['posição nula', { position: null }],
    ['posição fracionária', { position: { x: 1.5, y: 2 } }],
    ['posição NaN', { position: { x: Number.NaN, y: 2 } }],
    ['posição infinita', { position: { x: 2, y: Number.POSITIVE_INFINITY } }],
    ['posição como texto', { position: { x: '12', y: 24 } }],
    ['posição incompleta', { position: { x: 12 } }],
  ])('recusa %s com INVALID_COMMAND', (_name, patch) => {
    const state = initial();

    expect(executeSimulationCommand(state, command(patch))).toEqual({
      ok: false,
      error: 'INVALID_COMMAND',
    });
  });

  it('um comando só com o tipo é malformado', () => {
    expect(executeSimulationCommand(initial(), { type: 'PlaceBuilding' })).toEqual({
      ok: false,
      error: 'INVALID_COMMAND',
    });
  });
});

describe('PlaceBuilding: identificadores únicos', () => {
  it('cada construção recebe um identificador novo, em sequência, e o contador só cresce', () => {
    let state = initial();
    const spots = [FREE_A, FREE_B, FREE_C];

    for (const spot of spots) {
      const result = place(state, 'solar-array', spot);
      expect(result.ok).toBe(true);
      if (result.ok) {
        state = result.value;
      }
    }

    const added = state.buildings.slice(-3).map((building) => building.instanceId);
    expect(added).toEqual(['building-1', 'building-2', 'building-3']);
    expect(state.nextEntityId).toBe(4);
  });

  it('todos os identificadores do estado são distintos, inclusive dos edifícios iniciais', () => {
    let state = initial();
    for (const spot of [FREE_A, FREE_B, FREE_C]) {
      const result = place(state, 'solar-array', spot);
      if (result.ok) {
        state = result.value;
      }
    }

    const ids = state.buildings.map((building) => building.instanceId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 3)).toEqual(
      INITIAL_SCENARIO.initialBuildings.map((building) => building.instanceId),
    );
    expect(ids.slice(3).every((id) => id.startsWith(BUILDING_ID_PREFIX))).toBe(true);
  });

  it('o identificador não depende do tipo, da posição nem da rotação', () => {
    const a = place(initial(), 'solar-array', FREE_A, 0);
    const b = place(initial(), 'hydroponic-farm', FREE_B, 270);

    expect(a.ok && a.value.buildings.at(-1)?.instanceId).toBe('building-1');
    expect(b.ok && b.value.buildings.at(-1)?.instanceId).toBe('building-1');
  });

  it('um contador no limite recusa o comando em vez de gerar um identificador inexato', () => {
    const state = { ...initial(), nextEntityId: Number.MAX_SAFE_INTEGER };

    expect(place(state, 'solar-array')).toEqual({ ok: false, error: 'INVALID_STATE' });
  });

  it('um estado com contador inválido não é um estado válido', () => {
    for (const nextEntityId of [0, -1, 1.5, Number.NaN]) {
      expect(validateGameState({ ...initial(), nextEntityId }).join()).toMatch(/nextEntityId/);
    }
  });

  it('o estado inicial começa o contador em 1', () => {
    expect(initial().nextEntityId).toBe(1);
  });
});

describe('PlaceBuilding: tratador com terreno e definições próprios', () => {
  const definitions: ConstructionDefinitions = {
    hut: { footprint: { width: 2, depth: 2 }, cost: { materials: 10 } },
  };
  const terrain = { buildableArea: { x: 0, y: 0, width: 4, depth: 4 }, obstacles: [] };
  const handler = createPlaceBuildingHandler(terrain, definitions);
  const run = (state: GameState, patch: Record<string, unknown> = {}) => {
    const command: SimulationCommand & Record<string, unknown> = {
      type: 'PlaceBuilding',
      definitionId: 'hut',
      position: { x: 0, y: 0 },
      rotation: 0,
      ...patch,
    };
    return handler(state, command);
  };

  // Sem os edifícios iniciais: o conjunto de definições injetado não os conhece.
  const empty = (): GameState => ({ ...initial(), buildings: [] });

  it('usa o terreno e as definições injetados', () => {
    const state = empty();

    const inside = run(state);
    const outside = run(state, { position: { x: 3, y: 3 } });

    expect(inside.ok && inside.value.resources.materials).toBe(state.resources.materials - 10);
    expect(outside).toEqual({ ok: false, error: 'OUT_OF_BUILDABLE_AREA' });
  });

  it('só aceita definições do conjunto injetado', () => {
    expect(run(empty(), { definitionId: 'solar-array' })).toEqual({
      ok: false,
      error: 'INVALID_COMMAND',
    });
  });
});
