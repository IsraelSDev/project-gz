# Civilização Alienígena (nome de trabalho: `alien-civilization`)

Jogo 3D de estratégia e simulação de civilização alienígena, executado no navegador.
Stack: TypeScript (estrito), Vite, React e Babylon.js.

**Status:** Fase 1 do roadmap implementada (estrutura do projeto), aguardando aprovação. Ainda **não há** funcionalidade de
jogo: nenhum terreno, câmera, nave, construção ou cena gráfica. A página inicial é apenas um
marcador de que a estrutura funciona.

## Requisitos

| Item    | Versão                                                                  |
| ------- | ----------------------------------------------------------------------- |
| Node.js | **24 LTS** recomendado (`.nvmrc`); mínimo `^22.13` (imposto por `engine-strict`) |
| npm     | o que acompanha o Node (verificado com npm 11)                          |
| Git     | qualquer versão recente                                                 |

Com `nvm`: `nvm install 24 && nvm use 24`.

## Instalação

```bash
npm ci
```

Use `npm ci` (e não `npm install`) para instalar exatamente as versões do `package-lock.json`.
Só use `npm install` ao adicionar ou atualizar dependências de propósito, e versione o lockfile.

## Comandos

| Comando                | O que faz                                                                  |
| ---------------------- | -------------------------------------------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento do Vite (padrão: http://localhost:5173)        |
| `npm run build`        | Typecheck e build de produção em `dist/`                                   |
| `npm run preview`      | Serve o build de `dist/` localmente                                        |
| `npm run typecheck`    | `tsc -b` (TypeScript estrito)                                              |
| `npm run lint`         | ESLint (inclui as regras de dependência entre camadas)                     |
| `npm run format`       | Prettier, reescrevendo os arquivos                                         |
| `npm run format:check` | Prettier, apenas verificando                                               |
| `npm test`             | Vitest (uma execução)                                                      |
| `npm run test:watch`   | Vitest em modo observação                                                  |
| `npm run validate`     | typecheck, lint, format:check, test e build em sequência (verificação de entrega) |

## Estrutura atual

```text
docs/                   documentos de design, arquitetura, roadmap, decisões e revisão
src/
├── app/                App.tsx e estilos (raiz de composição)
└── main.tsx            ponto de entrada (React em StrictMode)
tests/unit/             testes (Vitest, ambiente Node)
```

As demais pastas (`game/`, `rendering/`, `presentation/`, `session/`, `platform/`, `shared/`) só são
criadas quando houver código nelas. A estrutura-alvo está em
[`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) §4.

## Convenções que já são verificadas

- **Alias `@/` → `src/`:** definido em `tsconfig.app.json` (`paths`) e lido pelo Vite 8
  (`resolve.tsconfigPaths`), inclusive nos testes. Use o alias entre camadas, não `../../..`.
- **Regras de dependência entre camadas:** `eslint.config.js` implementa a tabela de
  [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) §3.6. Por exemplo, `game/domain`
  não pode importar React, Babylon.js, APIs de navegador nem `Math.random`/`Date.now`/`performance.now`,
  e `rendering/` só pode importar tipos (`import type`) de `game/domain` e `game/content`. As regras só
  passam a ter efeito quando essas pastas existirem.
- **TypeScript:** `strict` e `noUncheckedIndexedAccess`. O TypeScript está fixado em `~6.0.x` porque o
  `typescript-eslint` declara peer `typescript <6.1.0`. Não atualize para 7.x até que isso mude.
- **Testes:** domínio e aplicação em ambiente Node. Babylon.js é testado sem WebGL via `NullEngine`
  (`tests/unit/babylon-headless.test.ts`). O `NullEngine` **não** cobre renderização real.

## Documentação

- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md): visão, sistemas e MVP.
- [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md): camadas, estado, tempo, comandos, persistência.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): fases de desenvolvimento e critérios de aceite.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): decisões adotadas e pendências, por fase.
- [`docs/REVIEW.md`](docs/REVIEW.md): revisão da Fase 0.

## Solução de problemas

- **`Unsupported engine` / erro de versão do Node:** use Node 24 LTS (ou ≥ 22.13).
- **`npm ci` falha por divergência entre `package.json` e `package-lock.json`:** não edite um sem o
  outro; use `npm install` de propósito e versione o lockfile.
