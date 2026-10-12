# TECHNICAL ARCHITECTURE

## Projeto: Civilização Alienígena — versão 0.2

**Status:** Arquitetura revisada na Fase 0 (ver `REVIEW.md` e `DECISIONS.md`)\
**Princípio central:** simulação independente da renderização e da
plataforma.

Cada regra marcada com **[Fase N]** deve ser implementada na fase
indicada do `ROADMAP.md`; antes disso, é uma decisão registrada, não
código existente.

------------------------------------------------------------------------

## 1. Objetivos arquiteturais

1.  Desenvolver primeiro para navegador.
2.  Reutilizar o máximo possível ao empacotar para PC.
3.  Separar renderização 3D, interface, regras de simulação e
    persistência.
4.  Permitir que a simulação seja testada sem inicializar Babylon.js.
5.  Manter o projeto simples enquanto o MVP ainda está em descoberta.
6.  Evitar abstrações e infraestrutura que não atendam a uma necessidade
    atual.

## 2. Stack inicial

-   **Linguagem:** TypeScript com `strict` habilitado.
-   **Build e servidor de desenvolvimento:** Vite.
-   **Interface:** React.
-   **Renderização 3D:** Babylon.js (`@babylonjs/core`, importado por
    módulos para permitir tree-shaking).
-   **Testes unitários:** Vitest.
-   **Qualidade:** ESLint e Prettier.
-   **Versionamento:** Git (repositório local; remoto não definido).
-   **Gerenciador de pacotes:** npm, com `package-lock.json` versionado
    e instalação via `npm ci`.
-   **Dados estáticos:** JSON ou módulos TypeScript validados.
-   **Persistência inicial:** porta de armazenamento assíncrona com
    implementação local no navegador.

**Versões.** As versões efetivamente instaladas são as do
`package-lock.json`. Node 24 LTS é recomendado (`.nvmrc`); o mínimo é
`^22.13`. O TypeScript é fixado em `~6.0.x` enquanto o `typescript-eslint`
declarar peer `typescript <6.1.0` (verificado em 2026-10-12). Não
atualizar dependências para versões incompatíveis entre si.

**Alias.** `@/` aponta para `src/` (tsconfig e Vite, compartilhado com o
Vitest). Importações entre camadas usam o alias, não `../../..`.

Não adicionar backend, autenticação, PostgreSQL, filas, microsserviços
ou multiplayer no MVP. Essas tecnologias só serão introduzidas se
requisitos concretos justificarem.

## 3. Separação de responsabilidades

### 3.1 Camada de plataforma (`src/platform/`)

Responsável por capacidades específicas do ambiente: - Navegador. -
Salvamento local. - Futuro empacotamento desktop. -
Importação/exportação de arquivos, caso seja necessária.

Implementa portas definidas na camada de aplicação. As regras do jogo
não devem acessar diretamente APIs do navegador.

### 3.2 Camada de apresentação (`src/presentation/`, `src/rendering/`, `src/session/`)

React (`presentation/`) apresenta: - Barra de recursos. - Painéis
administrativos. - Informações de objetos selecionados. - Menus,
diálogos, notificações e eventos. - A interface é HTML sobreposto ao
canvas; não se usa Babylon GUI.

Babylon.js (`rendering/`, **fora de `game/`**) apresenta: - Cena 3D. -
Terreno e construções. - Câmera e iluminação. - Seleção e interação
espacial (picking). - Animações e efeitos.

`session/` guarda o **estado de sessão da interface** (por exemplo, a
seleção atual). É um módulo simples, sem React nem Babylon, para poder
ser lido tanto por `presentation/` quanto por `rendering/`.

React e Babylon.js devem se comunicar por contratos explícitos, sem
manter duas fontes de verdade para o mesmo dado.

### 3.3 Camada de aplicação (`src/game/application/`)

Coordena casos de uso, por exemplo: - Iniciar partida. - Pausar ou
retomar. - Avançar o tempo. - Construir edifício. - Resolver evento. -
Salvar ou carregar partida.

Essa camada coordena chamadas à simulação e expõe o estado da partida à
apresentação como **snapshots imutáveis** (seção 11). Define as portas
que a plataforma implementa (por exemplo, `SaveProvider`).

### 3.4 Camada de domínio/simulação (`src/game/domain/`)

Contém regras independentes da engine gráfica: - Estado da partida. -
Recursos e economia. - População e necessidades. - Construção e
requisitos. - Tempo e eventos. - Futuros módulos de política, corte,
dinastia, diplomacia e militar.

Não importar React, Babylon.js nem APIs de DOM/navegador nesta camada.
Também não usar fontes de não determinismo (seção 6.3).

### 3.5 Camada de conteúdo (`src/game/content/`)

Contém definições de dados: - Edifícios. - Recursos. - Tecnologias. -
Eventos. - Traços e profissões. - Leis e cargos quando esses módulos
forem implementados. - O cenário inicial da partida (recursos e
edifícios iniciais).

Separar definições estáticas do estado mutável de uma partida.

### 3.6 Regras de dependência entre camadas

A tabela indica o que cada camada **pode** importar. Tudo o que não
estiver permitido é proibido.

| Camada | Pode importar | Proibido (entre outros) |
| --- | --- | --- |
| `shared/` | nada do projeto | React, Babylon, DOM, qualquer outra camada |
| `game/content/` | `shared` | React, Babylon, DOM, outras camadas de `game` |
| `game/domain/` | `shared`, `game/content` | React, Babylon, DOM/navegador, `application`, `rendering`, `presentation`, `session`, `platform`, `app`; `Math.random`, `Date.now`, `Date()`, `new Date()` sem argumento, `performance`, `crypto`, `setTimeout`/`setInterval`, `globalThis` |
| `game/application/` | `shared`, `game/domain`, `game/content` | React, Babylon, DOM/navegador, `rendering`, `presentation`, `session`, `platform`, `app`; tempo real, timers e aleatoriedade (`Date.now`, `performance`, `setTimeout`, `Math.random`, `crypto`): o tempo entra pela porta `TimeEnvironment` (D-42) |
| `session/` | `shared` | React, Babylon, `game/*` (exceto tipos), outras camadas |
| `rendering/` | `@babylonjs/*`, `shared`, `session`; **somente tipos** (`import type`) de `game/domain` e `game/content` | React, `presentation`, `platform`, `app`, importações em tempo de execução de `game/*` |
| `presentation/` | `react`, `shared`, `session`, `game/application`; somente tipos de `game/domain` e `game/content` | Babylon, `rendering`, `platform`, `app` |
| `platform/` | `shared`; somente tipos de `game/application` (portas) | React, Babylon, `rendering`, `presentation`, `session`, `app` |
| `app/` | tudo (raiz de composição) | — |

**Aplicação das regras [Fase 1]:** `no-restricted-imports`
(`@typescript-eslint/no-restricted-imports`, com `allowTypeImports` onde
indicado) e restrições de globais no ESLint, em `eslint.config.js`. As
regras existem desde a Fase 1 e passam a ter efeito conforme as pastas
são criadas.

`rendering/` não conhece React nem o controlador: recebe dados por
contratos injetados pelo `app/` (por exemplo, uma função de sincronização
que recebe o snapshot e um callback `onPick(entityId)`).

## 4. Estrutura de pastas

Estrutura-alvo. **Criar pastas somente quando houver código nelas.** Até a
Fase 6 existem `app/`, `game/application/` (com `ports/` e `time/`),
`game/content/`, `game/domain/` (`state/`, `time/`, `simulation/`,
`commands/`, `economy/`, `construction/`), `platform/time/`, `presentation/`
(`hud/`, `game-ui/`, `build/`, `hooks/`), `rendering/`, `session/`, `shared/`
(`grid/`, `result/`, `store/`) e `main.tsx`; as demais ainda não têm código.

``` text
src/
├── app/                      # raiz de composição (App.tsx, ligações entre camadas)
├── platform/
│   ├── time/                 # BrowserTimeEnvironment (Fase 4)
│   └── storage/              # BrowserSaveProvider (Fase 8)
├── presentation/             # React
│   ├── hud/                  # barra de recursos, controles de tempo (Fases 3 e 4)
│   ├── game-ui/              # HUD e painel de detalhes (Fase 3)
│   └── hooks/                # useGameSelector, useClock, useSelection
├── session/                  # estado de sessão da UI (seleção: Fase 3; construção: Fase 6)
├── rendering/                # Babylon.js — Fase 2 (fora de game/)
│   ├── scene/
│   ├── camera/
│   ├── world/                # inclui a conversão grid → espaço Babylon
│   ├── buildings/
│   ├── props/                # kit de primitivas com cor por vértice
│   └── interaction/
├── game/
│   ├── application/
│   │   ├── GameController.ts # Fases 3 e 4
│   │   ├── selectors.ts      # consultas sobre o snapshot (Fase 3)
│   │   ├── time/             # SimulationClock, driver de tempo (Fase 4)
│   │   ├── ports/            # TimeEnvironment (Fase 4); SaveProvider — Fase 8
│   │   └── commands/
│   ├── domain/
│   │   ├── state/
│   │   ├── time/             # duração do tick (Fase 4)
│   │   ├── simulation/       # passo de simulação (Fase 4)
│   │   ├── commands/         # comandos de simulação (infraestrutura: Fase 4)
│   │   ├── economy/          # produção, consumo e regra de falta (Fase 5)
│   │   ├── population/
│   │   ├── construction/     # posicionamento, custo e PlaceBuilding (Fase 6)
│   │   └── events/
│   └── content/
├── shared/
│   ├── grid/                 # tipos e matemática do grid (Fase 2)
│   ├── result/               # Result com código de erro (Fase 4)
│   ├── store/                # conjunto de ouvintes de stores (Fase 3)
│   └── validation/
└── main.tsx

tests/
├── unit/
│   ├── economy/
│   ├── time/
│   └── construction/
└── integration/
```

