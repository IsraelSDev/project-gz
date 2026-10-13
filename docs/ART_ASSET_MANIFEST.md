# Manifesto de arte e dependências de assets

Registrar cada arte externa ou autoral que entrar no jogo. Licenças devem ser conferidas antes da
distribuição; a ausência de um arquivo de licença no repositório não concede uma licença implícita.

| ID | Estado / arquivo | Origem e autoria | Licença | Versão | Escala e características técnicas |
| --- | --- | --- | --- | --- | --- |
| `planet-terrain` | Implementado proceduralmente em `src/rendering/world/heightField.ts` e `terrain.ts` | Código procedural original do projeto; nenhuma fonte externa | O repositório não declara licença de distribuição | Entrega 1 da Fase 16.2 | Babylon mesh; extensão segue `TerrainSpec`; 100 × 100 células de subdivisão, 10.201 vértices, 20.000 triângulos; altura e vertex color derivados da seed; planalto construível plano; sem texturas |
| `babylon-gltf-loader` | Dependência de runtime `@babylonjs/loaders/glTF` | Babylon.js | Apache-2.0, conforme pacote oficial | 9.30.0 | GLB/glTF; carregamento dinâmico; asset container isolado e descarte controlado; não é arte do jogo |
| `crashed-ship` | Pendente; ainda usa `src/rendering/world/crashedShip.ts` | Próximo modelo deverá ser autoral, com origem/ferramenta registradas na incorporação | Pendente, não há arquivo externo incorporado | Pendente | Contrato atual da cena/grid deve ser medido e registrado com o modelo; alvo sugerido até 10 mil triângulos ainda não medido |

Não há arquivos GLB de produção nesta entrega. O GLB mínimo usado nos testes é gerado dentro do
arquivo de teste apenas para verificar o loader; não é asset de jogo nem arte final.
