# REGISTRO DE DECISÕES

## Projeto: Civilização Alienígena — versão 0.2

Este arquivo registra as decisões tomadas na revisão da Fase 0 (ver `REVIEW.md`) e **em qual fase cada uma deve ser implementada**. Os detalhes técnicos estão em `TECHNICAL_ARCHITECTURE.md`; as regras de design, em `GAME_DESIGN.md`.

Convenção: **Fase** refere-se ao `ROADMAP.md` (desenvolvimento). **Era** refere-se à progressão do jogo no GDD.

---

## 1. Decisões adotadas

| ID | Decisão | Implementar na | Referência |
| --- | --- | --- | --- |
| D-01 | Gerenciador de pacotes: **npm**; `package-lock.json` versionado; instalação via `npm ci`. | Fase 1 | Arquitetura §2 |
| D-02 | Git local, **sem remoto** por enquanto. | Fase 1 | README |
| D-03 | Documentação em `docs/`. | Fase 1 | README |
| D-04 | Slug provisório do pacote: `alien-civilization` (o nome do jogo segue em aberto). | Fase 1 | GDD §12 |
| D-05 | Alias `@/` → `src/`, configurado em `tsconfig.app.json` e no Vite (compartilhado com o Vitest). | Fase 1 | Arquitetura §2, §15 |
| D-06 | Node 24 LTS recomendado (`.nvmrc`); mínimo `^22.13`. TypeScript fixado em `~6.0.x` enquanto o `typescript-eslint` declarar peer `typescript <6.1.0` (verificado em 2026-10-12). Versões efetivas: `package-lock.json`. | Fase 1 | Arquitetura §2 |
| D-07 | O `GameState` mínimo e somente leitura (`schemaVersion`, `tick`, `resources`, `buildings` com IDs estáveis) é criado **antes** da integração entre seleção 3D e interface. A cena renderiza a partir dele. | Fase 2 | Arquitetura §5.1 |
| D-08 | A barra de recursos lê **somente** do snapshot do `GameController`. Sem valores copiados no estado do React nem valores de demonstração. | Fase 3 | Arquitetura §11 |
| D-09 | Seleção é **estado de sessão de UI** (`src/session/`), não faz parte do `GameState`, não é persistida e não é um comando de domínio. | Fase 3 | Arquitetura §5.3 |
| D-10 | Comandos de **controle** (pausar, retomar, velocidade) e de **simulação** (construir, resolver evento) têm regras distintas, inclusive com o jogo pausado. | Fase 4 | Arquitetura §7 |
| D-11 | `paused` e `speed` pertencem ao `SimulationClock`, não ao `GameState`. Toda partida carregada começa pausada. | Fase 4 | Arquitetura §5.2 |
| D-12 | Renderização em `src/rendering/`, **fora** de `src/game/`. Regras de dependência entre camadas aplicadas por ESLint. | Fase 1 (regras) / Fase 2 (uso) | Arquitetura §3.6 |
| D-13 | Determinismo: passo fixo de simulação; estado do PRNG (`rng`) dentro do `GameState`; IDs por contador (`nextEntityId`); `Math.random`, `Date.now` e `performance.now` proibidos no domínio. | Fase 4 (relógio, IDs) / Fase 7 (PRNG) | Arquitetura §6.3 |
| D-14 | Quantidades de recursos como **inteiros em unidades escaladas** (sem ponto flutuante no domínio econômico); piso em zero. Revisável por ADR no início da Fase 5 se os testes mostrarem inadequação. | Fase 5 | Arquitetura §6.4 |
| D-15 | Aba em segundo plano: limite de passos de recuperação (*catch-up*) por quadro e pausa automática quando a aba fica oculta. | Fase 4 | Arquitetura §6.2 |
| D-16 | Posicionamento: grid discreto 2D no domínio, rotação em passos de 90°, área construível plana e limitada. A conversão para o espaço do Babylon fica em um único módulo. | Fase 2 (posições do cenário) / Fase 6 (validação) | Arquitetura §9 |
| D-17 | `SaveProvider` **assíncrono** (porta em `game/application`, implementação em `platform/storage`); versão do esquema, migrações em cadeia, versão do conteúdo, validação de chaves contra o conteúdo, escrita sem corromper o estado ativo. | Fase 8 | Arquitetura §10 |
| D-18 | A população entra na Fase 9 por **migração de esquema v1→v2 com teste**, o que também valida a estratégia de versionamento. | Fase 9 | Roadmap Fase 9 |
| D-19 | Testes: domínio em ambiente Node; Babylon headless com `NullEngine` (smoke já na Fase 1); React Testing Library + jsdom entram na Fase 3, junto do primeiro componente testável. | Fase 1 / Fase 3 | Arquitetura §13 |
| D-20 | Erros esperados de validação retornam `Result` com código de erro (união de literais); a UI traduz o código em texto. | Fase 4 / Fase 6 | Arquitetura §14 |
| D-21 | Ponte domínio → React por store próprio com `useSyncExternalStore`, snapshots imutáveis e seletores. Sem biblioteca de estado. | Fase 3 | Arquitetura §11 |
| D-22 | Ciclo de vida do Babylon: `dispose` idempotente, StrictMode mantido, tratamento de HMR e de perda de contexto WebGL. | Fase 2 | Arquitetura §12 |
| D-23 | Terminologia: o GDD usa **Era** para a progressão do jogo; o Roadmap mantém **Fase** para o desenvolvimento. | Já aplicada | GDD §7 |
| D-24 | **Câmera (resolve P-01):** `ArcRotateCamera` em perspectiva (FOV ≈ 40°), com controles nativos do Babylon.js. Inclinação limitada a ≈14°–64° de elevação; zoom com mínimo e máximo; pan no plano do terreno, limitado ao redor do acampamento; a câmera nunca fica abaixo do terreno; enquadramento inicial calculado a partir da área construível e da proporção da janela. **Controles:** botão esquerdo gira; botão direito (ou `Ctrl` + esquerdo) move; roda do mouse e pinça do trackpad dão zoom; teclado com o canvas focado: **`W/A/S/D` movem** (ver D-34), setas giram, `Ctrl` + setas movem, `+`/`-` ou `Alt` + setas dão zoom. | Fase 2 (feita) | Arquitetura §17.3 |
| D-25 | A **nave acidentada** é um elemento de cenário (landmark) definido em `ScenarioDefinition`, **fora** do `GameState`: é imutável na Fase 2. Passa para o estado quando houver reparo ou recuperação de componentes (Era 1 / Fase 11). | Fase 2 (feita) | `game/content/scenario.ts` |
| D-26 | **Contrato de renderização:** `WorldSnapshot` é definido em `rendering/` e montado só em `app/` (`worldSnapshot.ts`) a partir do `GameState` e do cenário. O renderizador sincroniza os edifícios por `instanceId` (cria, atualiza ou remove); o terreno e a nave são refeitos apenas se os dados do cenário mudarem. | Fase 2 (feita) | Arquitetura §17.1 |
| D-27 | A matemática e os tipos do grid ficam em `src/shared/grid/` (usados por `domain`, `content` e `rendering`), porque `rendering/` só pode importar **tipos** de `domain`. Uma posição é a célula de menor x e menor y do retângulo ocupado, já rotacionado. | Fase 2 (feita) | Arquitetura §9 |
| D-28 | **Coordenadas e orientação:** grid com x para leste e y para o sul; no Babylon.js, norte = +Z; rotação horária vista de cima; modelos com a frente para o sul (-Z) em rotação 0. A conversão existe só em `rendering/world/gridToWorld.ts` e a convenção de rotação é testada contra a matemática do Babylon.js. | Fase 2 (feita) | Arquitetura §9 |
| D-29 | O cenário visual (terreno, vegetação, destroços) é gerado de forma **determinística** a partir da semente do cenário, com ruído e PRNG próprios da renderização (não são o PRNG do domínio, P-07). Props usam cor por vértice, um material compartilhado e thin instances; **sem arquivos externos**. | Fase 2 (feita) | `rendering/world/noise.ts` |
| D-30 | **HMR:** `GameRenderer.ts` é o limite de atualização de `rendering/`: libera os renderizadores antigos e **recarrega a página** (o React Refresh não recria a engine sozinho e deixaria a cena velha rodando). Mudanças de **conteúdo** atualizam a cena ao vivo (o `App` recalcula o snapshot e o `sync` faz o diff). | Fase 2 (feita) | `GameRenderer.ts`, `App.tsx` |
| D-31 | `createGameRenderer` **não lança** em falha de inicialização: registra o erro, chama `onStatusChange('failed')` e devolve `null`; a perda de contexto vira `context-lost` e a restauração volta a `running`. A interface mostra um aviso (`role="alert"`). | Fase 2 (feita) | Arquitetura §12 |
| D-32 | **Indicador de FPS e tempo de quadro** só em desenvolvimento (`import.meta.env.DEV`), atualizado a cada 500 ms (sem atualização do React por quadro) e ausente do build de produção. O log `[renderer] criado/descartado` também é só de desenvolvimento. | Fase 2 (feita) | `DevStatsOverlay.tsx` |
| D-33 | **Build:** `chunkSizeWarningLimit` de 1400 kB, justificado no `vite.config.ts` (núcleo do Babylon.js ≈ 1,3 MB, ≈ 320 kB com gzip). Separar o Babylon em chunk próprio foi testado e **rejeitado**: piorou o tamanho inicial (1,69 MB) ao arrastar os chunks sob demanda. | Fase 2 (feita) | `vite.config.ts` |
| D-34 | **Navegação por `W/A/S/D`** (pedido pós-Fase 2): pan no plano do terreno, relativo à direção da câmera (frente, esquerda, trás, direita), usando só o teclado e o mapa de entrada **nativos** do Babylon.js (as teclas entram nas listas de direção e uma entrada de mapa as liga ao pan; não afeta setas, `Ctrl` nem `Alt`). Velocidade **proporcional ao raio da câmera** (≈ 14 unidades/s à frente e ≈ 17 para os lados no enquadramento inicial; ≈ 5 de perto e ≈ 27 de longe), sempre dentro do limite de pan. O canvas é **focado ao abrir** para as teclas funcionarem sem clique prévio. Limitação: lê `keyCode` (o caractere), não a posição física da tecla. | Feita | `cameraRig.ts`, `GameCanvas.tsx` |

