import { describe, expect, it } from 'vitest';
import { getBuildingDefinition } from '@/game/content/buildings';
import { INITIAL_SCENARIO, type ScenarioDefinition } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { createInitialWorldSnapshot, toWorldSnapshot } from '@/app/worldSnapshot';

const scenario: ScenarioDefinition = INITIAL_SCENARIO;

describe('snapshot de renderização', () => {
  it('deriva os edifícios das instâncias do estado', () => {
    const state = createInitialGameState(scenario);
    const snapshot = toWorldSnapshot(state, scenario);

    expect(snapshot.buildings.map((building) => building.instanceId)).toEqual(
      state.buildings.map((building) => building.instanceId),
    );
    for (const building of snapshot.buildings) {
      const instance = state.buildings.find(
        (candidate) => candidate.instanceId === building.instanceId,
      );
      expect(building.position).toEqual(instance?.position);
      expect(building.rotation).toBe(instance?.rotation);
      expect(building.size).toEqual(getBuildingDefinition(building.definitionId).footprint);
    }
  });

  it('reflete a remoção de uma construção do cenário sem alterar a renderização', () => {
    const [removed, ...remaining] = scenario.initialBuildings;
    const smaller: ScenarioDefinition = { ...scenario, initialBuildings: remaining };

    const snapshot = toWorldSnapshot(createInitialGameState(smaller), smaller);

    expect(snapshot.buildings).toHaveLength(2);
    expect(snapshot.buildings.some((building) => building.instanceId === removed?.instanceId)).toBe(
      false,
    );
  });

  it('reflete a mudança de posição feita no conteúdo', () => {
    const [first, ...others] = scenario.initialBuildings;
    if (!first) {
      throw new Error('O cenário inicial precisa ter pelo menos uma construção.');
    }
    const moved: ScenarioDefinition = {
      ...scenario,
      initialBuildings: [{ ...first, position: { x: 17, y: 25 } }, ...others],
    };

    const snapshot = toWorldSnapshot(createInitialGameState(moved), moved);

    expect(snapshot.buildings.find((b) => b.instanceId === first.instanceId)?.position).toEqual({
      x: 17,
      y: 25,
    });
  });

  it('contém só dados simples (serializável), sem objetos gráficos', () => {
    const snapshot = createInitialWorldSnapshot();

    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(snapshot.buildings).toHaveLength(3);
  });
});