## 5. Estado da partida

### 5.1 Estado persistente (`GameState`)

Manter um objeto de estado serializável que represente os dados
necessários para retomar uma partida. Exemplo conceitual (ilustrativo,
não é especificação final de tipos):

``` ts
interface GameState {
  schemaVersion: number;
  contentVersion: string;
  tick: number;
  resources: Record<ResourceId, number>; // inteiros em unidades escaladas
  buildings: BuildingInstance[];
  // Adicionados quando o sistema que os usa for implementado:
  nextEntityId: number;      // Fase 6, feito: §21.3 (IDs por contador)
  rng: RngState;             // quando um sistema precisar de aleatoriedade (P-07)
  population: PopulationState; // Fase 9 (via migração de esquema)
  events: GameEventState[];  // Fase 7
}
```

**GameState mínimo [Fase 2]:** `schemaVersion`, `contentVersion`, `tick`,
`resources` e `buildings`, em modo **somente leitura**, criado a partir do
cenário inicial em `game/content`. Cada `BuildingInstance` tem
`instanceId` estável. A cena (Fase 2) e a seleção (Fase 3) usam esses IDs;
nenhum objeto visual nasce de dados fixos dentro de `rendering/`.

Regras: - IDs estáveis para entidades, gerados por contador no estado
(não por UUID aleatório). - Valores econômicos numéricos, inteiros e
validados. - `ResourceId` e demais IDs tipados a partir do conteúdo
(`as const`), não `string` livre. - Separar definições estáticas do
estado da partida. - Versionar o formato de salvamento. - Definir
comportamento para dados inválidos ou incompatíveis. - Não guardar
objetos Babylon.js, referências DOM ou funções dentro do estado
serializado. - Evitar campos duplicados ou estado derivável armazenado
sem necessidade.

### 5.2 Estado do relógio (não persistente)

`paused` e `speed` pertencem ao `SimulationClock` [Fase 4], **não** ao
`GameState`. Uma partida carregada começa sempre pausada. O `tick` (que é
dado de simulação) permanece no `GameState`.

### 5.3 Estado de sessão da interface (não persistente)

A **seleção** (qual objeto está selecionado) é estado de sessão da UI,
mantido em `src/session/` [Fase 3]:

-   Guarda apenas identificadores de domínio (por exemplo, `instanceId`),
    nunca meshes nem nomes de meshes.
-   Não faz parte do `GameState`, não é salvo e não é um comando de
    domínio. Selecionar não altera a partida.
-   Expõe `subscribe`/`getSnapshot` (compatível com `useSyncExternalStore`).
-   Se o identificador selecionado deixar de existir no `GameState`
    (edifício removido) ou for desconhecido, a seleção é limpa e a
    interface exibe o estado vazio.

O **modo de construção** [Fase 6, §21.5] segue o mesmo desenho
(`src/session/buildStore.ts`): o edifício em posicionamento, a rotação, a
célula apontada e se a posição está fixada. Também não faz parte do
`GameState`, não é salvo e não é um comando: só a **confirmação** envia o
comando `PlaceBuilding`; mover, girar e cancelar a prévia não alteram a
partida. A seleção atual é preservada durante a construção.

## 6. Tempo e simulação

### 6.1 Relógio e passo fixo [Fase 4, feito: §19.2]

O tempo da simulação não pode depender diretamente do FPS.

-   Um `SimulationClock` (camada de **aplicação**, pois lida com tempo
    real) acumula o tempo e executa passos de simulação de **duração
    fixa** (duração definida na Fase 4, pendência P-04). O domínio só
    recebe "execute um passo" e nunca lê o tempo real.
-   O render loop do Babylon.js desenha de acordo com o frame rate e não
    avança a simulação.
-   O controlador pode pausar ou acelerar a simulação.
-   Cada passo executa sistemas em ordem documentada. Evitar efeitos
    colaterais ocultos entre módulos.

### 6.2 Aba em segundo plano [Fase 4, feito: §19.4]

Quando a aba fica oculta, o `requestAnimationFrame` é suspenso. Para
evitar uma rajada de passos ao voltar: (a) limite máximo de passos de
recuperação por quadro; (b) a simulação é pausada automaticamente quando
a aba fica oculta.

### 6.3 Determinismo [Fase 4 e Fase 7]

-   Mesmo estado + mesmos comandos ⇒ mesmo resultado.
-   Proibido no domínio: `Math.random`, `Date.now`, `performance.now`
    (regras de ESLint, seção 3.6).
-   Se um sistema precisar de aleatoriedade, usar PRNG do domínio com estado
    completo (`rng`) no `GameState` e no salvamento; algoritmo em P-07. A Fase 7
    não usa aleatoriedade e não adiciona esse campo.
-   IDs por contador (`nextEntityId`) [Fase 6, feito: §21.3].
-   O relógio e o tempo real ficam fora do domínio: o domínio recebe
    "execute um passo".

### 6.4 Política numérica e de recursos [Fase 5, feito: §20]

-   Quantidades como **inteiros em unidades escaladas**; sem ponto
    flutuante nas regras econômicas.
-   Nenhum estoque fica negativo (piso em zero); a falta de recursos
    segue uma regra explícita e testada.
-   A ordem produção → consumo é documentada e testada; a política de
    arredondamento é única e definida em um só lugar.
-   Valores inválidos (NaN, infinito, não inteiro) são rejeitados, não
    corrigidos silenciosamente.

### 6.5 Ordem dos sistemas em cada passo

Ordem inicial possível: 1. Atualizar o relógio/tick. 2. Processar
comandos de simulação pendentes. 3. Calcular produção. 4. Calcular
consumo. 5. Atualizar necessidades e estados populacionais. 6. Avaliar
gatilhos de eventos. 7. Publicar um novo snapshot para a camada de
apresentação.

A ordem deve ser confirmada por testes e refinada conforme os sistemas
forem adicionados.

**Refinamento da Fase 5 (§20.2):** os itens 3 e 4 viram um único passo
econômico (`advanceEconomy`), que decide a partir do estoque do início do
passo quais edifícios operam e depois aplica produção e consumo. Os itens
1, 2 e 3-4 estão nesta ordem em `advanceSimulationStep`, que é o único
lugar que define a ordem dos sistemas.

## 7. Comandos [Fase 4, infraestrutura feita: §19.3; `PlaceBuilding`: Fase 6, §21]

Há dois tipos de comando, com regras distintas.

### 7.1 Comandos de controle

`PauseSimulation`, `ResumeSimulation`, `SetSimulationSpeed`.

-   Atuam no `SimulationClock`, **imediatamente**, esteja o jogo
    pausado ou não.
-   Não alteram o `GameState` e não entram na fila de simulação.

### 7.2 Comandos de simulação

`PlaceBuilding`, `ResolveEvent` e futuros comandos que alteram a partida.

-   São **validados no momento do envio** pelo domínio, que retorna um
    `Result` com código de erro (seção 14). A interface mostra o motivo.
-   **Jogo em execução:** o comando válido entra na fila e é aplicado no
    início do próximo passo (ordem 6.5, item 2), sendo **revalidado** na
    aplicação; o resultado da aplicação é o definitivo.
-   **Jogo pausado:** o comando válido é aplicado **imediatamente**, sem
    avançar o `tick` e sem executar produção, consumo ou eventos. Assim o
    jogador pode planejar com o tempo parado.
-   Um comando só altera o estado por esse caminho; nenhum componente
    React nem objeto Babylon altera estoques ou atributos diretamente.
-   Comandos aplicados são registrados com o `tick` em que ocorreram
    (útil para testes e depuração).

### 7.3 O que não é comando

`SelectEntity` **não** é um comando de domínio: seleção é estado de
sessão da UI (seção 5.3).

Para seleção 3D, Babylon.js identifica o objeto selecionado, converte
essa seleção em um identificador de domínio e o entrega, por callback,
ao store de sessão. A interface consulta os dados correspondentes no
snapshot do jogo.

## 8. Contrato de construção

Uma definição estática de edifício pode conter: - `id` - `name` -
`category` - `cost` - `footprint` (em células do grid) - `production` -
`consumption` - `requirements`

Uma instância construída pode conter: - `instanceId` - `definitionId` -
posição (célula do grid) e orientação (0/90/180/270°) - condição
operacional - nível - progresso de construção, se houver.