---

## 2. Pendências (decidir na fase indicada, não antes)

| ID | Pendência | Decidir até |
| --- | --- | --- |
| P-01 | ~~Câmera~~ **Resolvida na Fase 2:** ver D-24. | — |
| P-02 | **Parcial.** Feito: indicador de FPS em dev (D-32). Pendente: hardware-alvo, matriz de navegadores (WebGL2) e **medição real de FPS** nessa máquina. Linha de base da cena (medida em `NullEngine`, não é FPS): ≈ 199 mil triângulos, 24 meshes, 6 chamadas instanciadas (≈ 456 instâncias), 12 materiais, 2 luzes e 1 mapa de sombra de 2048. Se o FPS for insuficiente: limitar a escala de renderização em telas de alta densidade (DPR), reduzir sombras ou a densidade do cenário. | Antes da Fase 3 ou quando houver hardware-alvo |
| P-03 | Smoke test E2E com WebGL real (Playwright) ou verificação manual. Na Fase 2 a verificação foi **manual** (roteiro no relatório da fase); decidir se vale automatizar. | Fim da Fase 3 |
| P-04 | Duração de um tick em tempo de jogo e velocidades disponíveis. | Início da Fase 4 |
| P-05 | Biblioteca ou validador manual para validar dados carregados e conteúdo. | Início da Fase 8 (conteúdo: Fase 6) |
| P-06 | Slots de salvamento, autosave e exportação/importação de arquivo. | Fase 8 |
| P-07 | Algoritmo do PRNG. | Início da Fase 7 |
| P-08 | Condições de sucesso e fracasso do objetivo "estabilizar o acampamento" (métrica e limiar). | Antes da Fase 9 |
| P-09 | Pipeline de ativos (formato, origem) e registro de licenças. | Quando o primeiro ativo externo for necessário |
| P-10 | Idioma(s) do jogo e estratégia de textos (i18n). | Antes da Fase 7 (primeiro texto de evento) |
| P-11 | Remoto Git e CI. | Quando houver necessidade de compartilhar o código |
| P-12 | Acessibilidade (teclado, contraste, daltonismo): requisitos mínimos antes da Fase 12. | Fase 3 (interface) |
| P-13 | Empacotamento desktop: Electron ou Tauri (suporte a WebGL varia no WebView do sistema). | Fase 12 |
| P-14 | **Pan com o botão direito do mouse não foi verificado com entrada real** (a ferramenta de automação não arrasta com o botão direito). Verificados: pan por teclado (`Ctrl` + setas) e, numericamente, a escala do pan por ponteiro (sensibilidade 100 ≈ 1:1 no enquadramento inicial). Confirmar a sensação com um mouse real e ajustar `panningSensibility` se preciso. | Início da Fase 3 |
| P-15 | Enquadramento inicial é calculado só na primeira sincronização: redimensionar a janela depois não reenquadra (comportamento intencional); decidir se um botão "reenquadrar" é desejável quando houver interface (Fase 3). | Fase 3 |
