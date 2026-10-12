import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLiveRendererCount } from '@/rendering/GameRenderer';
import { pickEntityId } from '@/rendering/interaction/BuildingPicking';
import { resolveEntityId } from '@/rendering/interaction/entityMetadata';
import { CELL_SIZE, gridPointToWorld } from '@/rendering/world/gridToWorld';
import {
  buildingNode,
  cleanupHeadlessRenderers,
  click,
  headlessEngines,
  mountHeadlessRenderer,
  onBuilding,
  pointer,
  toScreen,
} from '../../support/headlessRenderer';

/*
 * Seleção por picking com o NullEngine do Babylon.js: o raio, a geometria e a resolução do
 * `instanceId` são reais, mas os eventos de ponteiro são SINTÉTICOS (ver tests/support). Isto NÃO
 * prova o mouse real, o canvas, o WebGL nem a sensação do clique no navegador: isso é verificado à
 * mão.
 */

afterEach(cleanupHeadlessRenderers);

/** Monta com um espião em `onPick`. */
function mount() {
  const onPick = vi.fn();
  return { ...mountHeadlessRenderer({ onPick }), onPick };
}

const markers = (scene: Scene) => scene.meshes.filter((mesh) => mesh.name === 'selection-marker');

function firstBuilding(snapshot: { buildings: readonly { instanceId: string }[] }) {
  const target = snapshot.buildings[0];
  if (!target) {
    throw new Error('O snapshot precisa ter edifícios.');
  }
  return target;
}

