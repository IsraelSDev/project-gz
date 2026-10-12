import type { BuildingDefinitionId } from '@/game/content/buildings';
import type { EventId } from '@/game/content/events';
import type { ResourceId } from '@/game/content/resources';
import type { GridPosition, Rotation } from '@/shared/grid/types';
import type { Character, CharacterRelationship, Government } from '@/game/content/characters';

/** Versão do formato do estado. Migrações encadeadas são definidas em `application/saveMigrations.ts`. */
export const GAME_STATE_SCHEMA_VERSION = 5;

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

export interface ResearchState {
  readonly unlockedTechnologyIds: readonly string[];
  readonly activeTechnologyId: string | null;
  readonly progress: number;
}

export interface ExplorationState {
  readonly discoveredPointIds: readonly string[];
}

export type DiplomaticContactStatus = 'unknown' | 'discovered' | 'contacted';
export type DiplomaticTreatyStatus = 'none' | 'active' | 'rejected' | 'ended';
export type DiplomaticAction =
  | 'civilization-discovered'
  | 'signal-deferred'
  | 'contact-established'
  | 'information-requested'
  | 'gift-offered'
  | 'pact-proposed'
  | 'pact-accepted'
  | 'pact-rejected'
  | 'pact-ended';

export interface DiplomaticHistoryEntry {
  readonly tick: number;
  readonly action: DiplomaticAction;
  readonly relationshipChange: number;
}

export interface CivilizationDiplomacyState {
  readonly civilizationId: string;
  readonly contactStatus: DiplomaticContactStatus;
  readonly relationshipScore: number;
  readonly informationRequested: boolean;
  readonly giftOffered: boolean;
  readonly nonAggressionPact: DiplomaticTreatyStatus;
  readonly history: readonly DiplomaticHistoryEntry[];
}

export interface DiplomacyState {
  readonly civilizations: readonly CivilizationDiplomacyState[];
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
  /** Elenco de personagens politicamente relevantes; população comum permanece agregada. */
  readonly characters: readonly Character[];
  readonly government: Government;
  readonly relationships: readonly CharacterRelationship[];
  readonly research: ResearchState;
  readonly exploration: ExplorationState;
  readonly diplomacy: DiplomacyState;
}