**Fase 5:** `production` e `consumption` existem (inteiros positivos por
tick, `ResourceRates`). Detalhes em §20.4. **Fase 6:** `cost` existe (mesmo
formato); os `requirements` se resumem a posição válida e recursos
suficientes (§21.2), porque nada usa requisitos de tecnologia ou de outros
edifícios. Detalhes em §21.3.

Os tipos definitivos deverão distinguir dados de domínio e dados
puramente visuais. Posição e orientação podem ser persistidas, mas
meshes e materiais não.

## 9. Posicionamento no mundo [Fase 2 e Fase 6, feito: §21.1 e §21.2]

-   O domínio usa um **grid discreto 2D** de células inteiras `(x, y)`.
-   Cada edifício ocupa um `footprint` retangular de células, com
    rotação em passos de 90°.
-   A área construível é **plana e limitada**; o relevo do terreno é
    visual no início.
-   Regras de ocupação (sem sobreposição, dentro da área) vivem no
    domínio e são testadas sem renderização [Fase 6, feito: §21.2].
-   O espaço do Babylon.js (esquerdo, Y para cima) é uma questão de
    renderização: a conversão grid → mundo 3D existe em **um único
    módulo**, `rendering/world/gridToWorld.ts` [Fase 2, feito].
-   As posições dos edifícios da Fase 2 já são células do grid, definidas
    no cenário inicial do conteúdo.

**Convenções implementadas (Fase 2):**

-   **Grid** (vista de cima, norte para cima): `x` cresce para leste e
    `y` cresce para o **sul**. Medidas em células inteiras; `width` é a
    extensão em `x` e `depth` a extensão em `y` (não é altura vertical).
-   **Posição:** é a célula de menor `x` e menor `y` do retângulo
    ocupado, **já rotacionado**. A rotação ocorre em torno do centro do
    retângulo, que não muda com a rotação. Com 90° e 270° largura e
    profundidade trocam (`rotatedSize` / `occupiedRect`).
-   **Mundo (Babylon.js):** o terreno é centrado em `(0, 0)`; `x` do
    grid → `+X` (leste); `y` do grid → `-Z` (sul), logo **norte = +Z**.
    Uma célula mede `CELL_SIZE = 2` unidades de mundo.
-   **Orientação:** `Rotation` é `0 | 90 | 180 | 270`, em graus no
    sentido **horário visto de cima**. Os modelos são construídos com a
    frente voltada para o **sul (-Z)** em rotação 0 e giram com
    `node.rotation.y = rotationToRadians(r)`. Sul → oeste → norte → leste
    a cada 90°. Essa convenção é verificada em teste contra
    `Matrix.RotationY` do Babylon.js.
-   **Onde ficam:** tipos e matemática do grid em `src/shared/grid/`
    (porque `domain`, `content` e `rendering` precisam deles e
    `rendering/` só importa **tipos** de `domain`); a conversão para o
    mundo 3D só em `rendering/world/gridToWorld.ts`.

## 10. Persistência e portabilidade [Fase 8]

A porta `SaveProvider` fica em `game/application/ports/` e é
**assíncrona** (retorna `Promise`), para que a simulação não dependa de
`localStorage` e o backend possa mudar (por exemplo, IndexedDB ou arquivo
no desktop) sem alterar o contrato.

Implementação inicial (`platform/storage/`): um slot manual no
`localStorage`, isolado por `BrowserSaveProvider`. A porta permite trocar o
adaptador sem alterar aplicação/domínio; erros de leitura e escrita são
devolvidos como falhas da operação.

Regras: envelope com versão do formato, `schemaVersion` e
`contentVersion`. Todo dado carregado é **não confiável**: validar formato,
tipos, chaves e consistência contra o conteúdo (rejeitar, por exemplo,
`__proto__`), com tratamento de versões incompatíveis. O estado ativo só é
substituído depois de o dado carregado ser validado; falha não corrompe a
partida em curso. Partida carregada começa pausada. Limitar o tamanho de
registros que crescem (como o log de eventos). Slots múltiplos, autosave e
exportação em arquivo continuam na pendência P-06.

O primeiro formato é v1 e ainda não precisa de migração: não há saves
anteriores em produção. Mudanças futuras do esquema devem adicionar
migrações testadas em cadeia; a população da Fase 9 será a primeira
mudança de esquema planejada.

Possíveis implementações futuras: - Arquivo local no desktop. -
Sincronização em nuvem. - Backend para contas e partidas online.

Não implementar as opções futuras antes de existir requisito.

## 11. Comunicação entre interface e jogo [Fase 3 e Fase 4, feito: §18.2 e §19.5]

**Fonte única de verdade:** o `GameController` (camada de aplicação)
mantém o estado da partida e expõe `subscribe` e `getSnapshot`. Cada
passo ou comando aplicado publica um **snapshot imutável**.

-   A interface React lê o snapshot por `useSyncExternalStore` e
    **seletores** (por exemplo, "recursos", "edifício X"), para não
    re-renderizar tudo a cada passo. Não se adiciona biblioteca de
    estado.
-   A **barra de recursos lê somente do snapshot**. É proibido copiar
    valores de recursos para o estado do React ou manter números fixos
    na interface. Na Fase 3 a barra lia os valores iniciais do
    `GameState`; desde a Fase 5 ela mostra o estado que a economia
    atualiza a cada passo (§20), sem lógica econômica no React.
-   `rendering/` recebe o snapshot por um contrato injetado pelo `app/`
    e atualiza apenas o que mudou (sem recriar a cena inteira).
-   A interface envia comandos (seção 7) ao controlador. O controlador
    coordena; as regras de validação vivem no domínio (sem duplicação).
-   Seleção segue a seção 5.3 e não passa pelo controlador.

Não permitir que um componente React altere diretamente estoques ou
atributos internos da simulação.

## 12. Performance 3D e ciclo de vida [Fase 2]

-   O render loop é limitado a 60 quadros por segundo por padrão
    (`engine.maxFPS`, D-40); a simulação não depende dos quadros.
-   Criar e destruir recursos gráficos de forma explícita.
-   `dispose` da engine e da cena **idempotente**; o StrictMode do React
    permanece ativo (ele executa efeitos duas vezes em desenvolvimento)
    e a inicialização não pode duplicar engine, listeners nem render
    loops.
-   Tratar o HMR do Vite (recriação do módulo) e a **perda de contexto
    WebGL**.
-   Evitar recriar a cena inteira quando um painel React muda.
-   Usar instancing ou thin instances para objetos repetidos quando
    necessário.
-   Limitar luzes, sombras e materiais caros.
-   Carregar ativos sob demanda se o volume justificar.
-   Medir frame time e memória com cenas representativas (contador em
    modo dev e hardware-alvo: pendência P-02).
-   Começar com modelos provisórios e uma área de jogo pequena.
-   Definir metas de desempenho após medir em hardware-alvo, em vez de
    prometer números sem benchmark.

## 13. Qualidade e testes

### Estratégia por camada

-   **Domínio e aplicação:** testes unitários em ambiente Node, sem DOM e
    sem Babylon.
-   **Babylon headless:** `NullEngine` para criar e descartar engine e
    cena sem WebGL. Há um teste de fumaça já na Fase 1. O `NullEngine`
    não cobre renderização real.
-   **Componentes React:** (feito na Fase 3, §18.4) React Testing Library com jsdom, introduzidos
    na Fase 3 junto do primeiro componente testável (não antes).
-   **WebGL real:** verificação manual na Fase 2; teste E2E com
    Playwright é pendência P-03.

### Testes unitários

-   Produção e consumo de recursos.
-   Regras de construção e custos.
-   Avanço do tempo e passo fixo.
-   Validação de comandos, inclusive com o jogo pausado.
-   Gatilhos de eventos.
-   Serialização, migração e restauração de estado.

### Testes de integração

-   Um comando válido altera o estado esperado.
-   Seleção 3D atualiza o painel React (parte headless; parte real
    conforme P-03).
-   Pausar impede avanços de simulação, mas comandos de simulação
    continuam aplicáveis.
-   Salvar e carregar restaura o estado esperado.
-   Desmontar a cena libera recursos e listeners.

### Verificações de entrega

-   `typecheck`
-   `lint`
-   `test`
-   `build`

Os comandos reais são definidos nos scripts do projeto
(`package.json`) e documentados no README. O script `validate` executa
a sequência completa.

## 14. Tratamento de erros [Fase 4 e Fase 6]

-   Falhas **esperadas** de validação (recursos insuficientes, posição
    ocupada) retornam `Result` com um **código de erro** (união de
    literais), sem lançar exceção.
-   A interface traduz o código em texto; o domínio não contém texto de
    interface.
-   Exceções ficam reservadas para erros inesperados (bugs, falhas de
    armazenamento ou de criação da cena), tratados nas bordas.

## 15. Convenções de desenvolvimento

-   Usar TypeScript estrito (também `noUncheckedIndexedAccess`).
-   Preferir funções pequenas e responsabilidades explícitas.
-   Não introduzir dependências sem justificar seu benefício.
-   Não criar abstrações genéricas antes de existir mais de um caso
    real.
