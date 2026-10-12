import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { advanceSimulationStep } from '@/game/domain/simulation/advanceSimulationStep';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';
import { validateGameState } from '@/game/domain/state/validateGameState';
import { TICK_GAME_SECONDS } from '@/game/domain/time/ticks';

const initial = () => createInitialGameState(INITIAL_SCENARIO);

/** Estado com campos sobrescritos sem passar pelos tipos (para provar a rejeição de dados ruins). */
const corrupt = (patch: Record<string, unknown>): GameState =>
  ({ ...initial(), ...patch }) as unknown as GameState;

describe('modelo de estado da partida', () => {
  it('o estado inicial é válido', () => {
    expect(validateGameState(initial())).toEqual([]);
  });

  it('tem exatamente os campos persistentes previstos (sem paused, speed nem seleção)', () => {
    expect(Object.keys(initial()).sort()).toEqual(
      [
        'buildings',
        'characters',
        'contentVersion',
        'diplomacy',
        'events',
        'exploration',
        'government',
        'nextEntityId',
        'population',
        'relationships',
        'research',
        'resources',
        'schemaVersion',
        'tick',
      ].sort(),
    );
  });

  it('é serializável e não carrega funções, objetos gráficos nem estado de interface ou do relógio', () => {
    const state = initial();
    const json = JSON.stringify(state);

    expect(JSON.parse(json)).toEqual(state);
    expect(json).not.toMatch(/"(paused|speed|selected|mesh|scene|engine|canvas)"|function/i);
  });

  it('a duração do tick é de 1 segundo de tempo de jogo (D-41)', () => {
    expect(TICK_GAME_SECONDS).toBe(1);
  });
});

