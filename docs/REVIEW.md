# REVISÃO DA FASE 0 — Análise dos documentos e proposta da Fase 1

**Data:** 2026-10-12
**Documentos analisados:** `GAME_DESIGN.md`, `TECHNICAL_ARCHITECTURE.md`, `ROADMAP.md` (versão 0.1)
**Status:** documento histórico da revisão da Fase 0. As decisões da seção 2 foram aprovadas (npm, Git local, `docs/`, slug `alien-civilization`, alias `@/`) e os ajustes arquiteturais foram aplicados em `GAME_DESIGN.md`, `TECHNICAL_ARCHITECTURE.md` e `ROADMAP.md` (versão 0.2). O que ficou para cada fase está em `DECISIONS.md`. Os itens 8–25 que não foram aplicados nos documentos permanecem como pendências ou decisões registradas ali; as seções abaixo refletem o estado no momento da revisão.

Legenda: **Fato** = verificado (arquivos ou registry npm em 2026-10-12). **Proposta** = recomendação, sujeita à sua decisão.

---

## 1. Inconsistências e conflitos

### Bloqueantes (afetam o desenho antes da Fase 3 ou 4)

1. **Ordem das fases contradiz a arquitetura.**
   - A Fase 3 (seleção) exige "IDs de domínio" e uma barra de recursos.
   - O modelo de estado só nasce na Fase 4, e a economia na Fase 5.
   - A Fase 2 já posiciona construções, sem entidade de domínio.
   - O GDD (MVP, item 7) e a arquitetura exigem "estado independente da cena" desde o início.
   - Risco: a cena nascer acoplada e ser retrabalhada depois.
   - **Proposta:** antecipar um GameState mínimo e somente leitura, com `BuildingInstance` e IDs, para a Fase 2/3. O relógio e o controlador continuam na Fase 4.

2. **A barra de recursos viola dois critérios.**
   - A Fase 3 cria a barra, e o MVP a descreve com "dados de demonstração".
   - O GDD proíbe "controles falsos". A Fase 5 exige exibir "estado real, não valores duplicados".
   - **Proposta:** a barra da Fase 3 lê do GameState mínimo, com valores iniciais vindos do conteúdo. Nada hardcoded na UI.

3. **Comandos: aplicação imediata ou fila por tick?**
   - A arquitetura §7 diz que o controlador valida e altera o domínio imediatamente.
   - O §6 diz "processar comandos pendentes" dentro do tick.
   - O GDD quer "pausar, planejar e avançar", ou seja, construir com o jogo pausado. Se comandos só rodam no tick, eles travam durante a pausa.
   - **Proposta:** dois tipos de comando.
     - Comandos de controle (pausar, velocidade) vão direto ao relógio.
     - Comandos de simulação (`PlaceBuilding`, `ResolveEvent`) são validados na hora e aplicados no próximo passo, ou imediatamente quando pausado, por regra explícita.

4. **`SelectEntity` está listado como comando que altera estado.** Seleção é estado de UI, não de domínio, e não deve ser salva nem entrar no GameState.
   - **Proposta:** um store de sessão/UI separado. A Fase 3 acontece antes do controlador existir, então esse store precisa ser definido já nela.

5. **Fase 8 (save) antes da Fase 9 (população).**
   - O `GameState` do exemplo já tem `PopulationState`, mas a população só entra na Fase 9.
   - Isso força migração de schema logo após criar o save.
   - **Proposta:** mover a população mínima para antes do save, ou aceitar explicitamente a migração v1→v2 como teste da estratégia de versionamento.

6. **Fase 9 exige vitória/derrota e tutorial.**
   - O GDD §12 lista condições de vitória/derrota como questão em aberto.
   - O MVP do GDD não inclui tutorial, alertas nem desfecho.
   - **Proposta:** definir no GDD o objetivo "estabilizar o acampamento" (métrica e limiar) antes da Fase 9, e alinhar a lista do MVP.

7. **"Fase" tem dois significados.** O GDD tem Fases 1–6 (progressão do jogo) e o Roadmap tem Fases 0–12 (desenvolvimento). A "Fase 1" do GDD é Sobrevivência e a do Roadmap é estrutura do projeto.
   - **Proposta:** chamar as do GDD de "Eras" e as do Roadmap de "Marcos" (M0–M12), ou similar.

### Importantes

8. **Determinismo incompleto.**
   - O GDD exige resultados determinísticos, mas só há `randomSeed` no estado. O estado do PRNG (`rngState`) precisa ser salvo, não só a seed.
   - É preciso proibir `Math.random`, `Date.now` e `performance.now` no domínio. O ESLint pode barrar isso.
   - Faltam IDs determinísticos (contador `nextEntityId` no estado) em vez de UUID aleatório.
   - Faltam a duração de um tick em tempo de jogo e a política de números: inteiros em unidades escaladas ou float.
   - Faltam regras para aba em background e `requestAnimationFrame` pausado: limitar o catch-up de ticks e/ou pausar automaticamente.

