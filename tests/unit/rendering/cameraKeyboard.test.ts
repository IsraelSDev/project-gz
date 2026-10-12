import type { ArcRotateCameraKeyboardMoveInput } from '@babylonjs/core/Cameras/Inputs/arcRotateCameraKeyboardMoveInput';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { KeyboardEventTypes, KeyboardInfo } from '@babylonjs/core/Events/keyboardEvents';
import { Scene } from '@babylonjs/core/scene';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addWasdNavigation,
  createCameraRig,
  wasdPanSensitivity,
  type CameraRig,
} from '@/rendering/camera/cameraRig';

/*
 * Teclado da câmera em modo headless: o teclado nativo do Babylon.js é ligado manualmente (não há
 * elemento de entrada no NullEngine) e as teclas são entregues por `onKeyboardObservable`. Isto
 * não prova o foco do canvas nem eventos reais do navegador; esses são verificados à mão.
 */

const KEY_W = 87;
const KEY_A = 65;
const KEY_S = 83;
const KEY_D = 68;
const KEY_UP_ARROW = 38;

type KeyEventInit = ConstructorParameters<typeof KeyboardInfo>[1];

const engines: NullEngine[] = [];
const rigs: CameraRig[] = [];

function createRig(): { rig: CameraRig; scene: Scene } {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  const rig = createCameraRig(scene);
  rigs.push(rig);
  rig.frame({ x: 0, z: 0 }, 32);
  const keyboard = rig.camera.inputs.attached['keyboard'] as ArcRotateCameraKeyboardMoveInput;
  keyboard.attachControl();
  return { rig, scene };
}

function press(
  scene: Scene,
  keyCode: number,
  type: number,
  modifiers: { ctrl?: boolean; alt?: boolean } = {},
) {
  const event = {
    keyCode,
    ctrlKey: modifiers.ctrl ?? false,
    altKey: modifiers.alt ?? false,
    metaKey: false,
    preventDefault: () => undefined,
  } as unknown as KeyEventInit;
  scene.onKeyboardObservable.notifyObservers(new KeyboardInfo(type, event));
}

function renderFrames(scene: Scene, frames: number): void {
  for (let frame = 0; frame < frames; frame += 1) {
    scene.render();
  }
}

/** Segura a tecla por `frames` quadros, solta e devolve o deslocamento do alvo da câmera. */
function hold(rig: CameraRig, scene: Scene, keyCode: number, frames = 60) {
  const start = rig.camera.target.clone();
  press(scene, keyCode, KeyboardEventTypes.KEYDOWN);
  renderFrames(scene, frames);
  press(scene, keyCode, KeyboardEventTypes.KEYUP);
  renderFrames(scene, 120);
  return {
    dx: rig.camera.target.x - start.x,
    dy: rig.camera.target.y - start.y,
    dz: rig.camera.target.z - start.z,
  };
}

/** Direção em que a câmera olha, projetada no terreno (norte = +Z, leste = +X). */
function groundForward(rig: CameraRig): { x: number; z: number } {
  const { alpha } = rig.camera;
  return { x: -Math.cos(alpha), z: -Math.sin(alpha) };
}

afterEach(() => {
  for (const rig of rigs.splice(0)) {
    rig.dispose();
  }
  for (const engine of engines.splice(0)) {
    engine.dispose();
  }
});

