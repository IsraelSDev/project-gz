import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createGameRenderer,
  type FrameStats,
  type GameRenderer,
  type RendererStatus,
} from '@/rendering/GameRenderer';
import type { WorldSnapshot } from '@/rendering/world/WorldSnapshot';
import { DevStatsOverlay } from './DevStatsOverlay';

const STATUS_MESSAGES: Record<Exclude<RendererStatus, 'running'>, string> = {
  'context-lost': 'O contexto gráfico foi perdido. Aguardando a restauração…',
  failed:
    'Não foi possível iniciar a cena 3D. Verifique se o navegador oferece WebGL e se a aceleração por hardware está ativada; depois recarregue a página.',
};

/**
 * Hospeda o canvas e liga o ciclo de vida do renderizador ao do React. O renderizador é criado
 * no efeito e liberado na limpeza (compatível com o StrictMode e com o HMR); os dados chegam por
 * `snapshot` e são sincronizados em outro efeito, separado da criação.
 */
export function GameCanvas({ snapshot }: { readonly snapshot: WorldSnapshot }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [status, setStatus] = useState<RendererStatus>('running');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    // Em caso de falha, o renderizador já registrou o erro e avisou via onStatusChange('failed').
    const renderer = createGameRenderer(canvas, { onStatusChange: setStatus });
    if (!renderer) {
      return undefined;
    }

    rendererRef.current = renderer;
    // O teclado da câmera (W/A/S/D e setas) só chega ao canvas quando ele tem o foco: foca ao
    // iniciar, para as teclas funcionarem sem clicar antes. Clicar no canvas devolve o foco.
    canvas.focus({ preventScroll: true });
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.sync(snapshot);
  }, [snapshot]);

  const getStats = useCallback(
    (): FrameStats | null => rendererRef.current?.getFrameStats() ?? null,
    [],
  );

  return (
    <div className="game-view">
      <canvas
        ref={canvasRef}
        className="game-canvas"
        tabIndex={0}
        aria-label="Cena 3D do acampamento"
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
