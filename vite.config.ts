import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// O alias "@/" é resolvido a partir do "paths" de tsconfig.app.json (um único ponto de configuração).
// Vitest reutiliza esta configuração. Domínio e aplicação são testados em ambiente Node (sem DOM).
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  build: {
    // O núcleo do Babylon.js (engine, cena, sombras, materiais) tem ~1,3 MB minificado (~320 kB
    // com gzip); shaders e carregadores de textura já são divididos e carregados sob demanda.
    // O limite acima do padrão (500 kB) só evita um aviso permanente: revise se o chunk crescer
    // de forma inesperada. Separar o Babylon em um chunk próprio foi testado e piorou o tamanho
    // inicial, porque arrasta os chunks sob demanda para dentro dele.
    chunkSizeWarningLimit: 1400,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
