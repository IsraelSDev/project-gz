import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';

describe('App', () => {
  it('renderiza o título, o HUD e o canvas da cena sem DOM e resolve o alias "@/"', () => {
    // renderToString não executa efeitos: a engine e o relógio só são ligados no navegador.
    const html = renderToString(<App />);

    expect(html).toContain('Civilização Alienígena</h1>');
    expect(html).toContain('<canvas');
    expect(html).toContain('Recursos da colônia');
    expect(html).toContain('Selecione uma construção para consultar suas informações.');
  });

  it('a partida nasce pausada, no tick 0 e a 1x', () => {
    const html = renderToString(<App />);

    expect(html).toContain('data-state="paused"');
    expect(html).toContain('Pausado');
    expect(html).toContain('Retomar');
    expect(html).toContain('<span class="time-controls__tick-value">0</span>');
    expect(html).toMatch(/aria-pressed="true">1<!-- -->×/);
  });

  it('não apresenta controles que pareçam funcionar sem implementação', () => {
    const html = renderToString(<App />);

    // Só os controles de tempo existem; sem seleção não há o que limpar.
    expect(html).not.toContain('Limpar seleção');
  });
});
