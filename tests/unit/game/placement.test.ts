import { describe, expect, it } from 'vitest';
import { BUILDING_DEFINITIONS } from '@/game/content/buildings';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import {
  evaluatePlacement,
  evaluatePlacementSpace,
  missingForCost,
  placementRect,
  positionForAnchorCell,
  type ConstructionDefinitions,
  type PlacedBuilding,
  type PlacementTerrain,
} from '@/game/domain/construction/placement';
import {
  createPlacementTerrain,
  INITIAL_PLACEMENT_TERRAIN,
} from '@/game/domain/construction/placementTerrain';
import { validateBuildingContent } from '@/game/domain/construction/validateBuildingContent';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { ResourceStock } from '@/game/domain/state/GameState';
import { ROTATIONS, type GridPosition, type Rotation } from '@/shared/grid/types';

/*
 * Regras de posicionamento e de custo, testadas SEM renderização, relógio ou interface. Os testes de
 * regra usam um terreno e definições FICTÍCIOS (pequenos, com contas fáceis de conferir); o conteúdo
 * real tem testes próprios no final.
 *
 * Convenção do grid: x cresce para leste e y para o sul; `position` é a célula de menor x e menor y
 * do retângulo já rotacionado (90° e 270° trocam largura e profundidade).
 */

/** Área construível de (10, 10) a (20, 20), com um obstáculo 2×2 em (12, 12). */
const terrain: PlacementTerrain = {
  buildableArea: { x: 10, y: 10, width: 10, depth: 10 },
  obstacles: [{ x: 12, y: 12, width: 2, depth: 2 }],
};

const definitions = {
  hut: { footprint: { width: 2, depth: 2 }, cost: { materials: 10 } },
  longhouse: { footprint: { width: 4, depth: 2 }, cost: { materials: 20, water: 5 } },
  cell: { footprint: { width: 1, depth: 1 }, cost: {} },
  tower: { footprint: { width: 3, depth: 3 }, cost: { energy: 7 } },
} as const satisfies ConstructionDefinitions;

type Kind = keyof typeof definitions;

const rich: ResourceStock = { food: 100, water: 100, materials: 100, energy: 100 };
const request = (definitionId: Kind, x: number, y: number, rotation: Rotation = 0) => ({
  definitionId,
  position: { x, y },
  rotation,
});
const placed = (
  definitionId: Kind,
  x: number,
  y: number,
  rotation: Rotation = 0,
): PlacedBuilding => ({
  definitionId,
  position: { x, y },
  rotation,
});
const stateOf = (buildings: PlacedBuilding[] = [], resources: ResourceStock = rich) => ({
  buildings,
  resources,
});
const place = (
  req: ReturnType<typeof request>,
  buildings: PlacedBuilding[] = [],
  resources: ResourceStock = rich,
) => evaluatePlacement(stateOf(buildings, resources), req, terrain, definitions);

