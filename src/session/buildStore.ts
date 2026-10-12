import type { BuildingDefinitionId } from '@/game/content/buildings';
import type { CommandErrorCode } from '@/game/domain/commands/simulationCommand';
import { ROTATIONS, type GridPosition, type Rotation } from '@/shared/grid/types';
import { createListenerSet } from '@/shared/store/listenerSet';

/*
 * Estado de sessão do MODO DE CONSTRUÇÃO (docs/TECHNICAL_ARCHITECTURE.md §5.3 e §21), no mesmo padrão
 * da seleção: vive na interface, não faz parte do `GameState`, não é salvo e não é um comando de
 * domínio. Guarda só dados simples (o identificador do edifício em posicionamento, a rotação e a
 * célula apontada), nunca meshes. Posicionar na prévia NÃO altera a partida: só o comando
 * `PlaceBuilding`, enviado ao confirmar, altera. Não depende de React nem de Babylon.js;
 * `subscribe` e `getSnapshot` seguem o contrato de `useSyncExternalStore`.
 */

/** Resultado da última tentativa de construir, para a interface explicar ao jogador. */
export type BuildFeedback =
  | {
      /** `applied`: construído na hora (jogo pausado). `queued`: será aplicado no próximo passo. */
      readonly kind: 'applied' | 'queued';
      readonly definitionId: BuildingDefinitionId;
    }
  | { readonly kind: 'rejected'; readonly error: CommandErrorCode };

export interface BuildState {
  /** Edifício em posicionamento, ou `null` quando o modo de construção não está ativo. */
  readonly definitionId: BuildingDefinitionId | null;
  /** Rotação da prévia, em passos de 90° no sentido horário. */
  readonly rotation: Rotation;
  /** Célula do grid sob a qual a prévia está centrada, ou `null` enquanto nada foi apontado. */
  readonly cell: GridPosition | null;
  /**
   * `true` depois de um clique no terreno: a posição fica FIXA e o ponteiro deixa de movê-la, para
   * o jogador poder ir até os botões de confirmar sem a prévia sair do lugar. Um novo clique no
   * terreno move a posição fixada.
   */
  readonly pinned: boolean;
  readonly feedback: BuildFeedback | null;
}

export interface BuildStore {
  /** Estado atual, somente leitura. A referência só muda quando algo realmente muda. */
  getSnapshot(): BuildState;
  subscribe(listener: () => void): () => void;
  /** Ativa o posicionamento de um edifício (ou troca o edifício, mantendo rotação e posição). */
  start(definitionId: BuildingDefinitionId): void;
  /** O ponteiro passou por uma célula. Ignorado se o modo não está ativo ou a posição está fixada. */
  hover(cell: GridPosition): void;
  /** Clique no terreno: posiciona a prévia na célula e a fixa. Ignorado se o modo não está ativo. */
  pin(cell: GridPosition): void;
  /** Gira a prévia 90° no sentido horário. Ignorado se o modo não está ativo. */
  rotate(): void;
  /** Cancela o posicionamento e limpa tudo, inclusive o aviso. Nada na partida muda. */
  cancel(): void;
  /** Encerra o posicionamento depois de enviar o comando e guarda o resultado para exibir. */
  complete(feedback: BuildFeedback): void;
  /** Guarda um resultado sem encerrar o posicionamento (recusa tardia de um comando enfileirado). */
  report(feedback: BuildFeedback): void;
  clearFeedback(): void;
}

const IDLE: BuildState = Object.freeze({
  definitionId: null,
  rotation: 0,
  cell: null,
  pinned: false,
  feedback: null,
});

const sameCell = (a: GridPosition | null, b: GridPosition | null): boolean =>
  a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y);

function nextRotation(rotation: Rotation): Rotation {
  const index = ROTATIONS.indexOf(rotation);
  return ROTATIONS[(index + 1) % ROTATIONS.length] ?? 0;
}

export function createBuildStore(): BuildStore {
  const listeners = createListenerSet();
  let state: BuildState = IDLE;

  /** Troca o estado só se algum campo mudou, para manter a referência estável. */
  const update = (patch: Partial<BuildState>): void => {
    const next: BuildState = {
      definitionId: patch.definitionId === undefined ? state.definitionId : patch.definitionId,
      rotation: patch.rotation ?? state.rotation,
      cell: patch.cell === undefined ? state.cell : patch.cell,
      pinned: patch.pinned ?? state.pinned,
      feedback: patch.feedback === undefined ? state.feedback : patch.feedback,
    };
    const unchanged =
      next.definitionId === state.definitionId &&
      next.rotation === state.rotation &&
      sameCell(next.cell, state.cell) &&
      next.pinned === state.pinned &&
      next.feedback === state.feedback;
    if (unchanged) {
      return;
    }
    state = Object.freeze({
      ...next,
      cell: next.cell ? Object.freeze({ x: next.cell.x, y: next.cell.y }) : null,
    });
    listeners.notify();
  };

  const isActive = (): boolean => state.definitionId !== null;

  return {
    getSnapshot: () => state,
    subscribe: listeners.subscribe,
    start: (definitionId) => update({ definitionId, feedback: null }),
    hover: (cell) => {
      if (isActive() && !state.pinned) {
        update({ cell });
      }
    },
    pin: (cell) => {
      if (isActive()) {
        update({ cell, pinned: true });
      }
    },
    rotate: () => {
      if (isActive()) {
        update({ rotation: nextRotation(state.rotation) });
      }
    },
    cancel: () => {
      if (state !== IDLE) {
        state = IDLE;
        listeners.notify();
      }
    },
    complete: (feedback) => {
      state = Object.freeze({ ...IDLE, feedback });
      listeners.notify();
    },
    report: (feedback) => update({ feedback }),
    clearFeedback: () => update({ feedback: null }),
  };
}
