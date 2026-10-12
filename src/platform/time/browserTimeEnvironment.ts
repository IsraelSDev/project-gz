import type { TimeEnvironment } from '@/game/application/ports/TimeEnvironment';

/**
 * Implementação da porta de tempo para o navegador: `performance.now()`, `requestAnimationFrame` e
 * a API de visibilidade da página. É a única parte do jogo que toca `window`, `document` e
 * `performance` para o tempo da simulação; a aplicação e o domínio nunca os veem.
 */
export function createBrowserTimeEnvironment(): TimeEnvironment {
  return {
    now: () => performance.now(),
    requestFrame: (callback) => window.requestAnimationFrame(() => callback()),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
    isHidden: () => document.hidden,
    onVisibilityChange: (listener) => {
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
  };
}