describe('rotação e dimensões', () => {
  it.each([
    [0, { width: 4, depth: 2 }],
    [90, { width: 2, depth: 4 }],
    [180, { width: 4, depth: 2 }],
    [270, { width: 2, depth: 4 }],
  ] as const)('com %i° o footprint 4×2 ocupa %j', (rotation, size) => {
    const rect = placementRect(request('longhouse', 11, 11, rotation), definitions);

    expect(rect).toEqual({ x: 11, y: 11, ...size });
  });

  it('a posição é a célula de menor x e y do retângulo ocupado, qualquer que seja a rotação', () => {
    for (const rotation of ROTATIONS) {
      const rect = placementRect(request('tower', 13, 14, rotation), definitions);

      expect([rect.x, rect.y]).toEqual([13, 14]);
    }
  });

  it('cada rotação ocupa as células esperadas (confere célula por célula)', () => {
    const cells = (rotation: Rotation) => {
      const rect = placementRect(request('longhouse', 14, 14, rotation), definitions);
      const result: string[] = [];
      for (let y = rect.y; y < rect.y + rect.depth; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) {
          result.push(`${x},${y}`);
        }
      }
      return result;
    };

    expect(cells(0)).toEqual([
      '14,14',
      '15,14',
      '16,14',
      '17,14',
      '14,15',
      '15,15',
      '16,15',
      '17,15',
    ]);
    expect(cells(90)).toEqual([
      '14,14',
      '15,14',
      '14,15',
      '15,15',
      '14,16',
      '15,16',
      '14,17',
      '15,17',
    ]);
  });

  it('girar muda quais células a construção ocupa, então muda a validade junto à borda', () => {
    // 4×2 em (17, 10): sem rotação passa da borda leste (17 + 4 = 21 > 20); girado cabe (17 + 2 = 19).
    expect(place(request('longhouse', 17, 10, 0)).ok).toBe(false);
    expect(place(request('longhouse', 17, 10, 90)).ok).toBe(true);
    // O inverso junto à borda sul: girado (4 de profundidade) não cabe em y = 17.
    expect(place(request('longhouse', 10, 17, 0)).ok).toBe(true);
    expect(place(request('longhouse', 10, 17, 90))).toEqual({
      ok: false,
      error: 'OUT_OF_BUILDABLE_AREA',
    });
  });

  it('girar 360° (quatro vezes 90°) volta ao mesmo retângulo', () => {
    const start = placementRect(request('longhouse', 11, 11, 0), definitions);
    let rotation: Rotation = 0;
    for (let step = 0; step < 4; step += 1) {
      rotation = ROTATIONS[(ROTATIONS.indexOf(rotation) + 1) % 4] ?? 0;
    }

    expect(rotation).toBe(0);
    expect(placementRect(request('longhouse', 11, 11, rotation), definitions)).toEqual(start);
  });

  it('rotação e posição não alteram a definição do edifício', () => {
    const before = JSON.stringify(definitions);

    placementRect(request('longhouse', 11, 11, 90), definitions);

    expect(JSON.stringify(definitions)).toBe(before);
  });
});

describe('célula apontada → posição (centralizar o edifício no ponteiro)', () => {
  it.each(ROTATIONS)(
    'o retângulo contém a célula apontada e a centraliza (rotação %i°)',
    (rotation) => {
      for (const kind of Object.keys(definitions) as Kind[]) {
        for (const cell of [
          { x: 0, y: 0 },
          { x: 15, y: 17 },
          { x: 39, y: 3 },
        ]) {
          const { footprint } = definitions[kind];
          const position = positionForAnchorCell(cell, footprint, rotation);
          const rect = placementRect({ definitionId: kind, position, rotation }, definitions);

          expect(cell.x).toBeGreaterThanOrEqual(rect.x);
          expect(cell.x).toBeLessThan(rect.x + rect.width);
          expect(cell.y).toBeGreaterThanOrEqual(rect.y);
          expect(cell.y).toBeLessThan(rect.y + rect.depth);
          // Centro: a célula é a do meio (a de menor índice quando a extensão é par).
          expect(cell.x - rect.x).toBe(Math.floor(rect.width / 2));
          expect(cell.y - rect.y).toBe(Math.floor(rect.depth / 2));
        }
      }
    },
  );

  it('exemplos conferidos à mão', () => {
    const at = (cell: GridPosition, kind: Kind, rotation: Rotation) =>
      positionForAnchorCell(cell, definitions[kind].footprint, rotation);

    expect(at({ x: 15, y: 15 }, 'cell', 0)).toEqual({ x: 15, y: 15 });
    expect(at({ x: 15, y: 15 }, 'tower', 0)).toEqual({ x: 14, y: 14 });
    expect(at({ x: 15, y: 15 }, 'hut', 0)).toEqual({ x: 14, y: 14 });
    expect(at({ x: 15, y: 15 }, 'longhouse', 0)).toEqual({ x: 13, y: 14 });
    expect(at({ x: 15, y: 15 }, 'longhouse', 90)).toEqual({ x: 14, y: 13 });
  });
});