-   Evitar `any`; quando inevitável, documentar o motivo.
-   Tratar erros de armazenamento, carregamento e criação da cena.
-   Não deixar botões que aparentem funcionar sem implementação.
-   Não declarar testes ou builds aprovados sem executá-los.
-   Atualizar documentação quando contratos e regras mudarem.
-   Respeitar as regras de dependência da seção 3.6 e usar o alias `@/`.
-   Conteúdo renderizado em React não usa `dangerouslySetInnerHTML`.

## 16. Limites de escopo

Fora da arquitetura implementada no MVP: - Servidor e autenticação. -
Multiplayer e sincronização de estado. - Economia avançada. - Simulação
individual de milhares de habitantes. - IA generativa em runtime. -
Combate completo. - Distribuição em lojas de PC.

A arquitetura pode manter caminhos de extensão, mas não deve antecipar
toda a complexidade desses sistemas.

## 17. Notas de implementação da Fase 2

Registro do que foi implementado e das escolhas locais (decisões em
`DECISIONS.md`, D-24 a D-33).

### 17.1 Do estado à cena

```
INITIAL_SCENARIO (content) ──createInitialGameState──▶ GameState (domain, congelado)
                                         │
              app/worldSnapshot.ts: toWorldSnapshot(state, scenario)
                                         ▼
                      WorldSnapshot (contrato definido em rendering/)
                                         ▼
                 GameRenderer.sync(snapshot)  ──▶  cena Babylon.js
```

-   `createInitialGameState` valida o cenário (`validateScenario`) e lança
    se ele for inválido (erro de conteúdo). O estado é congelado em
    profundidade (somente leitura em tempo de execução) e é serializável.
-   `toWorldSnapshot` é a **única** ponte domínio → renderização. Os
    edifícios da cena vêm das `BuildingInstance` do estado, com o
    `footprint` da definição; nenhuma construção nasce de dados fixos na
    renderização. Um modelo visual por `BuildingDefinitionId` é exigido
    pelo compilador (`Record<BuildingDefinitionId, ...>`).
-   `BuildingLayer.sync` identifica cada edifício pelo `instanceId`:
    cria os novos, atualiza posição e rotação dos existentes e libera os
    removidos. O terreno e a nave são refeitos apenas quando os dados do
    cenário mudam.
-   Preparação para a seleção (Fase 3): todo nó e mesh de edifício leva
    `metadata = { kind: 'building', entityId: instanceId }`;
    `resolveEntityId(node)` sobe pela hierarquia até achar o
    identificador; o módulo importa `Culling/ray` (habilita
    `scene.pick`). Cenário e terreno não são selecionáveis. A seleção em
    si **não** foi implementada.

### 17.2 Ciclo de vida do renderizador

-   `createGameRenderer(canvas, { createEngine?, onStatusChange? })`
    devolve `GameRenderer | null` (`sync`, `getFrameStats`, `dispose`).
    Falha de inicialização: erro registrado, `onStatusChange('failed')`
    e `null` (nada fica alocado).
-   Uma engine e uma cena por renderizador. O render loop só chama
    `scene.render()`; não conhece simulação.
-   `ResizeObserver` no canvas chama `engine.resize()`. A engine usa
    `adaptToDeviceRatio` (o canvas interno acompanha o DPR).
-   Perda e restauração do contexto: observadores em
    `onContextLostObservable` e `onContextRestoredObservable` viram
    `context-lost` / `running`; o Babylon.js reconstrói os recursos.
-   `dispose()` é **idempotente** e libera, nesta ordem: render loop,
    observadores e `ResizeObserver`, edifícios, mundo estático, câmera,
    cena (com luzes e sombras) e engine. `sync` após o `dispose` não faz
    nada.
-   `GameCanvas` (em `app/`) cria o renderizador no efeito e o descarta
    na limpeza; o StrictMode continua ativo (em desenvolvimento ocorre
    criar → descartar → criar, sempre com no máximo 1 renderizador).
    `getLiveRendererCount()` e o log `[renderer]` (só em dev) permitem
    conferir isso.
-   HMR: ver D-30. Mudanças em `rendering/` recarregam a página; mudanças
    de conteúdo atualizam a cena ao vivo.

### 17.3 Câmera

-   `ArcRotateCamera` em perspectiva, com os controles nativos do
    Babylon.js 9 (mapa de entrada padrão: botão esquerdo gira; botão
    direito ou `Ctrl` + esquerdo faz pan; roda dá zoom; teclado:
    `W/A/S/D` fazem pan, setas giram, `Ctrl` + setas movem, `+`/`-` ou
    `Alt` + setas dão zoom).
-   `W/A/S/D` (`addWasdNavigation`): as teclas entram nas listas
    `keysUp/Left/Down/Right` do teclado nativo e uma entrada do mapa de
    entrada (`keyboard`, `key: [W, A, S, D]`, `pan`) as liga ao pan; o
    mapa resolve por especificidade, então `Ctrl`/`Alt` mantêm seus
    comportamentos. A sensibilidade é ajustada a cada quadro em
    proporção ao raio (`wasdPanSensitivity`). O teclado nativo lê as
    teclas **a cada quadro** e só recebe eventos com o canvas focado
    (`GameCanvas` o foca ao iniciar).
-   Limites: `beta` entre 0,45 e 1,32 rad (≈ 64° a ≈ 14° de elevação);
    raio entre 14 e 72; pan no plano do terreno
    (`panningAxis = (1, 0, 1)`) e a no máximo 28 unidades do centro do
    acampamento.
-   `clampCameraAboveGround` (função pura, testada) reduz `beta` quando a
    posição da câmera ficaria abaixo do terreno.
-   Enquadramento inicial: centro e maior extensão da área construível,
    com a distância aumentada em janelas mais estreitas que 1,3 de
    proporção (o campo de visão é vertical). Só ocorre na primeira
    sincronização.
-   A sensibilidade do pan (`panningSensibility = 100`) foi **medida**
    no Babylon.js 9 (≈ 1:1 com o ponteiro no enquadramento inicial).
    Valores menores deixam o pan mais rápido.

### 17.4 Cenário visual e desempenho

-   Sem arquivos externos: terreno (malha 100×100 com cor por vértice),
    céu (domo com gradiente e duas luas), vegetação e rochas (thin
    instances, uma chamada de desenho por tipo), nave e edifícios
    (primitivas fundidas em um mesh com cor por vértice). Materiais
    compartilhados e poucos.
-   Iluminação: luz hemisférica de preenchimento e uma luz direcional
    com um mapa de sombra de 2048 (filtragem PCF de qualidade baixa).
-   Linha de base medida em `NullEngine` (não é FPS): ≈ 199 mil
    triângulos, 24 meshes, 6 chamadas instanciadas (≈ 456 instâncias),
    12 materiais, 2 luzes. O indicador de FPS em desenvolvimento ajuda a
    medir em hardware real (P-02).
-   Build: o chunk principal tem ≈ 1,28 MB (≈ 323 kB com gzip); os
    shaders e carregadores de textura do Babylon.js já são divididos em
    chunks sob demanda (D-33).

### 17.5 Testes da Fase 2

-   Domínio e conteúdo: estrutura do estado, três construções,
    `instanceId` único e não vazio, posições dentro da área, estado
    congelado e serializável, validação de cenários inválidos.
-   Renderização pura: conversão de coordenadas (incluindo a convenção
    de rotação contra o Babylon.js), relevo plano na área construível,
    dispersão determinística, câmera acima do terreno.
-   Integração headless (`NullEngine`): um objeto 3D por edifício com o
    `instanceId` correto, posição derivada do grid, `sync` idempotente,
    remoção e movimento por diff, refazer o terreno sem vazar meshes,
    `dispose` idempotente, remonte estilo StrictMode, perda de contexto e
    falha de inicialização.
-   **Não coberto por testes automáticos:** WebGL real, `ResizeObserver`,
    controles de câmera por entrada real e aparência visual. São
    verificados manualmente no navegador (relatório da Fase 2).

## 18. Notas de implementação da Fase 3

Registro do que foi implementado (decisões em `DECISIONS.md`, D-35 a D-40).

### 18.1 Seleção por picking

-   `session/selectionStore.ts` guarda só o `instanceId` selecionado
    (`SelectionState.selectedEntityId`), sem React nem Babylon.js. O
    snapshot é congelado e só muda de referência quando a seleção muda;
    `select`/`clear` não notificam quando nada muda.
-   `rendering/interaction/BuildingPicking.ts`: um único observador em
    `scene.onPointerObservable`. Um clique do botão principal (apertar e
    soltar com no máximo 6 px de deslocamento) chama
    `onPick(instanceId | null)`; arrastos (girar a câmera) e outros
    botões são ignorados. `scene.pick` pega o primeiro objeto atingido e o
    identificador vem de `resolveEntityId` (metadados tipados, nunca o
    nome do mesh).
-   O casco da nave é "pickable" de propósito: sem metadados ele resolve
    para `null`, mas oculta o que está atrás (clicar na nave nunca
    seleciona uma construção). O cenário (vegetação, rochas, grade) não é
    "pickable": decoração não bloqueia o clique.
-   `GameRenderer` recebe `onPick` nas opções (registrado uma vez) e expõe
    `setSelectedEntity(id | null)`. O renderizador não conhece o store: o
    `GameCanvas` (em `app/`) liga os dois sentidos. Mudar a seleção não
    recria engine, cena nem edifícios e não re-renderiza o `GameCanvas`.
