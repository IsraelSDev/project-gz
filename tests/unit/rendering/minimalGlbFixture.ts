/*
 * GLB mínimo gerado em memória, só para testar o carregador e a integração. NÃO é arte do jogo:
 * é um triângulo no plano XY, com o vértice de -X ("nariz") separado dos outros dois, para os
 * testes enxergarem escala e orientação.
 */

export interface GlbFixtureOptions {
  /** Metade do comprimento do triângulo em X (o comprimento total é `2 × halfLength`). */
  readonly halfLength?: number;
  /** Posição do nó da malha no arquivo (eixos do glTF), para provar como o loader converte eixos. */
  readonly nodePosition?: readonly [number, number, number];
  /** Cena com um nó e nenhuma malha: um GLB válido que não tem nada para mostrar. */
  readonly withoutMesh?: boolean;
}

function encodeGlb(gltf: object, binary: Uint8Array | null): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const binaryLength = binary ? Math.ceil(binary.length / 4) * 4 : 0;
  const totalLength = 12 + 8 + jsonLength + (binary ? 8 + binaryLength : 0);
  const bytes = new Uint8Array(totalLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(0x20, 20, 20 + jsonLength);
  bytes.set(json, 20);
  if (binary) {
    const header = 20 + jsonLength;
    view.setUint32(header, binaryLength, true);
    view.setUint32(header + 4, 0x004e4942, true);
    bytes.set(binary, header + 8);
  }
  return bytes;
}

export function minimalGlbBytes(options: GlbFixtureOptions = {}): Uint8Array {
  const asset = { version: '2.0', generator: 'Civilização Alienígena test fixture' };
  if (options.withoutMesh) {
    return encodeGlb(
      { asset, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'vazio' }] },
      null,
    );
  }

  const half = options.halfLength ?? 1;
  const binary = new Uint8Array(44);
  const data = new DataView(binary.buffer);
  [-half, 0, 0, half, 0, 0, 0, half, 0].forEach((value, index) =>
    data.setFloat32(index * 4, value, true),
  );
  [0, 1, 2].forEach((value, index) => data.setUint16(36 + index * 2, value, true));

  const gltf = {
    asset,
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, translation: options.nodePosition ?? [0, 0, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: 42 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 6, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [-half, 0, 0],
        max: [half, half, 0],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
  };
  return encodeGlb(gltf, binary);
}

export function minimalGlbDataUrl(options: GlbFixtureOptions = {}): string {
  const bytes = minimalGlbBytes(options);
  let text = '';
  for (const byte of bytes) {
    text += String.fromCharCode(byte);
  }
  return `data:application/octet-stream;base64,${btoa(text)}`;
}
