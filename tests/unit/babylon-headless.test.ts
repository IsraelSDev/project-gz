import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { describe, expect, it } from 'vitest';

describe('Babylon.js headless (NullEngine)', () => {
  it('cria e descarta engine e cena sem WebGL', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);

    expect(scene.isDisposed).toBe(false);

    scene.dispose();
    engine.dispose();

    expect(scene.isDisposed).toBe(true);
    expect(engine.isDisposed).toBe(true);
  });
});
