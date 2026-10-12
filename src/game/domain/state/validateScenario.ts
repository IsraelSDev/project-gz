import { getBuildingDefinition, isBuildingDefinitionId } from '@/game/content/buildings';
import { RESOURCE_IDS } from '@/game/content/resources';
import type { ScenarioDefinition } from '@/game/content/scenario';
import { isRotation, occupiedRect, rectContainsRect, rectsOverlap } from '@/shared/grid/gridMath';
import type { GridRect, GridSize } from '@/shared/grid/types';

const isWholeNumber = (value: number): boolean => Number.isSafeInteger(value);
const isPositiveSize = (size: GridSize): boolean =>
  isWholeNumber(size.width) && isWholeNumber(size.depth) && size.width > 0 && size.depth > 0;

/** Valida um cenário e devolve a lista de problemas (vazia quando o cenário é válido). */
export function validateScenario(scenario: ScenarioDefinition): readonly string[] {
  const issues: string[] = [];

  if (scenario.contentVersion.trim() === '') {
    issues.push('contentVersion não pode ser vazio.');
  }

  const { sizeCells, buildableArea } = scenario.terrain;
  const terrainRect: GridRect = { x: 0, y: 0, width: sizeCells.width, depth: sizeCells.depth };

  if (!isPositiveSize(sizeCells)) {
    issues.push('terrain.sizeCells deve ter largura e profundidade inteiras e positivas.');
  }
  if (
    !isWholeNumber(buildableArea.x) ||
    !isWholeNumber(buildableArea.y) ||
    !isPositiveSize(buildableArea)
  ) {
    issues.push('terrain.buildableArea deve ter posição e extensão inteiras e positivas.');
  } else if (!rectContainsRect(terrainRect, buildableArea)) {
    issues.push('terrain.buildableArea deve estar dentro do terreno.');
  }

  const ship = scenario.crashedShip;
  if (
    !isPositiveSize(ship.size) ||
    !isWholeNumber(ship.position.x) ||
    !isWholeNumber(ship.position.y)
  ) {
    issues.push('crashedShip deve ter posição e extensão inteiras e positivas.');
  }
  if (!isRotation(ship.rotation)) {
    issues.push('crashedShip.rotation deve ser 0, 90, 180 ou 270.');
  }
  const shipRect = occupiedRect(ship.position, ship.size, ship.rotation);
  if (!rectContainsRect(terrainRect, shipRect)) {
    issues.push('crashedShip deve estar dentro do terreno.');
  }

  for (const id of RESOURCE_IDS) {
    const amount = scenario.initialResources[id];
    if (!isWholeNumber(amount) || amount < 0) {
      issues.push(`initialResources.${id} deve ser um inteiro não negativo.`);
    }
  }

  const seenIds = new Set<string>();
  const placed: { readonly label: string; readonly rect: GridRect }[] = [
    { label: 'crashedShip', rect: shipRect },
  ];

  for (const building of scenario.initialBuildings) {
    const label = `edifício "${building.instanceId}"`;

    if (building.instanceId.trim() === '') {
      issues.push('Todo edifício precisa de um instanceId não vazio.');
    } else if (seenIds.has(building.instanceId)) {
      issues.push(`instanceId duplicado: "${building.instanceId}".`);
    }
    seenIds.add(building.instanceId);

    if (!isBuildingDefinitionId(building.definitionId)) {
      issues.push(`${label}: definição desconhecida "${building.definitionId}".`);
      continue;
    }
    if (!isRotation(building.rotation)) {
      issues.push(`${label}: rotação inválida.`);
      continue;
    }
    if (!isWholeNumber(building.position.x) || !isWholeNumber(building.position.y)) {
      issues.push(`${label}: a posição deve usar células inteiras.`);
      continue;
    }

    const definition = getBuildingDefinition(building.definitionId);
    const rect = occupiedRect(building.position, definition.footprint, building.rotation);

    if (!rectContainsRect(buildableArea, rect)) {
      issues.push(`${label}: fora da área construível.`);
    }
    for (const other of placed) {
      if (rectsOverlap(rect, other.rect)) {
        issues.push(`${label}: sobrepõe ${other.label}.`);
      }
    }
    placed.push({ label, rect });
  }

  return issues;
}
