import { describe, expect, it, vi } from 'vitest';
import {
  createBrowserSaveProvider,
  SAVE_STORAGE_KEY,
} from '@/platform/storage/browserSaveProvider';

describe('BrowserSaveProvider', () => {
  it('usa a chave isolada de salvamento para ler e escrever', async () => {
    const stored = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => stored.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => stored.set(key, value)),
    };
    const provider = createBrowserSaveProvider(storage);

    await provider.write('{"saved":true}');

    expect(storage.setItem).toHaveBeenCalledWith(SAVE_STORAGE_KEY, '{"saved":true}');
    expect(await provider.read()).toBe('{"saved":true}');
    expect(storage.getItem).toHaveBeenCalledWith(SAVE_STORAGE_KEY);
  });

  it('devolve rejeicao async quando o armazenamento falha', async () => {
    const provider = createBrowserSaveProvider({
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('quota');
      },
    });

    await expect(provider.read()).rejects.toThrow('unavailable');
    await expect(provider.write('save')).rejects.toThrow('quota');
  });
});
