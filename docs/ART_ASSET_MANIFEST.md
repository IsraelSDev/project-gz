# Manifesto de arte e dependências de assets

Registrar cada arte externa ou autoral que entrar no jogo. Licenças devem ser conferidas antes da
distribuição; a ausência de um arquivo de licença no repositório não concede uma licença implícita.

| ID | Estado / arquivo | Origem e autoria | Licença | Versão | Escala e características técnicas |
| --- | --- | --- | --- | --- | --- |
| `planet-terrain` | Implementado proceduralmente em `src/rendering/world/heightField.ts` e `terrain.ts` | Código procedural original do projeto; nenhuma fonte externa | O repositório não declara licença de distribuição | Entrega 1 da Fase 16.2 | Babylon mesh; extensão segue `TerrainSpec`; 100 × 100 células de subdivisão, 10.201 vértices, 20.000 triângulos; altura e vertex color derivados da seed; planalto construível plano; sem texturas |
| `babylon-gltf-loader` | Dependência de runtime `@babylonjs/loaders/glTF` | Babylon.js | Apache-2.0, conforme pacote oficial | 9.30.0 | GLB/glTF; carregamento dinâmico; asset container isolado e descarte controlado; não é arte do jogo |
| `crashed-ship` | `public/assets/ships/crashed-ship.glb` (69.865.172 bytes). Integrado em `src/rendering/world/crashedShip.ts`; fallback procedural preservado | Arquivo enviado pelo usuário. O cabeçalho glTF informa o gerador `Tripo`; autoria, origem detalhada e licença não vieram no arquivo e precisam ser confirmadas antes da distribuição pública | Não informada; confirmar antes de publicar | Substituição do asset na Fase 16.3 (2026-10-13) | GLB 2.0 autocontido; 1.037.826 vértices, 1.959.403 triângulos, uma malha, um material PBR e três texturas incorporadas. Escala original normalizada, extensões locais aproximadas 0,761 × 0,376 × 0,985; em runtime escala 15× e yaw 90°. Sem Draco/Meshopt/KTX2; declara `KHR_materials_volume` e `FB_ngon_encoding` (não requeridas). O carregamento adapta o material à cena; custo geométrico deve ser reavaliado antes da publicação |
| `ship-debris-1` | `public/assets/ships/destrocos-1.glb` (67.317.328 bytes). Integrado na célula `(12, 17)` do mapa em `src/rendering/world/crashedShip.ts` | Arquivo enviado pelo usuário. O cabeçalho glTF informa o gerador `Tripo`; autoria, origem detalhada e licença não vieram no arquivo e precisam ser confirmadas antes da distribuição pública | Não informada; confirmar antes de publicar | Asset adicionado em 2026-10-13 | GLB 2.0 autocontido; 1.015.159 vértices, 1.892.009 triângulos, uma malha, um material PBR e três texturas incorporadas. Escala original normalizada, extensões locais aproximadas 0,941 × 0,400 × 0,973; em runtime escala 6,5×, yaw 0,38 rad. A posição corresponde ao centro da célula `(12, 17)`. Sem Draco/Meshopt/KTX2; declara `KHR_materials_volume` e `FB_ngon_encoding` (não requeridas). |

Os dois GLBs de produção somam cerca de 3,85 milhões de triângulos e 137 MB; o carregamento e o
orçamento de geometria devem ser reavaliados antes da publicação. O script `npm run asset:ship` gera a versão
procedural anterior em `crashed-ship-procedural.glb`, sem sobrescrever o arquivo enviado. Os GLBs mínimos usados nos testes são gerados
em memória por `tests/unit/rendering/minimalGlbFixture.ts` apenas para verificar o loader e a
integração; não são assets de jogo nem arte final. Detalhes da entrega e da validação:
`docs/PHASE16_3_DELIVERY_1.md`.
