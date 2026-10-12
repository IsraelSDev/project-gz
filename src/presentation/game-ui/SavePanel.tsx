import { useRef, useState } from 'react';
import type { GameController } from '@/game/application/GameController';
import { loadGame, saveGame, type SaveError } from '@/game/application/saveGame';
import type { SaveProvider } from '@/game/application/ports/SaveProvider';
import type { GameState } from '@/game/domain/state/GameState';

const ERROR_MESSAGES: Readonly<Record<SaveError, string>> = {
  NO_SAVE: 'Nenhuma partida salva foi encontrada.',
  STORAGE_ERROR: 'Não foi possível acessar o armazenamento local.',
  CORRUPT_SAVE: 'O arquivo salvo está corrompido ou contém dados inválidos.',
  INCOMPATIBLE_SAVE: 'A partida salva é incompatível com esta versão do jogo.',
  INVALID_STATE: 'A partida não pôde ser carregada porque o estado é inválido.',
};

export interface SavePanelProps {
  readonly controller: GameController;
  readonly provider: SaveProvider;
  readonly initialState: GameState;
  readonly onStateReplaced: () => void;
}

export function SavePanel({ controller, provider, initialState, onStateReplaced }: SavePanelProps) {
  const baseline = useRef(JSON.stringify(initialState));
  const operationInProgress = useRef(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ readonly error: boolean; readonly text: string }>();

  const beginOperation = async (operation: () => Promise<void>): Promise<void> => {
    if (operationInProgress.current) return;
    operationInProgress.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      await operation();
    } catch {
      setFeedback({ error: true, text: ERROR_MESSAGES.STORAGE_ERROR });
    } finally {
      operationInProgress.current = false;
      setBusy(false);
    }
  };

  const save = () =>
    beginOperation(async () => {
      const result = await saveGame(controller, provider);
      if (!result.ok) {
        setFeedback({ error: true, text: ERROR_MESSAGES[result.error] });
        return;
      }
      baseline.current = JSON.stringify(result.value);
      setFeedback({ error: false, text: 'Partida salva.' });
    });

  const load = () =>
    beginOperation(async () => {
      const result = await loadGame(controller, provider);
      if (!result.ok) {
        setFeedback({ error: true, text: ERROR_MESSAGES[result.error] });
        return;
      }
      baseline.current = JSON.stringify(result.value);
      onStateReplaced();
      setFeedback({ error: false, text: 'Partida carregada. O jogo está pausado.' });
    });

  const newGame = () => {
    if (operationInProgress.current) return;
    const hasUnsavedProgress = JSON.stringify(controller.getSnapshot()) !== baseline.current;
    if (
      hasUnsavedProgress &&
      !window.confirm('O progresso não salvo será perdido. Iniciar uma nova partida?')
    ) {
      return;
    }
    void beginOperation(async () => {
      const result = controller.replaceState(initialState);
      if (!result.ok) {
        setFeedback({ error: true, text: ERROR_MESSAGES.INVALID_STATE });
        return;
      }
      baseline.current = JSON.stringify(initialState);
      onStateReplaced();
      setFeedback({ error: false, text: 'Nova partida iniciada.' });
    });
  };

  return (
    <section className="hud-panel save-panel" aria-label="Salvamento da partida" aria-busy={busy}>
      <h2 className="hud-panel__title">Partida</h2>
      <div className="save-panel__actions">
        <button type="button" disabled={busy} onClick={() => void save()}>
          Salvar
        </button>
        <button type="button" disabled={busy} onClick={() => void load()}>
          Carregar
        </button>
        <button type="button" disabled={busy} onClick={newGame}>
          Nova partida
        </button>
      </div>
      {busy && <p role="status">Processando…</p>}
      {feedback && (
        <p
          className="save-panel__feedback"
          data-error={feedback.error}
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}