describe('navegação por W/A/S/D', () => {
  it('liga W/A/S/D ao pan sem tirar o comportamento de setas, Ctrl e Alt', () => {
    const { rig } = createRig();
    const input = rig.camera.movement.input;
    const resolve = (key: number, modifiers: { ctrl: boolean; alt: boolean }) =>
      input.resolveInteraction('keyboard', { key, modifiers })?.interaction;

    for (const key of [KEY_W, KEY_A, KEY_S, KEY_D]) {
      expect(resolve(key, { ctrl: false, alt: false })).toBe('pan');
    }
    expect(resolve(KEY_UP_ARROW, { ctrl: false, alt: false })).toBe('rotate');
    expect(resolve(KEY_UP_ARROW, { ctrl: true, alt: false })).toBe('pan');
    expect(resolve(KEY_UP_ARROW, { ctrl: false, alt: true })).toBe('zoom');
  });

  it('é idempotente: chamar de novo não duplica teclas nem entradas do mapa', () => {
    const { rig } = createRig();
    const keyboard = rig.camera.inputs.attached['keyboard'] as ArcRotateCameraKeyboardMoveInput;
    const entriesBefore = rig.camera.movement.input.inputMap.length;
    const upKeysBefore = keyboard.keysUp.length;

    addWasdNavigation(rig.camera);

    expect(rig.camera.movement.input.inputMap).toHaveLength(entriesBefore);
    expect(keyboard.keysUp).toHaveLength(upKeysBefore);
    expect(keyboard.keysUp.filter((code) => code === KEY_W)).toHaveLength(1);
  });

  it('W e S movem o alvo para frente e para trás, relativos à direção da câmera', () => {
    const { rig, scene } = createRig();
    const forward = groundForward(rig);

    const ahead = hold(rig, scene, KEY_W);
    expect(ahead.dx * forward.x + ahead.dz * forward.z).toBeGreaterThan(3);

    const back = hold(rig, scene, KEY_S);
    expect(back.dx * forward.x + back.dz * forward.z).toBeLessThan(-3);
  });

  it('A e D movem o alvo para os lados', () => {
    const { rig, scene } = createRig();
    const forward = groundForward(rig);
    // Direita da câmera no terreno: a direção da frente girada 90° no sentido horário visto de cima.
    const right = { x: forward.z, z: -forward.x };

    const toRight = hold(rig, scene, KEY_D);
    expect(toRight.dx * right.x + toRight.dz * right.z).toBeGreaterThan(3);

    const toLeft = hold(rig, scene, KEY_A);
    expect(toLeft.dx * right.x + toLeft.dz * right.z).toBeLessThan(-3);
  });

  it('move só no plano do terreno: a altura do alvo não muda', () => {
    const { rig, scene } = createRig();

    const move = hold(rig, scene, KEY_W);

    expect(Math.hypot(move.dx, move.dz)).toBeGreaterThan(3);
    expect(move.dy).toBeCloseTo(0);
  });

  it('para quando a tecla é solta', () => {
    const { rig, scene } = createRig();

    hold(rig, scene, KEY_W, 30);
    const settled = rig.camera.target.clone();
    renderFrames(scene, 60);

    expect(rig.camera.target.x).toBeCloseTo(settled.x);
    expect(rig.camera.target.z).toBeCloseTo(settled.z);
  });

  it('é mais rápido com a câmera afastada do que com ela próxima', () => {
    const { rig, scene } = createRig();

    rig.camera.radius = 14;
    rig.camera.target.set(0, 0, 0);
    const near = hold(rig, scene, KEY_W);

    rig.camera.radius = 60;
    rig.camera.target.set(0, 0, 0);
    const far = hold(rig, scene, KEY_W);

    expect(Math.hypot(far.dx, far.dz)).toBeGreaterThan(Math.hypot(near.dx, near.dz) * 2);
  });

  it('a sensibilidade é proporcional ao raio da câmera', () => {
    expect(wasdPanSensitivity(86)).toBeCloseTo(wasdPanSensitivity(43) * 2);
    expect(wasdPanSensitivity(14)).toBeLessThan(wasdPanSensitivity(43));
  });

  it('respeita o limite de pan ao redor do acampamento', () => {
    const { rig, scene } = createRig();
    rig.camera.radius = 72;

    hold(rig, scene, KEY_W, 400);

    expect(Math.hypot(rig.camera.target.x, rig.camera.target.z)).toBeLessThanOrEqual(28.01);
  });
});
