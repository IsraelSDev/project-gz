/** Porta assíncrona de leitura e escrita do único salvamento local do protótipo. */
export interface SaveProvider {
  read(): Promise<string | null>;
  write(serializedSave: string): Promise<void>;
}