-   Indicação visual (`SelectionHighlight.ts`): quatro cantoneiras no chão
    ao redor do footprint, um mesh com material emissivo compartilhado
    (`selection`), filho do nó do edifício (acompanha posição e rotação),
    não "pickable", sem sombra. Não altera o material do edifício. A
    forma, e não só a cor, marca a seleção.

### 18.2 `GameController`, snapshots e seletores

-   `GameSnapshot` é o próprio `GameState` (já congelado em profundidade):
    não há segunda cópia. `GameStateReader` (`getSnapshot` + `subscribe`)
    é o que a interface recebe para ler a partida.
-   `selectors.ts` (camada de aplicação) traz as consultas sobre o estado:
    `selectResourceEntries` (nome do conteúdo + quantidade; recurso
    ausente não é inventado; valor não finito vira `null`) e
    `selectBuildingDetails`. Ficam na aplicação porque `presentation/` só
    pode importar **tipos** de `game/content`. Recebem só a fatia de que
    precisam (`resources`, `buildings`).
-   Hooks em `presentation/hooks/`: `useGameSelector` (lê uma fatia do
    snapshot por `useSyncExternalStore`; o seletor deve devolver uma
    referência já existente), `useSelection` e, na Fase 4, `useClock`.
-   `shared/store/listenerSet.ts`: conjunto de ouvintes compartilhado
    pelo store de seleção, pelo controlador e pelo relógio (cancelar é
    idempotente; cancelar durante a notificação é seguro).

### 18.3 HUD e acessibilidade mínima (P-12, parcial)

-   HTML sobreposto ao canvas, em `presentation/`, sem biblioteca de UI. O
    contêiner `.hud` não captura o ponteiro; só a barra superior e o
    painel o capturam (câmera e seleção continuam recebendo o resto).
-   Barra superior: título (`h1`), controles de tempo (Fase 4) e lista de
    recursos (`ul` com nome acessível; ícones SVG provisórios e
    decorativos, sempre com o nome ao lado). Painel: `aside` com `h2`, nome
    da construção em `h3`, dados em `dl`, estado vazio contextual, anúncio
    de mudança em `role="status"` e botão "Limpar seleção" com foco
    visível.
-   Foco previsível: fechar o painel pelo botão devolve o foco ao canvas
    (`App`); `Esc` no canvas limpa a seleção. Uma seleção cujo
    `instanceId` não existe (mais) no estado mostra o estado vazio e é
    limpa por um efeito, sem laço (limpar é idempotente).
-   O canvas **não** mostra anel de foco (ver a nota em `app.css`): ele é
    focado por script e a cada clique, e o navegador o trataria como
    `:focus-visible` mesmo para quem usa o mouse. O indicador de foco do
    mundo 3D e a navegação por teclado nele ficam como pendência (P-12).

### 18.4 Testes da Fase 3

-   Store de seleção, `GameController`, seletores e conjunto de ouvintes
    (Node, sem DOM).
-   Picking e marcador com `NullEngine` e eventos de ponteiro
    **sintéticos** (`tests/support/headlessRenderer.ts`): clique em cada
    construção, terreno, céu, nave, nave na frente de uma construção,
    arraste, botão direito, descarte do observador, marcador.
-   Componentes com React Testing Library + jsdom (`jsdom@29`, que aceita
    o mínimo do projeto, Node 22.13; ambiente por arquivo com
    `// @vitest-environment jsdom`) e o fluxo completo com o `App`
    (`selectionFlow.test.tsx`).
-   **Não cobertos:** mouse e canvas reais, WebGL e a sensação do clique
    (verificados à mão), o foco real do navegador.

### 18.5 Limite de FPS

`createGameRenderer` aplica `engine.maxFPS = 60` por padrão
(`DEFAULT_MAX_FPS`; a opção `maxFps` muda o valor e `null` remove o
limite). O limitador do Babylon.js usa um acumulador de tempo, então em um
monitor de 120 Hz desenha um quadro sim, outro não, e em 144 Hz mantém a
média em 60. O limite só reduz o trabalho da GPU: não conserta uma máquina
que não alcança 60. Com ele, o indicador de FPS nunca passa de 60: para
medir a **folga** (P-02) é preciso `maxFps: null`.

## 19. Notas de implementação da Fase 4

Registro do que foi implementado (decisões em `DECISIONS.md`, D-41 a D-46).

### 19.1 Estado e validação

-   O `GameState` mantém os cinco campos (`schemaVersion`,
    `contentVersion`, `tick`, `resources`, `buildings`). `nextEntityId`
    (Fase 6) e `rng` (Fase 7) **não** foram adicionados: nada os usa ainda.
    `paused`, `speed` e a seleção não estão no estado.
-   `validateGameState` é a única definição de estado válido (versão do
    esquema, `tick` inteiro não negativo, recursos exatamente os do
    conteúdo e inteiros não negativos, edifícios com `instanceId` único,
    definição conhecida, rotação e posição válidas). O estado inicial e o
    resultado de todo comando passam por ela. Regras de posição (área,
    sobreposição) ficam com o cenário e com a construção (Fase 6).
-   `advanceSimulationStep` é a função pura que executa um passo e o
    **único** lugar que incrementa `tick`; `resources` e `buildings`
    mantêm a referência (compartilhamento estrutural). `freezeDeep` foi
    extraído para ser reutilizado.

### 19.2 `SimulationClock` e o driver de tempo

-   `SimulationClock` (`game/application/time/`) é lógica pura: guarda
    `paused` e `speed` (`ClockSnapshot` imutável, com `subscribe`),
    acumula tempo de **jogo** e chama `onStep` uma vez por passo. Um tick
    = 1 segundo de tempo de jogo (`TICK_GAME_SECONDS`); a velocidade
    (1x, 2x, 4x) multiplica o tempo real e não muda a duração do passo.
    Nasce **pausado**. `advance(realDeltaMs)` devolve quantos passos
    executou; pausado, devolve 0 e o tempo real não se acumula; um delta
    negativo ou não finito lança `RangeError` (bug do chamador).
-   Limite de recuperação (D-15): no máximo `DEFAULT_MAX_STEPS_PER_ADVANCE`
    (10) passos por chamada; os passos além do limite são **descartados**
    (mantém-se só a fração do passo atual). Um quadro lento a 4x (2 s) é
    recuperado por inteiro; uma hora sem quadros vira, no máximo, 10 ticks.
-   Comandos de **controle**: `pause()`, `resume()`, `setSpeed(n)` (devolve
    `Result` com `INVALID_SPEED`). Atuam direto no relógio, com o jogo
    pausado ou não, e não tocam o `GameState`. `reset()` volta ao estado
    de partida nova ou carregada (pausado, 1x, sem atraso).
-   `startClockDriver(clock, env)` mantém um **único** loop de quadros,
    separado do render loop do Babylon.js: mede o tempo real entre
    quadros (nunca negativo) e o entrega a `clock.advance`. Devolve a
    função que o para (cancela o quadro e a assinatura de visibilidade).
    Se um passo lança exceção, pausa o relógio, relança o erro (continua
    visível) e mantém o loop vivo para a interface responder.
-   A porta `TimeEnvironment` (`game/application/ports/`) isola o tempo real
    e a visibilidade (`now`, `requestFrame`, `cancelFrame`, `isHidden`,
    `onVisibilityChange`). `platform/time/browserTimeEnvironment.ts` a
    implementa com `performance.now`, `requestAnimationFrame` e
    `document.hidden`. O `App` inicia o driver em um efeito e o para na
    limpeza (StrictMode: iniciar, parar, iniciar).

### 19.3 Comandos de simulação

-   Infraestrutura em `game/domain/commands/simulationCommand.ts`: um
    comando é `{ type, ...dados }`; `COMMAND_HANDLERS` (vazio por ora)
    mapeia o tipo ao tratador. `executeSimulationCommand(state, command)`
    **valida e aplica numa única passada**, sem alterar o estado de
    entrada, e devolve `Result<GameState, CommandErrorCode>`:
    `INVALID_COMMAND` (tipo desconhecido ou malformado; chaves herdadas
    como `__proto__` não casam), `COMMAND_REJECTED` (as regras recusam) e
    `INVALID_STATE` (o resultado violaria `validateGameState`). Não há
    nenhum comando concreto: `PlaceBuilding` (Fase 6) e `ResolveEvent`
    (Fase 7) entram na tabela.
-   `GameController.submitCommand(command)`:
    -   é validado na hora (a mesma função), recusando cedo com o código;
    -   com o jogo **pausado**, um comando válido é aplicado na hora, sem
        avançar o tick (resultado `applied`);
    -   **em andamento**, entra numa fila FIFO (resultado `queued`) e é
        aplicado no início do próximo passo, depois do incremento do tick
        (Arquitetura §6.5), **revalidado** contra o estado do momento (a
        aplicação é a decisão definitiva; um recusado não altera nada);
    -   ao **pausar** (por qualquer caminho), o que estava na fila é
        aplicado na hora, em ordem, sem avançar o tick: com o jogo
        pausado a fila nunca fica retida e a ordem de chegada é mantida.
