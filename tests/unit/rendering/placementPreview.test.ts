import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickEntityId } from '@/rendering/interaction/BuildingPicking';
import { pickGridCell, pickGroundPoint } from '@/rendering/interaction/groundPicking';
import {
  CELL_SIZE,
  gridPointToWorld,
  placedCenterToWorld,
  worldToGridCell,
} from '@/rendering/world/gridToWorld';
import type { PlacementPreviewSpec } from '@/rendering/world/WorldSnapshot';
import {
  cleanupHeadlessRenderers,
  click,
  mountHeadlessRenderer,
  move,
  onBuilding,
  pointer,
  toScreen,
} from '../../support/headlessRenderer';
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents';

/*
 * Posicionamento e prévia na cena, com o NullEngine do Babylon.js: o raio, a geometria e os meshes
 * são reais, mas os eventos de ponteiro são SINTÉTICOS. Isto NÃO prova o mouse real, o WebGL, a cor
 * na tela nem a sensação do arrasto no navegador: isso é verificado à mão.
 */

afterEach(cleanupHeadlessRenderers);

const TERRAIN = { width: 40, depth: 40 };

function mount() {
  const onPlacementCell = vi.fn();
  const onPick = vi.fn();
  const mounted = mountHeadlessRenderer({ onPlacementCell, onPick });
  return { ...mounted, onPlacementCell, onPick };
}

/** Ponto em pixels do centro de uma célula do grid, no chão. */
function cellScreen(scene: Scene, cell: { x: number; y: number }) {
  const world = gridPointToWorld({ x: cell.x + 0.5, y: cell.y + 0.5 }, TERRAIN);
  return toScreen(scene, new Vector3(world.x, 0, world.z));
}

const previewNodes = (scene: Scene) =>
  scene.transformNodes.filter((node) => node.name === 'placement-preview');
const previewMeshes = (scene: Scene) =>
  scene.meshes.filter(
    (mesh) => mesh.name.startsWith('preview-') || mesh.parent?.name === 'placement-preview',
  );

const spec = (patch: Partial<PlacementPreviewSpec> = {}): PlacementPreviewSpec => ({
  definitionId: 'solar-array',
  size: { width: 3, depth: 2 },
  position: { x: 24, y: 13 },
  rotation: 0,
  valid: true,
  ...patch,
});

describe('conversão do mundo para a grade', () => {
  it('é o inverso de gridPointToWorld: o centro de cada célula do terreno volta à própria célula', () => {
    for (let y = 0; y < TERRAIN.depth; y += 1) {
      for (let x = 0; x < TERRAIN.width; x += 1) {
        const world = gridPointToWorld({ x: x + 0.5, y: y + 0.5 }, TERRAIN);

        expect(worldToGridCell(world, TERRAIN)).toEqual({ x, y });
      }
    }
  });

  it('as bordas pertencem à célula seguinte (intervalos [início, fim))', () => {
    const corner = gridPointToWorld({ x: 12, y: 12 }, TERRAIN);

    expect(worldToGridCell(corner, TERRAIN)).toEqual({ x: 12, y: 12 });
    expect(worldToGridCell({ x: corner.x - 0.01, z: corner.z + 0.01 }, TERRAIN)).toEqual({
      x: 11,
      y: 11,
    });
  });

  it('x cresce para leste (+X) e y cresce para o sul (-Z)', () => {
    const origin = worldToGridCell({ x: 0, z: 0 }, TERRAIN);
    const east = worldToGridCell({ x: CELL_SIZE * 3, z: 0 }, TERRAIN);
    const south = worldToGridCell({ x: 0, z: -CELL_SIZE * 3 }, TERRAIN);

    expect(east.x - origin.x).toBe(3);
    expect(south.y - origin.y).toBe(3);
  });

  it('pontos fora do terreno dão índices fora da extensão (quem usa decide o que fazer)', () => {
    expect(worldToGridCell({ x: -1000, z: 1000 }, TERRAIN).x).toBeLessThan(0);
    expect(worldToGridCell({ x: 1000, z: -1000 }, TERRAIN).x).toBeGreaterThan(TERRAIN.width);
  });
});

