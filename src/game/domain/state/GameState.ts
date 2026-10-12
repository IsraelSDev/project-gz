import type { BuildingDefinitionId } from '@/game/content/buildings';
import type { EventId } from '@/game/content/events';
import type { ResourceId } from '@/game/content/resources';
import type { GridPosition, Rotation } from '@/shared/grid/types';

/** Versão do formato do estado. Incrementar ao alterar o formato (migrações: Fase 8). */
export const GAME_STATE_SCHEMA_VERSION = 2;

export interface PopulationState {
  readonly survivors: number;
  /** Ticks consecutivos de escassez, limitado a 0..59. */
  readonly shortageTicks: number;
  /** Ticks consecutivos abastecidos e dentro da capacidade. */
  readonly stableTicks: number;
  readonly outcome: 'ongoing' | 'victory' | 'defeat';
}

/** Edifício construído. Dados de domínio apenas: meshes e materiais nunca entram no estado. */
export interface BuildingInstance {
  readonly instanceId: string;
  readonly definitionId: BuildingDefinitionId;
  /** Célula de menor x e menor y do retângulo ocupado (já rotacionado). */
  readonly position: GridPosition;
  readonly rotation: Rotation;
}

export type ResourceStock = Readonly<Record<ResourceId, number>>;

export type GameEventStatus = 'available' | 'active' | 'resolved' | 'closed';

/** Estado serializável do evento; conteúdo narrativo fica separado em `game/content/events.ts`. */
export interface GameEventState {
  readonly eventId: EventId;
  readonly status: GameEventStatus;
  readonly chosenOptionId?: string;
  readonly resolvedAtTick?: number;
}

/**
 * Estado somente leitura da partida (docs/TECHNICAL_ARCHITECTURE.md §5.1). Seleção da interface, modo de
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
  /** Estados de eventos do conteúdo (Fase 7), fora de qualquer componente visual. */
  readonly events: readonly GameEventState[];
  readonly population: PopulationState;
}