describe('picking de construções (NullEngine, eventos sintéticos)', () => {
  it('clicar em cada construção entrega o seu instanceId', () => {
    const { scene, snapshot, onPick } = mount();

    for (const building of snapshot.buildings) {
      click(scene, onBuilding(scene, building.instanceId));
      expect(onPick).toHaveBeenLastCalledWith(building.instanceId);
    }
    expect(onPick).toHaveBeenCalledTimes(snapshot.buildings.length);
  });

  it('resolve o identificador pelos metadados do objeto, nunca pelo nome do mesh', () => {
    const { scene, snapshot } = mount();
    const target = firstBuilding(snapshot);
    const { x, y } = onBuilding(scene, target.instanceId);

    const picked = scene.pick(x, y).pickedMesh;

    expect(picked?.name).not.toBe(target.instanceId);
    expect(pickEntityId(scene, x, y)).toBe(target.instanceId);
  });

  it('clicar no terreno vazio entrega null', () => {
    const { scene, snapshot, onPick } = mount();
    // Uma célula livre da área construível, longe das construções e da nave.
    const cell = gridPointToWorld({ x: 26.5, y: 14.5 }, snapshot.terrain.sizeCells);

    click(scene, toScreen(scene, new Vector3(cell.x, 0, cell.z)));

    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('clicar onde só há céu entrega null e não lança erro', () => {
    const { scene, onPick } = mount();

    expect(() => click(scene, { x: 1, y: 1 })).not.toThrow();

    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('clicar na nave entrega null: a nave não é uma construção', () => {
    const { scene, onPick } = mount();
    const hull = scene.getMeshByName('ship-hull');
    if (!hull) {
      throw new Error('O casco da nave deveria existir.');
    }
    const point = toScreen(scene, hull.getBoundingInfo().boundingBox.centerWorld);

    expect(scene.pick(point.x, point.y).pickedMesh).toBe(hull);
    click(scene, point);

    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('a nave na frente de uma construção a oculta: clicar nela não seleciona o que está atrás', () => {
    const { renderer, scene, snapshot, onPick } = mount();
    const habitat = snapshot.buildings.find(
      (building) => building.definitionId === 'habitat-module',
    );
    const hull = scene.getMeshByName('ship-hull');
    const camera = scene.activeCamera;
    if (!habitat || !hull || !camera) {
      throw new Error('Cenário de teste inválido.');
    }

    // O raio que passa pelo centro do casco continua e toca o chão em um ponto: o módulo é posto
    // ali, atrás da nave do ponto de vista da câmera.
    const point = toScreen(scene, hull.getBoundingInfo().boundingBox.centerWorld);
    const ray = scene.createPickingRay(point.x, point.y, Matrix.Identity(), camera);
    const ground = ray.origin.add(ray.direction.scale(-ray.origin.y / ray.direction.y));
    const { width, depth } = snapshot.terrain.sizeCells;
    const behind = {
      ...habitat,
      position: {
        x: Math.round(ground.x / CELL_SIZE + width / 2) - 1,
        y: Math.round(depth / 2 - ground.z / CELL_SIZE) - 1,
      },
    };
    renderer.sync({ ...snapshot, buildings: [behind] });
    scene.render();

    // A configuração de produção do casco é "pickable" (crashedShip.ts); este teste a protege.
    const hullIsPickable = hull.isPickable;
    expect(hullIsPickable).toBe(true);

    // Sem o casco no caminho, o mesmo clique atingiria a construção (o teste não é vazio)...
    hull.isPickable = false;
    expect(pickEntityId(scene, point.x, point.y)).toBe(behind.instanceId);
    hull.isPickable = hullIsPickable;

    // ...mas com a nave "pickable" ela vem primeiro e nada é selecionado.
    expect(scene.pick(point.x, point.y).pickedMesh).toBe(hull);
    click(scene, point);
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('um objeto desconhecido (sem metadados válidos) resolve para null, sem exceção', () => {
    const { scene, snapshot, onPick } = mount();
    const at = buildingNode(scene, firstBuilding(snapshot).instanceId).position;
    const stranger = CreateBox('qualquer-coisa', { size: 30 }, scene);
    stranger.position.copyFrom(at).addInPlaceFromFloats(0, 1, 0);
    stranger.metadata = { kind: 'building', entityId: 42 };
    const point = toScreen(scene, new Vector3(at.x, at.y + 1, at.z));

    expect(() => click(scene, point)).not.toThrow();

    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('um arraste (girar a câmera) não seleciona nada', () => {
    const { scene, snapshot, onPick } = mount();
    const start = onBuilding(scene, firstBuilding(snapshot).instanceId);

    pointer(scene, PointerEventTypes.POINTERDOWN, start.x, start.y);
    pointer(scene, PointerEventTypes.POINTERUP, start.x + 40, start.y + 10);

    expect(onPick).not.toHaveBeenCalled();
  });

  it('um pequeno tremor do ponteiro ainda conta como clique', () => {
    const { scene, snapshot, onPick } = mount();
    const target = firstBuilding(snapshot);
    const start = onBuilding(scene, target.instanceId);

    pointer(scene, PointerEventTypes.POINTERDOWN, start.x, start.y);
    pointer(scene, PointerEventTypes.POINTERUP, start.x + 2, start.y + 1);

    expect(onPick).toHaveBeenCalledWith(target.instanceId);
  });

  it('só o botão principal seleciona (o botão direito é o pan da câmera)', () => {
    const { scene, snapshot, onPick } = mount();
    const point = onBuilding(scene, firstBuilding(snapshot).instanceId);

    pointer(scene, PointerEventTypes.POINTERDOWN, point.x, point.y, 2);
    pointer(scene, PointerEventTypes.POINTERUP, point.x, point.y, 2);

    expect(onPick).not.toHaveBeenCalled();
  });

  it('soltar o botão sem ter apertado dentro da cena não seleciona nada', () => {
    const { scene, snapshot, onPick } = mount();
    const point = onBuilding(scene, firstBuilding(snapshot).instanceId);

    pointer(scene, PointerEventTypes.POINTERUP, point.x, point.y);

    expect(onPick).not.toHaveBeenCalled();
  });

  it('só registra o observador de ponteiro quando há onPick, e o remove no dispose', async () => {
    // A câmera também observa o ponteiro; compara-se a contagem com e sem `onPick`.
    const withoutPick = mountHeadlessRenderer();
    const baseline = withoutPick.scene.onPointerObservable.observers.length;
    withoutPick.renderer.dispose();

    const { renderer, scene, snapshot, onPick } = mount();
    expect(scene.onPointerObservable.observers).toHaveLength(baseline + 1);
    const point = onBuilding(scene, firstBuilding(snapshot).instanceId);

    renderer.dispose();
    click(scene, point);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onPick).not.toHaveBeenCalled();
    expect(scene.onPointerObservable.observers).toHaveLength(0);
  });
});

describe('marcador de seleção 3D (NullEngine)', () => {
  it('mostra um marcador, filho da construção selecionada, sem tocar no material dela', () => {
    const { renderer, scene, snapshot } = mount();
    const target = firstBuilding(snapshot);
    const node = buildingNode(scene, target.instanceId);
    const materialsBefore = node.getChildMeshes().map((mesh) => mesh.material);

    renderer.setSelectedEntity(target.instanceId);

    const [marker, ...others] = markers(scene);
    expect(others).toHaveLength(0);
    expect(marker?.parent).toBe(node);
    expect(marker?.isPickable).toBe(false);
    expect(marker?.material?.name).toBe('selection');
    expect(
      node
        .getChildMeshes()
        .filter((mesh) => mesh !== marker)
        .map((mesh) => mesh.material),
    ).toEqual(materialsBefore);
  });

  it('o marcador é filho do nó da construção, então acompanha sua rotação e posição', () => {
    const { renderer, scene, snapshot } = mount();
    const solar = snapshot.buildings.find((building) => building.definitionId === 'solar-array');
    if (!solar) {
      throw new Error('A matriz solar deveria existir.');
    }

    renderer.setSelectedEntity(solar.instanceId);

    const node = buildingNode(scene, solar.instanceId);
    expect(node.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(markers(scene)[0]?.parent).toBe(node);
  });

  it('transfere o marcador ao selecionar outra construção e o remove ao limpar', () => {
    const { renderer, scene, snapshot } = mount();
    const [first, second] = snapshot.buildings;
    if (!first || !second) {
      throw new Error('O snapshot precisa ter duas construções.');
    }
    const baseline = scene.meshes.length;

    renderer.setSelectedEntity(first.instanceId);
    expect(markers(scene)).toHaveLength(1);
    expect(markers(scene)[0]?.parent).toBe(buildingNode(scene, first.instanceId));

    renderer.setSelectedEntity(second.instanceId);
    expect(markers(scene)).toHaveLength(1);
    expect(markers(scene)[0]?.parent).toBe(buildingNode(scene, second.instanceId));

    renderer.setSelectedEntity(null);
    expect(markers(scene)).toHaveLength(0);
    expect(scene.meshes).toHaveLength(baseline);
  });

  it('selecionar a mesma construção de novo não duplica o marcador', () => {
    const { renderer, scene, snapshot } = mount();
    const target = firstBuilding(snapshot);

    renderer.setSelectedEntity(target.instanceId);
    renderer.setSelectedEntity(target.instanceId);

    expect(markers(scene)).toHaveLength(1);
  });

  it('aceita um identificador inexistente sem erro e sem marcar nada', () => {
    const { renderer, scene } = mount();

    expect(() => renderer.setSelectedEntity('nao-existe')).not.toThrow();

    expect(markers(scene)).toHaveLength(0);
  });

  it('um identificador escolhido antes do sync recebe o marcador quando a construção aparece', () => {
    const { renderer, scene, snapshot } = mountHeadlessRenderer({ sync: false });
    const target = firstBuilding(snapshot);

    renderer.setSelectedEntity(target.instanceId);
    expect(markers(scene)).toHaveLength(0);
    renderer.sync(snapshot);

    expect(markers(scene)).toHaveLength(1);
  });

  it('remover do estado a construção selecionada libera o marcador, sem erro nem sobras', () => {
    const { renderer, scene, snapshot } = mount();
    const [removed, ...remaining] = snapshot.buildings;
    if (!removed) {
      throw new Error('O snapshot precisa ter edifícios.');
    }
    renderer.setSelectedEntity(removed.instanceId);
    expect(markers(scene)).toHaveLength(1);

    expect(() => renderer.sync({ ...snapshot, buildings: remaining })).not.toThrow();

    expect(markers(scene)).toHaveLength(0);
    expect(scene.transformNodes.some((node) => resolveEntityId(node) === removed.instanceId)).toBe(
      false,
    );
  });

  it('o marcador não interfere no picking: clicar na construção selecionada ainda a resolve', () => {
    const { renderer, scene, snapshot, onPick } = mount();
    const target = firstBuilding(snapshot);

    renderer.setSelectedEntity(target.instanceId);
    const point = onBuilding(scene, target.instanceId);
    click(scene, point);

    expect(onPick).toHaveBeenCalledWith(target.instanceId);
    expect(scene.pick(point.x, point.y).pickedMesh?.name).not.toBe('selection-marker');
  });

  it('mudar a seleção não recria a engine, a cena nem os objetos das construções', () => {
    const { renderer, engine, scene, snapshot } = mount();
    const [first, second] = snapshot.buildings;
    if (!first || !second) {
      throw new Error('O snapshot precisa ter duas construções.');
    }
    const nodesBefore = scene.transformNodes.filter((node) => node.name.startsWith('building-'));

    renderer.setSelectedEntity(first.instanceId);
    renderer.setSelectedEntity(second.instanceId);
    renderer.setSelectedEntity(null);

    expect(headlessEngines).toHaveLength(1);
    expect(engine.scenes).toEqual([scene]);
    expect(getLiveRendererCount()).toBe(1);
    expect(scene.transformNodes.filter((node) => node.name.startsWith('building-'))).toEqual(
      nodesBefore,
    );
  });

  it('setSelectedEntity depois do dispose não faz nada e não lança erro', () => {
    const { renderer } = mount();

    renderer.dispose();

    expect(() => renderer.setSelectedEntity('qualquer')).not.toThrow();
  });
});
