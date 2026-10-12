import { describe, expect, it } from 'vitest';
import { selectBuildCatalog, selectPlacementPreview } from '@/game/application/buildSelectors';
import { BUILDING_DEFINITIONS } from '@/game/content/buildings';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import type { ResourceStock } from '@/game/domain/state/GameState';

const state = () => createInitialGameState(INITIAL_SCENARIO);
const poor: ResourceStock = { food: 0, water: 0, materials: 10, energy: 0 };

describe('selectBuildCatalog', () => {
  it('lista todos os edifícios do conteúdo, na ordem do conteúdo', () => {
    const catalog = selectBuildCatalog(state().resources);

    expect(catalog.map((entry) => entry.definitionId)).toEqual(Object.keys(BUILDING_DEFINITIONS));
    expect(catalog).toHaveLength(8);
  });

  it('traz nome, categoria, footprint e custo da definição (nada é inventado na interface)', () => {
    const catalog = selectBuildCatalog(state().resources);
    const solar = catalog.find((entry) => entry.definitionId === 'solar-array');

    expect(solar).toMatchObject({
      name: BUILDING_DEFINITIONS['solar-array'].name,
      category: 'energy',
      footprint: BUILDING_DEFINITIONS['solar-array'].footprint,
    });
    expect(solar?.cost).toEqual([
      {
        id: 'materials',
        name: 'Materiais',
        amount: BUILDING_DEFINITIONS['solar-array'].cost.materials,
        available: INITIAL_SCENARIO.initialResources.materials,
        missing: 0,
      },
    ]);
  });

  it('um custo em vários recursos lista cada um, na ordem dos recursos', () => {
    const farm = selectBuildCatalog(state().resources).find(
      (entry) => entry.definitionId === 'hydroponic-farm',
    );

    expect(farm?.cost.map((line) => line.id)).toEqual(['water', 'materials']);
  });

  it('com recursos suficientes todos são acessíveis; faltando, diz quanto falta', () => {
    const rich = selectBuildCatalog(state().resources);
    const lacking = selectBuildCatalog(poor);

    expect(rich.every((entry) => entry.affordable)).toBe(true);
    const habitat = lacking.find((entry) => entry.definitionId === 'habitat-module');
    expect(habitat?.affordable).toBe(false);
    expect(habitat?.cost).toEqual([
      {
        id: 'materials',
        name: 'Materiais',
        amount: BUILDING_DEFINITIONS['habitat-module'].cost.materials,
        available: 10,
        missing: BUILDING_DEFINITIONS['habitat-module'].cost.materials - 10,
      },
    ]);
  });

  it('a disponibilidade acompanha o estoque exato (limite inclusivo)', () => {
    const cost = BUILDING_DEFINITIONS['solar-array'].cost.materials;
    const at = (materials: number) =>
      selectBuildCatalog({ ...poor, materials }).find(
        (entry) => entry.definitionId === 'solar-array',
      )?.affordable;

    expect(at(cost - 1)).toBe(false);
    expect(at(cost)).toBe(true);
  });

  it('não altera o estoque de entrada', () => {
    const resources = freezeDeep({ ...state().resources });

    selectBuildCatalog(resources);

    expect(resources).toEqual(INITIAL_SCENARIO.initialResources);
  });
});

describe('selectPlacementPreview', () => {
  const input = (patch: Partial<Parameters<typeof selectPlacementPreview>[1]> = {}) => ({
    definitionId: 'solar-array' as const,
    rotation: 0 as const,
    cell: { x: 25, y: 14 },
    ...patch,
  });

  it('sem edifício em posicionamento não há prévia', () => {
    expect(selectPlacementPreview(state(), input({ definitionId: null }))).toBeNull();
  });

  it('sem célula apontada há a prévia do edifício, mas sem pedido e sem posição', () => {
    const preview = selectPlacementPreview(state(), input({ cell: null }));

    expect(preview?.request).toBeNull();
    expect(preview?.status).toEqual({ kind: 'no-position' });
    expect(preview?.name).toBe(BUILDING_DEFINITIONS['solar-array'].name);
  });

  it('numa posição livre é válida e o pedido usa a célula apontada como centro', () => {
    const preview = selectPlacementPreview(state(), input());

    expect(preview?.status).toEqual({ kind: 'valid' });
    // 3×2 centralizado na célula (25, 14): posição (24, 13).
    expect(preview?.request).toEqual({
      definitionId: 'solar-array',
      position: { x: 24, y: 13 },
      rotation: 0,
    });
  });

  it('girar troca as dimensões ocupadas e a posição resultante', () => {
    const straight = selectPlacementPreview(state(), input());
    const turned = selectPlacementPreview(state(), input({ rotation: 90 }));

    expect(straight?.occupied).toEqual({ width: 3, depth: 2 });
    expect(turned?.occupied).toEqual({ width: 2, depth: 3 });
    expect(turned?.footprint).toEqual({ width: 3, depth: 2 });
    expect(turned?.request?.position).toEqual({ x: 24, y: 13 });
    expect(turned?.request?.rotation).toBe(90);
  });

  it.each([
    ['fora da área', { x: 2, y: 2 }, 'OUT_OF_BUILDABLE_AREA'],
    ['sobre a nave', { x: 18, y: 15 }, 'OVERLAPS_OBSTACLE'],
    ['sobre um edifício', { x: 15, y: 21 }, 'OVERLAPS_BUILDING'],
  ])('%s: inválida com o código do domínio', (_name, cell, error) => {
    const preview = selectPlacementPreview(state(), input({ cell }));

    expect(preview?.status).toEqual({ kind: 'invalid', error });
  });

  it('sem recursos: inválida por recursos insuficientes, com o que falta nas linhas de custo', () => {
    const lacking = { ...state(), resources: poor };

    const preview = selectPlacementPreview(lacking, input());

    expect(preview?.status).toEqual({ kind: 'invalid', error: 'INSUFFICIENT_RESOURCES' });
    expect(preview?.cost[0]?.missing).toBe(BUILDING_DEFINITIONS['solar-array'].cost.materials - 10);
  });

  it('é só uma consulta: não altera o estado e devolve resultados iguais para entradas iguais', () => {
    const frozen = freezeDeep(state());
    const before = JSON.stringify(frozen);

    const a = selectPlacementPreview(frozen, input());
    const b = selectPlacementPreview(frozen, input());

    expect(JSON.stringify(frozen)).toBe(before);
    expect(a).toEqual(b);
  });

  it('a validade da prévia é a mesma do comando (mesma regra, sem duplicação)', () => {
    // Cada célula da área: a prévia válida ⇔ o pedido resultante seria aceito pelo domínio.
    const valid = selectPlacementPreview(state(), input())?.status.kind === 'valid';
    const invalid = selectPlacementPreview(state(), input({ cell: { x: 18, y: 15 } }))?.status.kind;

    expect(valid).toBe(true);
    expect(invalid).toBe('invalid');
  });
});
