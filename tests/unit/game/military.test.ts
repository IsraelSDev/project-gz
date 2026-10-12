import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { executeSimulationCommand } from '@/game/domain/commands/simulationCommand';
import { explorePointCommand } from '@/game/domain/exploration/exploreCommand';
import { resolveEventCommand } from '@/game/domain/events/resolveEventCommand';
import { advanceEvents } from '@/game/domain/events/advanceEvents';
import { militaryActionCommand } from '@/game/domain/military/militaryCommands';
import { advanceSimulationStep } from '@/game/domain/simulation/advanceSimulationStep';
import { validateGameState } from '@/game/domain/state/validateGameState';
import type { GameState } from '@/game/domain/state/GameState';
import { decodeGameSave } from '@/game/application/saveGame';

const run = (state: GameState, command: Parameters<typeof executeSimulationCommand>[1]) =>
  executeSimulationCommand(state, command);

describe('militar Fase 14', () => {
  it('recruta somente com posto, cobra custo e manutenção sem duplicar alterações', () => {
    const state = createInitialGameState(INITIAL_SCENARIO);
    expect(run(state, militaryActionCommand('recruit', { unitType: 'scout' }))).toMatchObject({
      ok: false,
      error: 'COMMAND_REJECTED',
    });
    const defended = {
      ...state,
      buildings: [
        ...state.buildings,
        {
          instanceId: 'guard-post-test',
          definitionId: 'guard-post' as const,
          position: { x: 25, y: 25 },
          rotation: 0 as const,
        },
      ],
    };
    const recruited = run(defended, militaryActionCommand('recruit', { unitType: 'scout' }));
    expect(recruited.ok).toBe(true);
    if (!recruited.ok) return;
    expect(recruited.value.military.units).toHaveLength(1);
    expect(recruited.value.resources.materials).toBe(defended.resources.materials - 18);
    const baselineTick = advanceSimulationStep(defended).resources.food;
    expect(advanceSimulationStep(recruited.value).resources.food).toBe(baselineTick - 1);
    expect(validateGameState(recruited.value)).toEqual([]);
  });

  it('permite hostilidade após primeiro contato guardado e resolve um confronto determinístico', () => {
    let state = createInitialGameState(INITIAL_SCENARIO);
    const explored = run(state, explorePointCommand('luminous-grove'));
    if (!explored.ok) throw new Error('Exploração falhou');
    state = advanceEvents(explored.value);
    const contact = run(state, resolveEventCommand('signal-ithari-gardeners', 'send-warning'));
    if (!contact.ok) throw new Error('Contato falhou');
    state = {
      ...contact.value,
      buildings: [
        ...contact.value.buildings,
        {
          instanceId: 'guard-post-test',
          definitionId: 'guard-post',
          position: { x: 25, y: 25 },
          rotation: 0,
        },
      ],
    };
    for (let index = 0; index < 3; index += 1) {
      const recruited = run(state, militaryActionCommand('recruit', { unitType: 'striker' }));
      if (!recruited.ok) throw new Error(`Recrutamento falhou: ${recruited.error}`);
      state = recruited.value;
    }
    const declared = run(
      state,
      militaryActionCommand('declare-war', { civilizationId: 'ithari-gardeners' }),
    );
    if (!declared.ok) throw new Error(`Declaração falhou: ${declared.error}`);
    state = advanceEvents(declared.value);
    expect(
      state.events.find((event) => event.eventId === 'war-alert-ithari-gardeners')?.status,
    ).toBe('active');
    const started = run(
      state,
      militaryActionCommand('start-battle', { civilizationId: 'ithari-gardeners' }),
    );
    if (!started.ok) throw new Error(`Combate falhou: ${started.error}`);
    state = started.value;
    while (state.military.battle?.status === 'active') state = advanceSimulationStep(state);
    expect(state.military.battle?.status).toBe('victory');
    expect(
      state.events.find((event) => event.eventId === 'battle-report-ithari-gardeners')?.status,
    ).toBe('active');
    expect(state.military.history.at(-1)).toMatchObject({
      civilizationId: 'ithari-gardeners',
      outcome: 'victory',
    });
    expect(validateGameState(state)).toEqual([]);
  });

  it('distingue derrota e recuo e migra saves de diplomacia schema 5', () => {
    const initialState = createInitialGameState(INITIAL_SCENARIO);
    let state: GameState = {
      ...initialState,
      research: { ...initialState.research, unlockedTechnologyIds: ['protein-cultures'] },
    };
    const explored = run(state, explorePointCommand('echo-ruins'));
    if (!explored.ok) throw new Error('Exploração falhou');
    state = advanceEvents(explored.value);
    const contact = run(state, resolveEventCommand('signal-oruun-clans', 'send-warning'));
    if (!contact.ok) throw new Error('Contato falhou');
    state = {
      ...contact.value,
      buildings: [
        ...contact.value.buildings,
        {
          instanceId: 'guard-post-test',
          definitionId: 'guard-post',
          position: { x: 25, y: 25 },
          rotation: 0,
        },
      ],
    };
    const recruited = run(state, militaryActionCommand('recruit', { unitType: 'scout' }));
    if (!recruited.ok) throw new Error('Recrutamento falhou');
    const declared = run(
      recruited.value,
      militaryActionCommand('declare-war', { civilizationId: 'oruun-clans' }),
    );
    if (!declared.ok) throw new Error('Declaração falhou');
    const started = run(
      declared.value,
      militaryActionCommand('start-battle', { civilizationId: 'oruun-clans' }),
    );
    if (!started.ok) throw new Error('Combate falhou');
    let defeat = started.value;
    while (defeat.military.battle?.status === 'active') defeat = advanceSimulationStep(defeat);
    expect(defeat.military.battle?.status).toBe('defeat');
    expect(defeat.military.units).toHaveLength(0);
    expect(validateGameState(defeat)).toEqual([]);

    const guardian = run(state, militaryActionCommand('recruit', { unitType: 'guardian' }));
    if (!guardian.ok) throw new Error('Recrutamento falhou');
    const secondWar = run(
      guardian.value,
      militaryActionCommand('declare-war', { civilizationId: 'oruun-clans' }),
    );
    if (!secondWar.ok) throw new Error('Declaração falhou');
    const strongStart = run(
      secondWar.value,
      militaryActionCommand('start-battle', { civilizationId: 'oruun-clans' }),
    );
    if (!strongStart.ok) throw new Error('Combate falhou');
    const retreated = run(
      strongStart.value,
      militaryActionCommand('retreat', { civilizationId: 'oruun-clans' }),
    );
    expect(retreated.ok && retreated.value.military.battle?.status).toBe('retreated');

    const current = createInitialGameState(INITIAL_SCENARIO);
    const schema5: Record<string, unknown> = {
      ...current,
      schemaVersion: 5,
      contentVersion: '0.8.0',
      events: current.events.filter(
        ({ eventId }) => !eventId.startsWith('war-alert-') && !eventId.startsWith('battle-report-'),
      ),
      diplomacy: {
        civilizations: current.diplomacy.civilizations.map((relation) => {
          return {
            civilizationId: relation.civilizationId,
            contactStatus: relation.contactStatus,
            relationshipScore: relation.relationshipScore,
            informationRequested: relation.informationRequested,
            giftOffered: relation.giftOffered,
            nonAggressionPact: relation.nonAggressionPact,
            history: relation.history,
          };
        }),
      },
    };
    delete schema5.military;
    const decoded = decodeGameSave(
      JSON.stringify({
        format: 'alien-civilization-save',
        formatVersion: 1,
        state: schema5,
      }),
    );
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.schemaVersion).toBe(6);
      expect(decoded.value.diplomacy.civilizations.every((item) => item.warStatus === 'none')).toBe(
        true,
      );
      expect(decoded.value.military).toEqual({
        nextUnitId: 1,
        units: [],
        battle: null,
        history: [],
      });
      expect(decoded.value.events.some((event) => event.eventId === 'war-alert-oruun-clans')).toBe(
        true,
      );
    }
    const corruptLegacy = decodeGameSave(
      JSON.stringify({
        format: 'alien-civilization-save',
        formatVersion: 1,
        state: { ...schema5, diplomacy: null },
      }),
    );
    expect(corruptLegacy).toEqual({ ok: false, error: 'CORRUPT_SAVE' });
  });
});
