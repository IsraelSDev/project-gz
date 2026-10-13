# Fase 16.3 — Entrega 1: nave acidentada (primeiro asset 3D)

## Atualização: GLB enviado pelo usuário (2026-10-13)

O arquivo de produção `public/assets/ships/crashed-ship.glb` foi substituído pelo GLB enviado pelo
usuário. O loader já usa esse caminho; configurei escala 15× e rotação Y de 90° para converter as
dimensões normalizadas do arquivo (eixo longo local Z) ao footprint 16 × 10 do cenário. A posição
vem do cenário e o fallback procedural continua disponível. O teste de integração agora carrega o
arquivo real.

Inspeção do GLB: 20.295.768 bytes, 319.377 vértices, 597.772 triângulos, um material e três imagens
JPEG incorporadas. O metadata registra `Tripo` como gerador; não há autoria ou licença no arquivo.
O modelo excede o orçamento de 10 mil triângulos documentado para a versão anterior, então a
integração funcional não equivale a aprovação de desempenho ou artística. Confirme a licença antes
de distribuir. A origem e licença estão registradas como pendentes em `ART_ASSET_MANIFEST.md`.

**Validação visual desta atualização:** pendente. O GLB é aceito pelo loader no NullEngine e o build
de produção o serve com HTTP 200 e `Content-Length: 20.295.768`, mas a tentativa de captura no Chrome
headless não terminou; portanto não registro aparência WebGL aprovada. As capturas e a inspeção da
seção histórica abaixo são da versão procedural anterior.

`npm run asset:ship` foi redirecionado para `crashed-ship-procedural.glb` para não sobrescrever o
arquivo enviado. Essa saída é apenas a versão procedural anterior, não o modelo de produção.

Os detalhes abaixo documentam a implementação original e as evidências daquela versão; os valores
de geometria, materiais, capturas e testes descritos abaixo não representam o GLB atualmente ativo.

## Resultado

A nave acidentada agora é um modelo GLB original, `public/assets/ships/crashed-ship.glb`, gerado
no Blender a partir de um script versionado (`scripts/blender/crashed_ship.py`). O jogo carrega o
modelo de forma assíncrona e troca a nave procedural por ele. Se o arquivo faltar, falhar ou for
recusado, a nave procedural continua na cena (fallback).

O modelo passou na validação técnica e foi inspecionado no navegador com WebGL (evidências abaixo).
**A aprovação artística final é de quem responde pela direção de arte**: esta entrega não a declara.

## Avaliação do pipeline

1. **Nave anterior.** `createCrashedShip` (`src/rendering/world/crashedShip.ts`), chamada por
   `StaticWorld`. Nó `crashed-ship` no centro do footprint (8 × 5 células = 16 × 10 unidades), sobre
   o relevo, com a rotação do cenário; nariz em -X. Casco "pickable" sem metadados de entidade
   (clicar nele não seleciona nada e ele oculta construções atrás); só o casco projeta sombra; solo
   queimado separado (`ship-ground`). A nave só é refeita se `[terrain, crashedShip]` mudar.
2. **Loader GLB (Fase 16.2).** `loadGlbAsset` importa o plugin glTF sob demanda, carrega num
   `AssetContainer`, respeita `AbortSignal` e cena descartada e libera tudo em `dispose()`.
3. **Ciclo de vida.** O React cria e descarta o renderizador; em dev o StrictMode monta duas vezes.
   O descarte é idempotente em todas as camadas.
4. **Dependência.** `@babylonjs/loaders` 9.30.0 já estava declarada e instalada. Nada adicionado.
5. **Arquivos.** Não havia modelo 3D no repositório. O Blender 5.2.2 LTS está instalado na máquina
   de desenvolvimento e foi usado para produzir o modelo.

## O modelo

**Desenho original:** casco de asa integrada (corpo central elevado que se funde, por uma
concordância suave, a asas finas em crescente), dois motores dorsais, crista dorsal, cabine em gota
de vidro turquesa e veios de energia ciano correndo do corpo para as asas. Casco em ardósia/grafite,
painéis de metal envelhecido mais claros, faixas e pontas laranja.

