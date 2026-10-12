import { useEffect, useMemo, useRef, useState } from 'react';
import { createGameController } from '@/game/application/GameController';
import { startClockDriver } from '@/game/application/time/startClockDriver';
import { INITIAL_SCENARIO } from '@/game/content/scenario';
import { PLACE_BUILDING } from '@/game/domain/construction/placeBuildingCommand';
import { createInitialGameState } from '@/game/domain/state/createInitialGameState';
import { createBuildActions } from '@/presentation/build/buildActions';
import { GameHUD } from '@/presentation/game-ui/GameHUD';
import { useGameSelector } from '@/presentation/hooks/useGameSelector';
import { createBrowserTimeEnvironment } from '@/platform/time/browserTimeEnvironment';
import { createBuildStore } from '@/session/buildStore';
import { createSelectionStore } from '@/session/selectionStore';
import { GameCanvas } from './GameCanvas';
import { toWorldSnapshot } from './worldSnapshot';

/**
 * Raiz de composição: cria o controlador da partida (estado do domínio, relógio e comandos) e o
 * store de seleção (estado de sessão da interface) e liga a eles a cena 3D, o HUD e o tempo real.
 * Nada aqui guarda cópia do estado.
 */
export function App() {
  // Usa-se useMemo (e não useState) para o controlador porque o React Refresh o recalcula quando o
  // conteúdo do cenário é editado em desenvolvimento, e a cena acompanha a mudança sem recarregar a
  // página. A partida nasce pausada.
  const controller = useMemo(
    () => createGameController(createInitialGameState(INITIAL_SCENARIO)),
    [],
  );
  // A seleção é estado de sessão: vive enquanto a página vive e não faz parte do GameState.
  const [selection] = useState(createSelectionStore);
  // O modo de construção (qual edifício, rotação, posição da prévia) também é estado de sessão.
  const [build] = useState(createBuildStore);
  const buildActions = useMemo(() => createBuildActions(controller, build), [controller, build]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // O tempo real move o relógio por um loop próprio, separado do render loop do Babylon.js. O
  // efeito inicia UM driver e o para na limpeza (StrictMode: iniciar → parar → iniciar).
  useEffect(() => startClockDriver(controller.clock, createBrowserTimeEnvironment()), [controller]);

  // Uma construção aceita na fila pode ser recusada ao ser aplicada (por exemplo, outro comando gastou
  // os recursos antes): o motivo chega por este canal e a interface o mostra (P-17).
  useEffect(
    () =>
      controller.subscribeRejections((rejection) => {
        if (rejection.command.type === PLACE_BUILDING) {
          build.report({ kind: 'rejected', error: rejection.error });
        }
      }),
    [controller, build],
  );

  // Só `buildings` alimenta a cena: os ticks não a refazem (a referência não muda a cada passo).
  const buildings = useGameSelector(controller, (snapshot) => snapshot.buildings);
  const worldSnapshot = useMemo(
    () => toWorldSnapshot({ buildings }, INITIAL_SCENARIO),
    [buildings],
  );

  // Fechar o painel remove o botão que tinha o foco; devolve-o ao jogo para o teclado seguir útil.
  const returnFocusToGame = () => canvasRef.current?.focus({ preventScroll: true });

  return (
    <div className="app">
      <main className="game-stage">
        <GameCanvas
          snapshot={worldSnapshot}
          controller={controller}
          selection={selection}
          build={build}
          buildActions={buildActions}
          canvasRef={canvasRef}
        />
      </main>
      <GameHUD
        controller={controller}
        selection={selection}
        build={build}
        buildActions={buildActions}
        onPanelDismissed={returnFocusToGame}
      />
    </div>
  );
}