-   O passo publica **um** snapshot (tick e comandos juntos). O controlador
    guarda um log limitado (100) com o tick de cada comando aplicado ou
    recusado, para testes e depuração. Uma recusa na aplicação só aparece
    no log: não há canal de feedback na interface ainda (Fase 6).

### 19.4 Aba em segundo plano

Com a página oculta o driver **pausa** o relógio e descarta o tempo
oculto; ao voltar a partida continua **pausada** até o jogador retomar (o
driver nunca retoma sozinho). Quadros entregues com a aba oculta não
avançam nem acumulam, e o cronômetro é zerado a cada mudança de
visibilidade, então não há rajada de ticks nem salto no tempo de jogo.
Mesmo sem evento de visibilidade (navegador que só suspende o rAF), o
primeiro quadro após a pausa é limitado pelo teto de passos.

### 19.5 Interface

-   `TimeControls` (barra superior): chip "Pausado"/"Em andamento", tick,
    botão Pausar/Retomar e grupo de velocidades (`aria-pressed`). Lê o
    relógio por `useClock` e o tick por `useGameSelector`: não guarda cópia
    de `paused`, `speed` nem `tick`. Pausado, a barra ganha a cor de aviso.
    Um `role="status"` anuncia as mudanças. Sem calendário.
-   Como o snapshot muda a cada tick, a interface lê **fatias**:
    `resources` e `buildings` mantêm a referência, então a barra de
    recursos, o painel e o snapshot da cena (`toWorldSnapshot` só recebe
    `buildings`) não são refeitos a cada passo. Isto é verificado por
    teste (`renderIsolation`, `clockFlow`).

### 19.6 Determinismo e ESLint

O domínio proíbe, além do que já estava, `Date()` sem `new`, `crypto`,
`setTimeout`/`setInterval`/`setImmediate`/`queueMicrotask` e `globalThis`.
A camada de aplicação passa a proibir `Date.now`, `performance`,
`Math.random`, `crypto` e timers: o tempo real só entra pela porta
`TimeEnvironment`. As regras foram verificadas com violações temporárias.

### 19.7 Testes da Fase 4

-   Relógio, driver (com `tests/support/fakeTimeEnvironment.ts`, sem
    esperas reais), estado e passo, comandos (com comandos **de teste** em
    `tests/support/testCommands.ts`, que não são regras do jogo) e
    controlador (fila, ordem, revalidação, pausa, determinismo e
    independência do número de quadros), em Node.
-   Componentes e o `App` completo com tempo falso e `NullEngine`: tick
    na interface, pausar/retomar/velocidade sem recriar engine, cena nem
    câmera, cena selecionável pausada e em andamento, aba oculta,
    StrictMode e descarte.
-   **Não cobertos:** `requestAnimationFrame` e visibilidade de um
    navegador real em segundo plano, e o desempenho (verificados à mão ou
    pendentes).

## 20. Notas de implementação da Fase 5

Registro do que foi implementado (decisões em `DECISIONS.md`, D-47 a D-52).

### 20.1 Unidade e política numérica

-   Estoques são **inteiros** e a unidade armazenada é a própria unidade
    exibida (escala 1, D-47). Taxas de produção e consumo são inteiros
    positivos **por tick** (1 tick = 1 s de tempo de jogo). Não há ponto
    flutuante nem arredondamento: não existe divisão nas regras. Se um
    sistema futuro precisar de frações, a escala muda por migração do
    esquema do estado (Fase 8), nunca por arredondamento escondido.
-   Cada número vive em **um só lugar**: estoques iniciais em
    `game/content/scenario.ts` (`initialResources`), taxas na definição de
    cada edifício em `game/content/buildings.ts` e o teto técnico
    (`MAX_RESOURCE_AMOUNT`) em `game/content/resources.ts`. Não há número
    econômico em `domain/`, `application/` nem `presentation/`.
-   Valores inválidos (NaN, infinito, fracionário, negativo) são
    **rejeitados, não corrigidos**: `validateGameState` (estado),
    `validateBuildingEconomy` (taxas do conteúdo) e um `RangeError` no
    próprio passo econômico se o resultado não for um inteiro seguro não
    negativo.

### 20.2 O passo econômico e a regra de falta

`advanceEconomy(resources, buildings, definitions?)`, em
`game/domain/economy/advanceEconomy.ts`, é uma função **pura e
determinística** (sem relógio, aleatoriedade, DOM, React nem Babylon.js).
Devolve um novo estoque congelado ou a **mesma referência** quando nada
muda. Em cada passo:

1.  **Decidir quem opera.** Os edifícios são avaliados na **ordem do
    estado** (a de construção), que é a prioridade. Cada um tenta
    **reservar todo o seu consumo** do estoque que sobrou. Se algum recurso
    não cobrir o consumo, o edifício fica **parado**: não reserva, não
    consome e **não produz**.
2.  **Produção.** Soma a produção de cada edifício que opera, limitada ao
    teto técnico (D-51).
3.  **Consumo.** Subtrai o consumo de cada edifício que opera.

Consequências, todas testadas:

-   **A disponibilidade é o estoque do início do passo.** A produção do
    passo só pode pagar consumo a partir do passo seguinte (por isso, com
    o estoque zerado, um consumidor fica parado por um passo mesmo que um
    produtor esteja funcionando).
-   **O estoque nunca fica negativo, por construção:** cada reserva sai do
    estoque inicial, então o consumo total não passa do que existe. Não há
    dívida: o que faltou num passo não é cobrado depois.
-   **Disputa:** se dois edifícios competem pelo mesmo recurso, o mais
    antigo tem prioridade. Um edifício parado não reserva nada, então o
    seguinte ainda pode usar o estoque.
-   **Tudo ou nada por edifício:** a falta de um insumo impede o consumo
    dos outros insumos do mesmo edifício.
-   **Teto técnico:** uma produção que passaria de `MAX_RESOURCE_AMOUNT`
    (o maior inteiro seguro) é limitada a ele. Não é capacidade de
    armazenamento do jogo (P-19).
-   Estoque de entrada inválido, taxa inválida ou definição desconhecida
    lançam `RangeError` (erro de conteúdo ou de programação). O driver de
    tempo pausa o relógio e relança o erro; a economia nunca produz um
    valor inválido em silêncio.

Esta regra **refina** a ordem do §6.5: os itens 3 (produção) e 4
(consumo) formam um único passo econômico, decidido sobre o estoque
inicial; produção e consumo são aplicados nessa ordem, e o resultado não
depende da ordem entre eles.

### 20.3 Ligação com ticks, relógio e comandos

-   `advanceSimulationStep(state, applyCommands?)` é o **único** lugar que
    define a ordem dos sistemas de um passo: (1) tick, (2) fase de
    comandos, (3-4) economia. O `GameController` entrega a fase de comandos
    (a fila é dele), então a regra do §7 não muda: os comandos são
    aplicados depois do tick e **antes** da economia, e a economia já vê o
    resultado deles.
-   A economia só roda **dentro do passo**. Pausado, nenhum passo é
    executado, então nenhum estoque muda. Um comando aplicado com o jogo
    pausado não executa produção nem consumo (§7.2).
-   **A velocidade** (1x, 2x, 4x) muda quantos passos acontecem por segundo
    real; a quantidade por passo é a mesma. O teto de recuperação (10
    passos por chamada) e a pausa com a aba oculta valem para a economia
    sem código extra. Não existe segundo relógio.
-   O `GameState` continua com os mesmos cinco campos: `resources` já
    existia e é a **única fonte de verdade** dos estoques. O formato não
    mudou (`schemaVersion` continua 1); o conteúdo mudou
    (`contentVersion` 0.3.0). Um passo troca `tick` e, se algum estoque
    mudou, `resources`; `buildings` mantém a referência.

### 20.4 Conteúdo econômico (provisório, D-48)

Taxas por tick, em `game/content/buildings.ts`. São os números mínimos
para a economia funcionar e ser testada, **não balanceamento** (P-21):

| Edifício           | Produz     | Consome    |
| ------------------ | ---------- | ---------- |
| Módulo Habitacional | —          | Energia 2  |
| Extrator de Água   | Água 4     | Energia 3  |
| Matriz Solar       | Energia 6  | —          |

Saldo do cenário inicial: energia +1, água +4, alimentos e materiais 0.
**Alimentos e materiais não têm produtor nem consumidor ainda**: o consumo
de alimentos é da população (Fase 9) e os materiais entram com a
construção (Fase 6). Como também não há consumidores de água nem
capacidade de armazenamento, água e energia crescem sem limite (P-19).

O GDD (§8.3) pede insumos, mão de obra, tempo e resultado: os **insumos** e o
**resultado** estão modelados; o **tempo** é o tick; a **mão de obra** só
existe com a população (Fase 9). A validação do conteúdo é
`validateBuildingEconomy` (taxas inteiras positivas de recursos que
existem), chamada por `createInitialGameState`: o jogo recusa começar com
conteúdo econômico inválido.

### 20.5 Interface

-   `ResourceBar` não ganhou lógica: já lia a fatia `resources` do snapshot
    (D-08, D-46) e agora os números mudam porque o estado muda. Ela só
    re-renderiza quando algum estoque muda (verificado por teste), e não
    há regra econômica nem valor próprio no React.