describe('validação do estado', () => {
  it.each([
    ['schemaVersion diferente', { schemaVersion: 99 }, /schemaVersion/],
    ['contentVersion vazio', { contentVersion: '  ' }, /contentVersion/],
    ['tick negativo', { tick: -1 }, /tick/],
    ['tick fracionário', { tick: 1.5 }, /tick/],
    ['tick NaN', { tick: Number.NaN }, /tick/],
    ['tick infinito', { tick: Number.POSITIVE_INFINITY }, /tick/],
  ])('rejeita %s', (_name, patch, message) => {
    const issues = validateGameState(corrupt(patch));

    expect(issues.some((issue) => message.test(issue))).toBe(true);
  });

  it.each([
    ['recurso negativo', { food: -1 }],
    ['recurso fracionário', { water: 0.5 }],
    ['recurso NaN', { materials: Number.NaN }],
    ['recurso infinito', { energy: Number.POSITIVE_INFINITY }],
  ])('rejeita %s', (_name, patch) => {
    const state = initial();

    const issues = validateGameState(corrupt({ resources: { ...state.resources, ...patch } }));

    expect(issues.some((issue) => issue.startsWith('resources.'))).toBe(true);
  });

  it('rejeita recurso ausente e recurso desconhecido, inclusive chaves perigosas', () => {
    const withoutEnergy = Object.fromEntries(
      Object.entries(initial().resources).filter(([id]) => id !== 'energy'),
    );
    const missing = validateGameState(corrupt({ resources: withoutEnergy }));
    const unknown = validateGameState(corrupt({ resources: { ...initial().resources, gold: 5 } }));
    const proto = validateGameState(
      corrupt({
        resources: JSON.parse('{"food":1,"water":1,"materials":1,"energy":1,"__proto__":{"x":1}}'),
      }),
    );

    expect(missing.some((issue) => issue.includes('resources.energy'))).toBe(true);
    expect(unknown.some((issue) => issue.includes('"gold"'))).toBe(true);
    expect(proto.some((issue) => issue.includes('__proto__'))).toBe(true);
  });

  it('rejeita edifícios com instanceId vazio ou duplicado, definição desconhecida e rotação inválida', () => {
    const [first] = initial().buildings;
    if (!first) {
      throw new Error('O estado inicial precisa ter edifícios.');
    }

    const blank = validateGameState(corrupt({ buildings: [{ ...first, instanceId: ' ' }] }));
    const duplicated = validateGameState(corrupt({ buildings: [first, first] }));
    const unknown = validateGameState(
      corrupt({ buildings: [{ ...first, definitionId: 'inexistente' }] }),
    );
    const rotation = validateGameState(corrupt({ buildings: [{ ...first, rotation: 45 }] }));
    const position = validateGameState(
      corrupt({ buildings: [{ ...first, position: { x: 1.5, y: 2 } }] }),
    );

    expect(blank.some((issue) => issue.includes('instanceId'))).toBe(true);
    expect(duplicated.some((issue) => issue.includes('duplicado'))).toBe(true);
    expect(unknown.some((issue) => issue.includes('definição'))).toBe(true);
    expect(rotation.some((issue) => issue.includes('rotação'))).toBe(true);
    expect(position.some((issue) => issue.includes('posição'))).toBe(true);
  });

  it('acumula todos os problemas em vez de parar no primeiro e nunca lança', () => {
    const issues = validateGameState(corrupt({ tick: -1, contentVersion: '' }));

    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});

describe('transição de estado por passo de simulação', () => {
  /** Estado sem edifícios: a economia não tem o que produzir nem consumir. */
  const withoutBuildings = (): GameState => ({ ...initial(), buildings: [] });

  it('incrementa o tick e cobra as necessidades quando não há edifícios produtivos', () => {
    const state = withoutBuildings();

    const next = advanceSimulationStep(state);

    expect(next.tick).toBe(state.tick + 1);
    expect(next.resources).toEqual({ ...state.resources, food: 298, water: 298 });
    expect(next.population).toEqual(state.population);
  });

  it('com edifícios, só o tick e os recursos mudam (a economia roda no passo, Fase 5)', () => {
    const state = initial();

    const next = advanceSimulationStep(state);

    expect(next.tick).toBe(state.tick + 1);
    expect(next.resources).not.toEqual(state.resources);
    expect(next.population.stableTicks).toBe(1);
    expect(next.buildings).toBe(state.buildings);
  });

  it('não altera o estado de entrada (pura)', () => {
    const state = initial();
    const before = JSON.stringify(state);

    advanceSimulationStep(state);

    expect(JSON.stringify(state)).toBe(before);
    expect(state.tick).toBe(0);
  });

  it('devolve um estado válido, congelado e que mantém a referência do que não mudou', () => {
    const state = initial();

    const next = advanceSimulationStep(state);

    expect(validateGameState(next)).toEqual([]);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.resources)).toBe(true);
    expect(next).not.toBe(state);
    expect(next.buildings).toBe(state.buildings);
  });

  it('troca os recursos por causa das necessidades mesmo sem economia de edifícios', () => {
    const state = withoutBuildings();

    const next = advanceSimulationStep(state);

    expect(next.resources).not.toBe(state.resources);
    expect(next.resources.food).toBe(state.resources.food - 2);
    expect(next.resources.water).toBe(state.resources.water - 2);
    expect(next.buildings).toBe(state.buildings);
  });

  it('é determinística: o mesmo estado e o mesmo número de passos dão o mesmo resultado', () => {
    const run = () => {
      let state = initial();
      for (let step = 0; step < 25; step += 1) {
        state = advanceSimulationStep(state);
      }
      return JSON.stringify(state);
    };

    expect(run()).toBe(run());
    expect(JSON.parse(run()).tick).toBe(25);
  });

  it('recusa estourar o maior inteiro seguro (bug, não falha esperada)', () => {
    const state = corrupt({ tick: Number.MAX_SAFE_INTEGER });

    expect(() => advanceSimulationStep(state)).toThrow(RangeError);
  });
});

describe('estado inicial validado', () => {
  it('createInitialGameState recusa um cenário cujo estado seria inválido', () => {
    const scenario = {
      ...INITIAL_SCENARIO,
      initialResources: { ...INITIAL_SCENARIO.initialResources, food: -5 },
    };

    expect(() => createInitialGameState(scenario)).toThrow(/Cenário inicial inválido/);
  });
});
