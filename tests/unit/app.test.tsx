import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';

describe('App', () => {
  it('renderiza o título e o canvas da cena sem DOM e resolve o alias "@/"', () => {
    // renderToString não executa efeitos: a engine só é criada no navegador.
    const html = renderToString(<App />);

    expect(html).toContain('Civilização Alienígena</h1>');
    expect(html).toContain('<canvas');
  });

  it('não apresenta controles que pareçam funcionar sem implementação', () => {
    const html = renderToString(<App />);

    expect(html).not.toContain('<button');
  });
});