9. **Ordem produção → consumo.** Depende da ordem e permite estoque negativo. Falta definir o piso em zero, a política de falta de recursos e o arredondamento.

10. **`paused` está no GameState, mas falta `speed`.** Definir se o relógio faz parte do estado salvo. **Proposta:** carregar sempre pausado.

11. **Estrutura de pastas vs. regra de camadas.**
    - A arquitetura classifica Babylon como apresentação, mas coloca `rendering/` dentro de `game/`, ao lado do domínio.
    - **Proposta:** `src/rendering/` fora de `game/`, com `no-restricted-imports` do ESLint proibindo React, Babylon e DOM em `game/domain`.

12. **Ponte domínio → React não especificada.**
    - Falta definir como o estado chega à UI. A 60 ticks/s, um re-render completo da árvore é um risco.
    - **Proposta:** store próprio com `useSyncExternalStore`, snapshots imutáveis e seletores. Sem Zustand, coerente com "não adicionar dependências".

13. **Recursos como `Record<string, number>`.**
    - Perde a tipagem.
    - Com `JSON.parse` de save não confiável, chaves como `__proto__` são um vetor de prototype pollution.
    - **Proposta:** IDs tipados a partir do conteúdo (`as const`) e validação das chaves contra as definições.

14. **Modelo espacial ausente.**
    - A Fase 6 fala em ocupação e colisão, e o contrato tem `footprint`, mas não há grid vs. posicionamento livre, convenção de coordenadas nem rotação discreta.
    - O terreno "com relevo" conflita com construir em área plana.
    - **Proposta:** grid discreto no domínio, rotação em passos de 90° e área construível plana no início. A conversão para o sistema do Babylon (esquerdo, Y para cima) fica em um único lugar.

15. **Câmera.** "Isométrica livre" é ambíguo (ortográfica ou perspectiva?), e o pan não está listado.
    - **Proposta:** `ArcRotateCamera` em perspectiva, com ângulo vertical limitado, e pan incluído na Fase 2.

16. **SaveProvider síncrono não escala.** `localStorage` tem limite (~5 MB) e o desktop pode trocar de backend.
    - **Proposta:** interface assíncrona (`Promise`) desde o início.
    - Faltam também estratégia de migração em cadeia, versão do conteúdo no save (remoção de `definitionId`), slots/autosave e limite do log de eventos.

17. **Testes de integração sem ferramenta.**
    - "Seleção 3D atualiza painel React" e "desmontar libera recursos" exigem DOM e WebGL.
    - Vitest em jsdom não tem WebGL. O `NullEngine` do Babylon serve para o headless, mas não cobre o render real.
    - Falta definir React Testing Library (Fase 3) e se haverá Playwright para um smoke test com WebGL.

18. **Ciclo de vida no React.** O StrictMode executa efeitos duas vezes em desenvolvimento, e o HMR do Vite também recria a engine.
    - O critério "sem inicializações duplicadas" só se cumpre com `dispose` idempotente, sem remover o StrictMode.
    - Falta também tratar a perda de contexto WebGL.

19. **Medição de performance só na Fase 12.** O GDD e a arquitetura exigem medir antes de escalar.
    - **Proposta:** um contador de frame time só em modo dev já na Fase 2, e um hardware-alvo e matriz de navegadores (WebGL2) definidos cedo.

### Menores

20. O pilar 7 do GDD ("acessibilidade técnica") não é acessibilidade de verdade. Teclado, contraste e daltonismo só aparecem na Fase 12, e idiomas/i18n não são mencionados (o texto de eventos é dado de conteúdo).
21. Faltam o pipeline de ativos (glTF?) e o registro de licenças. O GDD exige conteúdo original, mas não define como controlar assets de terceiros.
22. O modelo de erro está indefinido. A Fase 6 exige "feedback claro", e a validação aparece duplicada (controlador e domínio).
    - **Proposta:** funções de domínio retornam `Result` com códigos de erro, mapeados para texto na UI.
23. O Roadmap menciona "Claude Sonnet" no corpo. Convém mover o modelo de trabalho para um `CLAUDE.md` ou CONTRIBUTING.
24. Não há CI e o diretório do projeto **não é um repositório Git** (verificado). Falta definir onde o remoto ficará (nenhum foi assumido).
25. A estratégia de empacotamento desktop precisa considerar que Tauri usa WebView do sistema, e o suporte a WebGL varia entre plataformas.

