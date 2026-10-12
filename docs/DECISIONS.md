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

---

## 2. Pendências (decidir na fase indicada, não antes)

| ID | Pendência | Decidir até |
| --- | --- | --- |
| P-01 | Câmera: perspectiva com ângulo vertical limitado (proposta) ou ortográfica? Incluir pan? | Início da Fase 2 |
| P-02 | Contador de frame time em modo dev e hardware-alvo/matriz de navegadores (WebGL2). | Fase 2 |
| P-03 | Smoke test E2E com WebGL real (Playwright) ou verificação manual. | Fim da Fase 2 |
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
