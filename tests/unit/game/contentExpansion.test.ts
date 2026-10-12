import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { explorePointCommand } from '@/game/domain/exploration/exploreCommand';
import { advanceEvents } from '@/game/domain/events/advanceEvents';
import { executeSimulationCommand } from '@/game/domain/commands/simulationCommand';
import { advanceResearch, startResearchCommand } from '@/game/domain/research/researchCommands';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { decodeGameSave, encodeGameSave } from '@/game/application/saveGame';
import { selectBuildCatalog } from '@/game/application/buildSelectors';

const initial = () => createInitialGameState(INITIAL_SCENARIO);
const withLab = () => {
  const state = initial();
  return {
    ...state,
    buildings: [
      ...state.buildings,
      {
        instanceId: 'building-lab',
        definitionId: 'field-laboratory' as const,
        position: { x: 30, y: 30 },
        rotation: 0 as const,
      },
    ],
  };
};

describe('expansão de conteúdo da Fase 11', () => {
  it('cobra a pesquisa uma vez, progride com cientista e laboratório, e desbloqueia a tecnologia', () => {
    const state = withLab();
    const started = executeSimulationCommand(state, startResearchCommand('protein-cultures'));
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.resources.materials).toBe(state.resources.materials - 20);
    expect(
      executeSimulationCommand(started.value, startResearchCommand('protein-cultures')),
    ).toMatchObject({ ok: false, error: 'COMMAND_REJECTED' });
    let progress = started.value;
    for (let i = 0; i < 15; i += 1) progress = advanceResearch(progress);
    expect(progress.research.unlockedTechnologyIds).toContain('protein-cultures');
    expect(progress.research.activeTechnologyId).toBeNull();
  });

  it('bloqueia pesquisa sem laboratório e não expõe construções antes do desbloqueio', () => {
    const state = initial();
    expect(executeSimulationCommand(state, startResearchCommand('protein-cultures'))).toMatchObject(
      {
        ok: false,
        error: 'COMMAND_REJECTED',
      },
    );
    expect(
      selectBuildCatalog(state.resources).find((item) => item.definitionId === 'protein-cultivator')
        ?.unlocked,
    ).toBe(false);
    expect(
      selectBuildCatalog(state.resources, ['protein-cultures']).find(
        (item) => item.definitionId === 'protein-cultivator',
      )?.unlocked,
    ).toBe(true);
  });

  it('usa a competência do cientista e avança deterministicamente', () => {
    const state = withLab();
    const slowerScientist = {
      ...state,
      characters: state.characters.map((character) =>
        character.characterId === state.government.offices.science
          ? { ...character, skills: { ...character.skills, science: 2 } }
          : character,
      ),
      research: { unlockedTechnologyIds: [], activeTechnologyId: 'protein-cultures', progress: 0 },
    };
    expect(advanceResearch(slowerScientist).research.progress).toBe(2);
    const a = advanceResearch(advanceResearch(slowerScientist));
    const b = advanceResearch(advanceResearch(slowerScientist));
    expect(a).toEqual(b);
    expect(a.research.progress).toBe(4);
  });

  it('não cobra duas vezes nem duplica recompensas ao repetir exploração', () => {
    const state = initial();
    const found = executeSimulationCommand(state, explorePointCommand('crystal-spring'));
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.exploration.discoveredPointIds).toEqual(['crystal-spring']);
    expect(found.value.resources.water).toBe(state.resources.water + 18);
    expect(
      executeSimulationCommand(found.value, explorePointCommand('crystal-spring')),
    ).toMatchObject({ ok: false, error: 'COMMAND_REJECTED' });
  });

  it('descoberta nas ruínas ativa evento pelo motor existente', () => {
    const state = initial();
    const prepared = {
      ...state,
      research: { ...state.research, unlockedTechnologyIds: ['protein-cultures'] },
    };
    const found = executeSimulationCommand(prepared, explorePointCommand('echo-ruins'));
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(
      advanceEvents(found.value).events.find((event) => event.eventId === 'ruins-cache')?.status,
    ).toBe('active');
  });

  it('migra save v3 sem alterar progresso anterior e persiste as descobertas atuais', () => {
    const current = initial();
    const old = {
      ...current,
      schemaVersion: 3,
      contentVersion: '0.6.0',
      events: [current.events[0]],
      research: undefined,
      exploration: undefined,
    };
    const migrated = decodeGameSave(
      JSON.stringify({ format: 'alien-civilization-save', formatVersion: 1, state: old }),
    );
    expect(migrated.ok).toBe(true);
    if (!migrated.ok) return;
    expect(migrated.value.research).toEqual({
      unlockedTechnologyIds: [],
      activeTechnologyId: null,
      progress: 0,
    });
    expect(migrated.value.events.some((event) => event.eventId === 'ruins-cache')).toBe(true);
    const result = { ...migrated.value, exploration: { discoveredPointIds: ['crystal-spring'] } };
    expect(decodeGameSave(encodeGameSave(result))).toMatchObject({
      ok: true,
      value: { exploration: result.exploration },
    });
  });
});