-   `selectBuildingDetails` passou a trazer `production` e `consumption`
    (da definição, por tick) e o painel mostra "Produção por tick" e
    "Consumo por tick" ("Nenhum" quando vazio). O painel **não** mostra o
    estado operacional ("parado por falta de energia"): isso depende de
    uma condição operacional do edifício (P-20).
-   A seleção, o painel e a cena não mudaram: a economia mexe em
    `resources`, e a cena só é sincronizada quando `buildings` muda.

### 20.6 Testes da Fase 5

-   **Regras** (`economy.test.ts`, definições fictícias com os quatro
    recursos, sem relógio nem interface): produção, consumo, limite
    inclusivo, falta (parado, tudo ou nada, sem dívida), produção do passo
    não paga o consumo do mesmo passo, prioridade por ordem, parado não
    reserva, nunca negativo em 300 passos de déficit, teto técnico, taxas e
    estoques inválidos, pureza, imutabilidade e determinismo.
-   **Conteúdo** (`economyContent.test.ts`): o conteúdo entregue é válido,
    o estado recusa conteúdo inválido, o estoque inicial cobre o consumo e
    o jogo produz o que a soma simples das definições prevê
    (`tests/support/economyExpectations.ts`, calculada à parte e sem fixar
    os números provisórios).
-   **Passo, relógio e comandos** (`economySimulation.test.ts`): ordem
    tick → comandos → economia, pausa, retomada, velocidades, mudança de
    velocidade, independência de FPS, determinismo, teto de recuperação,
    comandos na fila e aba oculta.
-   **Interface e fluxo** (`ResourceBar`, `BuildingDetailsPanel`,
    `renderIsolation`, `clockFlow` com o `App` real, tempo falso e
    `NullEngine`): a barra acompanha o estado, pausa congela, a seleção e
    o painel continuam funcionando e a cena não é refeita por mudança de
    recursos.
-   **Não cobertos:** o `requestAnimationFrame` e a visibilidade de um
    navegador real em segundo plano (P-18), o desempenho e o balanceamento.

## 21. Notas de implementação da Fase 6

Registro do que foi implementado (decisões em `DECISIONS.md`, D-53 a D-58).

### 21.1 Convenção do grid e do posicionamento

A convenção é a de §9 (Fase 2), agora também aplicada às regras:

-   **Origem e eixos:** a célula `(0, 0)` é o canto noroeste do terreno; `x`
    cresce para **leste** e `y` para o **sul**, em células inteiras. O
    terreno do cenário inicial tem 40 × 40 células; a área construível
    é o retângulo `(12, 12)` com 16 × 16.
-   **Dimensões:** `width` é a extensão em `x` e `depth` a extensão em
    `y` (não é altura vertical). O `footprint` da definição é medido com
    rotação 0.
-   **Rotação:** `0 | 90 | 180 | 270`, no sentido horário visto de cima.
    90° e 270° **trocam** largura e profundidade. A rotação ocorre em torno
    do centro do retângulo ocupado.
-   **Posição:** `position` é a célula de **menor `x` e menor `y`** do
    retângulo ocupado **já rotacionado**. Células ocupadas =
    `[x, x + largura) × [y, y + profundidade)`.
-   **Ponteiro → posição:** o ponteiro aponta uma **célula** (o ponto do
    plano do chão sob o ponteiro, `y = 0`, convertido por `worldToGridCell`,
    único módulo de conversão mundo → grid junto de `gridToWorld.ts`).
    O edifício fica **centrado** nessa célula (`positionForAnchorCell`):
    `position = célula − ⌊extensão / 2⌋` em cada eixo, com a extensão já
    rotacionada. Em extensões pares o centro cai na célula de menor índice
    das duas do meio.
-   **Obstáculos:** a nave acidentada é cenário (D-25) e ocupa células; para o
    posicionamento ela é um **obstáculo** (`createPlacementTerrain`). Os
    edifícios existentes vêm do estado.

### 21.2 Regras de validação (domínio)

`game/domain/construction/placement.ts`. Uma só definição de construção
válida, usada pelo comando **e** pela prévia da interface
(`evaluatePlacement`; sem Babylon.js, React, relógio nem aleatoriedade):

1.  **Área construível:** o retângulo ocupado precisa estar **inteiro**
    dentro dela (`OUT_OF_BUILDABLE_AREA`). Encostar na borda vale.
2.  **Edifícios:** o retângulo não pode sobrepor nenhum edifício do estado,
    considerando a rotação de cada um (`OVERLAPS_BUILDING`). Bordas ou
    cantos que apenas se tocam **não** são sobreposição.
3.  **Obstáculos:** não pode sobrepor a nave (`OVERLAPS_OBSTACLE`).
4.  **Recursos:** o estoque precisa cobrir o **custo inteiro** de todos os
    recursos (`INSUFFICIENT_RESOURCES`); o limite é inclusivo.

A **primeira** verificação que falha decide o código, nessa ordem. O espaço
(1 a 3) é validado por `evaluatePlacementSpace`, que ignora os recursos.
Definição desconhecida lança `RangeError` (erro de programação); no
comando ela é `INVALID_COMMAND`.

### 21.3 `PlaceBuilding`, custos e identificadores

-   **Comando** `{ type: 'PlaceBuilding', definitionId, position, rotation }`,
    registrado em `COMMAND_HANDLERS`. O tratador lê o comando (que chega sem
    tipos) e devolve `INVALID_COMMAND` se estiver malformado (definição
    desconhecida ou herdada como `__proto__`, rotação inválida, posição não
    inteira); depois aplica `evaluatePlacement`. Os códigos de
    `PlacementErrorCode` entram em `CommandErrorCode`, para a interface
    explicar o motivo (`COMMAND_REJECTED` continua sendo a recusa genérica).
-   **Custo:** declarado em cada definição (`BuildingDefinition.cost`,
    `ResourceRates`, inteiros positivos; vazio = grátis). É descontado **uma
    vez**, junto da criação do edifício, só quando a construção é válida. Uma
    recusa devolve erro e **não altera nada**: nem recursos, nem edifícios,
    nem contador.
-   **Identidade:** `GameState.nextEntityId` (inteiro ≥ 1, só cresce) é o
    contador. A instância nova recebe `building-<n>` e o contador avança. Os
    edifícios iniciais mantêm os identificadores fixos do cenário. Uma recusa
    não consome número. O contador no limite do inteiro seguro recusa o
    comando (`INVALID_STATE`) em vez de gerar um identificador inexato. O
    formato do estado não ganhou versão nova (`schemaVersion` continua 1:
    ainda não existe formato salvo; o primeiro é o da Fase 8).
-   **Instância:** só dados de domínio (`instanceId`, `definitionId`, posição,
    rotação). Nenhum mesh, nó ou objeto do Babylon.js entra no estado: a cena
    é uma representação do estado (`toWorldSnapshot`), não uma segunda fonte.
-   **Validação do conteúdo:** `validateBuildingContent` (manual, sem
    biblioteca) confere id igual à chave, nome, categoria, footprint e, pela
    validação econômica, custo, produção e consumo. O jogo recusa começar com
    conteúdo inválido (`createInitialGameState`).

### 21.4 Prévia visual

-   **Contrato:** `PlacementPreviewSpec` (em `rendering/world/WorldSnapshot.ts`):
    o edifício, o tamanho, a posição, a rotação e `valid`. Quem o monta é o
    `app/` (`GameCanvas`), a partir de `selectPlacementPreview` (aplicação),
    que usa as regras do domínio. A cena **só desenha**: não conhece regras,
    custo nem estado.
-   **Camada** `rendering/buildings/PlacementPreview.ts`: um **fantasma**
    translúcido do edifício (com a frente apontando para o sul em 0°, então a
    rotação fica visível), um **preenchimento** e uma **moldura** no chão e,
    **só se inválida, um "X"**. Válida e inválida se distinguem por cor
    **e** por forma (o X), e o painel diz o motivo em texto com ✔ ou ✖.
-   Nada da prévia é "pickable", projeta sombra, tem metadados de entidade ou
    entra na lista de edifícios. Os materiais do fantasma são próprios; os
    materiais compartilhados dos edifícios reais não são tocados. Trocar só a
    validade, a posição ou a rotação não recria nada.
-   **Entrada** (`rendering/interaction/PlacementInput.ts`): com o modo ligado,
    o ponteiro vira uma **célula** (`groundPicking`, raio da câmera contra o
    plano do chão): `hover` quando a célula muda e `click` num clique do botão
    principal (mesma tolerância de 6 px da seleção, para o arrasto continuar
    girando a câmera). A área construível é exatamente plana em `y = 0`;
    fora dela o plano é aproximado, o que não importa porque a posição é
    inválida de qualquer jeito. Um edifício na frente não muda a célula.

### 21.5 Modo de construção e interface

-   **Estado de sessão** (`session/buildStore.ts`, como a seleção): o
    identificador do edifício em posicionamento, a rotação, a célula e se a
    posição está **fixada**. Fora do `GameState`, não é salvo e não é comando.
    Mover, girar e cancelar a prévia **não** enviam comando nenhum.
