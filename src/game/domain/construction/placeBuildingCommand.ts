import { BUILDING_DEFINITIONS, type BuildingDefinitionId } from '@/game/content/buildings';
import { RESOURCE_IDS, type ResourceRates } from '@/game/content/resources';
import type { CommandHandler, SimulationCommand } from '@/game/domain/commands/simulationCommand';
import type { BuildingInstance, GameState, ResourceStock } from '@/game/domain/state/GameState';
import { isRotation } from '@/shared/grid/gridMath';
import type { GridPosition, Rotation } from '@/shared/grid/types';
import { err, ok } from '@/shared/result/result';
import {
  evaluatePlacement,
  type ConstructionDefinitions,
  type PlacementRequest,
  type PlacementTerrain,
} from './placement';
import { INITIAL_PLACEMENT_TERRAIN } from './placementTerrain';

/*
 * Comando de simulação `PlaceBuilding` (docs/TECHNICAL_ARCHITECTURE.md §7.2 e §21). Segue as regras
 * dos comandos: validado ao ser enviado e REVALIDADO ao ser aplicado (a aplicação é a decisão
 * definitiva); com o jogo pausado é aplicado na hora, sem avançar o tick; em andamento entra na fila.
 */

export const PLACE_BUILDING = 'PlaceBuilding';

export interface PlaceBuildingCommand extends SimulationCommand {
  readonly type: typeof PLACE_BUILDING;
  readonly definitionId: BuildingDefinitionId;
  /** Célula de menor x e menor y do retângulo ocupado (já rotacionado). */
  readonly position: GridPosition;
  readonly rotation: Rotation;
}

export function placeBuildingCommand(request: {
  readonly definitionId: BuildingDefinitionId;
  readonly position: GridPosition;
  readonly rotation: Rotation;
}): PlaceBuildingCommand {
  return {
    type: PLACE_BUILDING,
    definitionId: request.definitionId,
    position: { x: request.position.x, y: request.position.y },
    rotation: request.rotation,
  };
}

/** Prefixo dos identificadores gerados pelo contador (`building-1`, `building-2`, …). */
export const BUILDING_ID_PREFIX = 'building-';

/**
 * Lê o comando, que chega sem tipos de verdade: devolve `null` se estiver malformado ou se a definição
 * não existir. Chaves herdadas (`__proto__`, `constructor`) não contam como definição.
 */
function parseRequest(
  command: SimulationCommand,
  definitions: ConstructionDefinitions,
): PlacementRequest | null {
  const fields: Readonly<Record<string, unknown>> = { ...command };
  const { definitionId, position, rotation } = fields;
  if (typeof definitionId !== 'string' || !Object.hasOwn(definitions, definitionId)) {
    return null;
  }
  if (typeof position !== 'object' || position === null || !isRotation(rotation)) {
    return null;
  }
  const { x, y } = position as Readonly<Record<string, unknown>>;
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
    return null;
  }
  return { definitionId, position: { x: x as number, y: y as number }, rotation };
}

/** Estoque depois de pagar o custo. A mesma referência se o custo for vazio. */
function payCost(resources: ResourceStock, cost: ResourceRates): ResourceStock {
  const paid: Record<string, number> = { ...resources };
  let changed = false;
  for (const id of RESOURCE_IDS) {
    const amount = Object.hasOwn(cost, id) ? cost[id] : undefined;
    if (amount !== undefined) {
      paid[id] = resources[id] - amount;
      changed = true;
    }
  }
  return changed ? (paid as ResourceStock) : resources;
}

/**
 * Cria o tratador de `PlaceBuilding` para um terreno e um conjunto de definições (os testes injetam
 * os seus; o jogo usa `handlePlaceBuilding`). Valida e aplica numa passada, sem alterar o estado de
 * entrada:
 *  - comando malformado ou definição desconhecida: `INVALID_COMMAND`;
 *  - posição ou recursos recusados pelas regras: o código de `evaluatePlacement`;
 *  - aceito: desconta o custo, cria a instância com o identificador do contador (`nextEntityId`) e
 *    avança o contador. Uma recusa não desconta nada e não consome identificador.
 */
export function createPlaceBuildingHandler(
  terrain: PlacementTerrain,
  definitions: ConstructionDefinitions = BUILDING_DEFINITIONS,
): CommandHandler {
  return (state, command) => {
    const request = parseRequest(command, definitions);
    const definition = request ? definitions[request.definitionId] : undefined;
    if (!request || !definition) {
      return err('INVALID_COMMAND');
    }
    const requiredTechnologyId = (definition as { requiredTechnologyId?: string })
      .requiredTechnologyId;
    if (
      requiredTechnologyId &&
      !state.research.unlockedTechnologyIds.includes(requiredTechnologyId)
    )
      return err('COMMAND_REJECTED');
    const checked = evaluatePlacement(state, request, terrain, definitions);
    if (!checked.ok) {
      return err(checked.error);
    }

    const building: BuildingInstance = {
      instanceId: `${BUILDING_ID_PREFIX}${state.nextEntityId}`,
      // O tratador do jogo só conhece as definições do conteúdo; o executor ainda valida o estado
      // resultante (`validateGameState`), que recusa uma definição desconhecida.
      definitionId: request.definitionId as BuildingDefinitionId,
      position: { x: request.position.x, y: request.position.y },
      rotation: request.rotation,
    };
    const next: GameState = {
      ...state,
      resources: payCost(state.resources, definition.cost),
      buildings: [...state.buildings, building],
      nextEntityId: state.nextEntityId + 1,
    };
    return ok(next);
  };
}

/** Tratador usado pelo jogo: o terreno do cenário inicial e as definições do conteúdo. */
export const handlePlaceBuilding: CommandHandler = createPlaceBuildingHandler(
  INITIAL_PLACEMENT_TERRAIN,
  BUILDING_DEFINITIONS,
);
