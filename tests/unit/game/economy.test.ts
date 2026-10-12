import { describe, expect, it } from 'vitest';
import { MAX_RESOURCE_AMOUNT, RESOURCE_IDS } from '@/game/content/resources';
import { advanceEconomy, type EconomyDefinitions } from '@/game/domain/economy/advanceEconomy';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { ResourceStock } from '@/game/domain/state/GameState';

/*
 * Regras econômicas do domínio, testadas SEM renderização, relógio ou interface. Os testes usam
 * definições de edifício FICTÍCIAS (com os quatro recursos), não os números provisórios do conteúdo:
 * as regras valem para qualquer conteúdo, e o conteúdo real tem seus próprios testes
 * (economyContent.test.ts).
 */

const definitions = {
  /** Só produz (sem insumo). */
  farm: { production: { food: 5 }, consumption: {} },
  solar: { production: { energy: 6 }, consumption: {} },
  /** Produz usando energia. */
  well: { production: { water: 4 }, consumption: { energy: 3 } },
  /** Usa dois insumos. */
  mine: { production: { materials: 2 }, consumption: { energy: 1, water: 1 } },
  /** Só consome. */
  lamp: { production: {}, consumption: { energy: 2 } },
  /** Insumo grande, para forçar falta. */
  furnace: { production: { materials: 9 }, consumption: { energy: 5 } },
  /** Não faz nada. */
  statue: { production: {}, consumption: {} },
} as const satisfies EconomyDefinitions;

type Kind = keyof typeof definitions;

const stock = (patch: Partial<ResourceStock> = {}): ResourceStock => ({
  food: 0,
  water: 0,
  materials: 0,
  energy: 0,
  ...patch,
});
const buildings = (...kinds: Kind[]) => kinds.map((definitionId) => ({ definitionId }));
const step = (resources: ResourceStock, ...kinds: Kind[]) =>
  advanceEconomy(resources, buildings(...kinds), definitions);

describe('economia: produção', () => {
  it.each([
    ['alimentos', 'farm', { food: 5 }],
    ['energia', 'solar', { energy: 6 }],
  ] as const)('um edifício sem insumo produz %s a cada passo', (_name, kind, expected) => {
    expect(step(stock(), kind)).toEqual(stock(expected));
  });

  it('produz cada um dos quatro recursos quando o edifício opera', () => {
    const next = step(stock({ energy: 10, water: 10 }), 'farm', 'well', 'mine', 'solar');

    // food +5; água 10 + 4 - 1; materiais +2; energia 10 + 6 - 3 - 1.
    expect(next).toEqual({ food: 5, water: 13, materials: 2, energy: 12 });
  });

  it('várias instâncias do mesmo edifício somam', () => {
    expect(step(stock(), 'solar', 'solar', 'solar')).toEqual(stock({ energy: 18 }));
  });

  it('acumula passo a passo sobre o estoque anterior', () => {
    let resources = stock({ food: 100 });
    for (let tick = 0; tick < 10; tick += 1) {
      resources = step(resources, 'farm');
    }

    expect(resources.food).toBe(150);
  });
});

describe('economia: consumo', () => {
  it('um edifício que opera consome o seu insumo e entrega o resultado', () => {
    expect(step(stock({ energy: 10 }), 'well')).toEqual(stock({ energy: 7, water: 4 }));
  });

  it('um edifício só de consumo apenas gasta', () => {
    expect(step(stock({ energy: 10 }), 'lamp')).toEqual(stock({ energy: 8 }));
  });

  it('consome todos os insumos de um edifício de uma vez', () => {
    expect(step(stock({ energy: 5, water: 5 }), 'mine')).toEqual(
      stock({ energy: 4, water: 4, materials: 2 }),
    );
  });

  it('o estoque que cobre o consumo exatamente é suficiente (limite inclusivo)', () => {
    expect(step(stock({ energy: 3 }), 'well')).toEqual(stock({ energy: 0, water: 4 }));
  });

  it('o consumo de vários edifícios soma e a produção de outro o compensa', () => {
    const first = step(stock({ energy: 20 }), 'solar', 'lamp', 'lamp');

    expect(first.energy).toBe(20 + 6 - 2 - 2);
  });
});