-   **Fluxo:** "Construir" abre o catálogo → escolher um edifício → o
    ponteiro move a prévia → **clicar no terreno fixa** a posição (o ponteiro
    indo até os botões não a move; outro clique a muda) → `R` ou "Girar 90°"
    → **"Confirmar construção"** (ou `Enter`) ou **"Cancelar"** (ou `Esc`).
    Fechar o painel também cancela. A confirmação é sempre explícita.
-   **Seleção:** no modo de construção o clique **não seleciona** (a seleção
    atual é preservada e o painel de detalhes continua); `Esc` com um edifício
    em posicionamento cancela a prévia **sem** limpar a seleção. Ao sair do
    modo, o clique volta a selecionar.
-   **Catálogo e custos:** `selectBuildCatalog` (nome, categoria, footprint,
    custo e disponibilidade, tudo do conteúdo e do estado). O que falta
    aparece em **texto** ("faltam 20", "Recursos insuficientes agora").
-   **Gasto duplicado:** ao confirmar com sucesso, o posicionamento é
    **encerrado na mesma chamada**, antes de qualquer novo clique; um segundo
    clique ou `Enter` não encontra nada a confirmar. Por outro caminho, um
    comando repetido é recusado por sobreposição (jogo pausado) ou na
    revalidação do passo (em andamento): o custo é cobrado uma vez só.
-   **Acessibilidade:** botões com nome, grupo "Posicionar …", `aria-pressed`
    no edifício escolhido, `aria-expanded`/`aria-controls` no botão
    "Construir", resultado em `role="status"`, foco visível. Posicionar ainda
    exige um ponteiro (P-16).

### 21.6 Pausa, fila e feedback

-   Valem as regras de §7.2: com o jogo **pausado** o comando válido é
    aplicado **na hora**, sem avançar o tick e sem rodar a economia; **em
    andamento** entra na fila, é aplicado no início do próximo passo (depois
    do tick e **antes** da economia, então o edifício novo já produz e
    consome nesse passo) e é **revalidado**. Pausar aplica o que estava na
    fila, em ordem, sem avançar o tempo.
-   `submitCommand` devolve `applied` ou `queued`, e o aviso diz qual dos dois
    aconteceu ("construído" ou "será aplicada no próximo passo").
-   **Recusa tardia (resolve P-17 para a construção):** um comando aceito na
    fila e recusado ao ser aplicado (por exemplo, outro pedido gastou os
    recursos antes) chega à interface por `GameController.subscribeRejections`;
    o `App` o converte em aviso e a interface o traduz (`ERROR_MESSAGES`, que
    o compilador obriga a cobrir todo código). A construção é **instantânea**:
    não há tempo de obra nem progresso (P-22).

### 21.7 Testes da Fase 6

-   **Regras** (`placement.test.ts`, terreno e definições fictícios): rotação
    e dimensões, célula → posição, posição válida, limites da grade,
    sobreposição (inclusive rotação e ordem das verificações), recursos e
    pureza; o conteúdo real tem espaço para todo edifício em qualquer rotação.
-   **Comando** (`placeBuildingCommand.test.ts`): criação, desconto exato por
    edifício, operações inválidas sem alterar nada, comando malformado,
    identificadores únicos e determinismo.
-   **Pausa e fila** (`constructionCommands.test.ts`): aplicação imediata,
    fila, revalidação, pedidos repetidos, recursos esgotados na aplicação,
    pausa que descarrega a fila, independência de FPS e canal de recusa.
-   **Seletores e sessão** (`buildSelectors`, `buildStore`), **cena**
    (`placementPreview`: conversão mundo → grade, entrada do ponteiro, seleção
    suspensa, prévia válida e inválida, sem sobras e sem picking),
    **painel** (`BuildPanel`) e **fluxo** com o `App` real, tempo falso e
    `NullEngine` (`buildFlow`): prévia, fixar, confirmar, cancelar, seleção,
    fila e recusa tardia.
-   **Não cobertos:** o mouse e o toque reais, o WebGL e a cor na tela, a
    sensação do arrasto e o desempenho em um navegador real (verificados à
    mão ou pendentes).

### 21.8 Limitações conhecidas

-   Construção instantânea, sem tempo de obra, demolição, mover ou melhorar
    (P-22).
-   Custos e taxas provisórios (P-21); a estufa produz alimentos que ninguém
    consome até a população (Fase 9).
-   Posicionar exige ponteiro; sem alternativa por teclado (P-16). Em telas
    de toque não há "passar o ponteiro": o primeiro toque fixa a posição e
    "Confirmar construção" conclui (verificar em um aparelho real, P-23).

## 22. Eventos narrativos [Fase 7]

- Definições imutáveis e textos ficam em `game/content/events.ts`; o `GameState` guarda somente `eventId`, status e os dados necessários da resolução. Eventos não armazenam referências visuais.
- `advanceEvents` é chamado por `advanceSimulationStep` depois da economia. O passo incrementa o tick, aplica comandos, calcula a economia e só então avalia gatilhos; pausado, não há passo e nenhum gatilho avança.
- Cada definição tem identificador estável e pré-condição determinística. A transição `available → active` ocorre uma vez, portanto uma condição persistente não dispara o mesmo evento repetidamente. Eventos ativos permanecem aguardando a escolha; resolvidos não voltam a disparar.
- `ResolveEvent` é comando de simulação: com a partida pausada aplica imediatamente sem avançar tempo; em andamento enfileira e revalida no tick. A validação confirma que o evento está ativo, que a opção existe e que há recursos; custo e efeitos são aplicados atomicamente, nunca gerando estoque negativo. A resolução grava opção e tick, impedindo duplicidade.
- A aplicação fornece à apresentação seletores com conteúdo, opções e disponibilidade econômica. O painel não importa definições nem aplica efeitos; apenas envia decisões e mostra o resultado.
- O evento inicial, `wreck-signal`, torna-se ativo no tick 60. Responder custa 4 de energia e concede 8 materiais; desmontar custa 2 materiais e concede 6 energia.
- Não há sorteio nesta fase, então não há PRNG nem campo `rng` no estado (P-07 adiada até surgir necessidade real). Textos do protótipo ficam em pt-BR, sem i18n (D-60).
- Testes em `events.test.ts` cobrem gatilho, tick mínimo, repetição, pausa, efeitos, recusa inválida/sem recursos, resolução única e determinismo. `EventPanel.test.tsx` cobre apresentação, affordability, envio e resultado.






## Fase 9 - sobrevivência e migração de saves

`GameState.schemaVersion` passa a 2 e guarda `population` (sobreviventes, contador de escassez, progresso de estabilidade e resultado). `contentVersion` passa a 0.5.0. A migração pura v1/0.4.0 para v2/0.5.0 preserva tick, estoques, edifícios, contador de entidades e eventos, acrescentando 8 sobreviventes e contadores zerados. A versão do envelope permanece 1. Saves v1 com conteúdo desconhecido são rejeitados sem substituir a partida ativa.

Ordem do tick: incrementar tick, aplicar comandos pendentes, rodar produção e consumo dos edifícios, cobrar necessidades da população e avaliar eventos. Necessidades parciais consomem o estoque disponível; a falta de qualquer recurso conta como um tick de escassez, sem dívida. Cada 60 ticks seguidos em escassez remove 1 sobrevivente; abastecimento completo reinicia o contador. A vitória exige 900 ticks consecutivos abastecidos e alojados e pelo menos 6 sobreviventes; a derrota ocorre com zero sobreviventes. O controlador pausa em qualquer resultado.

A capacidade habitacional deriva da soma de `housingCapacity` nas definições de edifícios presentes e não se duplica no save. O HUD mostra população, capacidade, estoques, necessidades do próximo tick, alertas, progresso e resultado.

## 23. Personagens e cargos (Fase 10)

`GameState` usa schema 3 e conteúdo 0.6.0. `characters` guarda apenas indivíduos importantes; `population.survivors` continua sendo o total de habitantes. O elenco inicial contém quatro personagens entre oito habitantes. IDs, nomes, espécie, estágio de vida, competências (0–5), traços e disponibilidade pertencem ao domínio; avatares CSS da HUD são provisórios e não são estado.

`government` guarda um líder e ocupantes opcionais dos cargos de ciência, engenharia e produção. Nomeações são comandos do domínio: exigem pessoa viva, disponível, competência mínima 2 e nenhum outro cargo ocupado. Remoção deixa qualquer cargo vago, inclusive a liderança.

`relationships` contém pares de personagens existentes com afinidade, confiança e rivalidade inteiras de -5 a 5. Os valores não alteram outros sistemas nesta fase. Quando uma baixa populacional afeta alguém do elenco, a pessoa com menor soma de competências (empate por ID) é marcada como falecida e seus cargos ficam vagos; assim o número de personagens vivos nunca excede a população agregada.

A migração de save encadeia v1/0.4.0 → v2/0.5.0 → v3/0.6.0. Saves v2 preservam todos os campos existentes e recebem o elenco e governo iniciais. A carga valida campos, IDs únicos, elegibilidade, ocupação exclusiva e relações antes de substituir o estado ativo. A versão do envelope continua 1; saves inválidos não substituem a partida.