describe('posicionamento válido', () => {
  it('numa área livre é válido e devolve o retângulo ocupado', () => {
    expect(place(request('hut', 15, 15))).toEqual({
      ok: true,
      value: { x: 15, y: 15, width: 2, depth: 2 },
    });
  });

  it('encostar nas quatro bordas da área construível é válido', () => {
    expect(place(request('hut', 10, 10)).ok).toBe(true);
    expect(place(request('hut', 18, 10)).ok).toBe(true);
    expect(place(request('hut', 10, 18)).ok).toBe(true);
    expect(place(request('hut', 18, 18)).ok).toBe(true);
  });

  it('construir ao lado de outro edifício, com as bordas encostadas ou só os cantos, é válido', () => {
    const existing = [placed('hut', 15, 15)];

    expect(place(request('hut', 17, 15), existing).ok).toBe(true);
    expect(place(request('hut', 13, 15), existing).ok).toBe(true);
    expect(place(request('hut', 15, 17), existing).ok).toBe(true);
    expect(place(request('hut', 17, 17), existing).ok).toBe(true);
  });

  it('um edifício de uma célula cabe numa fresta de uma célula', () => {
    const existing = [placed('hut', 15, 15), placed('hut', 18, 15)];

    expect(place(request('cell', 17, 15), existing).ok).toBe(true);
    expect(place(request('cell', 17, 16), existing).ok).toBe(true);
  });
});

describe('limites da grade', () => {
  it.each([
    ['uma célula além da borda oeste', 9, 15],
    ['uma célula além da borda norte', 15, 9],
    ['uma célula além da borda leste (2 de largura em x = 19)', 19, 15],
    ['uma célula além da borda sul (2 de profundidade em y = 19)', 15, 19],
    ['bem fora da área', 0, 0],
    ['coordenadas negativas', -3, -3],
    ['muito longe', 500, 500],
  ])('recusa %s', (_name, x, y) => {
    expect(place(request('hut', x, y))).toEqual({ ok: false, error: 'OUT_OF_BUILDABLE_AREA' });
  });

  it('recusa quando só parte do edifício está fora da área', () => {
    expect(place(request('hut', 19, 19))).toEqual({ ok: false, error: 'OUT_OF_BUILDABLE_AREA' });
    expect(place(request('tower', 18, 10))).toEqual({ ok: false, error: 'OUT_OF_BUILDABLE_AREA' });
  });
});

describe('sobreposição', () => {
  it('recusa a mesma posição de outro edifício', () => {
    expect(place(request('hut', 15, 15), [placed('hut', 15, 15)])).toEqual({
      ok: false,
      error: 'OVERLAPS_BUILDING',
    });
  });

  it.each([
    ['uma célula de sobreposição no canto', 16, 16],
    ['metade sobreposta', 16, 15],
    ['totalmente dentro', 15, 15],
    ['cobrindo o outro por inteiro', 14, 14],
  ])('recusa %s', (_name, x, y) => {
    const existing = [placed('hut', 15, 15)];
    const kind: Kind = _name.startsWith('cobrindo') ? 'tower' : 'hut';

    expect(place(request(kind, x, y), existing)).toEqual({ ok: false, error: 'OVERLAPS_BUILDING' });
  });

  it('considera a rotação do edifício já construído', () => {
    // 4×2 girado em 90° em (10, 10) ocupa x 10..12 e y 10..14.
    const existing = [placed('longhouse', 10, 10, 90)];

    expect(place(request('hut', 10, 13), existing)).toEqual({
      ok: false,
      error: 'OVERLAPS_BUILDING',
    });
    expect(place(request('hut', 10, 14), existing).ok).toBe(true);
    expect(place(request('hut', 12, 10), existing).ok).toBe(true);
  });

  it('considera a rotação do edifício novo', () => {
    const existing = [placed('hut', 10, 17)];

    // 4×2 em (10, 15): sem girar ocupa as linhas 15 e 16 e não toca o outro (linhas 17 e 18);
    // girado (2×4) ocupa as linhas 15 a 18 e sobrepõe.
    expect(place(request('longhouse', 10, 15, 0), existing).ok).toBe(true);
    expect(place(request('longhouse', 10, 15, 90), existing)).toEqual({
      ok: false,
      error: 'OVERLAPS_BUILDING',
    });
  });

  it('recusa sobrepor um obstáculo do cenário (a nave)', () => {
    expect(place(request('hut', 12, 12))).toEqual({ ok: false, error: 'OVERLAPS_OBSTACLE' });
    expect(place(request('hut', 13, 13))).toEqual({ ok: false, error: 'OVERLAPS_OBSTACLE' });
    expect(place(request('hut', 14, 12)).ok).toBe(true);
    expect(place(request('hut', 10, 12)).ok).toBe(true);
  });

  it('a ordem das verificações é: área, edifícios, obstáculos, recursos', () => {
    const existing = [placed('hut', 12, 12)];
    const poor = { ...rich, materials: 0 };

    // Fora da área vence tudo.
    expect(place(request('hut', 0, 0), existing, poor)).toEqual({
      ok: false,
      error: 'OUT_OF_BUILDABLE_AREA',
    });
    // Sobrepõe edifício E obstáculo: o edifício vence.
    expect(place(request('hut', 12, 12), existing, poor)).toEqual({
      ok: false,
      error: 'OVERLAPS_BUILDING',
    });
    // Sobrepõe só o obstáculo e não há recursos: o obstáculo vence.
    expect(place(request('hut', 13, 13), [], poor)).toEqual({
      ok: false,
      error: 'OVERLAPS_OBSTACLE',
    });
    // Posição ótima, sem recursos: só então a falta de recursos.
    expect(place(request('hut', 16, 16), [], poor)).toEqual({
      ok: false,
      error: 'INSUFFICIENT_RESOURCES',
    });
  });

  it('evaluatePlacementSpace só olha o espaço: ignora o estoque', () => {
    const space = evaluatePlacementSpace([], request('hut', 16, 16), terrain, definitions);

    expect(space.ok).toBe(true);
  });
});

