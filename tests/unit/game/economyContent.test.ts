import { describe, expect, it } from 'vitest';
import { BUILDING_DEFINITIONS } from '@/game/content/buildings';
import { RESOURCE_IDS } from '@/game/content/resources';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { advanceEconomy } from '@/game/domain/economy/advanceEconomy';
import { validateBuildingEconomy } from '@/game/domain/economy/validateBuildingEconomy';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { validateGameState } from '@/game/domain/state/validateGameState';
import {
  expectedBuildingResourcesAfter,
  scenarioConsumptionPerTick,
  scenarioNetPerTick,
} from '../../support/economyExpectations';

/*
 * O conteúdo econômico REAL (definições dos edifícios e cenário inicial). Os números são provisórios
 * (P-21): estes testes não os fixam; conferem que o conteúdo é válido e que o jogo produz o que a
 * soma simples das definições prevê.
 */

describe('validação do conteúdo econômico', () => {
  it('as definições de edifícios entregues com o jogo são válidas', () => {
    expect(validateBuildingEconomy(BUILDING_DEFINITIONS)).toEqual([]);
  });

  it('todo edifício declara produção e consumo explicitamente (vazios quando não há)', () => {
    for (const definition of Object.values(BUILDING_DEFINITIONS)) {
      expect(definition.production).toBeTypeOf('object');
      expect(definition.consumption).toBeTypeOf('object');
    }
  });

  it.each([
    ['fracionária', { energy: 1.5 }, /energy.*inteiro positivo/],
    ['zero', { energy: 0 }, /energy.*inteiro positivo/],
    ['negativa', { energy: -2 }, /energy.*inteiro positivo/],
    ['NaN', { energy: Number.NaN }, /energy.*inteiro positivo/],
    ['infinita', { water: Number.POSITIVE_INFINITY }, /water.*inteiro positivo/],
    ['como texto', { food: '3' }, /food.*inteiro positivo/],
    ['de um recurso desconhecido', { gold: 2 }, /desconhecido: "gold"/],
  ])('rejeita uma taxa %s', (_name, rates, message) => {
    const issues = validateBuildingEconomy({
      thing: { production: rates, consumption: {} } as never,
    });

    expect(issues.some((issue) => message.test(issue))).toBe(true);
  });

  it('rejeita taxas que não são um objeto e chaves perigosas', () => {
    const notObject = validateBuildingEconomy({
      a: { cost: {}, production: null, consumption: [] } as never,
    });
    const proto = validateBuildingEconomy({
      b: { cost: {}, production: JSON.parse('{"__proto__": 1}'), consumption: {} } as never,
    });

    expect(notObject).toHaveLength(2);
    expect(proto.some((issue) => issue.includes('__proto__'))).toBe(true);
  });

  it('o estado inicial recusa começar com conteúdo econômico inválido', () => {
    const original = BUILDING_DEFINITIONS['solar-array'].production;
    // O conteúdo é `as const`; a mutação abaixo só existe para provar que o estado recusa dados ruins.
    (BUILDING_DEFINITIONS['solar-array'] as { production: unknown }).production = { energy: -1 };
    try {
      expect(() => createInitialGameState(INITIAL_SCENARIO)).toThrow(
        /Conteúdo de edifícios inválido/,
      );
    } finally {
      (BUILDING_DEFINITIONS['solar-array'] as { production: unknown }).production = original;
    }

    expect(() => createInitialGameState(INITIAL_SCENARIO)).not.toThrow();
  });
});

describe('economia do cenário inicial', () => {
  const initial = () => createInitialGameState(INITIAL_SCENARIO);

  it('o estoque inicial cobre o consumo de todos os edifícios (todos operam desde o primeiro passo)', () => {
    const consumption = scenarioConsumptionPerTick();

    for (const id of RESOURCE_IDS) {
      expect(INITIAL_SCENARIO.initialResources[id]).toBeGreaterThanOrEqual(consumption[id]);
    }
  });

  it('um passo muda os estoques exatamente pela soma das definições', () => {
    const state = initial();

    const next = advanceEconomy(state.resources, state.buildings);

    expect(next).toEqual(expectedBuildingResourcesAfter(1));
  });

  it('muitos passos seguidos mantêm a mesma taxa líquida, sem falta nem valores inválidos', () => {
    let state = initial();
    let resources = state.resources;
    for (let tick = 1; tick <= 100; tick += 1) {
      resources = advanceEconomy(resources, state.buildings);
      state = { ...state, resources };
      expect(validateGameState(state)).toEqual([]);
    }

    expect(resources).toEqual(expectedBuildingResourcesAfter(100));
  });

  it('o conteúdo atual só move os recursos que algum edifício produz ou consome', () => {
    // Alimentos e materiais não têm produtor nem consumidor ainda: o consumo de alimentos é da
    // população (Fase 9) e os materiais entram com a construção (Fase 6). Se a Fase 6 ou a 9
    // mudar isto de propósito, este teste deve ser atualizado junto com DECISIONS.md (D-48).
    const net = scenarioNetPerTick();

    expect(net.food).toBe(0);
    expect(net.materials).toBe(0);
    expect(net.water).toBeGreaterThan(0);
    expect(net.energy).toBeGreaterThanOrEqual(0);
  });
});