**Acidente, assimétrico:** nariz amassado e enterrado no monte de terra, inclinação de 5,5° (nariz
para baixo) e 4,5° (lado +Y para baixo); do lado voltado para a câmera inicial a asa foi arrancada (o
pedaço está caído ao lado, com a borda interna enterrada), o motor rasgou e brilha laranja por
dentro, e um rombo no casco expõe costelas e um núcleo incandescente. Há amassados, uma placa
arrancada, a crista entortada e fuligem ao redor dos danos. Detalhes pequenos demais para a câmera
foram evitados; os veios, as faixas e os brilhos foram engrossados depois da primeira inspeção.

**Técnica:** superfícies analíticas (seções em lente unidas por máximo suave, aerofólios,
superfícies de revolução), cortes booleanos para os danos, placas e faixas com espessura,
oclusão ambiente calculada por raios (com o chão) e suavizada entre vértices, gravada em `COLOR_0`
junto com a fuligem. Tudo com sementes fixas: duas execuções geraram o mesmo arquivo (SHA-256
`d186af9f…89230b5`). `npm run asset:ship` regenera o arquivo em cerca de 5 s.

| Item | Valor |
| --- | --- |
| Arquivo | GLB 2.0, 307.060 bytes, sem texturas, sem extensões |
| Geometria | 9.902 triângulos (orçamento: 10 mil) em 9 primitivas, uma por material |
| Materiais | `hull`, `hull-dark`, `plate`, `trim`, `glass`, `glow-cyan`, `glow-hot`, `interior`, `burnt` |
| Extensão | 14,1 × 9,8 × 5,4 unidades, dentro do footprint 16 × 10; a altura é próxima à dos edifícios |
| Eixos | 1 unidade = 1 unidade de mundo; origem no centro do footprint, no chão; nariz em +X no arquivo (o loader inverte o X, então no jogo ele fica em -X, como antes) |
| Proveniência | Script do projeto, executado no Blender sem rede nem arquivos de terceiros. O script foi escrito nesta entrega com auxílio de um assistente de IA (Claude); a geometria sai do código, não de ferramenta de geração 3D por IA |

## Integração

- **Procedural primeiro, sem bloquear.** A nave procedural aparece na hora; o GLB carrega em
  paralelo. Só depois de os materiais do modelo compilarem é que o casco procedural sai e o modelo
  entra (sem isso a cena ficava sem nave por alguns segundos). O solo queimado e os destroços
  procedurais continuam.
- **Materiais na cena (novo).** A cena é toda `StandardMaterial` e não tem mapa de ambiente. Nela o
  PBR do GLB deixava o grafite marrom e chapado (verificado no navegador, alternando os dois).
  `adaptGlbMaterialsToScene` (`src/rendering/assets/glbMaterials.ts`) troca cada material PBR por um
  `StandardMaterial` equivalente (cores convertidas de linear para sRGB, brilho especular pela
  rugosidade), converte `COLOR_0` para o mesmo espaço e desliga o alfa por vértice quando ele é todo 1.
  Esse último ponto corrige um defeito achado na validação: o loader marca alfa por vértice sempre
  que `COLOR_0` tem 4 componentes, e com `StandardMaterial` isso mandava o casco para o passe
  transparente, cobrindo veios, faixas, crista e núcleo. Decisão registrada como D-74.
- **Recusa e fallback.** Modelo sem malha, com materiais que não compilam ou com comprimento fora de
  8–24 unidades é recusado (`console.warn`) e a nave procedural fica. Arquivo ausente ou inválido
  gera `console.info` e mantém a procedural.
- **Seleção e sombras.** Malhas do modelo "pickable", sem metadados de entidade, como o casco
  procedural; recebem e projetam sombra.
- **Ciclo de vida.** O descarte cancela o carregamento, libera o GLB (malhas, materiais originais,
  geometrias), os materiais adaptados e as projetoras de sombra, sem tocar nos materiais
  compartilhados. Recriar a nave não a duplica. O nó do glTF se chama `crashed-ship-model`, para não
  se confundir com o nó `crashed-ship` que o jogo cria.
- `GameState`, economia, construção, simulação, salvamento e regras não foram tocados; posição,
  orientação e footprint da nave são os do cenário.

## Arquivos alterados

- `scripts/blender/crashed_ship.py` (novo): fonte do modelo.
- `scripts/build-ship-asset.mjs` (novo) e `package.json`: script `asset:ship`, que acha o Blender
  (`BLENDER_PATH`, `PATH` ou instalação padrão) e gera o GLB.
