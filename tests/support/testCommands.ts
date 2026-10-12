import {
  executeSimulationCommand,
  type CommandHandlers,
  type SimulationCommand,
} from '@/game/domain/commands/simulationCommand';
import type { GameState } from '@/game/domain/state/GameState';
import { err, ok } from '@/shared/result/result';

/*
 * Comandos de TESTE. Não existe nenhum comando de simulação concreto na Fase 4 (PlaceBuilding é da
 * Fase 6 e ResolveEvent da Fase 7); estes só provam a infraestrutura de validação, fila e aplicação.
 * Não são regras do jogo e não existem na aplicação.
 */

/** Define o estoque de materiais (valores fora do domínio de `GameState` são barrados pela validação). */
export interface SetMaterials extends SimulationCommand {
  readonly type: 'SetMaterials';
  readonly value: number;
}

/** Gasta materiais; as regras recusam se não houver estoque suficiente NO MOMENTO da aplicação. */
export interface SpendMaterials extends SimulationCommand {
  readonly type: 'SpendMaterials';
  readonly amount: number;
}

export const setMaterials = (value: number): SetMaterials => ({ type: 'SetMaterials', value });
export const spendMaterials = (amount: number): SpendMaterials => ({
  type: 'SpendMaterials',
  amount,
});

const withMaterials = (state: GameState, materials: number): GameState => ({
  ...state,
  resources: { ...state.resources, materials },
});

export const TEST_HANDLERS: CommandHandlers = {
  SetMaterials: (state, command) => {
    const { value } = command as SetMaterials;
    if (typeof value !== 'number') {
      return err('INVALID_COMMAND');
    }
    if (value > 1000) {
      return err('COMMAND_REJECTED');
    }
    // Um valor inválido passa pelo tratador e é barrado pela validação do estado resultante.
    return ok(withMaterials(state, value));
  },
  SpendMaterials: (state, command) => {
    const { amount } = command as SpendMaterials;
    if (!Number.isInteger(amount) || amount <= 0) {
      return err('INVALID_COMMAND');
    }
    if (state.resources.materials < amount) {
      return err('COMMAND_REJECTED');
    }
    return ok(withMaterials(state, state.resources.materials - amount));
  },
};

/** Executor que usa os tratadores de teste (injetado no `GameController` pelos testes). */
export const executeTestCommand = (state: GameState, command: SimulationCommand) =>
  executeSimulationCommand(state, command, TEST_HANDLERS);
