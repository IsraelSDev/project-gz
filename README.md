# Civilização Alienígena (nome de trabalho: `alien-civilization`)

Jogo 3D de estratégia e simulação de civilização alienígena, executado no navegador.
Stack: TypeScript (estrito), Vite, React e Babylon.js.

**Status:** Fases 1 a 6 implementadas; o primeiro evento da Fase 7 está implementado e aguarda
validação. Ao abrir o jogo você
vê a cena 3D (terreno alienígena, céu, vegetação provisória, a nave acidentada e três construções
iniciais), tudo derivado de um `GameState` somente leitura, com uma HUD: barra de recursos, controles
de tempo e painel da construção selecionada. A simulação tem um relógio de passo fixo (1 tick = 1 s
de jogo, velocidades 1x, 2x e 4x) e a partida **começa pausada**. A economia mínima roda a cada tick:
cada edifício produz e consome recursos (o painel da construção mostra as taxas) e a barra de recursos
mostra o estado real. Após 60 ticks, surge um evento narrativo com duas escolhas que alteram
recursos de forma reproduzível. Com a simulação em andamento, **água e energia sobem**; alimentos
e materiais também mudam quando você resolve o evento ou constrói suas estruturas produtoras.
Com o botão **Construir** você escolhe um edifício, vê a prévia no terreno (verde se a posição vale,
vermelha e com um "X" se não vale), gira, confirma ou cancela; a construção custa recursos e só é
cobrada quando é confirmada. **Ainda não há** população nem salvamento, e a construção é
instantânea (sem tempo de obra nem demolição).

## Controles da câmera

| Ação                                   | Controle                                                     |
| -------------------------------------- | ------------------------------------------------------------ |
| Girar e inclinar                       | Arrastar com o botão esquerdo                                |
| Mover lateralmente (pan)               | Arrastar com o botão direito, ou `Ctrl` + arrastar           |
| Zoom                                   | Roda do mouse ou pinça do trackpad (com limites)             |
| Mover pelo teclado                     | `W` frente, `A` esquerda, `S` trás, `D` direita (relativos à direção da câmera; mais rápido com a câmera afastada) |
| Outras teclas                          | Setas giram; `Ctrl` + setas movem; `+`/`-` ou `Alt` + setas = zoom |
| Selecionar uma construção              | Clique esquerdo (sem arrastar), fora do modo de construção   |
| Limpar a seleção                       | Clicar em área vazia ou na nave, `Esc` (com o canvas focado) ou o botão do painel |
| Pausar / retomar a simulação           | Botão "Pausar"/"Retomar" na barra superior                   |
| Velocidade da simulação                | Botões 1×, 2× e 4× na barra superior                         |
| Construir                              | Botão "Construir": escolher o edifício; o ponteiro move a prévia no terreno |
| Fixar a posição da prévia              | Clique esquerdo no terreno (outro clique a muda)             |
| Girar a prévia                         | `R` ou o botão "Girar 90°"                                   |
| Confirmar / cancelar a construção      | `Enter` ou o botão "Confirmar construção" / `Esc` ou o botão "Cancelar" |

A inclinação é limitada (≈14° a ≈64° de elevação), o zoom tem mínimo e máximo, o pan é restrito ao
redor do acampamento e a câmera nunca fica abaixo do terreno.

O teclado só chega ao jogo quando o canvas tem o foco: ele é focado ao abrir a página e ao clicar
nele. Se você clicar em outro elemento da página, clique no canvas para voltar a usar `W/A/S/D`.
As teclas são lidas por `keyCode`, ou seja, pelo caractere (em um teclado AZERTY, por exemplo, a
posição física muda).

A simulação e a cena são independentes: o tempo de jogo vem do tempo real (não dos quadros), então
pausar, retomar ou mudar a velocidade não mexe na cena nem na câmera, e a seleção funciona pausada
ou não. Com a aba em segundo plano a simulação é **pausada automaticamente** e continua pausada ao
voltar, até você retomar.

O render loop é limitado a **60 FPS** por padrão (`DEFAULT_MAX_FPS`, em `src/rendering/GameRenderer.ts`).
Em desenvolvimento (`npm run dev`) há um indicador de FPS e tempo de quadro no canto inferior
esquerdo; ele não existe no build de produção. Com o limite ele nunca passa de 60: para medir a
folga de desempenho, crie o renderizador com `maxFps: null`.

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
docs/                        documentos de design, arquitetura, roadmap, decisões e revisão
src/
├── app/                     raiz de composição: App, GameCanvas, worldSnapshot (estado -> cena)
├── game/
│   ├── application/         GameController (estado, relógio, fila de comandos), seletores,
│   │                        SimulationClock e driver de tempo, porta TimeEnvironment
│   ├── content/             definições estáticas e o cenário inicial
│   └── domain/              GameState e validação, passo de simulação, economia, construção
│                            (posicionamento, custo, PlaceBuilding), comandos, tick
├── platform/time/           ambiente de tempo do navegador (rAF, performance.now, visibilidade)
├── presentation/            React: HUD, barra de recursos, controles de tempo, painel, construção, hooks
├── rendering/               Babylon.js: GameRenderer, cena, câmera, picking, edifícios
├── session/                 estado de sessão da UI (seleção e modo de construção), fora do GameState
├── shared/                  grid, Result e conjunto de ouvintes (usados por várias camadas)
└── main.tsx                 ponto de entrada (React em StrictMode)
tests/unit/                  testes (Vitest; Node, e jsdom nos de componentes)
tests/support/               apoio dos testes (cena headless, tempo falso, comandos de teste)
```

As demais pastas só são criadas quando houver código nelas. A estrutura-alvo está em
[`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) §4.