describe('recursos para construir', () => {
  it('o estoque que cobre o custo exatamente é suficiente (limite inclusivo)', () => {
    expect(place(request('hut', 16, 16), [], { ...rich, materials: 10 }).ok).toBe(true);
    expect(place(request('hut', 16, 16), [], { ...rich, materials: 9 })).toEqual({
      ok: false,
      error: 'INSUFFICIENT_RESOURCES',
    });
  });

  it('com custo em vários recursos, faltar qualquer um impede', () => {
    expect(place(request('longhouse', 14, 16), [], { ...rich, materials: 20, water: 5 }).ok).toBe(
      true,
    );
    expect(place(request('longhouse', 14, 16), [], { ...rich, materials: 20, water: 4 }).ok).toBe(
      false,
    );
    expect(place(request('longhouse', 14, 16), [], { ...rich, materials: 19, water: 5 }).ok).toBe(
      false,
    );
  });

  it('um edifício sem custo é sempre acessível', () => {
    const broke: ResourceStock = { food: 0, water: 0, materials: 0, energy: 0 };

    expect(place(request('cell', 16, 16), [], broke).ok).toBe(true);
  });

  it('missingForCost diz o que falta, na ordem dos recursos', () => {
    const stock: ResourceStock = { food: 0, water: 2, materials: 5, energy: 0 };

    expect(missingForCost(stock, definitions.longhouse.cost)).toEqual([
      ['water', 3],
      ['materials', 15],
    ]);
    expect(missingForCost(rich, definitions.longhouse.cost)).toEqual([]);
    expect(missingForCost(stock, {})).toEqual([]);
  });
});

describe('pureza e entradas inválidas', () => {
  it('não altera o estado, mesmo congelado', () => {
    const state = freezeDeep(stateOf([placed('hut', 15, 15)]));
    const before = JSON.stringify(state);

    evaluatePlacement(state, request('hut', 15, 15), terrain, definitions);
    evaluatePlacement(state, request('hut', 17, 17), terrain, definitions);

    expect(JSON.stringify(state)).toBe(before);
  });

  it.each(['inexistente', '__proto__', 'constructor', 'toString'])(
    'a definição "%s" não existe (inclusive chaves herdadas)',
    (definitionId) => {
      expect(() =>
        evaluatePlacement(
          stateOf(),
          { definitionId, position: { x: 15, y: 15 }, rotation: 0 },
          terrain,
          definitions,
        ),
      ).toThrow(RangeError);
    },
  );

  it('é determinística: o mesmo pedido dá o mesmo resultado', () => {
    const run = () => JSON.stringify(place(request('hut', 16, 16), [placed('hut', 14, 16)]));

    expect(run()).toBe(run());
  });
});

