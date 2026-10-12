import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {
  createGameRenderer,
  type FrameStats,
  type GameRenderer,
  type RendererStatus,
} from '@/rendering/GameRenderer';
import type { WorldSnapshot } from '@/rendering/world/WorldSnapshot';
import type { SelectionStore } from '@/session/selectionStore';
import { DevStatsOverlay } from './DevStatsOverlay';

const STATUS_MESSAGES: Record<Exclude<RendererStatus, 'running'>, string> = {
  'context-lost': 'O contexto gráfico foi perdido. Aguardando a restauração…',
  failed:
    'Não foi possível iniciar a cena 3D. Verifique se o navegador oferece WebGL e se a aceleração por hardware está ativada; depois recarregue a página.',
};

export interface GameCanvasProps {
  readonly snapshot: WorldSnapshot;
  /** Seleção da interface: o clique na cena escreve nela e o marcador 3D a acompanha. */
  readonly selection: SelectionStore;
  /** Ref do canvas, para o `App` poder devolver o foco do teclado ao jogo. */
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
}

/**
 * Hospeda o canvas e liga o ciclo de vida do renderizador ao do React. O renderizador é criado
 * no efeito e liberado na limpeza (compatível com o StrictMode e com o HMR); os dados chegam por
 * `snapshot` e são sincronizados em outro efeito, separado da criação.
 *
 * Também faz a ponte da seleção, nos dois sentidos, sem passar pelo React a cada quadro: o clique
 * na cena (`onPick`) chega ao store de seleção, e mudanças no store atualizam o marcador 3D por
 * assinatura. Mudar a seleção não recria a engine nem re-renderiza este componente.
 */
export function GameCanvas({ snapshot, selection, canvasRef }: GameCanvasProps) {
  const rendererRef = useRef<GameRenderer | null>(null);
  const [status, setStatus] = useState<RendererStatus>('running');

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

    // O teclado da câmera (W/A/S/D e setas) só chega ao canvas quando ele tem o foco: foca ao
    // iniciar, para as teclas funcionarem sem clicar antes. Clicar no canvas devolve o foco.
    canvas.focus({ preventScroll: true });
    return () => {
      unsubscribe();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvasRef, selection]);

  useEffect(() => {
    rendererRef.current?.sync(snapshot);
  }, [snapshot]);

  const getStats = useCallback(
    (): FrameStats | null => rendererRef.current?.getFrameStats() ?? null,
    [],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === 'Escape') {
      selection.clear();
    }
  };

  return (
    <div className="game-view">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        tabIndex={0}
        aria-label="Cena 3D do acampamento. Clique em uma construção para ver seus detalhes."
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
