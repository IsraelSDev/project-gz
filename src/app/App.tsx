import { useMemo, useRef, useState } from 'react';
import { createGameController } from '@/game/application/GameController';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { GameHUD } from '@/presentation/game-ui/GameHUD';
import { useGameSnapshot } from '@/presentation/hooks/useGameSnapshot';
import { createSelectionStore } from '@/session/selectionStore';
import { GameCanvas } from './GameCanvas';
import { toWorldSnapshot } from './worldSnapshot';

/**
 * Raiz de composição: cria o controlador da partida (estado do domínio) e o store de seleção
 * (estado de sessão da interface) e liga a eles a cena 3D e o HUD. Nada aqui guarda cópia do estado.
 */
export function App() {
  // O estado inicial é somente leitura nesta fase. Usa-se useMemo (e não useState) para o
  // controlador porque o React Refresh o recalcula quando o conteúdo do cenário é editado em
  // desenvolvimento, e a cena acompanha a mudança sem recarregar a página.
  const controller = useMemo(
    () => createGameController(createInitialGameState(INITIAL_SCENARIO)),
    [],
  );
  // A seleção é estado de sessão: vive enquanto a página vive e não faz parte do GameState.
  const [selection] = useState(createSelectionStore);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const gameState = useGameSnapshot(controller);
  const worldSnapshot = useMemo(() => toWorldSnapshot(gameState, INITIAL_SCENARIO), [gameState]);

  // Fechar o painel remove o botão que tinha o foco; devolve-o ao jogo para o teclado seguir útil.
  const returnFocusToGame = () => canvasRef.current?.focus({ preventScroll: true });

  return (
    <div className="app">
      <main className="game-stage">
        <GameCanvas snapshot={worldSnapshot} selection={selection} canvasRef={canvasRef} />
      </main>
      <GameHUD controller={controller} selection={selection} onPanelDismissed={returnFocusToGame} />
    </div>
  );
}
