/*
 * Resultado de uma operação cujas falhas ESPERADAS (validação) não lançam exceção: carregam um
 * código de erro, uma união de literais (docs/TECHNICAL_ARCHITECTURE.md §14). O texto mostrado ao
 * jogador é responsabilidade da interface; o domínio e a aplicação só devolvem o código. Exceções
 * ficam para erros inesperados (bugs), que não devem ser silenciados.
 */

export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E extends string> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E extends string> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E extends string>(error: E): Err<E> {
  return { ok: false, error };
}
