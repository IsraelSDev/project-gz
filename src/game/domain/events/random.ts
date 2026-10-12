/** PRNG determinístico xorshift32; o chamador deve garantir um estado não zero. */
export function nextRandomUint32(state: number): {
  readonly state: number;
  readonly value: number;
} {
  let next = state >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { state: next, value: next };
}

/** Inteiro uniforme e inclusivo entre min e max, junto do estado seguinte do PRNG. */
export function randomInteger(
  state: number,
  min: number,
  max: number,
): { readonly state: number; readonly value: number } {
  const next = nextRandomUint32(state);
  return {
    state: next.state,
    value: min + (next.value % (max - min + 1)),
  };
}
