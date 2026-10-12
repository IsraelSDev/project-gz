import { describe, expect, it } from 'vitest';
import { BUILDING_DEFINITIONS, getBuildingDefinition } from '@/game/content/buildings';
import { RESOURCE_IDS } from '@/game/content/resources';
import {
  INITIAL_SCENARIO,
  type InitialBuildingPlacement,
  type ScenarioDefinition,
} from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { validateScenario } from '@/game/domain/state/validateScenario';
import { occupiedRect, rectContainsRect } from '@/shared/grid/gridMath';

const scenario: ScenarioDefinition = INITIAL_SCENARIO;

const withBuildings = (buildings: readonly InitialBuildingPlacement[]): ScenarioDefinition => ({
  ...scenario,
  initialBuildings: buildings,
});

const firstBuilding = (): InitialBuildingPlacement => {
  const building = scenario.initialBuildings[0];
  if (!building) {
    throw new Error('O cenário inicial precisa ter pelo menos uma construção.');
  }
  return building;
};

describe('conteúdo do cenário inicial', () => {
  it('é válido', () => {
    expect(validateScenario(scenario)).toEqual([]);
  });

  it('define exatamente três construções iniciais', () => {
    expect(scenario.initialBuildings).toHaveLength(3);
  });

  it('usa definições cujo id coincide com a chave do catálogo', () => {
    for (const [key, definition] of Object.entries(BUILDING_DEFINITIONS)) {
      expect(definition.id).toBe(key);
    }
  });

  it('mantém todas as construções dentro da área construível e a nave dentro do terreno', () => {
    for (const building of scenario.initialBuildings) {
      const rect = occupiedRect(
        building.position,
        getBuildingDefinition(building.definitionId).footprint,
        building.rotation,
      );
      expect(rectContainsRect(scenario.terrain.buildableArea, rect)).toBe(true);
    }

    const terrainRect = { x: 0, y: 0, ...scenario.terrain.sizeCells };
    const ship = scenario.crashedShip;
    expect(
      rectContainsRect(terrainRect, occupiedRect(ship.position, ship.size, ship.rotation)),
    ).toBe(true);
  });
});

describe('estado inicial do jogo', () => {
  const state = createInitialGameState(scenario);

  it('tem a estrutura mínima', () => {
    expect(state.schemaVersion).toBe(3);
    expect(state.population.survivors).toBe(8);
    expect(state.contentVersion).toBe(scenario.contentVersion);
    expect(state.tick).toBe(0);
    expect(Object.keys(state.resources).sort()).toEqual([...RESOURCE_IDS].sort());
    for (const id of RESOURCE_IDS) {
      expect(Number.isInteger(state.resources[id])).toBe(true);
      expect(state.resources[id]).toBeGreaterThanOrEqual(0);
    }
    expect(state.buildings).toHaveLength(3);
  });

  it('dá a cada construção um instanceId não vazio e único', () => {
    const ids = state.buildings.map((building) => building.instanceId);

    expect(ids.every((id) => id.trim() !== '')).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('é somente leitura em tempo de execução', () => {
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.resources)).toBe(true);
    expect(Object.isFrozen(state.buildings)).toBe(true);
    expect(state.buildings.every((building) => Object.isFrozen(building))).toBe(true);
    expect(() => {
      (state as { tick: number }).tick = 1;
    }).toThrow(TypeError);
  });

  it('é serializável e não carrega objetos gráficos', () => {
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  it('é uma cópia: o estado não compartilha objetos com o cenário', () => {
    const building = state.buildings[0];
    expect(building?.position).not.toBe(firstBuilding().position);
  });
});

describe('validação do cenário', () => {
  it('rejeita instanceId duplicado', () => {
    const first = firstBuilding();
    const issues = validateScenario(
      withBuildings([first, { ...first, position: { x: 21, y: 20 } }]),
    );

    expect(issues.some((issue) => issue.includes('duplicado'))).toBe(true);
  });

  it('rejeita instanceId vazio', () => {
    const issues = validateScenario(withBuildings([{ ...firstBuilding(), instanceId: ' ' }]));

    expect(issues.some((issue) => issue.includes('instanceId'))).toBe(true);
  });

  it('rejeita construção fora da área construível', () => {
    const issues = validateScenario(
      withBuildings([{ ...firstBuilding(), position: { x: 0, y: 0 } }]),
    );

    expect(issues.some((issue) => issue.includes('fora da área construível'))).toBe(true);
  });

  it('rejeita sobreposição com a nave e entre construções', () => {
    const first = firstBuilding();
    const onShip = validateScenario(withBuildings([{ ...first, position: { x: 14, y: 13 } }]));
    const overlapping = validateScenario(
      withBuildings([first, { ...first, instanceId: 'outra', position: { x: 15, y: 21 } }]),
    );

    expect(onShip.some((issue) => issue.includes('crashedShip'))).toBe(true);
    expect(overlapping.some((issue) => issue.includes('sobrepõe'))).toBe(true);
  });

  it('rejeita definição desconhecida e rotação inválida', () => {
    const first = firstBuilding();
    const unknown = validateScenario(
      withBuildings([{ ...first, definitionId: 'inexistente' as never }]),
    );
    const badRotation = validateScenario(withBuildings([{ ...first, rotation: 45 as never }]));

    expect(unknown.some((issue) => issue.includes('definição desconhecida'))).toBe(true);
    expect(badRotation.some((issue) => issue.includes('rotação'))).toBe(true);
  });

  it('impede criar o estado a partir de um cenário inválido', () => {
    const first = firstBuilding();

    expect(() => createInitialGameState(withBuildings([first, first]))).toThrow(
      /Cenário inicial inválido/,
    );
  });
});
