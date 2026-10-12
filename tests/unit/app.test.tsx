import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';

describe('App', () => {
  it('renderiza o título do projeto sem DOM e resolve o alias "@/"', () => {
    const html = renderToString(<App />);

    expect(html).toContain('<h1>Civilização Alienígena</h1>');
  });
});
