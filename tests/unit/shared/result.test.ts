import { describe, expect, it } from 'vitest';
import { err, ok, type Result } from '@/shared/result/result';

describe('Result', () => {
  it('ok carrega o valor e err carrega só o código do erro', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
    expect(err('INVALID_SPEED')).toEqual({ ok: false, error: 'INVALID_SPEED' });
  });

  it('permite discriminar o resultado pelo campo ok, com os tipos estreitados', () => {
    const divide = (a: number, b: number): Result<number, 'DIVIDE_BY_ZERO'> =>
      b === 0 ? err('DIVIDE_BY_ZERO') : ok(a / b);

    const good = divide(6, 3);
    const bad = divide(1, 0);

    expect(good.ok && good.value).toBe(2);
    expect(!bad.ok && bad.error).toBe('DIVIDE_BY_ZERO');
  });

  it('é serializável: não carrega funções nem objetos de erro', () => {
    expect(JSON.parse(JSON.stringify(err('INVALID_COMMAND')))).toEqual(err('INVALID_COMMAND'));
  });
});
