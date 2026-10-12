import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { ArcRotateCameraKeyboardMoveInput } from '@babylonjs/core/Cameras/Inputs/arcRotateCameraKeyboardMoveInput';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { WorldPoint } from '../world/gridToWorld';

/*
 * Câmera do jogo: ArcRotateCamera em perspectiva, usando os controles nativos do Babylon.js.
 * Controles (decisão registrada em docs/DECISIONS.md, D-24):
 *  - Arrastar com o botão esquerdo: girar (e inclinar dentro de limites).
 *  - Arrastar com o botão direito, ou Ctrl + arrastar: mover lateralmente (pan) sobre o terreno.
 *  - Roda do mouse ou pinça do trackpad: zoom, com limites.
 *  - Teclado (com o canvas focado): W/A/S/D movem a câmera sobre o terreno (frente, esquerda, trás,
 *    direita, relativos à direção da câmera); setas giram; Ctrl + setas movem; `+`/`-` ou Alt +
 *    setas = zoom.
 */

const INITIAL_ALPHA = -Math.PI * 0.75;
const INITIAL_BETA = 0.95;
/**
 * Inclinação medida a partir da vertical: 0.45 ≈ 64° de elevação, 1.32 ≈ 14° de elevação. Com o
 * campo de visão abaixo, o horizonte (e o céu) entra no quadro quando a elevação cai abaixo de ~20°.
 */
const BETA_MIN = 0.45;
const BETA_MAX = 1.32;
/** Campo de visão vertical (radianos, ≈ 40°): baixo o bastante para preservar a leitura isométrica. */
const FIELD_OF_VIEW = 0.7;
const RADIUS_MIN = 14;
const RADIUS_MAX = 72;
/** Quanto o centro da câmera pode se afastar do centro do acampamento (unidades de mundo). */
const PAN_LIMIT = 28;
const GROUND_MARGIN = 1.5;
/** Distância inicial da câmera em múltiplos da maior extensão da área construível. */
const FRAME_DISTANCE_FACTOR = 1.35;
/**
 * O campo de visão é vertical: em janelas mais estreitas que esta proporção a distância inicial
 * aumenta, para o acampamento caber na largura.
 */
const REFERENCE_ASPECT = 1.3;

/** Códigos (`keyCode`) das teclas de navegação, como o teclado nativo do Babylon.js os usa. */
const KEY_W = 87;
const KEY_A = 65;
const KEY_S = 83;
const KEY_D = 68;
/**
 * Impulso de pan por quadro do teclado no raio de referência (o padrão do Babylon.js é 1/50 =
 * 0,02, lento demais para atravessar o acampamento). O movimento é suavizado e escalado pelo tempo
 * do quadro. Medido: ≈ 14 unidades/s para frente/trás e ≈ 17 unidades/s para os lados.
 */
const WASD_PAN_SENSITIVITY = 0.04;
/** Raio de câmera (≈ o enquadramento inicial) em que o pan por teclado tem a sensibilidade acima. */
const WASD_REFERENCE_RADIUS = 43;

/** Entrada de mapa do pan por teclado; só a sensibilidade é ajustada a cada quadro. */
export interface WasdPanEntry {
  sensitivity?: number;
}

/** Sensibilidade do pan por teclado: proporcional ao raio, como nos jogos de estratégia. */
export function wasdPanSensitivity(radius: number): number {
  return (WASD_PAN_SENSITIVITY * radius) / WASD_REFERENCE_RADIUS;
}

function addKey(keys: number[], code: number): void {
  if (!keys.includes(code)) {
    keys.push(code);
  }
}

/**
 * Faz W/A/S/D moverem a câmera (pan) no plano do terreno, relativos à direção em que ela olha.
 * Usa só o teclado e o mapa de entrada nativos: as teclas entram nas listas de direção e uma
 * entrada de mapa as liga ao pan, sem afetar Ctrl + setas (pan), Alt (zoom) nem as setas (girar).
 * Idempotente. Devolve a entrada do mapa (para ajustar a velocidade) ou `undefined` se a câmera
 * não tiver o teclado nativo.
 */
export function addWasdNavigation(camera: ArcRotateCamera): WasdPanEntry | undefined {
  const keyboard = camera.inputs.attached['keyboard'] as
    ArcRotateCameraKeyboardMoveInput | undefined;
  if (!keyboard) {
    return undefined;
  }
  addKey(keyboard.keysUp, KEY_W);
  addKey(keyboard.keysLeft, KEY_A);
  addKey(keyboard.keysDown, KEY_S);
  addKey(keyboard.keysRight, KEY_D);

  const input = camera.movement.input;
  const existing = input
    .getEntries('keyboard', 'pan')
    .find((entry) => Array.isArray(entry.key) && entry.key.includes(KEY_W));
  if (existing) {
    return existing;
  }
  const entry = {
    source: 'keyboard' as const,
    key: [KEY_W, KEY_A, KEY_S, KEY_D],
    interaction: 'pan' as const,
    sensitivity: wasdPanSensitivity(camera.radius),
  };
  input.addEntry(entry);
  return entry;
}

