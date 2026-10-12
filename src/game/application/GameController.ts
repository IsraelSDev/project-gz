import {
  executeSimulationCommand,
  type CommandErrorCode,
  type CommandResult,
  type SimulationCommand,
} from '@/game/domain/commands/simulationCommand';
import { advanceSimulationStep } from '@/game/domain/simulation/advanceSimulationStep';
import type { GameState } from '@/game/domain/state/GameState';
import { validateGameState } from '@/game/domain/state/validateGameState';
import { freezeDeep } from '@/game/domain/state/freezeDeep';
import { err, ok, type Result } from '@/shared/result/result';
import { createListenerSet } from '@/shared/store/listenerSet';
import { createSimulationClock, type SimulationClock } from './time/SimulationClock';

/*
 * Ponte entre a partida e o resto da aplicação (docs/TECHNICAL_ARCHITECTURE.md §3.3, §6, §7 e §11).
 * É a fonte única da verdade do estado da partida: guarda o `GameState`, o `SimulationClock` e a
 * fila de comandos de simulação, e publica snapshots imutáveis. `subscribe` e `getSnapshot` seguem o
 * contrato de `useSyncExternalStore`.
 */

/**
 * Visão imutável da partida entregue à interface. É o próprio `GameState`, que o domínio entrega
 * congelado em profundidade: não há segunda cópia dos dados. Um novo passo ou comando gera um novo
 * objeto, que COMPARTILHA as partes que não mudaram (`resources`, `buildings`), o que permite à
 * interface reagir só ao que mudou.
 */
export type GameSnapshot = GameState;

/** O que a interface precisa para LER a partida. */
export interface GameStateReader {
  /** Snapshot atual. A MESMA referência é devolvida enquanto o estado não mudar. */
  getSnapshot(): GameSnapshot;
  /** Registra um ouvinte, chamado a cada novo snapshot, e devolve o cancelamento da assinatura. */
  subscribe(listener: () => void): () => void;
}

/** `applied`: já aplicado ao estado (jogo pausado). `queued`: será aplicado no próximo passo. */
export type CommandOutcome = 'applied' | 'queued';

/** Registro de um comando de simulação, com o tick do estado em que foi aplicado ou recusado. */
export interface CommandLogEntry {
  readonly tick: number;
  readonly command: SimulationCommand;
  readonly outcome: 'applied' | 'rejected';
  /** Presente quando `outcome` é `rejected` (recusado na aplicação, depois de já ter sido aceito). */
  readonly error?: CommandErrorCode;
}

/** Um comando aceito na fila que as regras recusaram na hora de aplicar (revalidação). */
export type RejectedCommand = CommandLogEntry & {
  readonly outcome: 'rejected';
  readonly error: CommandErrorCode;
};

export interface GameController extends GameStateReader {
  /**
   * Relógio da simulação. A interface lê `getSnapshot`/`subscribe` e usa os comandos de controle
   * (`pause`, `resume`, `setSpeed`); `advance` e `reset` são do driver de tempo e do ciclo da partida.
   */
  readonly clock: SimulationClock;
  /**
   * Envia um comando de SIMULAÇÃO. É validado na hora (devolvendo o código do erro, sem alterar o
   * estado). Com o jogo pausado um comando válido é aplicado IMEDIATAMENTE, sem avançar o tick;
   * em andamento entra na fila e é aplicado no início do próximo passo (e revalidado ali).
   */
  submitCommand(command: SimulationCommand): Result<CommandOutcome, CommandErrorCode>;
  /** Substitui atomicamente o estado validado e reinicia o relógio pausado em 1x. */
  replaceState(state: GameState): Result<void, 'INVALID_STATE'>;
  /** Últimos comandos aplicados ou recusados, do mais antigo ao mais novo (para testes e depuração). */
  getCommandLog(): readonly CommandLogEntry[];
  /**
   * Canal de feedback dos comandos RECUSADOS NA APLICAÇÃO (P-17): um comando aceito na fila pode ser
   * recusado quando o passo o aplica (por exemplo, outro comando gastou os recursos antes). O
   * ouvinte recebe o comando e o código do erro, e a interface o traduz em texto. Comandos recusados
   * no envio não passam por aqui: o próprio `submitCommand` já devolveu o erro.
   */
  subscribeRejections(listener: (rejection: RejectedCommand) => void): () => void;
}