describe('conteúdo real: terreno e edifícios do jogo', () => {
  const state = createInitialGameState(INITIAL_SCENARIO);

  it('o terreno de construção é a área do cenário e a nave é um obstáculo', () => {
    expect(INITIAL_PLACEMENT_TERRAIN.buildableArea).toEqual(INITIAL_SCENARIO.terrain.buildableArea);
    expect(INITIAL_PLACEMENT_TERRAIN.obstacles).toEqual([{ x: 14, y: 13, width: 8, depth: 5 }]);
    // Uma nave girada tem as dimensões trocadas.
    const rotated = createPlacementTerrain({
      ...INITIAL_SCENARIO,
      crashedShip: { ...INITIAL_SCENARIO.crashedShip, rotation: 90 },
    });
    expect(rotated.obstacles).toEqual([{ x: 14, y: 13, width: 5, depth: 8 }]);
  });

  it('construir em cima da nave é recusado', () => {
    expect(
      evaluatePlacement(
        state,
        { definitionId: 'solar-array', position: { x: 16, y: 14 }, rotation: 0 },
        INITIAL_PLACEMENT_TERRAIN,
      ),
    ).toEqual({ ok: false, error: 'OVERLAPS_OBSTACLE' });
  });

  it('construir em cima de um edifício inicial é recusado', () => {
    expect(
      evaluatePlacement(
        state,
        { definitionId: 'solar-array', position: { x: 14, y: 20 }, rotation: 0 },
        INITIAL_PLACEMENT_TERRAIN,
      ),
    ).toEqual({ ok: false, error: 'OVERLAPS_BUILDING' });
  });

  it('todo edifício do catálogo tem espaço no terreno inicial, em qualquer rotação', () => {
    const area = INITIAL_SCENARIO.terrain.buildableArea;
    for (const definition of Object.values(BUILDING_DEFINITIONS)) {
      for (const rotation of ROTATIONS) {
        let found = false;
        for (let y = area.y; y < area.y + area.depth && !found; y += 1) {
          for (let x = area.x; x < area.x + area.width && !found; x += 1) {
            found = evaluatePlacementSpace(
              state.buildings,
              { definitionId: definition.id, position: { x, y }, rotation },
              INITIAL_PLACEMENT_TERRAIN,
            ).ok;
          }
        }
        expect(found, `${definition.id} em ${rotation}°`).toBe(true);
      }
    }
  });

  it('os edifícios iniciais não se sobrepõem entre si nem à nave (o cenário é coerente com a regra)', () => {
    for (const building of state.buildings) {
      const others = state.buildings.filter((other) => other.instanceId !== building.instanceId);

      expect(
        evaluatePlacementSpace(others, building, INITIAL_PLACEMENT_TERRAIN).ok,
        building.instanceId,
      ).toBe(true);
    }
  });
});

describe('validação do conteúdo dos edifícios', () => {
  it('as definições entregues com o jogo são válidas', () => {
    expect(validateBuildingContent(BUILDING_DEFINITIONS)).toEqual([]);
  });

  it('todo edifício declara um custo explícito', () => {
    for (const definition of Object.values(BUILDING_DEFINITIONS)) {
      expect(definition.cost, definition.id).toBeTypeOf('object');
    }
  });

  const valid = BUILDING_DEFINITIONS['solar-array'];

  it.each([
    ['id diferente da chave', { ...valid, id: 'outra' }, /id "outra"/],
    ['nome vazio', { ...valid, name: '  ' }, /nome/],
    ['categoria desconhecida', { ...valid, category: 'magica' }, /categoria/],
    ['footprint fracionário', { ...valid, footprint: { width: 1.5, depth: 2 } }, /footprint/],
    ['footprint zero', { ...valid, footprint: { width: 0, depth: 2 } }, /footprint/],
    ['footprint negativo', { ...valid, footprint: { width: 2, depth: -1 } }, /footprint/],
    ['custo fracionário', { ...valid, cost: { materials: 1.5 } }, /cost\.materials/],
    ['custo zero', { ...valid, cost: { materials: 0 } }, /cost\.materials/],
    ['custo negativo', { ...valid, cost: { materials: -5 } }, /cost\.materials/],
    ['custo de recurso desconhecido', { ...valid, cost: { ouro: 5 } }, /desconhecido: "ouro"/],
  ])('rejeita %s', (_name, definition, message) => {
    const issues = validateBuildingContent({ 'solar-array': definition } as never);

    expect(issues.some((issue) => message.test(issue))).toBe(true);
  });
});
