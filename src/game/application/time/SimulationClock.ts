import { TICK_GAME_SECONDS } from '@/game/domain/time/ticks';
import { createListenerSet } from '@/shared/store/listenerSet';
import { err, ok, type Result } from '@/shared/result/result';

/*
 * Relógio de simulação com passo FIXO (docs/TECHNICAL_ARCHITECTURE.md §6.1, decisões D-41 e D-42).
 *
 * É lógica temporal pura: não lê relógio, `requestAnimationFrame` nem DOM. Quem o move é um driver
 * (`startClockDriver`) que informa o tempo real transcorrido em `advance`. O relógio só decide
 * QUANTOS passos executar e chama `onStep` para cada um; não conhece produção, consumo nem nenhum
 * sistema do jogo. O tick (dado do domínio) é incrementado por quem executa o passo, nunca aqui.
 *
 * `paused` e `speed` pertencem ao relógio e NÃO fazem parte do `GameState` (D-11).
 */

/** Velocidades disponíveis: segundos de jogo processados por segundo real. */
export const SIMULATION_SPEEDS = [1, 2, 4] as const;
export type SimulationSpeed = (typeof SIMULATION_SPEEDS)[number];

export const DEFAULT_SIMULATION_SPEED: SimulationSpeed = 1;

/**
 * Máximo de passos executados por chamada de `advance` (limite de recuperação, D-15). Cobre com
 * folga um quadro lento a 4x (um quadro de 2 s a 4x pede 8 passos); acima disso o atraso é
 * DESCARTADO em vez de executado depois.
 */
export const DEFAULT_MAX_STEPS_PER_ADVANCE = 10;

export function isSimulationSpeed(value: unknown): value is SimulationSpeed {
  return SIMULATION_SPEEDS.some((speed) => speed === value);
}

/** Estado do relógio visível para a interface. Imutável; a referência só muda quando algo muda. */
export interface ClockSnapshot {
  readonly paused: boolean;
  readonly speed: SimulationSpeed;
}

/** INVALID_SPEED: a velocidade pedida não está em `SIMULATION_SPEEDS`. */
export type ClockErrorCode = 'INVALID_SPEED';

export interface SimulationClock {
  /** Estado atual (somente leitura). A MESMA referência é devolvida enquanto nada muda. */
  getSnapshot(): ClockSnapshot;
  subscribe(listener: () => void): () => void;

  /* Comandos de CONTROLE: atuam direto no relógio, imediatamente, com o jogo pausado ou não. */
  pause(): void;
  resume(): void;
  setSpeed(speed: number): Result<SimulationSpeed, ClockErrorCode>;

  /**
   * Informa `realDeltaMs` milissegundos de tempo real transcorridos e executa os passos devidos
   * (zero ou mais), devolvendo quantos foram. Pausado, não executa nada e o tempo real NÃO se
   * acumula. Lança `RangeError` para um delta negativo ou não finito: é um bug do chamador.
   */
  advance(realDeltaMs: number): number;

  /** Volta ao estado de partida nova ou carregada: pausado, velocidade padrão, sem atraso acumulado. */
  reset(): void;
}

export interface SimulationClockOptions {
  /** Executa UM passo de simulação. Chamado `n` vezes por `advance`, na ordem. */
  readonly onStep: () => void;
  readonly maxStepsPerAdvance?: number;
}

function createSnapshot(paused: boolean, speed: SimulationSpeed): ClockSnapshot {
  return Object.freeze({ paused, speed });
}

/** Cria o relógio. Começa PAUSADO, em 1x: a partida só avança quando o jogador a retoma. */
export function createSimulationClock(options: SimulationClockOptions): SimulationClock {
  const { onStep, maxStepsPerAdvance = DEFAULT_MAX_STEPS_PER_ADVANCE } = options;
  const listeners = createListenerSet();
  const stepGameMs = TICK_GAME_SECONDS * 1000;

  let snapshot = createSnapshot(true, DEFAULT_SIMULATION_SPEED);
  /** Tempo de JOGO (ms) acumulado e ainda não consumido em passos; sempre menor que um passo. */
  let pendingGameMs = 0;

  const update = (paused: boolean, speed: SimulationSpeed): void => {
    if (snapshot.paused === paused && snapshot.speed === speed) {
      return;
    }
    snapshot = createSnapshot(paused, speed);
    listeners.notify();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: listeners.subscribe,

    pause: () => update(true, snapshot.speed),
    resume: () => update(false, snapshot.speed),
    setSpeed: (speed) => {
      if (!isSimulationSpeed(speed)) {
        return err('INVALID_SPEED');
      }
      update(snapshot.paused, speed);
      return ok(speed);
    },

    advance: (realDeltaMs) => {
      if (!Number.isFinite(realDeltaMs) || realDeltaMs < 0) {
        throw new RangeError(`realDeltaMs inválido: ${String(realDeltaMs)}.`);
      }
      if (snapshot.paused) {
        return 0;
      }

      // A velocidade multiplica o tempo de jogo por tempo real; a duração do passo não muda.
      pendingGameMs += realDeltaMs * snapshot.speed;
      let steps = 0;
      // `onStep` pode pausar o relógio (no futuro, por exemplo, por um evento): o laço respeita.
      while (pendingGameMs >= stepGameMs && steps < maxStepsPerAdvance && !snapshot.paused) {
        pendingGameMs -= stepGameMs;
        steps += 1;
        onStep();
      }
      // Passos além do limite são descartados (não executados depois): sem catch-up ilimitado.
      // Mantém-se só a fração do passo atual, para o ritmo não "pular".
      pendingGameMs %= stepGameMs;
      return steps;
    },

    reset: () => {
      pendingGameMs = 0;
      update(true, DEFAULT_SIMULATION_SPEED);
    },
  };
}