describe('economia: estoque insuficiente (regra de falta)', () => {
  it('sem estoque para o insumo, o edifício fica parado: não consome e não produz', () => {
    const resources = stock({ energy: 2 });

    const next = step(resources, 'well');

    expect(next).toEqual(resources);
    expect(next).toBe(resources);
  });

  it('é tudo ou nada: um insumo em falta impede também o consumo dos outros', () => {
    const resources = stock({ energy: 5, water: 0 });

    const next = step(resources, 'mine');

    expect(next).toEqual(stock({ energy: 5 }));
  });

  it('a falta nunca deixa o estoque negativo, nem fica como dívida', () => {
    const stalled = step(stock(), 'well', 'furnace', 'lamp');
    const afterRefill = step(stalled, 'solar');

    for (const id of RESOURCE_IDS) {
      expect(stalled[id]).toBe(0);
    }
    // Sem dívida: o déficit do passo anterior não é cobrado do estoque que chega depois.
    expect(afterRefill).toEqual(stock({ energy: 6 }));
  });

  it('a produção do passo NÃO paga o consumo do mesmo passo (vale a partir do seguinte)', () => {
    const first = step(stock(), 'solar', 'well');
    const second = step(first, 'solar', 'well');

    expect(first).toEqual(stock({ energy: 6 }));
    expect(second).toEqual(stock({ energy: 9, water: 4 }));
  });

  it('o resultado não depende da posição entre produtor e consumidor quando não há disputa', () => {
    const producerFirst = step(stock({ energy: 10 }), 'solar', 'well');
    const consumerFirst = step(stock({ energy: 10 }), 'well', 'solar');

    expect(producerFirst).toEqual(consumerFirst);
  });

  it('na disputa pelo mesmo recurso vale a ordem do estado: o mais antigo tem prioridade', () => {
    const resources = stock({ energy: 4 });

    const twoWells = step(resources, 'well', 'well');
    const wellThenLamps = step(resources, 'well', 'lamp', 'lamp');
    const lampsThenWell = step(resources, 'lamp', 'lamp', 'well');

    // 4 de energia: só o primeiro poço (3) cabe; o segundo fica parado.
    expect(twoWells).toEqual(stock({ energy: 1, water: 4 }));
    // O poço reserva 3, sobra 1: nenhuma lâmpada (2) opera.
    expect(wellThenLamps).toEqual(stock({ energy: 1, water: 4 }));
    // As duas lâmpadas reservam 4: o poço fica parado.
    expect(lampsThenWell).toEqual(stock({ energy: 0 }));
  });

  it('um edifício parado não reserva estoque: o seguinte ainda pode usá-lo', () => {
    // O forno precisa de 5 (não cabe em 3) e fica parado; o poço (3) cabe e opera.
    const next = step(stock({ energy: 3 }), 'furnace', 'well');

    expect(next).toEqual(stock({ energy: 0, water: 4 }));
  });

  it('um edifício parado não entrega a sua produção', () => {
    const next = step(stock({ energy: 2 }), 'furnace');

    expect(next.materials).toBe(0);
    expect(next.energy).toBe(2);
  });

  it('com a economia em déficit, todo estoque continua inteiro e não negativo a cada passo', () => {
    // Demanda (3 poços = 9) maior que a oferta (1 painel = 6): oscila, mas nunca fica inválido.
    const kinds: Kind[] = ['well', 'well', 'well', 'solar', 'lamp'];
    let resources = stock({ energy: 10, food: 3 });

    for (let tick = 0; tick < 300; tick += 1) {
      resources = step(resources, ...kinds);
      for (const id of RESOURCE_IDS) {
        expect(Number.isSafeInteger(resources[id])).toBe(true);
        expect(resources[id]).toBeGreaterThanOrEqual(0);
      }
    }
    expect(resources.food).toBe(3);
  });

  it('sem edifícios, ou só com edifícios sem taxas, nada muda', () => {
    const resources = stock({ food: 7, energy: 1 });

    expect(step(resources)).toBe(resources);
    expect(step(resources, 'statue', 'statue')).toBe(resources);
  });
});

