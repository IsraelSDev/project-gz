import {
  getBuildingDefinition,
  type BuildingDefinition,
  type BuildingDefinitionId,
} from '@/game/content/buildings';
import { RESOURCE_DEFINITIONS, RESOURCE_IDS, type ResourceId } from '@/game/content/resources';
import { occupiedRect } from '@/shared/grid/gridMath';
import type { GridPosition, GridSize, Rotation } from '@/shared/grid/types';
import type { GameSnapshot } from './GameController';

/*
 * Funções de consulta sobre o snapshot (docs/TECHNICAL_ARCHITECTURE.md §11). São puras e derivam
 * tudo do snapshot e do conteúdo: não guardam estado nem criam uma segunda cópia da partida. A
 * interface só pode importar TIPOS de `game/content`, então os nomes e as definições chegam por aqui.
 *
 * Elas devolvem objetos novos a cada chamada: use-as dentro de `useMemo` sobre o snapshot, nunca
 * como `getSnapshot` de `useSyncExternalStore`.
 */

export interface ResourceEntry {
  readonly id: ResourceId;
  readonly name: string;
  /** Quantidade do estado. `null` quando o valor não é um número finito (dado inválido). */
  readonly amount: number | null;
}

/**
 * Recursos que existem no estado, na ordem definida pelo conteúdo. Recurso ausente não é inventado;
 * valor inválido (NaN ou infinito) vira `null` em vez de ser exibido como número ou corrigido.
 */
export function selectResourceEntries(snapshot: GameSnapshot): readonly ResourceEntry[] {
  return RESOURCE_IDS.filter((id) => Object.hasOwn(snapshot.resources, id)).map((id) => {
    const amount: unknown = snapshot.resources[id];
    return {
      id,
      name: RESOURCE_DEFINITIONS[id].name,
      amount: typeof amount === 'number' && Number.isFinite(amount) ? amount : null,
    };
  });
}

export interface BuildingDetails {
  /** Identificador estável da instância (o mesmo guardado no store de seleção). */
  readonly instanceId: string;
  readonly definitionId: BuildingDefinitionId;
  readonly name: string;
  readonly category: BuildingDefinition['category'];
  /** Célula de menor x e menor y do retângulo ocupado (já rotacionado). */
  readonly position: GridPosition;
  readonly rotation: Rotation;
  /** Células ocupadas (width em x, depth em y), já considerando a rotação. */
  readonly occupied: GridSize;
}

/** Detalhes da construção com este `instanceId`, ou `null` se ela não existir no estado. */
export function selectBuildingDetails(
  snapshot: GameSnapshot,
  instanceId: string,
): BuildingDetails | null {
  const building = snapshot.buildings.find((candidate) => candidate.instanceId === instanceId);
  if (!building) {
    return null;
  }
  const definition = getBuildingDefinition(building.definitionId);
  const { width, depth } = occupiedRect(building.position, definition.footprint, building.rotation);
  return {
    instanceId: building.instanceId,
    definitionId: building.definitionId,
    name: definition.name,
    category: definition.category,
    position: building.position,
    rotation: building.rotation,
    occupied: { width, depth },
  };
}
