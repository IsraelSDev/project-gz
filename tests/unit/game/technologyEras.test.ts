import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { advanceEconomy } from '@/game/domain/economy/advanceEconomy';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import {
  advanceResearch,
  countFieldLaboratories,
  getResearchBlockReason,
  startResearchCommand,
} from '@/game/domain/research/researchCommands';
import {
  applyConstructionDiscount,
  getTechnologyModifiers,
} from '@/game/domain/research/technologyEffects';
import { executeSimulationCommand } from '@/game/domain/commands/simulationCommand';
import { decodeGameSave } from '@/game/application/saveGame';
import type { GameState } from '@/game/domain/state/GameState';

const initial = () => createInitialGameState(INITIAL_SCENARIO);
const withLab = () => {
  const state = initial();
  return {
    ...state,
    resources: { ...state.resources, materials: 500, energy: 500 },
    buildings: [
      ...state.buildings,
      {
        instanceId: 'field-lab',
        definitionId: 'field-laboratory' as const,
        position: { x: 30, y: 30 },
        rotation: 0 as const,
      },
    ],
  };
};

describe('eras e efeitos tecnológicos da Fase 16', () => {
  it('só avança de era ao concluir os marcos tecnológicos exigidos', () => {
    let state: GameState = withLab();
    expect(state.research.currentEra).toBe('survival');
    const result = executeSimulationCommand(state, startResearchCommand('protein-cultures'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.value;
    for (let tick = 0; tick < 15; tick += 1) state = advanceResearch(state);
    expect(state.research.unlockedTechnologyIds).toContain('protein-cultures');
    expect(state.research.currentEra).toBe('foundation');
  });

  it('não inicia pesquisa sem recursos e bloqueia projetos duplicados', () => {
    const state = withLab();
    const poor = { ...state, resources: { ...state.resources, materials: 0, energy: 0 } };
    expect(getResearchBlockReason(poor, 'protein-cultures')).toBe('resources');
    expect(executeSimulationCommand(poor, startResearchCommand('protein-cultures'))).toMatchObject({
      ok: false,
      error: 'INSUFFICIENT_RESOURCES',
    });
    const started = executeSimulationCommand(state, startResearchCommand('protein-cultures'));
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(
      executeSimulationCommand(started.value, startResearchCommand('protein-cultures')),
    ).toMatchObject({
      ok: false,
      error: 'COMMAND_REJECTED',
    });
    expect(started.value.research.progress).toBe(0);
  });

  it('calcula bônus uma vez e aplica desconto e produção às estruturas', () => {
    const unlocked = ['modular-construction', 'modular-construction'];
    expect(applyConstructionDiscount({ materials: 80 }, unlocked)).toEqual({ materials: 72 });
    const modifiers = getTechnologyModifiers(['protein-cultures']);
    expect(modifiers).toEqual(getTechnologyModifiers(['protein-cultures', 'protein-cultures']));
    const state = initial();
    const building = { definitionId: 'protein-cultivator' };
    const normal = advanceEconomy(state.resources, [building]);
    const improved = advanceEconomy(
      state.resources,
      [building],
      undefined,
      modifiers.productionByBuilding,
    );
    expect(improved.food - normal.food).toBe(2);
  });

  it('conta laboratórios nos assentamentos além do capital', () => {
    const state = initial();
    const laboratory = {
      instanceId: 'city-lab',
      definitionId: 'field-laboratory' as const,
      position: { x: 0, y: 0 },
      rotation: 0 as const,
    };
    const city = {
      ...state,
      settlements: [
        {
          settlementId: 'city-1',
          regionId: 'crash-site' as const,
          name: 'Cidade',
          resources: state.resources,
          buildings: [laboratory],
          population: state.population,
          administratorId: null,
          nextBuildingId: 1,
        },
      ],
    };
    expect(countFieldLaboratories(city)).toBe(1);
    expect(getResearchBlockReason(city, 'protein-cultures')).not.toBe('laboratory');
  });

  it('laboratórios de cidades aceleram pesquisa imperial após Redes de Pesquisa', () => {
    const state = withLab();
    const unlockedTechnologyIds = [
      'protein-cultures',
      'thermal-engineering',
      'modular-construction',
      'agricultural-restoration',
      'materials-synthesis',
      'distributed-research',
    ];
    const cityLab = {
      instanceId: 'city-lab',
      definitionId: 'field-laboratory' as const,
      position: { x: 0, y: 0 },
      rotation: 0 as const,
    };
    const base = {
      ...state,
      research: {
        ...state.research,
        currentEra: 'scientific' as const,
        unlockedTechnologyIds,
        activeTechnologyId: 'civic-logistics',
        progress: 0,
      },
    };
    const oneLab = advanceResearch(base);
    const twoLabs = advanceResearch({
      ...base,
      settlements: [
        {
          settlementId: 'city-1',
          regionId: 'crash-site',
          name: 'Cidade',
          resources: base.resources,
          buildings: [cityLab],
          population: base.population,
          administratorId: null,
          nextBuildingId: 1,
        },
      ],
    });
    expect(twoLabs.research.progress - oneLab.research.progress).toBe(1);
  });

  it('migra o save v7 preservando projeto, progresso e recursos', () => {
    const current = initial();
    const { currentEra, ...legacyResearch } = current.research;
    void currentEra;
    const oldSave = {
      ...current,
      schemaVersion: 7,
      contentVersion: '0.10.0',
      resources: { ...current.resources, materials: 123, energy: 99 },
      research: {
        ...legacyResearch,
        unlockedTechnologyIds: ['protein-cultures'],
        activeTechnologyId: 'thermal-engineering',
        progress: 37,
      },
    };
    const decoded = decodeGameSave(
      JSON.stringify({ format: 'alien-civilization-save', formatVersion: 1, state: oldSave }),
    );
    expect(decoded).toMatchObject({
      ok: true,
      value: {
        schemaVersion: 8,
        contentVersion: '0.11.0',
        resources: { materials: 123, energy: 99 },
        research: {
          currentEra: 'foundation',
          unlockedTechnologyIds: ['protein-cultures'],
          activeTechnologyId: 'thermal-engineering',
          progress: 37,
        },
      },
    });
  });
});
