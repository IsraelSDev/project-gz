import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';

describe('App', () => {
  it('renderiza o título, o HUD e o canvas da cena sem DOM e resolve o alias "@/"', () => {
    // renderToString não executa efeitos: a engine só é criada no navegador.
    const html = renderToString(<App />);

    expect(html).toContain('Civilização Alienígena</h1>');
    expect(html).toContain('<canvas');
    expect(html).toContain('Recursos da colônia');
    expect(html).toContain('Selecione uma construção para consultar suas informações.');
  });

  it('não apresenta controles que pareçam funcionar sem implementação', () => {
    const html = renderToString(<App />);

    // Sem seleção não há o que fechar: o botão de limpar só existe com uma construção selecionada.
    expect(html).not.toContain('<button');
  });
});
