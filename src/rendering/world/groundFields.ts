import { fbm, smoothstep } from './noise';

/*
 * Campos de cobertura do solo (0–1), amostrados no plano do mundo. A dispersão do cenário os usa
 * para escolher onde nascem bosques e campos de rochas, e as cores do terreno os usam para tingir o
 * solo sob eles: vegetação e rocha caem sobre um chão coerente com elas. Só dependem da semente.
 */

/** Onde a vegetação prospera: manchas do tamanho de um bosque (≈ 13 unidades). */
export function plantCoverAt(x: number, z: number, seed: number): number {
  return smoothstep(0.38, 0.64, fbm(x * 0.075 + 47, z * 0.075 - 28, seed + 19));
}

/** Onde a rocha aflora: manchas médias, em outros lugares que a vegetação. */
export function rockCoverAt(x: number, z: number, seed: number): number {
  return smoothstep(0.5, 0.7, fbm(x * 0.065 - 67, z * 0.065 + 35, seed + 31));
}