- `public/assets/ships/crashed-ship.glb` (novo): o asset.
- `src/rendering/world/crashedShip.ts`: carregamento, validação, troca e descarte do modelo.
- `src/rendering/assets/glbMaterials.ts` (novo): adaptação dos materiais à cena.
- `vite.config.ts`: `assetsInclude` para `.glb` (o teste do asset importa o arquivo com `?inline`).
- Testes: `crashedShip.test.ts` (14), `crashedShipAsset.test.ts` (5), `glbMaterials.test.ts` (5),
  `minimalGlbFixture.ts` (GLBs mínimos em memória) e `glbAsset.test.ts` (passou a usar a fixture).
- Documentos: este arquivo, `ART_ASSET_MANIFEST.md`, `DECISIONS.md` (D-74) e as capturas em
  `docs/evidence/phase16_3/`.

## Validação

### `npm run validate`

- Typecheck, ESLint e Prettier: passaram.
- Testes: 56 arquivos e 803 testes passaram. O teste do asset confere o GLB versionado: formato,
  ausência de compressões e arquivos externos, 9.902 ≤ 10 mil triângulos, materiais, `COLOR_0`, e,
  carregado na integração, que ele é aceito, cabe no footprint, se apoia no chão, tem o nariz em -X
  e não fica no passe transparente.
- Build: passou. Bundle principal 1.273,04 kB (326,63 kB gzip); plugin glTF em chunk próprio de
  801,78 kB (187,30 kB gzip), carregado sob demanda. O GLB vai para `dist/assets/ships/`.

### Navegador com WebGL

Navegador embutido do aplicativo (WebGL2, ANGLE/Direct3D 11, NVIDIA RTX 3060 Ti), janela de
1280 × 720, cenário padrão pausado no tick 0 (seed 7241).

| Verificação | Resultado |
| --- | --- |
| Câmera inicial e visão geral | Nave legível: silhueta de arraia, cabine e veios ciano, crista e pontas laranja, rombo brilhando. Colônia continua legível (`1-camera-inicial.jpg`, `2-visao-geral.jpg`) |
| Escala e integração | Comprimento e altura coerentes com habitat, extrator e painéis; nariz no monte de terra, casco sobre o solo queimado, pedaço da asa no chão sem invadir células vizinhas (`4-perto-sudoeste.jpg`, `6-perto-sudeste.jpg`) |
| Materiais | Grafite/ardósia coerente com a luz da cena depois da adaptação a `StandardMaterial` |
| Duplicação e recursos | 1 engine, 1 nó `crashed-ship`, 1 modelo, casco procedural removido, nenhuma malha com alfa por vértice, 9.902 triângulos na cena, inclusive com o StrictMode montando duas vezes |
| Seleção | Clicar no habitat seleciona; clicar na nave limpa a seleção |
| Fallback | Com o arquivo renomeado, a nave procedural volta, sem materiais PBR nem adaptados na cena (`7-fallback-procedural.jpg`); com o arquivo restaurado, o modelo volta |
| Build de produção | `vite preview`: o GLB carrega de `./assets/ships/crashed-ship.glb` (200), sem erros no console |

### Limitações

- **Desempenho não medido.** O painel do navegador ficou oculto em parte da sessão (o
  `requestAnimationFrame` é limitado) e o contador de FPS não é confiável aqui.
- No zoom máximo, a autossombra do modelo mostra serrilhado do mapa de sombras da cena (2048, PCF
  baixo). Na câmera inicial ele não aparece. A configuração de sombras não foi alterada.
- Um navegador e uma janela; sem teste em janela estreita, outros navegadores ou dispositivos.
- Vazamento de recursos verificado por inventário (testes e consulta à cena), não por perfil de
  memória ao longo de muitas reinicializações.
- Os materiais do arquivo continuam PBR padrão; outro visualizador glTF mostrará o modelo com o PBR,
  não com a adaptação do jogo.

## Próximo passo

1. Revisão artística humana da nave na câmera do jogo (capturas acima). Ajustes de forma, cor ou
   dano são feitos no script e regenerados com `npm run asset:ship`.
2. Medir quadros, triângulos e memória antes e depois, com hardware e navegador registrados.
3. Se o projeto adotar iluminação PBR com mapa de ambiente, rever `adaptGlbMaterialsToScene` (D-74).
4. Manter a nave procedural como fallback.
