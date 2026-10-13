import { describe, expect, it } from 'vitest';
import { createGameController } from '@/game/application/GameController';
import { decodeGameSave, encodeGameSave } from '@/game/application/saveGame';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { validateGameState } from '@/game/domain/state/validateGameState';
import type { GameState } from '@/game/domain/state/GameState';
import {
  appointCharacterCommand,
  removeCharacterFromOfficeCommand,
} from '@/game/domain/government/governmentCommands';
import { advanceSimulationStep } from '@/game/domain/simulation/advanceSimulationStep';

const initial = () => createInitialGameState(INITIAL_SCENARIO);

describe('personagens e governo', () => {
  it('cria IDs estáveis para personagens importantes sem substituir a população agregada', () => {
    const state = initial();
    expect(state.population.survivors).toBe(8);
    expect(state.characters.map((character) => character.characterId)).toEqual([
      'colonist-aru',
      'colonist-veli',
      'colonist-koro',
      'colonist-miri',
    ]);
    expect(new Set(state.characters.map((character) => character.characterId)).size).toBe(4);
    expect(state.characters.length).toBeLessThan(state.population.survivors);
  });

  it('permite remoção e nomeação elegível e impede duplicidade de ocupação', () => {
    const controller = createGameController(initial());
    expect(
      controller.submitCommand(appointCharacterCommand('production', 'colonist-veli')),
    ).toEqual({ ok: false, error: 'COMMAND_REJECTED' });
    expect(controller.submitCommand(removeCharacterFromOfficeCommand('science'))).toMatchObject({
      ok: true,
    });
    expect(
      controller.submitCommand(appointCharacterCommand('engineering', 'colonist-veli')),
    ).toMatchObject({ ok: true });
    expect(
      controller.submitCommand(appointCharacterCommand('production', 'colonist-veli')),
    ).toEqual({ ok: false, error: 'COMMAND_REJECTED' });
    expect(controller.getSnapshot().government.offices).toMatchObject({
      engineering: 'colonist-veli',
      production: 'colonist-miri',
    });
  });

  it('rejeita personagem inexistente e competência insuficiente e permite liberar a liderança', () => {
    const controller = createGameController(initial());
    expect(controller.submitCommand(appointCharacterCommand('science', 'missing'))).toEqual({
      ok: false,
      error: 'COMMAND_REJECTED',
    });
    expect(controller.submitCommand(appointCharacterCommand('leader', 'colonist-miri'))).toEqual({
      ok: false,
      error: 'COMMAND_REJECTED',
    });
    expect(controller.submitCommand(removeCharacterFromOfficeCommand('leader'))).toMatchObject({
      ok: true,
    });
    expect(controller.getSnapshot().government.leaderId).toBeNull();
  });

  it('valida competências, atribuições e relações explícitas', () => {
    const state = initial();
    expect(state.relationships[0]).toMatchObject({ affinity: 1, trust: 2, rivalry: 0 });
    expect(validateGameState(state)).toEqual([]);
    expect(
      validateGameState({
        ...state,
        government: {
          ...state.government,
          offices: { ...state.government.offices, science: 'colonist-aru' },
        },
      }),
    ).toContain('Um personagem não pode ocupar mais de um cargo simultaneamente.');
    expect(
      validateGameState({
        ...state,
        relationships: [{ ...state.relationships[0]!, trust: 8 }],
      }).some((issue) => issue.includes('entre -5 e 5')),
    ).toBe(true);
  });

  it('atualiza elenco e cargo quando um personagem importante morre por escassez', () => {
    let state: GameState = {
      ...initial(),
      buildings: [],
      resources: { ...initial().resources, food: 0, water: 0 },
    };
    for (let tick = 0; tick < 60; tick += 1) state = advanceSimulationStep(state);
    expect(state.population.survivors).toBe(7);
    expect(state.characters.filter((character) => character.alive)).toHaveLength(3);
    expect(state.government.offices.production).toBeNull();
    expect(validateGameState(state)).toEqual([]);
  });

  it('salva e carrega personagens, governo e relações sem duplicar IDs', () => {
    const state = initial();
    const decoded = decodeGameSave(encodeGameSave(state));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.characters).toEqual(state.characters);
    expect(decoded.value.government).toEqual(state.government);
    expect(decoded.value.relationships).toEqual(state.relationships);
    expect(new Set(decoded.value.characters.map((character) => character.characterId)).size).toBe(
      decoded.value.characters.length,
    );
    const raw = JSON.parse(encodeGameSave(state)) as { state: Record<string, unknown> };
    const existingCharacters = raw.state.characters as unknown[];
    expect(
      decodeGameSave(
        JSON.stringify({
          format: 'alien-civilization-save',
          formatVersion: 1,
          state: { ...raw.state, characters: [...existingCharacters, existingCharacters[0]] },
        }),
      ).ok,
    ).toBe(false);
    expect(
      decodeGameSave(
        JSON.stringify({
          format: 'alien-civilization-save',
          formatVersion: 1,
          state: { ...raw.state, characters: [null] },
        }),
      ).ok,
    ).toBe(false);
  });
});
