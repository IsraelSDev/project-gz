import { useMemo } from 'react';
import { GameCanvas } from './GameCanvas';
import { createInitialWorldSnapshot } from './worldSnapshot';

export function App() {
  // O estado inicial é somente leitura nesta fase: o snapshot é criado uma vez. Usa-se useMemo
  // (e não useState) porque o React Refresh o recalcula quando o conteúdo do cenário é editado em
  // desenvolvimento, e a cena acompanha a mudança sem recarregar a página.
  const snapshot = useMemo(() => createInitialWorldSnapshot(), []);

  return (
    <main className="app">
      <h1 className="visually-hidden">Civilização Alienígena</h1>
      <GameCanvas snapshot={snapshot} />
      <p className="controls-hint">
        Arrastar: girar · Botão direito (ou Ctrl + arrastar): mover · Roda do mouse: zoom
      </p>
    </main>
  );
}
