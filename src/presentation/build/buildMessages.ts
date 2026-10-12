import type { CommandErrorCode } from '@/game/domain/commands/simulationCommand';

/*
 * Textos do modo de construção. O domínio devolve só CÓDIGOS de erro; a tradução em texto é da
 * interface (Arquitetura §14 e D-20). `Record<CommandErrorCode, string>` obriga o compilador a exigir
 * um texto para cada código novo. Idioma e estratégia de textos: pendência P-10.
 */
export const ERROR_MESSAGES: Readonly<Record<CommandErrorCode, string>> = {
  OUT_OF_BUILDABLE_AREA: 'Fora da área de construção.',
  OVERLAPS_BUILDING: 'Sobrepõe outra construção.',
  OVERLAPS_OBSTACLE: 'Sobrepõe a nave acidentada.',
  INSUFFICIENT_RESOURCES: 'Recursos insuficientes.',
  INVALID_COMMAND: 'O pedido de construção é inválido.',
  COMMAND_REJECTED: 'A construção foi recusada.',
  INVALID_STATE: 'A construção deixaria a partida em um estado inválido e foi cancelada.',
};

export function describeError(error: CommandErrorCode): string {
  return ERROR_MESSAGES[error];
}
