import type { GameController } from '@/game/application/GameController';
import { selectPlacementPreview } from '@/game/application/buildSelectors';
import { placeBuilding } from '@/game/application/constructionUseCases';
import type { BuildingDefinitionId } from '@/game/content/buildings';
import type { BuildStore } from '@/session/buildStore';

/** Ações do jogador no modo de construção. Não guardam estado: tudo vive no store de sessão. */
export interface BuildActions {
  /** Escolhe o edifício do catálogo e passa a mostrar a prévia. */
  start(definitionId: BuildingDefinitionId): void;
  /** Gira a prévia 90° no sentido horário. */
  rotate(): void;
  /** Cancela o posicionamento. Não altera a partida nem desconta nada. */
  cancel(): void;
  /**
   * Confirma a construção: envia `PlaceBuilding` ao controlador, que valida DE NOVO a posição e os
   * recursos. Sem posição apontada ou sem edifício em posicionamento, não faz nada.
   */
  confirm(): void;
}

/**
 * Cria as ações sobre o controlador (que aplica as regras dos comandos) e o store de sessão.
 *
 * Proteção contra gasto duplicado: ao enviar com sucesso, o posicionamento é ENCERRADO na mesma
 * chamada, antes de qualquer novo clique ou tecla. Um segundo clique em "Confirmar" (ou um Enter
 * repetido) encontra o modo já encerrado e não faz nada. Mesmo que um comando repetido chegue ao
 * controlador por outro caminho, o segundo é recusado por sobreposição (jogo pausado) ou na
 * revalidação do passo (jogo em andamento): o custo é cobrado uma vez só.
 */
export function createBuildActions(
  controller: Pick<GameController, 'getSnapshot' | 'submitCommand'>,
  build: BuildStore,
): BuildActions {
  return {
    start: (definitionId) => build.start(definitionId),
    rotate: () => build.rotate(),
    cancel: () => build.cancel(),
    confirm: () => {
      const state = build.getSnapshot();
      const preview = selectPlacementPreview(controller.getSnapshot(), state);
      if (!preview?.request) {
        return;
      }
      const result = placeBuilding(controller, preview.request);
      if (result.ok) {
        build.complete({ kind: result.value, definitionId: preview.definitionId });
      } else {
        build.report({ kind: 'rejected', error: result.error });
      }
    },
  };
}
