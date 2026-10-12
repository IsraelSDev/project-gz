import type { BuildingDefinitionId } from '@/game/content/buildings';
import type { ResourceId } from '@/game/content/resources';
import type { GridPosition, Rotation } from '@/shared/grid/types';

/** Versão do formato do estado. Incrementar ao alterar o formato (migrações: Fase 8). */
export const GAME_STATE_SCHEMA_VERSION = 1;

/** Edifício construído. Dados de domínio apenas: meshes e materiais nunca entram no estado. */
export interface BuildingInstance {
  readonly instanceId: string;
  readonly definitionId: BuildingDefinitionId;
  /** Célula de menor x e menor y do retângulo ocupado (já rotacionado). */
  readonly position: GridPosition;
  readonly rotation: Rotation;
}

export type ResourceStock = Readonly<Record<ResourceId, number>>;

export interface GameEventRecord {
  readonly eventId: string;
  readonly status: 'pending' | 'resolved';
  readonly triggeredAtTick: number;
  readonly resolvedAtTick?: number;
  readonly choiceId?: string;
}

/**
 * Estado somente leitura da partida (docs/TECHNICAL_ARCHITECTURE.md §5.1). Campos como `rng`,
 * `population` e `events` entram quando o sistema que os usa existir. Seleção da interface, modo de
 * construção e estado do relógio NÃO fazem parte deste estado (§5.2 e §5.3).
 */
export interface GameState {
  readonly schemaVersion: number;
  readonly contentVersion: string;
  readonly tick: number;
  readonly resources: ResourceStock;
  readonly buildings: readonly BuildingInstance[];
  /**
   * Contador de identificadores (Fase 6): o PRÓXIMO número a usar ao criar uma entidade. Inteiro
   * seguro maior ou igual a 1, só cresce. Os edifícios iniciais do cenário têm identificadores
   * fixos e não usam o contador.
   */
  readonly nextEntityId: number;
  /** Estado completo do PRNG xorshift32 (nunca zero), persistido para manter resultados reproduzíveis. */
  readonly rng: number;
  /** Eventos ativos e resolvidos; o registro é limitado para não crescer sem controle. */
  readonly events: readonly GameEventRecord[];
}