/** O mínimo que o ajuste de altura precisa da câmera (facilita o teste sem engine). */
export interface OrbitCameraState {
  alpha: number;
  beta: number;
  radius: number;
  lowerBetaLimit: number | null;
  readonly target: { readonly x: number; readonly y: number; readonly z: number };
}

/**
 * Evita que a câmera fique abaixo do terreno: se a posição calculada estiver baixo demais,
 * aumenta a elevação (reduz beta) até o limite inferior de beta.
 */
export function clampCameraAboveGround(
  camera: OrbitCameraState,
  heightAt: (x: number, z: number) => number,
  margin: number = GROUND_MARGIN,
): void {
  const minBeta = camera.lowerBetaLimit ?? 0.01;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const horizontal = camera.radius * Math.sin(camera.beta);
    const x = camera.target.x + horizontal * Math.cos(camera.alpha);
    const z = camera.target.z + horizontal * Math.sin(camera.alpha);
    const y = camera.target.y + camera.radius * Math.cos(camera.beta);
    if (y >= heightAt(x, z) + margin || camera.beta <= minBeta) {
      return;
    }
    camera.beta = Math.max(minBeta, camera.beta - 0.05);
  }
}

export interface CameraRig {
  readonly camera: ArcRotateCamera;
  /** Enquadra o acampamento: centro e maior extensão (unidades de mundo). */
  frame(center: WorldPoint, extent: number): void;
  /** Define a função de altura do terreno usada para manter a câmera acima do chão. */
  setGroundHeight(heightAt: ((x: number, z: number) => number) | null): void;
  /** Remove controles e observadores. Idempotente. */
  dispose(): void;
}

export function createCameraRig(scene: Scene): CameraRig {
  const camera = new ArcRotateCamera(
    'game-camera',
    INITIAL_ALPHA,
    INITIAL_BETA,
    40,
    new Vector3(0, 0, 0),
    scene,
  );
  camera.fov = FIELD_OF_VIEW;
  camera.minZ = 0.5;
  camera.maxZ = 600;

  camera.lowerBetaLimit = BETA_MIN;
  camera.upperBetaLimit = BETA_MAX;
  camera.lowerRadiusLimit = RADIUS_MIN;
  camera.upperRadiusLimit = RADIUS_MAX;
  camera.wheelDeltaPercentage = 0.02;
  camera.pinchDeltaPercentage = 0.015;
  camera.useNaturalPinchZoom = true;
  camera.angularSensibilityX = 700;
  camera.angularSensibilityY = 700;
  camera.inertia = 0.88;

  // Pan no plano do terreno (a altura do alvo não muda) e limitado ao redor do acampamento.
  camera.panningAxis = new Vector3(1, 0, 1);
  // Medido no Babylon.js 9: com 120, arrastar move o terreno ~1:1 com o ponteiro no enquadramento
  // inicial; 100 deixa um pouco mais ágil. Valores menores deixam o pan mais rápido.
  camera.panningSensibility = 100;
  camera.panningInertia = 0.88;
  camera.panningDistanceLimit = PAN_LIMIT;

  const wasdEntry = addWasdNavigation(camera);

  // Em testes headless (NullEngine) não há elemento de entrada para os controles.
  const hasInputElement = scene.getEngine().getInputElement() !== null;
  if (hasInputElement) {
    camera.attachControl();
  }

  let heightAt: ((x: number, z: number) => number) | null = null;
  const observer: Observer<Scene> | null = scene.onBeforeRenderObservable.add(() => {
    if (wasdEntry) {
      wasdEntry.sensitivity = wasdPanSensitivity(camera.radius);
    }
    if (heightAt) {
      clampCameraAboveGround(camera, heightAt);
    }
  });

  let disposed = false;
  return {
    camera,
    frame: (center, extent) => {
      camera.target = new Vector3(center.x, 0, center.z);
      camera.panningOriginTarget.copyFromFloats(center.x, 0, center.z);
      camera.alpha = INITIAL_ALPHA;
      camera.beta = INITIAL_BETA;
      // Ajusta a engine ao tamanho real do canvas antes de medir a proporção (o ResizeObserver
      // só dispara depois do primeiro quadro).
      const engine = scene.getEngine();
      engine.resize();
      const aspect = engine.getAspectRatio(camera);
      const widthFactor =
        Number.isFinite(aspect) && aspect > 0 ? Math.max(1, REFERENCE_ASPECT / aspect) : 1;
      camera.radius = Math.min(
        RADIUS_MAX,
        Math.max(RADIUS_MIN, extent * FRAME_DISTANCE_FACTOR * widthFactor),
      );
    },
    setGroundHeight: (next) => {
      heightAt = next;
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      scene.onBeforeRenderObservable.remove(observer);
      if (hasInputElement) {
        camera.detachControl();
      }
      camera.dispose();
    },
  };
}
