import {
  getBuildingDefinition,
  type BuildingDefinition,
  type BuildingDefinitionId,
} from '@/game/content/buildings';
import {
  RESOURCE_DEFINITIONS,
  RESOURCE_IDS,
  type ResourceId,
  type ResourceRates,
} from '@/game/content/resources';
import type { BuildingInstance, ResourceStock } from '@/game/domain/state/GameState';
import { occupiedRect } from '@/shared/grid/gridMath';
import type { GridPosition, GridSize, Rotation } from '@/shared/grid/types';

/*
 * Funções de consulta sobre o estado (docs/TECHNICAL_ARCHITECTURE.md §11). São puras e derivam
 * tudo do estado e do conteúdo: não guardam estado nem criam uma segunda cópia da partida. A
 * interface só pode importar TIPOS de `game/content`, então os nomes e as definições chegam por aqui.
 *
 * Recebem só a FATIA do snapshot de que precisam (`resources`, `buildings`), que mantém a mesma
 * referência enquanto não muda, mesmo com o `tick` avançando. Assim a interface lê a fatia por
 * `useGameSelector` e só recalcula quando ela muda. Devolvem objetos novos a cada chamada: use-as
 * dentro de `useMemo` sobre a fatia, nunca como `getSnapshot` de `useSyncExternalStore`.
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
export function selectResourceEntries(resources: ResourceStock): readonly ResourceEntry[] {
  return RESOURCE_IDS.filter((id) => Object.hasOwn(resources, id)).map((id) => {
    const amount: unknown = resources[id];
    return {
      id,
      name: RESOURCE_DEFINITIONS[id].name,
      amount: typeof amount === 'number' && Number.isFinite(amount) ? amount : null,
    };
  });
}

/** Quantidade por tick de um recurso, para exibir a produção ou o consumo de um edifício. */
export interface ResourceRateEntry {
  readonly id: ResourceId;
  readonly name: string;
  readonly amountPerTick: number;
}

/** Taxas na ordem definida pelo conteúdo (`RESOURCE_IDS`); recurso sem taxa não aparece. */
function selectRateEntries(rates: ResourceRates): readonly ResourceRateEntry[] {
  return RESOURCE_IDS.filter((id) => Object.hasOwn(rates, id)).flatMap((id) => {
    const amountPerTick = rates[id];
    return amountPerTick === undefined
      ? []
      : [{ id, name: RESOURCE_DEFINITIONS[id].name, amountPerTick }];
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
  /** O que o edifício produz por tick quando opera (vem da definição, não do estado). */
  readonly production: readonly ResourceRateEntry[];
  /** O que o edifício consome por tick quando opera (vem da definição, não do estado). */
  readonly consumption: readonly ResourceRateEntry[];
}

/** Detalhes da construção com este `instanceId`, ou `null` se ela não existir no estado. */
export function selectBuildingDetails(
  buildings: readonly BuildingInstance[],
  instanceId: string,
): BuildingDetails | null {
  const building = buildings.find((candidate) => candidate.instanceId === instanceId);
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
    production: selectRateEntries(definition.production),
    consumption: selectRateEntries(definition.consumption),
  };
}
