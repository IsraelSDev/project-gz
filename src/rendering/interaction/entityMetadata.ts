// Habilita scene.pick / createPickingRay (efeito colateral do módulo). A seleção em si é a Fase 3.
import '@babylonjs/core/Culling/ray';
import type { Node } from '@babylonjs/core/node';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

/*
 * Ligação entre objetos 3D e identificadores de domínio, preparada para a seleção da Fase 3.
 * O identificador de domínio (`instanceId`) é guardado em `metadata`; nomes de meshes NUNCA são
 * usados como identificadores.
 */
export interface EntityMetadata {
  readonly kind: 'building';
  readonly entityId: string;
}

function isEntityMetadata(value: unknown): value is EntityMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<EntityMetadata>;
  return candidate.kind === 'building' && typeof candidate.entityId === 'string';
}

/** Marca o nó e todos os meshes filhos com o identificador de domínio. */
export function tagEntity(root: TransformNode, metadata: EntityMetadata): void {
  root.metadata = metadata;
  for (const mesh of root.getChildMeshes()) {
    mesh.metadata = metadata;
  }
}

/** Sobe pela hierarquia a partir de um nó (por exemplo, o mesh de um pick) até achar o `entityId`. */
export function resolveEntityId(node: Node | null | undefined): string | null {
  let current: Node | null = node ?? null;
  while (current) {
    const metadata: unknown = current.metadata;
    if (isEntityMetadata(metadata)) {
      return metadata.entityId;
    }
    current = current.parent;
  }
  return null;
}
