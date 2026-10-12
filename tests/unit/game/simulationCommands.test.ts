import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import {
  COMMAND_HANDLERS,
  executeSimulationCommand,
  type CommandHandlers,
  type SimulationCommand,
} from '@/game/domain/commands/simulationCommand';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import type { GameState } from '@/game/domain/state/GameState';
import { ok } from '@/shared/result/result';
import { executeTestCommand, setMaterials, type SetMaterials } from '../../support/testCommands';

/*
 * Não existe nenhum comando de simulação concreto na Fase 4 (PlaceBuilding é da Fase 6 e
 * ResolveEvent da Fase 7). Estes testes usam comandos de TESTE (tests/support/testCommands.ts), só
 * para provar a infraestrutura de validação e aplicação. Eles não são regras do jogo.
 */

const initial = () => createInitialGameState(INITIAL_SCENARIO);
const execute = (state: GameState, command: SimulationCommand) =>
  executeTestCommand(state, command);

describe('executeSimulationCommand', () => {
  it('não há comandos concretos registrados nesta fase', () => {
    expect(Object.keys(COMMAND_HANDLERS)).toEqual([]);
    expect(executeSimulationCommand(initial(), { type: 'PlaceBuilding' })).toEqual({
      ok: false,
      error: 'INVALID_COMMAND',
    });
  });

  it('aplica um comando válido e devolve o NOVO estado, sem alterar o de entrada', () => {
    const state = initial();
    const before = JSON.stringify(state);

    const result = execute(state, setMaterials(42));

    expect(result.ok && result.value.resources.materials).toBe(42);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('o estado devolvido é válido, congelado e mantém a referência do que não mudou', () => {
    const state = initial();

    const result = execute(state, setMaterials(7));

    if (!result.ok) {
      throw new Error('O comando deveria ter sido aceito.');
    }
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.resources)).toBe(true);
    expect(result.value.buildings).toBe(state.buildings);
    expect(result.value.tick).toBe(state.tick);
  });

  it('um comando válido nunca avança o tick por conta própria', () => {
    const state = initial();

    const result = execute(state, setMaterials(1));

    expect(result.ok && result.value.tick).toBe(0);
  });

  it('rejeita um tipo de comando desconhecido com INVALID_COMMAND', () => {
    expect(execute(initial(), { type: 'Inexistente' })).toEqual({
      ok: false,
      error: 'INVALID_COMMAND',
    });
  });

  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty', ''])(
    'não confunde o tipo "%s" com um tratador herdado do objeto',
    (type) => {
      expect(execute(initial(), { type })).toEqual({ ok: false, error: 'INVALID_COMMAND' });
    },
  );

  it('rejeita um comando sem tipo textual', () => {
    const result = execute(initial(), { type: 42 } as unknown as SimulationCommand);

    expect(result).toEqual({ ok: false, error: 'INVALID_COMMAND' });
  });

  it('devolve o código do próprio tratador quando o comando é malformado ou recusado pelas regras', () => {
    const malformed = execute(initial(), {
      type: 'SetMaterials',
      value: 'x',
    } as unknown as SetMaterials);
    const refused = execute(initial(), setMaterials(5000));

    expect(malformed).toEqual({ ok: false, error: 'INVALID_COMMAND' });
    expect(refused).toEqual({ ok: false, error: 'COMMAND_REJECTED' });
  });

  it.each([-1, 2.5, Number.NaN])(
    'recusa com INVALID_STATE um comando que produziria um estado inválido (materiais = %s)',
    (value) => {
      const state = initial();

      const result = execute(state, setMaterials(value));

      expect(result).toEqual({ ok: false, error: 'INVALID_STATE' });
      expect(state.resources.materials).toBe(INITIAL_SCENARIO.initialResources.materials);
    },
  );

  it('um comando inválido não altera o estado de entrada', () => {
    const state = initial();
    const before = JSON.stringify(state);

    execute(state, { type: 'Inexistente' });
    execute(state, setMaterials(5000));
    execute(state, setMaterials(-1));

    expect(JSON.stringify(state)).toBe(before);
  });

  it('é determinística: o mesmo estado e a mesma sequência de comandos dão o mesmo resultado', () => {
    const run = () => {
      let state = initial();
      for (const value of [10, 20, 5000, 30, -1, 40]) {
        const result = execute(state, setMaterials(value));
        if (result.ok) {
          state = result.value;
        }
      }
      return JSON.stringify(state);
    };

    expect(run()).toBe(run());
    expect(JSON.parse(run()).resources.materials).toBe(40);
  });

  it('um tratador não consegue mutar o estado recebido (ele é somente leitura)', () => {
    const mutating: CommandHandlers = {
      Mutate: (state) => {
        (state.resources as { materials: number }).materials = 999;
        return ok(state);
      },
    };

    expect(() => executeSimulationCommand(initial(), { type: 'Mutate' }, mutating)).toThrow(
      TypeError,
    );
  });
});
