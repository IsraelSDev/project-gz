import {
  placeBuildingCommand,
  type PlaceBuildingCommand,
} from '@/game/domain/construction/placeBuildingCommand';
import type { CommandErrorCode } from '@/game/domain/commands/simulationCommand';
import type { Result } from '@/shared/result/result';
import type { CommandOutcome, GameController } from './GameController';
import type { ResolvedPlacement } from './buildSelectors';

/*
 * Caso de uso "construir edifício" (docs/TECHNICAL_ARCHITECTURE.md §3.3 e §21). A interface não
 * monta comandos de domínio nem conhece as regras: entrega um pedido já resolvido e o controlador
 * aplica as regras dos comandos (validação no envio, aplicação imediata com o jogo pausado, fila
 * em andamento, revalidação ao aplicar).
 */

/** O comando de domínio correspondente a um pedido de construção. */
export function toPlaceBuildingCommand(request: ResolvedPlacement): PlaceBuildingCommand {
  return placeBuildingCommand(request);
}

/**
 * Envia um pedido de construção. `applied`: já construído (jogo pausado). `queued`: aceito e será
 * aplicado no próximo passo, quando é revalidado (a recusa tardia chega por `subscribeRejections`).
 * Erro: recusado na hora, sem alterar nada nem descontar recursos.
 */
export function placeBuilding(
  controller: Pick<GameController, 'submitCommand'>,
  request: ResolvedPlacement,
): Result<CommandOutcome, CommandErrorCode> {
  return controller.submitCommand(toPlaceBuildingCommand(request));
}
