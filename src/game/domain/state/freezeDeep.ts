/**
 * Congela um valor em profundidade (somente leitura em tempo de execução). Objetos já congelados
 * são pulados, então partes compartilhadas entre estados (por exemplo, `resources` e `buildings`
 * que não mudaram) continuam sendo a MESMA referência: os snapshots mantêm compartilhamento
 * estrutural e a interface consegue comparar por referência.
 */
export function freezeDeep<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      freezeDeep(child);
    }
  }
  return value;
}