describe('ponteiro → chão → célula (raio da câmera)', () => {
  it('o ponto do chão sob o ponteiro é o ponto que a câmera projeta naquele pixel', () => {
    const { scene } = mount();
    const target = gridPointToWorld({ x: 20.5, y: 24.5 }, TERRAIN);
    const pixel = toScreen(scene, new Vector3(target.x, 0, target.z));

    const ground = pickGroundPoint(scene, pixel.x, pixel.y);

    expect(ground?.x).toBeCloseTo(target.x, 1);
    expect(ground?.z).toBeCloseTo(target.z, 1);
  });

  it('descobre a célula sob o ponteiro em várias células da área construível', () => {
    const { scene } = mount();

    for (const cell of [
      { x: 12, y: 12 },
      { x: 27, y: 27 },
      { x: 20, y: 20 },
      { x: 25, y: 14 },
    ]) {
      const pixel = cellScreen(scene, cell);

      expect(pickGridCell(scene, pixel.x, pixel.y, TERRAIN), `${cell.x},${cell.y}`).toEqual(cell);
    }
  });

  it('um edifício na frente não muda a célula apontada (o plano do chão, não o mesh)', () => {
    const { scene } = mount();
    // O topo do habitat aparece em pixels cujo raio atravessa outra célula do chão.
    const onTop = onBuilding(scene, 'building-habitat-01');

    const cell = pickGridCell(scene, onTop.x, onTop.y, TERRAIN);

    expect(cell).not.toBeNull();
    // Continua sendo uma célula do chão: não há "célula do edifício".
    expect(Number.isInteger(cell?.x)).toBe(true);
  });

  it('um raio que aponta para o céu não encontra o chão', () => {
    const { scene } = mount();
    const camera = scene.activeCamera as unknown as { beta: number };
    camera.beta = 1.32;
    scene.render();

    expect(pickGroundPoint(scene, 256, 0)).toBeNull();
  });
});

describe('entrada do modo de posicionamento', () => {
  it('desligado, o ponteiro não informa nada', () => {
    const { scene, onPlacementCell } = mount();

    move(scene, cellScreen(scene, { x: 20, y: 20 }));
    click(scene, cellScreen(scene, { x: 21, y: 20 }));

    expect(onPlacementCell).not.toHaveBeenCalled();
  });

  it('ligado, informa a célula sob o ponteiro e só quando a célula muda', () => {
    const { scene, renderer, onPlacementCell } = mount();
    renderer.setPlacementMode(true);

    const a = cellScreen(scene, { x: 20, y: 20 });
    move(scene, a);
    move(scene, { x: a.x + 1, y: a.y });
    move(scene, cellScreen(scene, { x: 21, y: 20 }));

    expect(onPlacementCell.mock.calls).toEqual([
      [{ x: 20, y: 20 }, 'hover'],
      [{ x: 21, y: 20 }, 'hover'],
    ]);
  });

  it('um clique (apertar e soltar no mesmo ponto) informa a célula como "click"', () => {
    const { scene, renderer, onPlacementCell } = mount();
    renderer.setPlacementMode(true);

    click(scene, cellScreen(scene, { x: 22, y: 21 }));

    expect(onPlacementCell).toHaveBeenLastCalledWith({ x: 22, y: 21 }, 'click');
  });

  it('um arrasto (girar a câmera) não conta como clique', () => {
    const { scene, renderer, onPlacementCell } = mount();
    renderer.setPlacementMode(true);
    const start = cellScreen(scene, { x: 20, y: 20 });

    pointer(scene, PointerEventTypes.POINTERDOWN, start.x, start.y);
    pointer(scene, PointerEventTypes.POINTERUP, start.x + 40, start.y + 10);

    expect(onPlacementCell.mock.calls.filter(([, source]) => source === 'click')).toEqual([]);
  });

  it('só o botão principal posiciona: o direito (pan) é ignorado', () => {
    const { scene, renderer, onPlacementCell } = mount();
    renderer.setPlacementMode(true);
    const point = cellScreen(scene, { x: 20, y: 20 });

    pointer(scene, PointerEventTypes.POINTERDOWN, point.x, point.y, 2);
    pointer(scene, PointerEventTypes.POINTERUP, point.x, point.y, 2);

    expect(onPlacementCell).not.toHaveBeenCalled();
  });

  it('desligar o modo para de informar e esquece a última célula', () => {
    const { scene, renderer, onPlacementCell } = mount();
    renderer.setPlacementMode(true);
    const point = cellScreen(scene, { x: 20, y: 20 });
    move(scene, point);
    renderer.setPlacementMode(false);
    move(scene, cellScreen(scene, { x: 22, y: 22 }));
    renderer.setPlacementMode(true);

    move(scene, point);

    expect(onPlacementCell.mock.calls.map(([cell]) => cell)).toEqual([
      { x: 20, y: 20 },
      { x: 20, y: 20 },
    ]);
  });
});

