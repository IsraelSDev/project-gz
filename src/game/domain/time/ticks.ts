/*
 * Tempo da simulação (decisão D-41). O tick é o passo FIXO da simulação e representa TEMPO DE JOGO,
 * nunca quadros renderizados nem tempo real. O domínio só conhece "execute um passo"; quem decide
 * quando um passo acontece é o `SimulationClock` (camada de aplicação), a partir de tempo real
 * injetado. Quando a economia existir (Fase 5), taxas por segundo viram taxas por tick por esta
 * constante.
 */

/** Segundos de tempo de jogo que um tick representa. */
export const TICK_GAME_SECONDS = 1;
