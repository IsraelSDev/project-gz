import { describe, expect, it } from 'vitest';
import { decodeGameSave, encodeGameSave } from '@/game/application/saveGame';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { validateGameState } from '@/game/domain/state/validateGameState';
import {
  executeSimulationCommand,
  type SimulationCommand,
} from '@/game/domain/commands/simulationCommand';
import { advanceSimulationStep } from '@/game/domain/simulation/advanceSimulationStep';
import { migrateV6ToV7 } from '@/game/application/saveMigrations';

function command(
  state: ReturnType<typeof createInitialGameState>,
  fields: Record<string, unknown>,
) {
  return executeSimulationCommand(state, {
    type: 'TerritoryAction',
    ...fields,
  } as SimulationCommand);
}

function discoveredState() {
  const initial = createInitialGameState(INITIAL_SCENARIO);
  const explored = executeSimulationCommand(initial, {
    type: 'ExplorePoint',
    pointId: 'crystal-spring',
  } as SimulationCommand);
  if (!explored.ok) throw new Error(explored.error);
  return {
    ...explored.value,
    resources: { food: 300, water: 300, materials: 300, energy: 100 },
  };
}

function stateWithTreaty() {
  let state = discoveredState();
  for (const action of [
    'establish-contact',
    'offer-gift',
    'propose-non-aggression-pact',
  ] as const) {
    const result = executeSimulationCommand(state, {
      type: 'DiplomaticAction',
      civilizationId: 'selari-commons',
      action,
    } as SimulationCommand);
    if (!result.ok) throw new Error(result.error);
    state = result.value;
  }
  return state;
}

function foundedState() {
  const state = stateWithTreaty();
  const founded = command(state, { action: 'found', regionId: 'crystal-spring' });
  if (!founded.ok) throw new Error(founded.error);
  return founded.value;
}

