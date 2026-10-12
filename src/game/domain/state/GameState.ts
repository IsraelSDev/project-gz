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

/**
 * Estado mínimo e somente leitura da Fase 2 (docs/TECHNICAL_ARCHITECTURE.md §5.1). Campos como
 * `nextEntityId`, `rng`, `population` e `events` entram quando o sistema que os usa existir.
 * Seleção da interface e estado do relógio NÃO fazem parte deste estado (§5.2 e §5.3).
 */
export interface GameState {
  readonly schemaVersion: number;
  readonly contentVersion: string;
  readonly tick: number;
  readonly resources: ResourceStock;
  readonly buildings: readonly BuildingInstance[];
}
