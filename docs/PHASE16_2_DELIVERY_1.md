# Fase 16.2 — Entrega 1: terreno e pipeline GLB

## Escopo

Entrega incremental para enriquecer o terreno procedural e preparar o carregamento do primeiro
modelo externo. Esta etapa não substitui a nave, edifícios, props ou unidades; as representações
procedurais existentes continuam em uso.

## Mudanças

- Terreno combina colinas amplas e cristas determinísticas; cores por vértice acrescentam manchas
  minerais, veios ligados ao relevo e transição mais suave junto ao planalto.
- A grade permanece em 100 × 100 subdivisões (10.201 vértices e 20.000 triângulos). O campo de
  altura continua zerado dentro da área construível.
- Adicionados `loadGlbAsset` e `loadGlbAssetWithFallback`, que importam o plugin glTF sob demanda, respeitam o base path do Vite por
  `resolvePublicAssetUrl`, carrega o arquivo num `AssetContainer`, detecta cancelamento/cena
  descartada e fornece descarte idempotente.
- A função de carregamento rejeita falhas sem manter recursos importados na cena; o wrapper executa
  a fábrica de fallback procedural em falha de asset e fornece descarte idempotente. Cancelamento e
  cena já descartada continuam rejeitando, sem construir uma maquete órfã. Nenhum ponto de produção
  invoca o carregador nesta entrega; a integração da nave pertence à Entrega 2.
- A dependência oficial `@babylonjs/loaders` está fixada na série 9.30, compatível com Babylon.js
  Core 9.30, com licença Apache-2.0. A importação dinâmica evita incluir o plugin no bundle inicial.

## Validação executada

- Base antes da alteração: `npm run validate` passou com 52 arquivos de teste e 763 testes; build
  principal de 1.405,78 kB minificados (359,76 kB gzip), 5,78 kB acima do limite configurado.
- Validação final: typecheck, lint e formatação passaram; 53 arquivos de teste e 768 testes passaram;
  build de produção passou.
- Bundle principal medido em 1.405,99 kB minificados / 359,88 kB gzip, variação de +0,21 kB / +0,12
  kB sobre a base. Não saiu um chunk do loader neste build porque ainda não há callsite de produção;
  o plugin é importado dinamicamente quando o loader for chamado.
- A validação visual desktop continua pendente: o Edge instalado não expôs a sessão de depuração
  headful neste ambiente, e a tentativa headless terminou com a falha do processo GPU antes da
  captura. `NullEngine` serve apenas aos testes funcionais e não substitui a revisão WebGL.

## Aceite e limites

- Confirmados por teste: dimensão da malha mantida, saída determinística para a mesma seed, mudança
  de aparência com outra seed e altura zero nos vértices do planalto construível.
- O carregador ainda não substitui nenhum modelo do jogo e não demonstra renderização visual de um
  asset de produção. A nave procedural permanece intacta até haver um GLB autoral revisado.
- A aparência revisada do terreno precisa de inspeção visual real em navegador/WebGL antes de ser
  considerada aprovada.
