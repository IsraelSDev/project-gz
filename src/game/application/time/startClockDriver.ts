import type { TimeEnvironment } from '../ports/TimeEnvironment';
import type { SimulationClock } from './SimulationClock';

/** O que o driver precisa do relógio: informar o tempo real e pausar. */
export type ClockDriverTarget = Pick<SimulationClock, 'advance' | 'pause'>;

/**
 * Liga o relógio ao tempo real: um ÚNICO loop de quadros, separado do render loop do Babylon.js,
 * que mede o tempo real entre quadros e o entrega a `clock.advance`. O número de quadros não muda o
 * resultado: o relógio só vê tempo transcorrido e decide quantos passos fixos executar.
 *
 * Política de segundo plano (D-15, D-44): quando a página fica oculta o relógio é PAUSADO e o tempo
 * oculto é descartado; ao voltar, a partida continua pausada até o jogador retomar (o driver nunca
 * retoma sozinho). Assim não há rajada de passos nem salto no tempo de jogo.
 *
 * Devolve a função que para o driver (cancela o quadro agendado e a assinatura). Quem chama deve
 * chamá-la ao desmontar; cada chamada de `startClockDriver` cria um loop próprio, então não se deve
 * iniciar dois para o mesmo relógio. Testável sem DOM com um `TimeEnvironment` falso.
 */
export function startClockDriver(clock: ClockDriverTarget, env: TimeEnvironment): () => void {
  let lastTime = env.now();
  let frameHandle: number | null = null;
  let stopped = false;

  const onFrame = (): void => {
    frameHandle = null;
    if (stopped) {
      return;
    }
    const now = env.now();
    // Defensivo: um relógio que andasse para trás não pode virar tempo negativo.
    const elapsed = Math.max(0, now - lastTime);
    lastTime = now;
    try {
      // Oculta: nada avança. O tempo decorrido é descartado (e a pausa vem de `onVisibilityChange`).
      if (!env.isHidden()) {
        clock.advance(elapsed);
      }
    } catch (error) {
      // Um passo lançou exceção (bug, não falha esperada): pausa para não repetir o erro a cada
      // quadro e relança para que continue visível. O loop segue vivo, então a interface responde.
      clock.pause();
      throw error;
    } finally {
      if (!stopped) {
        frameHandle = env.requestFrame(onFrame);
      }
    }
  };

  const onVisibilityChange = (): void => {
    if (env.isHidden()) {
      clock.pause();
    }
    // Ao esconder ou mostrar, o tempo até aqui não conta: sem salto ao voltar.
    lastTime = env.now();
  };

  const unsubscribe = env.onVisibilityChange(onVisibilityChange);
  if (env.isHidden()) {
    clock.pause();
  }
  frameHandle = env.requestFrame(onFrame);

  return () => {
    if (stopped) {
      return;
    }
    stopped = true;
    unsubscribe();
    if (frameHandle !== null) {
      env.cancelFrame(frameHandle);
      frameHandle = null;
    }
  };
}