describe('economia: limites e valores inválidos', () => {
  it('limita a produção ao teto técnico em vez de gerar um valor inexato', () => {
    const nearCeiling = stock({ energy: MAX_RESOURCE_AMOUNT - 2 });

    const next = step(nearCeiling, 'solar');

    expect(next.energy).toBe(MAX_RESOURCE_AMOUNT);
    expect(Number.isSafeInteger(next.energy)).toBe(true);
  });

  it('no teto, produzir mais não muda nada (mesma referência)', () => {
    const atCeiling = stock({ energy: MAX_RESOURCE_AMOUNT });

    expect(step(atCeiling, 'solar')).toBe(atCeiling);
  });

  it.each([
    ['fracionária', 1.5],
    ['zero', 0],
    ['negativa', -3],
    ['NaN', Number.NaN],
    ['infinita', Number.POSITIVE_INFINITY],
    ['maior que o inteiro seguro', 2 ** 60],
  ])('rejeita uma taxa de produção %s em vez de corrigi-la', (_name, amount) => {
    const bad = { thing: { production: { energy: amount }, consumption: {} } };

    expect(() => advanceEconomy(stock(), [{ definitionId: 'thing' }], bad)).toThrow(RangeError);
  });

  it('rejeita uma taxa de consumo inválida, inclusive a negativa que viraria produção', () => {
    const negative = { thing: { production: {}, consumption: { energy: -4 } } };
    const fractional = { thing: { production: {}, consumption: { energy: 0.5 } } };

    expect(() => advanceEconomy(stock(), [{ definitionId: 'thing' }], negative)).toThrow(
      RangeError,
    );
    expect(() => advanceEconomy(stock(), [{ definitionId: 'thing' }], fractional)).toThrow(
      RangeError,
    );
  });

  it('valida as taxas de um edifício mesmo quando ele fica parado por falta de estoque', () => {
    const bad = { thing: { production: { water: 1.5 }, consumption: { energy: 99 } } };

    expect(() => advanceEconomy(stock({ energy: 1 }), [{ definitionId: 'thing' }], bad)).toThrow(
      RangeError,
    );
  });

  it.each(['inexistente', '__proto__', 'constructor', 'toString'])(
    'rejeita a definição desconhecida "%s" (inclusive chaves herdadas)',
    (definitionId) => {
      expect(() => advanceEconomy(stock(), [{ definitionId }], definitions)).toThrow(RangeError);
    },
  );

  it.each([
    ['NaN', { food: Number.NaN }],
    ['negativo', { water: -1 }],
    ['fracionário', { energy: 0.5 }],
    ['infinito', { materials: Number.POSITIVE_INFINITY }],
  ])('um estoque de entrada %s é recusado, não propagado', (_name, patch) => {
    expect(() => step(stock(patch), 'solar')).toThrow(RangeError);
    expect(() => step(stock(patch))).toThrow(RangeError);
  });

  it('um recurso ausente no estoque de entrada é recusado', () => {
    const missing = { food: 1, water: 1, materials: 1 } as unknown as ResourceStock;

    expect(() => step(missing, 'solar')).toThrow(RangeError);
  });
});

describe('economia: pureza, imutabilidade e determinismo', () => {
  it('não altera o estoque de entrada, mesmo congelado, e devolve um novo objeto congelado', () => {
    const input = freezeDeep(stock({ energy: 10 }));

    const output = step(input, 'solar', 'well');

    expect(input).toEqual(stock({ energy: 10 }));
    expect(output).not.toBe(input);
    expect(Object.isFrozen(output)).toBe(true);
  });

  it('o mesmo estoque e os mesmos edifícios dão sempre o mesmo resultado', () => {
    const run = () => {
      let resources = stock({ energy: 10, water: 3, food: 40 });
      for (let tick = 0; tick < 200; tick += 1) {
        resources = step(resources, 'solar', 'well', 'mine', 'lamp', 'farm', 'furnace');
      }
      return JSON.stringify(resources);
    };

    expect(run()).toBe(run());
  });

  it('a economia independe da ordem de declaração das chaves nas taxas', () => {
    const a = {
      thing: { production: { food: 1, water: 2 }, consumption: { energy: 1, water: 1 } },
    };
    const b = {
      thing: { production: { water: 2, food: 1 }, consumption: { water: 1, energy: 1 } },
    };
    const start = stock({ energy: 5, water: 5 });

    const left = advanceEconomy(start, [{ definitionId: 'thing' }], a);
    const right = advanceEconomy(start, [{ definitionId: 'thing' }], b);

    expect(JSON.stringify(left)).toBe(JSON.stringify(right));
  });
});
