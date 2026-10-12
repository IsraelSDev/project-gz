import type { SaveProvider } from '@/game/application/ports/SaveProvider';

export const SAVE_STORAGE_KEY = 'alien-civilization.save';

export interface BrowserSaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Armazenamento local do navegador isolado atrás da porta assíncrona da aplicação. */
export function createBrowserSaveProvider(storage?: BrowserSaveStorage): SaveProvider {
  const getStorage = (): BrowserSaveStorage => {
    if (storage) return storage;
    if (typeof window === 'undefined') {
      throw new Error('O armazenamento local exige um navegador.');
    }
    return window.localStorage;
  };

  return {
    async read() {
      return getStorage().getItem(SAVE_STORAGE_KEY);
    },
    async write(serializedSave) {
      getStorage().setItem(SAVE_STORAGE_KEY, serializedSave);
    },
  };
}
