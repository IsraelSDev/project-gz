import type { GameStateReader } from '@/game/application/GameController';
import { SIMULATION_SPEEDS, type SimulationClock } from '@/game/application/time/SimulationClock';
import { useClock } from '../hooks/useClock';
import { useGameSelector } from '../hooks/useGameSelector';

const tickFormat = new Intl.NumberFormat('pt-BR');

/** O que os controles de tempo precisam do relógio: ler o estado e os comandos de CONTROLE. */
export type ClockControls = Pick<
  SimulationClock,
  'getSnapshot' | 'subscribe' | 'pause' | 'resume' | 'setSpeed'
>;

export interface TimeControlsProps {
  /** Fonte do tick (estado da partida) e do relógio (pausa e velocidade). */
  readonly controller: GameStateReader & { readonly clock: ClockControls };
}

/** Ícone decorativo (o texto ao lado diz o que é). */
function ClockIcon({ shape }: { readonly shape: 'play' | 'pause' }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      {shape === 'play' ? (
        <path d="M8 5v14l11-7z" fill="currentColor" />
      ) : (
        <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
      )}
    </svg>
  );
}

/**
 * Controles de tempo da HUD: estado do relógio, tick atual, pausar/retomar e velocidade. Lê o
 * relógio por `useClock` e o tick por `useGameSelector`: não guarda cópia de `paused`, `speed` nem
 * `tick` no React. Os botões são comandos de CONTROLE e funcionam com o jogo pausado ou não. Não há
 * calendário nem dias: só o tick (1 tick = 1 segundo de tempo de jogo, D-41).
 */
export function TimeControls({ controller }: TimeControlsProps) {
  const clock = controller.clock;
  const { paused, speed } = useClock(clock);
  const tick = useGameSelector(controller, (snapshot) => snapshot.tick);

  return (
    <section className="time-controls" aria-label="Tempo da simulação">
      <p className="time-controls__status" data-state={paused ? 'paused' : 'running'}>
        <ClockIcon shape={paused ? 'pause' : 'play'} />
        <span>{paused ? 'Pausado' : 'Em andamento'}</span>
      </p>

      <p className="time-controls__tick">
        <span className="time-controls__tick-label">Tick</span>{' '}
        <span className="time-controls__tick-value">{tickFormat.format(tick)}</span>
      </p>

      <button
        type="button"
        className="time-controls__toggle"
        onClick={() => (paused ? clock.resume() : clock.pause())}
      >
        <ClockIcon shape={paused ? 'play' : 'pause'} />
        <span>{paused ? 'Retomar' : 'Pausar'}</span>
      </button>

      <div className="time-controls__speeds" role="group" aria-label="Velocidade da simulação">
        {SIMULATION_SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            className="time-controls__speed"
            aria-pressed={option === speed}
            onClick={() => clock.setSpeed(option)}
          >
            {option}×
          </button>
        ))}
      </div>

      {/* Anúncio curto para leitores de tela quando o estado do relógio muda. */}
      <p role="status" className="visually-hidden">
        {paused ? 'Simulação pausada.' : `Simulação em andamento a ${speed}×.`}
      </p>
    </section>
  );
}
