import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import type { Scene } from '@babylonjs/core/scene';
import { resolveEntityId } from './entityMetadata';

/**
 * Quanto o ponteiro pode se mexer (pixels) entre apertar e soltar o botão para ainda contar como
 * clique. Acima disso é um arraste (girar a câmera) e não seleciona nada.
 */
const CLICK_TOLERANCE_PX = 6;
const PRIMARY_BUTTON = 0;

/**
 * `instanceId` da construção sob o ponto (em pixels do canvas), ou `null` se o primeiro objeto
 * atingido não for uma construção (terreno, nave, vazio). Quem está na frente vence: clicar na nave
 * nunca seleciona uma construção que esteja atrás dela. O identificador vem dos metadados tipados do
 * objeto (`entityMetadata`), nunca do nome do mesh.
 */
export function pickEntityId(scene: Scene, x: number, y: number): string | null {
  const result = scene.pick(x, y);
  return result.hit ? resolveEntityId(result.pickedMesh) : null;
}

export interface BuildingPicking {
  /** Remove o observador de ponteiro. Idempotente. */
  dispose(): void;
}

/**
 * Seleção por clique: um único observador de ponteiro na cena. Um clique com o botão principal
 * (apertar e soltar sem arrastar) chama `onPick` com o `instanceId` da construção atingida ou com
 * `null` para qualquer outra coisa. O renderizador não conhece o store de seleção: quem o cria
 * injeta o callback.
 *
 * `isEnabled` permite suspender a seleção (no modo de construção o clique posiciona, não seleciona):
 * com ela desligada, o clique é ignorado por completo e nenhum `onPick` é chamado.
 */
export function createBuildingPicking(
  scene: Scene,
  onPick: (entityId: string | null) => void,
  isEnabled: () => boolean = () => true,
): BuildingPicking {
  let press: { readonly x: number; readonly y: number } | null = null;

  const observer = scene.onPointerObservable.add((info) => {
    if (info.type === PointerEventTypes.POINTERDOWN) {
      press =
        info.event.button === PRIMARY_BUTTON ? { x: scene.pointerX, y: scene.pointerY } : null;
      return;
    }

    // POINTERUP
    const start = press;
    press = null;
    if (!start || info.event.button !== PRIMARY_BUTTON) {
      return;
    }
    const moved = Math.hypot(scene.pointerX - start.x, scene.pointerY - start.y);
    if (moved <= CLICK_TOLERANCE_PX && isEnabled()) {
      onPick(pickEntityId(scene, scene.pointerX, scene.pointerY));
    }
  }, PointerEventTypes.POINTERDOWN | PointerEventTypes.POINTERUP);

  return {
    dispose: () => {
      scene.onPointerObservable.remove(observer);
    },
  };
}
