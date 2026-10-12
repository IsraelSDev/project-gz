/*
 * Ruído e PRNG determinísticos APENAS para a variação visual do cenário (terreno, vegetação).
 * Não têm relação com o PRNG do domínio (D-13, pendência P-07): nada daqui entra no GameState.
 */

/** PRNG pequeno e determinístico (mulberry32). Devolve valores em [0, 1). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(ix: number, iz: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** Ruído de valor suave em [0, 1]. */
export function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const top = hash(x0, z0, seed) * (1 - sx) + hash(x0 + 1, z0, seed) * sx;
  const bottom = hash(x0, z0 + 1, seed) * (1 - sx) + hash(x0 + 1, z0 + 1, seed) * sx;
  return top * (1 - sz) + bottom * sz;
}

/** Soma de oitavas de ruído de valor, normalizada para [0, 1]. */
export function fbm(x: number, z: number, seed: number, octaves = 4): number {
  let amplitude = 0.5;
  let frequency = 1;
  let sum = 0;
  let total = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amplitude * valueNoise(x * frequency, z * frequency, seed + octave * 101);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / total;
}
