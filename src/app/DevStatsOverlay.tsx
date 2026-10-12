import { useEffect, useState } from 'react';
import type { FrameStats } from '@/rendering/GameRenderer';

const REFRESH_MS = 500;

/**
 * Indicador simples de FPS e tempo de quadro, só em desenvolvimento (P-02). Lê as estatísticas da
 * engine a cada 500 ms: não há atualização do React por quadro.
 */
export function DevStatsOverlay({ getStats }: { readonly getStats: () => FrameStats | null }) {
  const [text, setText] = useState('-- FPS');

  useEffect(() => {
    const id = window.setInterval(() => {
      const stats = getStats();
      setText(
        stats ? `${stats.fps.toFixed(0)} FPS · ${stats.frameTimeMs.toFixed(1)} ms` : '-- FPS',
      );
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [getStats]);

  return (
    <div className="dev-stats" aria-hidden="true">
      {text}
    </div>
  );
}