describe('seleção e posicionamento não se confundem', () => {
  it('fora do modo de construção o clique seleciona (regressão da Fase 3)', () => {
    const { scene, onPick } = mount();

    click(scene, onBuilding(scene, 'building-habitat-01'));

    expect(onPick).toHaveBeenCalledWith('building-habitat-01');
  });

  it('no modo de construção o clique NÃO seleciona, nem em cima de uma construção', () => {
    const { scene, renderer, onPick, onPlacementCell } = mount();
    renderer.setPlacementMode(true);

    click(scene, onBuilding(scene, 'building-habitat-01'));
    click(scene, cellScreen(scene, { x: 25, y: 14 }));

    expect(onPick).not.toHaveBeenCalled();
    expect(onPlacementCell.mock.calls.filter(([, source]) => source === 'click')).toHaveLength(2);
  });

  it('ao sair do modo a seleção por clique volta', () => {
    const { scene, renderer, onPick } = mount();
    renderer.setPlacementMode(true);
    renderer.setPlacementMode(false);

    click(scene, onBuilding(scene, 'building-habitat-01'));

    expect(onPick).toHaveBeenCalledWith('building-habitat-01');
  });
});

describe('prévia visual da construção', () => {
  it('mostra o fantasma, o preenchimento, a moldura e o X, num único nó', () => {
    const { scene, renderer } = mount();

    renderer.setPlacementPreview(spec({ valid: false }));

    expect(previewNodes(scene)).toHaveLength(1);
    const names = previewMeshes(scene)
      .map((mesh) => mesh.name)
      .sort();
    expect(names).toEqual(['preview-cross', 'preview-fill', 'preview-frame', 'solar-array']);
  });

  it('fica centrada no retângulo ocupado, à altura do terreno', () => {
    const { scene, renderer } = mount();
    const request = spec({ position: { x: 24, y: 13 }, rotation: 90 });

    renderer.setPlacementPreview(request);

    const [node] = previewNodes(scene);
    const expected = placedCenterToWorld(request, TERRAIN);
    expect(node?.position.x).toBeCloseTo(expected.x, 5);
    expect(node?.position.z).toBeCloseTo(expected.z, 5);
    expect(node?.position.y).toBe(0);
    expect(node?.rotation.y).toBeCloseTo(Math.PI / 2, 5);
  });

  it.each([0, 90, 180, 270] as const)('a rotação %i° gira a prévia', (rotation) => {
    const { scene, renderer } = mount();

    renderer.setPlacementPreview(spec({ rotation }));

    expect(previewNodes(scene)[0]?.rotation.y).toBeCloseTo((rotation * Math.PI) / 180, 5);
  });

  it('válida e inválida diferem pela cor E pela forma: só a inválida mostra o X', () => {
    const { scene, renderer } = mount();

    renderer.setPlacementPreview(spec({ valid: true }));
    const cross = scene.getMeshByName('preview-cross');
    const frame = scene.getMeshByName('preview-frame');
    const validFrameMaterial = frame?.material;
    expect(cross?.isEnabled()).toBe(false);

    renderer.setPlacementPreview(spec({ valid: false }));
    expect(scene.getMeshByName('preview-cross')?.isEnabled()).toBe(true);
    expect(scene.getMeshByName('preview-frame')?.material).not.toBe(validFrameMaterial);
    expect(scene.getMeshByName('preview-frame')?.material?.name).toBe('preview-line-invalid');
  });

  it('trocar só a validade, a posição ou a rotação não recria a prévia', () => {
    const { scene, renderer } = mount();
    renderer.setPlacementPreview(spec());
    const node = previewNodes(scene)[0];

    renderer.setPlacementPreview(spec({ valid: false }));
    renderer.setPlacementPreview(spec({ position: { x: 20, y: 20 }, rotation: 180 }));

    expect(previewNodes(scene)).toHaveLength(1);
    expect(previewNodes(scene)[0]).toBe(node);
  });

  it('trocar o edifício recria a prévia sem deixar sobras', () => {
    const { scene, renderer } = mount();
    renderer.setPlacementPreview(spec());
    const before = scene.meshes.length;

    renderer.setPlacementPreview(
      spec({ definitionId: 'habitat-module', size: { width: 3, depth: 3 } }),
    );

    // Só as peças da nova prévia: nenhuma sobra do fantasma anterior.
    expect(previewNodes(scene)).toHaveLength(1);
    expect(
      previewMeshes(scene)
        .map((mesh) => mesh.name)
        .sort(),
    ).toEqual(['habitat', 'preview-cross', 'preview-fill', 'preview-frame']);
    expect(scene.meshes).toHaveLength(before);
  });

  it('esconder remove tudo e deixa a cena como estava', () => {
    const { scene, renderer } = mount();
    const meshesBefore = scene.meshes.length;
    const nodesBefore = scene.transformNodes.length;

    renderer.setPlacementPreview(spec());
    renderer.setPlacementPreview(null);

    expect(previewNodes(scene)).toHaveLength(0);
    expect(scene.meshes).toHaveLength(meshesBefore);
    expect(scene.transformNodes).toHaveLength(nodesBefore);
  });

  it('a prévia nunca é clicável: não participa do picking nem esconde o que está atrás', () => {
    const { scene, renderer } = mount();
    renderer.setPlacementPreview(
      spec({
        definitionId: 'habitat-module',
        size: { width: 3, depth: 3 },
        position: { x: 14, y: 20 },
      }),
    );

    expect(previewMeshes(scene).every((mesh) => !mesh.isPickable)).toBe(true);
    // A prévia está EXATAMENTE em cima do habitat real: o clique ainda o encontra.
    const onHabitat = onBuilding(scene, 'building-habitat-01');
    expect(pickEntityId(scene, onHabitat.x, onHabitat.y)).toBe('building-habitat-01');
  });

  it('a prévia não é uma construção: não entra na lista de edifícios nem nos metadados de entidade', () => {
    const { scene, renderer } = mount();
    const buildingsBefore = scene.transformNodes.filter((node) =>
      node.name.startsWith('building-'),
    );

    renderer.setPlacementPreview(spec());

    const buildingsAfter = scene.transformNodes.filter((node) => node.name.startsWith('building-'));
    expect(buildingsAfter).toHaveLength(buildingsBefore.length);
    expect(
      previewMeshes(scene).every((mesh) => mesh.metadata === null || mesh.metadata === undefined),
    ).toBe(true);
  });

  it('não toca nos materiais compartilhados dos edifícios reais', () => {
    const { scene, renderer } = mount();
    const glow = scene.getMaterialByName('glow-green');
    const alphaBefore = glow?.alpha;

    renderer.setPlacementPreview(spec({ valid: false }));
    renderer.setPlacementPreview(spec({ valid: true }));

    expect(glow?.alpha).toBe(alphaBefore);
    expect(scene.getMaterialByName('solid')?.alpha).toBe(1);
  });

  it('pode ser pedida antes do primeiro sync e aparece quando o terreno é conhecido', () => {
    const { scene, renderer, snapshot } = mountHeadlessRenderer({ sync: false });
    renderer.setPlacementPreview(spec());
    expect(previewNodes(scene)).toHaveLength(0);

    renderer.sync(snapshot);

    expect(previewNodes(scene)).toHaveLength(1);
  });

  it('um novo sync mantém a prévia (os edifícios mudam, a prévia não some)', () => {
    const { scene, renderer, snapshot } = mount();
    renderer.setPlacementPreview(spec());

    renderer.sync(snapshot);
    renderer.sync({ ...snapshot, buildings: snapshot.buildings.slice(1) });

    expect(previewNodes(scene)).toHaveLength(1);
  });

  it('depois do dispose, pedir prévia ou modo não faz nada nem lança erro', () => {
    const { renderer } = mount();
    renderer.dispose();

    expect(() => {
      renderer.setPlacementPreview(spec());
      renderer.setPlacementMode(true);
    }).not.toThrow();
  });
});