## Convenções que já são verificadas

- **Alias `@/` → `src/`:** definido em `tsconfig.app.json` (`paths`) e lido pelo Vite 8
  (`resolve.tsconfigPaths`), inclusive nos testes. Use o alias entre camadas, não `../../..`.
- **Regras de dependência entre camadas:** `eslint.config.js` implementa a tabela de
  [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) §3.6. Por exemplo, `game/domain`
  não pode importar React, Babylon.js, APIs de navegador nem `Math.random`/`Date.now`/`performance.now`,
  e `rendering/` só pode importar tipos (`import type`) de `game/domain` e `game/content`.
- **TypeScript:** `strict` e `noUncheckedIndexedAccess`. O TypeScript está fixado em `~6.0.x` porque o
  `typescript-eslint` declara peer `typescript <6.1.0`. Não atualize para 7.x até que isso mude.
- **Testes:** domínio e aplicação em ambiente Node; componentes React com React Testing Library e
  jsdom (ambiente por arquivo, `// @vitest-environment jsdom`). Babylon.js é testado sem WebGL via
  `NullEngine` (cena, picking e seleção, com eventos de ponteiro sintéticos). O relógio e o driver
  usam um ambiente de tempo **falso**, sem esperas reais. Nada disso cobre o navegador real: WebGL,
  mouse e canvas reais, `requestAnimationFrame`, aba em segundo plano, redimensionamento e controles
  de câmera são verificados manualmente.
- **Economia (Fase 5):** estoques são inteiros e as taxas de produção e consumo ficam na definição de
  cada edifício (`src/game/content/buildings.ts`, valores provisórios). Um edifício só opera se o
  estoque do início do passo cobre todo o seu consumo; senão fica parado, e nenhum estoque fica
  negativo. A economia roda só dentro do passo de simulação (pausado não evolui). Regras em
  [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) §20.
- **Construção (Fase 6):** a posição é uma célula do grid (`x` para leste, `y` para o sul; a posição
  de um edifício é a célula de menor `x` e `y` do retângulo já rotacionado, e 90°/270° trocam largura e
  profundidade). Uma só regra no domínio (`evaluatePlacement`) decide se uma construção vale (área,
  sobreposição, nave, recursos) e é usada pelo comando `PlaceBuilding` e pela prévia. A prévia é só
  visual e não altera a partida. Regras em
  [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) §21.
- **Determinismo e tempo:** o ESLint proíbe no domínio `Math.random`, `Date.now`, `performance`,
  `crypto`, timers e `globalThis`; a camada de aplicação não lê o tempo real (ele entra pela porta
  `TimeEnvironment`, implementada em `platform/time/`).
- **Sistema de coordenadas:** o grid usa x para leste e y para o sul; a conversão para o espaço do
  Babylon.js fica só em `src/rendering/world/gridToWorld.ts` (ver arquitetura §9).
- **HMR:** editar o conteúdo do cenário atualiza a cena ao vivo; editar código de `rendering/`
  recarrega a página (a engine é descartada antes).

## Documentação

- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md): visão, sistemas e MVP.
- [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md): camadas, estado, tempo, comandos, persistência.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): fases de desenvolvimento e critérios de aceite.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): decisões adotadas e pendências, por fase.
- [`docs/REVIEW.md`](docs/REVIEW.md): revisão da Fase 0.

## Solução de problemas

- **`Unsupported engine` / erro de versão do Node:** use Node 24 LTS (ou ≥ 22.13).
- **Tela com a cor de fundo e "60 FPS · 0.0 ms", ou o tick parado mesmo "Em andamento":** a
  aba/painel está oculto ou não está pintando (o navegador suspende `requestAnimationFrame`). Traga a
  aba para a frente. Se ficar muito tempo sem quadros, ao voltar o jogo recupera no máximo 10 ticks.
- **`Timeout waiting for worker to respond` em `npm test`:** na primeira execução depois de
  `npm ci` o antivírus pode atrasar o carregamento do jsdom; rode `npm test` de novo.
- **Aviso "Não foi possível iniciar a cena 3D":** o navegador não ofereceu WebGL; ative a
  aceleração por hardware e recarregue.
- **Não abra esta pasta como projeto no BabylonJS Editor:** ele grava um template Next.js sobre
  `package.json`, `tsconfig.json`, `README.md` e `package-lock.json` e reinstala o `node_modules`.
  Se isso acontecer, restaure esses arquivos com `git checkout -- <arquivo>` e rode `npm ci`.
- **`npm ci` falha por divergência entre `package.json` e `package-lock.json`:** não edite um sem o
  outro; use `npm install` de propósito e versione o lockfile.
#   p r o j e c t - g z  
 
