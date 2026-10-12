import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type { GameController, GameStateReader } from '@/game/application/GameController';
import { selectPlacementPreview } from '@/game/application/buildSelectors';
import type { BuildActions } from '@/presentation/build/buildActions';
import { usePlacementActive } from '@/presentation/hooks/useBuild';
import {
  createGameRenderer,
  type FrameStats,
  type GameRenderer,
  type RendererStatus,
} from '@/rendering/GameRenderer';
import type { PlacementPreviewSpec, WorldSnapshot } from '@/rendering/world/WorldSnapshot';
import type { BuildStore } from '@/session/buildStore';
import type { SelectionStore } from '@/session/selectionStore';
import { DevStatsOverlay } from './DevStatsOverlay';

const STATUS_MESSAGES: Record<Exclude<RendererStatus, 'running'>, string> = {
  'context-lost': 'O contexto gráfico foi perdido. Aguardando a restauração…',
  failed:
    'Não foi possível iniciar a cena 3D. Verifique se o navegador oferece WebGL e se a aceleração por hardware está ativada; depois recarregue a página.',
};

export interface GameCanvasProps {
  readonly snapshot: WorldSnapshot;
  /** Fonte do estado (somente leitura): a validade da prévia depende de edifícios e recursos. */
  readonly controller: GameStateReader & {
    readonly clock: Pick<GameController['clock'], 'getSnapshot' | 'pause' | 'resume'>;
  };
  /** Seleção da interface: o clique na cena escreve nela e o marcador 3D a acompanha. */
  readonly selection: SelectionStore;
  /** Modo de construção: o ponteiro informa células a ele e a prévia 3D o acompanha. */
  readonly build: BuildStore;
  /** Ações do modo de construção disparadas pelo teclado (girar, confirmar, cancelar). */
  readonly buildActions: Pick<BuildActions, 'rotate' | 'confirm' | 'cancel'>;
  /** Ref do canvas, para o `App` poder devolver o foco do teclado ao jogo. */
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
}

/**
 * Converte a prévia da aplicação no contrato de renderização. Sem célula apontada não há o que
 * mostrar (`null`). A validade vem pronta do domínio (via `selectPlacementPreview`): a cena só a
 * desenha.
 */
function toPreviewSpec(
  preview: ReturnType<typeof selectPlacementPreview>,
): PlacementPreviewSpec | null {
  if (!preview?.request) {
    return null;
  }
  return {
    definitionId: preview.definitionId,
    size: preview.footprint,
    position: preview.request.position,
    rotation: preview.request.rotation,
    valid: preview.status.kind === 'valid',
  };
}

/**
 * Hospeda o canvas e liga o ciclo de vida do renderizador ao do React. O renderizador é criado
 * no efeito e liberado na limpeza (compatível com o StrictMode e com o HMR); os dados chegam por
 * `snapshot` e são sincronizados em outro efeito, separado da criação.
 *
 * Também faz a ponte da seleção, nos dois sentidos, sem passar pelo React a cada quadro: o clique
 * na cena (`onPick`) chega ao store de seleção, e mudanças no store atualizam o marcador 3D por
 * assinatura. Mudar a seleção não recria a engine nem re-renderiza este componente.
 *
 * O modo de construção segue o mesmo desenho: a célula sob o ponteiro (`onPlacementCell`) chega ao
 * store de construção, e a prévia 3D é recalculada por assinatura ao store e ao estado da partida
 * (a validade depende de edifícios e recursos). A prévia é só visual: este componente nunca envia
 * comandos por conta própria.
 */
export function GameCanvas({
  snapshot,
  controller,
  selection,
  build,
  buildActions,
  canvasRef,
}: GameCanvasProps) {
  const rendererRef = useRef<GameRenderer | null>(null);
  const [status, setStatus] = useState<RendererStatus>('running');
  const placing = usePlacementActive(build);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    // Em caso de falha, o renderizador já registrou o erro e avisou via onStatusChange('failed').
    const renderer = createGameRenderer(canvas, {
      onStatusChange: setStatus,
      onPick: (entityId) => {
        if (entityId === null) {
          selection.clear();
        } else {
          selection.select(entityId);
        }
      },
      onPlacementCell: (cell, source) => {
        if (source === 'click') {
          build.pin(cell);
        } else {
          build.hover(cell);
        }
      },
    });
    if (!renderer) {
      return undefined;
    }

    rendererRef.current = renderer;
    const showSelection = () => {
      renderer.setSelectedEntity(selection.getSnapshot().selectedEntityId);
    };
    showSelection();
    const unsubscribe = selection.subscribe(showSelection);

    // Prévia de construção: só trabalha enquanto há um edifício em posicionamento (o modo ligado ou
    // acabando de ser desligado), para os ticks não custarem nada fora dele.
    let wasPlacing = false;
    const showPlacement = () => {
      const input = build.getSnapshot();
      const isPlacing = input.definitionId !== null;
      if (!isPlacing && !wasPlacing) {
        return;
      }
      wasPlacing = isPlacing;
      renderer.setPlacementMode(isPlacing);
      const preview = selectPlacementPreview(controller.getSnapshot(), input);
      renderer.setPlacementPreview(toPreviewSpec(preview));
    };
    showPlacement();
    const unsubscribeBuild = build.subscribe(showPlacement);
    const unsubscribeState = controller.subscribe(showPlacement);

    // O teclado da câmera (W/A/S/D e setas) só chega ao canvas quando ele tem o foco: foca ao
    // iniciar, para as teclas funcionarem sem clicar antes. Clicar no canvas devolve o foco.
    canvas.focus({ preventScroll: true });
    return () => {
      unsubscribe();
      unsubscribeBuild();
      unsubscribeState();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvasRef, selection, build, controller]);

  useEffect(() => {
    rendererRef.current?.sync(snapshot);
  }, [snapshot]);

  const getStats = useCallback(
    (): FrameStats | null => rendererRef.current?.getFrameStats() ?? null,
    [],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const isPlacing = build.getSnapshot().definitionId !== null;
    if (event.key === 'Escape') {
      // Com um edifício em posicionamento, Esc cancela a prévia (e preserva a seleção).
      if (isPlacing) {
        buildActions.cancel();
      } else {
        selection.clear();
      }
    } else if (isPlacing && (event.key === 'r' || event.key === 'R')) {
      buildActions.rotate();
    } else if (isPlacing && event.key === 'Enter') {
      buildActions.confirm();
    }
  };

  return (
    <div className="game-view">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        tabIndex={0}
        aria-label={
          placing
            ? 'Cena 3D do acampamento em modo de construção. Espaço pausa ou retoma o jogo, clique no terreno fixa a posição, R gira a prévia, Enter confirma e Esc cancela.'
            : 'Cena 3D do acampamento. Espaço pausa ou retoma o jogo. Clique em uma construção para ver seus detalhes.'
        }
        onKeyDown={handleKeyDown}
      />
      {status !== 'running' && (
        <div className="game-overlay" role="alert">
          {STATUS_MESSAGES[status]}
        </div>
      )}
      {import.meta.env.DEV && <DevStatsOverlay getStats={getStats} />}
    </div>
  );
}