---

## 2. Decisões necessárias para iniciar a Fase 1

| # | Decisão | Recomendação |
|---|---------|--------------|
| 1 | Gerenciador de pacotes | npm (padrão, já instalado) |
| 2 | Remoto Git | `git init` local por enquanto, a menos que já exista um repositório a conectar |
| 3 | Mover os 3 `.md` para `docs/` | Sim (opcional) |
| 4 | Nome do pacote (`package.json`) | Slug de trabalho, já que o nome do jogo está em aberto |
| 5 | Alias `@/` → `src/` | Sim: evita `../../..` entre camadas e facilita regras de importação, ao custo de configuração duplicada (tsconfig + Vite) |

**Respostas:** _(preencher)_

---

## 3. Estrutura proposta para a Fase 1

### Ambiente e versões (fatos verificados)

- Node local: v24.21.0, npm 11.19.0, Git 2.55.0.
- Registry npm em 2026-10-12: Vite 8.3.4, `@vitejs/plugin-react` 6.1.2 (peer `vite ^8`), React 19.3.0, Vitest 5.0.4, ESLint 10.12.0, `typescript-eslint` 8.71.1, Prettier 3.9.10, `@babylonjs/core` 9.30.0.
- Engines: Vite e plugin-react `^20.19 || >=22.12`; ESLint `^20.19 || ^22.13 || >=24`; Vitest 5 `^22.12 || ^24 || >=26`. Node 24 atende a todos.
- **`typescript-eslint` 8.71.1 declara peer `typescript <6.1.0`, e o `latest` do TypeScript é a 7.0.2.** Uma instalação sem pin quebraria o lint.
- **Proposta:** fixar TypeScript em `~6.0.3` até o `typescript-eslint` suportar a 7.x.

### Árvore

```text
.
├── .gitignore
├── .nvmrc                  # 24
├── .prettierrc.json
├── eslint.config.js        # flat config: typescript-eslint, react-hooks, react-refresh, prettier
├── index.html
├── package.json            # private, engines.node, scripts
├── package-lock.json       # versionado (instalação reproduzível, via npm ci)
├── tsconfig.json           # project references
├── tsconfig.app.json       # strict + noUncheckedIndexedAccess + alias @/
├── tsconfig.node.json      # vite.config.ts
├── vite.config.ts          # React plugin + bloco `test` do Vitest
├── README.md               # requisitos (Node 24), comandos, estrutura
├── docs/                   # REVIEW.md (+ os 3 documentos, se aprovado) e decisões/ADRs
├── src/
│   ├── main.tsx
│   ├── vite-env.d.ts
│   └── app/
│       ├── App.tsx         # página mínima, SEM canvas nem lógica de jogo
│       └── app.css
└── tests/
    └── unit/
        ├── smoke.test.ts
        └── babylon-headless.test.ts
```

### Detalhes

- **Sem pastas vazias.** `game/`, `rendering/`, `platform/` e as demais só são criadas quando o código existir.
- **Babylon na Fase 1.** Instalar `@babylonjs/core` e validar com um teste headless que cria e descarta um `NullEngine`. O canvas é da Fase 2.
- **Scripts:** `dev`, `build` (`tsc -b && vite build`), `preview`, `typecheck`, `lint`, `format`, `format:check`, `test`, `test:watch` e `validate` (typecheck, lint, format:check, test e build em sequência).
- **ESLint:** inclui desde já `no-restricted-imports` para `src/game/domain/**`, sem arquivos ainda. Fica inativo até a Fase 4, e isso será avisado no README.
- **Dependências de runtime:** `react`, `react-dom` e `@babylonjs/core`. Nada além disso.
- **Segurança:** lockfile versionado, `engines` definido, `npm ci` nas instruções e `npm audit` como verificação manual. Nenhum segredo ou `.env` é necessário.

### Critérios de aceite da Fase 1 e verificação

| Critério (Roadmap) | Como será verificado |
|--------------------|----------------------|
| Instalação reproduzível | `npm ci` em diretório limpo |
| Aplicação inicia localmente | `npm run dev` e conferência no navegador embutido |
| Teste de exemplo passa | `npm test` |
| Typecheck, lint e build passam | `npm run typecheck`, `npm run lint`, `npm run build` (saída real reportada) |
| Nenhuma funcionalidade de jogo | Revisão do diff |

---

## 4. Pendências de aprovação

- **Ajustes aos documentos:** definir quais dos itens 1–25 serão aplicados nos `.md`. Sugestão: ao menos 1–7 e 11.
- **Fase 1:** responder às 5 decisões da seção 2 (ou confirmar "siga as recomendações").
- **Fase 2 em diante:** não iniciar sem nova aprovação explícita.