export interface GameControllerOptions {
  /** Valida e aplica um comando. Por padrão, o do domínio; testes injetam comandos próprios. */
  readonly executeCommand?: (state: GameState, command: SimulationCommand) => CommandResult;
  readonly maxStepsPerAdvance?: number;
  /** Tamanho máximo do log de comandos (registros que crescem têm limite, Arquitetura §10). */
  readonly commandLogLimit?: number;
}

export const DEFAULT_COMMAND_LOG_LIMIT = 100;

/**
 * Cria o controlador a partir do estado inicial (já imutável, vindo do domínio). Lança um erro se o
 * estado for inválido: é um erro de conteúdo ou de programação, não uma falha esperada de gameplay.
 * A partida nasce PAUSADA (o relógio começa pausado).
 */
export function createGameController(
  initialState: GameState,
  options: GameControllerOptions = {},
): GameController {
  const issues = validateGameState(initialState);
  if (issues.length > 0) {
    throw new Error(`Estado inicial inválido:\n- ${issues.join('\n- ')}`);
  }

  const execute =
    options.executeCommand ?? ((state, command) => executeSimulationCommand(state, command));
  const logLimit = options.commandLogLimit ?? DEFAULT_COMMAND_LOG_LIMIT;
  const listeners = createListenerSet();
  const rejectionListeners = new Set<(rejection: RejectedCommand) => void>();

  let state: GameSnapshot = initialState;
  /** Comandos aceitos e ainda não aplicados, em ordem de chegada (FIFO). Só existe com o jogo em andamento. */
  let pending: SimulationCommand[] = [];
  const log: CommandLogEntry[] = [];

  const record = (entry: CommandLogEntry): void => {
    log.push(entry);
    if (log.length > logLimit) {
      log.splice(0, log.length - logLimit);
    }
  };

  const publish = (next: GameSnapshot): void => {
    if (next !== state) {
      state = next;
      listeners.notify();
    }
  };

  /**
   * Aplica os comandos pendentes em ordem de chegada. Cada um é REVALIDADO contra o estado do
   * momento (a aplicação é a decisão definitiva); os recusados não alteram nada e ficam no log.
   */
  const applyPending = (from: GameSnapshot): GameSnapshot => {
    const batch = pending;
    pending = [];
    let current = from;
    for (const command of batch) {
      const result = execute(current, command);
      if (result.ok) {
        record({ tick: current.tick, command, outcome: 'applied' });
        current = result.value;
      } else {
        const rejection: RejectedCommand = {
          tick: current.tick,
          command,
          outcome: 'rejected',
          error: result.error,
        };
        record(rejection);
        for (const listener of [...rejectionListeners]) {
          listener(rejection);
        }
      }
    }
    return current;
  };

  /**
   * Um passo de simulação e UM snapshot novo. A ordem dos sistemas (tick, comandos pendentes,
   * economia: Arquitetura §6.5) é do domínio; a fila de comandos é daqui, então entra como a fase
   * de comandos do passo.
   */
  const runStep = (): void => {
    publish(advanceSimulationStep(state, applyPending));
  };

  const clock = createSimulationClock({
    onStep: runStep,
    maxStepsPerAdvance: options.maxStepsPerAdvance,
  });

  // Com o jogo pausado os comandos são aplicados na hora, então nada pode ficar esperando na fila:
  // ao pausar (pelo jogador, pela aba oculta ou por qualquer outro caminho), o que estava
  // pendente é aplicado AGORA, em ordem, sem avançar o tick. Isso mantém a ordem de chegada.
  clock.subscribe(() => {
    if (clock.getSnapshot().paused && pending.length > 0) {
      publish(applyPending(state));
    }
  });

  return {
    getSnapshot: () => state,
    subscribe: listeners.subscribe,
    clock,

    submitCommand: (command) => {
      // Validação no envio: a MESMA função que aplica, sobre o estado atual, descartando o resultado.
      const result = execute(state, command);
      if (!result.ok) {
        return err(result.error);
      }
      if (clock.getSnapshot().paused) {
        record({ tick: state.tick, command, outcome: 'applied' });
        publish(result.value);
        return ok('applied');
      }
      pending.push(command);
      return ok('queued');
    },

    replaceState: (nextState) => {
      if (validateGameState(nextState).length > 0) {
        return err('INVALID_STATE');
      }
      pending = [];
      clock.reset();
      log.length = 0;
      publish(freezeDeep(nextState));
      return ok(undefined);
    },

    getCommandLog: () => [...log],

    subscribeRejections: (listener) => {
      rejectionListeners.add(listener);
      return () => {
        rejectionListeners.delete(listener);
      };
    },
  };
}
