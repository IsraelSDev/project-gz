import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// O alias "@/" é resolvido a partir do "paths" de tsconfig.app.json (um único ponto de configuração).
// Vitest reutiliza esta configuração. Domínio e aplicação são testados em ambiente Node (sem DOM).
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