describe('território e cidades — Fase 15', () => {
  it('inicia com capital como controle único e identifica regiões pela exploração existente', () => {
    const state = createInitialGameState(INITIAL_SCENARIO);
    expect(state.territory.regions).toHaveLength(4);
    expect(state.territory.regions.filter((region) => region.owner === 'colony')).toEqual([
      {
        regionId: 'crash-site',
        owner: 'colony',
        civilizationId: null,
        settlementId: 'settlement-capital',
      },
    ]);
    expect(state.settlements).toEqual([]);
  });

  it('rejeita fundação não explorada ou sem recursos sem alterar o capital', () => {
    const initial = createInitialGameState(INITIAL_SCENARIO);
    expect(command(initial, { action: 'found', regionId: 'crystal-spring' })).toEqual({
      ok: false,
      error: 'COMMAND_REJECTED',
    });
    const explored = discoveredState();
    expect(
      explored.territory.regions.find((region) => region.regionId === 'crystal-spring'),
    ).toMatchObject({ owner: 'civilization', civilizationId: 'selari-commons' });
    expect(command(explored, { action: 'found', regionId: 'crystal-spring' })).toEqual({
      ok: false,
      error: 'COMMAND_REJECTED',
    });
    const poor = { ...stateWithTreaty(), resources: { ...explored.resources, materials: 219 } };
    const result = command(poor, { action: 'found', regionId: 'crystal-spring' });
    expect(result).toEqual({ ok: false, error: 'INSUFFICIENT_RESOURCES' });
    expect(poor.resources.materials).toBe(219);
    expect(poor.settlements).toHaveLength(0);
  });

  it('funda uma cidade uma única vez, cobra o pacote e atribui controle exclusivo', () => {
    const state = stateWithTreaty();
    const found = command(state, { action: 'found', regionId: 'crystal-spring' });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.settlements[0]).toMatchObject({
      settlementId: 'settlement-1',
      regionId: 'crystal-spring',
      name: 'Nascente Cristalina',
      population: { survivors: 0 },
      buildings: expect.arrayContaining([
        expect.objectContaining({ definitionId: 'habitat-module' }),
        expect.objectContaining({ definitionId: 'hydroponic-farm' }),
      ]),
    });
    expect(
      found.value.territory.regions.find((region) => region.regionId === 'crystal-spring'),
    ).toMatchObject({ owner: 'colony', settlementId: 'settlement-1' });
    expect(found.value.resources.materials).toBe(state.resources.materials - 220);
    expect(found.value.resources.food).toBe(state.resources.food - 30);
    expect(command(found.value, { action: 'found', regionId: 'crystal-spring' })).toEqual({
      ok: false,
      error: 'COMMAND_REJECTED',
    });
    expect(validateGameState(found.value)).toEqual([]);
  });

  it('mantém economias locais separadas e soma rendimentos regionais sem tocar no capital', () => {
    const state = foundedState();
    const capitalBefore = state.resources;
    const cityBefore = state.settlements[0]!.resources;
    const ticked = advanceSimulationStep(state);
    const city = ticked.settlements[0]!;
    expect(ticked.resources).not.toBe(capitalBefore);
    expect(city.resources.food).toBeGreaterThan(cityBefore.food);
    expect(city.resources.water).toBeGreaterThan(cityBefore.water);
    expect(city.resources.materials).toBe(cityBefore.materials + 2);
    expect(city.population.survivors).toBe(0);
  });

  it('transfere recursos e colonizadores atomicamente, respeitando estoque, capacidade e elenco', () => {
    let state = foundedState();
    const cityId = state.settlements[0]!.settlementId;
    const beforeMaterials = state.resources.materials;
    const transfer = command(state, {
      action: 'transfer-resources',
      settlementId: cityId,
      resources: { materials: 50 },
    });
    expect(transfer.ok).toBe(true);
    if (!transfer.ok) return;
    state = transfer.value;
    expect(state.resources.materials).toBe(beforeMaterials - 50);
    expect(state.settlements[0]!.resources.materials).toBe(50);
    expect(
      command(state, {
        action: 'transfer-resources',
        settlementId: cityId,
        resources: { materials: 100_000 },
      }).ok,
    ).toBe(false);
    const people = command(state, {
      action: 'transfer-population',
      settlementId: cityId,
      amount: 4,
    });
    expect(people.ok).toBe(true);
    if (!people.ok) return;
    state = people.value;
    expect(state.population.survivors + state.settlements[0]!.population.survivors).toBe(8);
    expect(state.population.survivors).toBe(4);
    expect(
      command(state, { action: 'transfer-population', settlementId: cityId, amount: 1 }).ok,
    ).toBe(false);
    expect(validateGameState(state)).toEqual([]);
  });

  it('reaproveita designações de personagens e aplica bônus administrativo em ticks regulares', () => {
    let state = foundedState();
    const cityId = state.settlements[0]!.settlementId;
    const removed = executeSimulationCommand(state, {
      type: 'RemoveCharacterFromOffice',
      office: 'engineering',
    } as SimulationCommand);
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    state = removed.value;
    const appointed = command(state, {
      action: 'appoint',
      settlementId: cityId,
      characterId: 'colonist-koro',
    });
    expect(appointed.ok).toBe(true);
    if (!appointed.ok) return;
    state = { ...appointed.value, tick: 9 };
    const before = state.settlements[0]!.resources.materials;
    const ticked = advanceSimulationStep(state);
    expect(ticked.settlements[0]!.resources.materials).toBe(before + 3); // potencial regional 2 + governador 1
    expect(ticked.territory.history.at(-1)).toMatchObject({
      action: 'administrator-appointed',
      detail: 'Koro Brasa',
    });
  });

  it('constrói em grid local, cobra do estoque da cidade e registra histórico', () => {
    let state = foundedState();
    const cityId = state.settlements[0]!.settlementId;
    const transferred = command(state, {
      action: 'transfer-resources',
      settlementId: cityId,
      resources: { materials: 50 },
    });
    expect(transferred.ok).toBe(true);
    if (!transferred.ok) return;
    state = transferred.value;
    const built = command(state, {
      action: 'build',
      settlementId: cityId,
      buildingId: 'materials-recycler',
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.settlements[0]!.buildings.at(-1)).toMatchObject({
      definitionId: 'materials-recycler',
    });
    expect(built.value.settlements[0]!.resources.materials).toBe(0);
    expect(built.value.territory.history.at(-1)).toMatchObject({
      action: 'building-constructed',
      detail: 'materials-recycler',
    });
  });

  it('salva e restaura assentamentos; v6 migra sem alterar os dados da capital', () => {
    const founded = foundedState();
    const decoded = decodeGameSave(encodeGameSave(founded));
    expect(decoded).toEqual({ ok: true, value: founded });
    const legacy = { ...founded, schemaVersion: 6, contentVersion: '0.9.0' } as Omit<
      typeof founded,
      'territory' | 'settlements'
    > & { schemaVersion: 6; contentVersion: '0.9.0' };
    const migrated = migrateV6ToV7(legacy);
    expect(migrated).toMatchObject({
      schemaVersion: 7,
      contentVersion: '0.10.0',
      resources: founded.resources,
      buildings: founded.buildings,
      settlements: [],
      territory: { nextSettlementId: 1, history: [] },
    });
    expect(migrated.territory.regions).toContainEqual(
      expect.objectContaining({
        regionId: 'crystal-spring',
        owner: 'civilization',
        civilizationId: 'selari-commons',
      }),
    );
    const oldSave = { ...founded, schemaVersion: 6, contentVersion: '0.9.0' } as Record<
      string,
      unknown
    >;
    delete oldSave.settlements;
    delete oldSave.territory;
    const decodedOldSave = decodeGameSave(
      JSON.stringify({
        format: 'alien-civilization-save',
        formatVersion: 1,
        state: oldSave,
      }),
    );
    expect(decodedOldSave).toMatchObject({
      ok: true,
      value: {
        schemaVersion: 8,
        contentVersion: '0.11.0',
        settlements: [],
        territory: { history: [] },
      },
    });
  });
});
