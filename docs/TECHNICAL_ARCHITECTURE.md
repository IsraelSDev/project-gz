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
| `game/domain/` | `shared`, `game/content` | React, Babylon, DOM/navegador, `application`, `rendering`, `presentation`, `session`, `platform`, `app`; `Math.random`, `Date.now`, `performance.now` |
| `game/application/` | `shared`, `game/domain`, `game/content` | React, Babylon, DOM/navegador, `rendering`, `presentation`, `session`, `platform`, `app` |
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

Estrutura-alvo. **Criar pastas somente quando houver código nelas.** Na
Fase 1 existem apenas `src/app/`, `src/main.tsx` e `tests/`.

``` text
src/
├── app/                      # raiz de composição (App.tsx, ligações entre camadas)
├── platform/
│   └── storage/              # BrowserSaveProvider (Fase 8)
├── presentation/             # React
│   ├── hud/
│   └── game-ui/
├── session/                  # estado de sessão da UI (seleção) — Fase 3
├── rendering/                # Babylon.js — Fase 2 (fora de game/)
│   ├── scene/
│   ├── camera/
│   ├── world/                # inclui a conversão grid → espaço Babylon
│   ├── buildings/
│   └── interaction/
├── game/
│   ├── application/
│   │   ├── GameController.ts
│   │   ├── ports/            # SaveProvider (interface) — Fase 8
│   │   └── commands/
│   ├── domain/
│   │   ├── state/
│   │   ├── time/
│   │   ├── economy/
│   │   ├── population/
│   │   ├── construction/
│   │   └── events/
│   └── content/
├── shared/
│   ├── types/
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
  nextEntityId: number;      // Fase 6 (IDs por contador)
  rng: RngState;             // Fase 7 (estado do PRNG, não só a seed)
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

## 6. Tempo e simulação

### 6.1 Relógio e passo fixo [Fase 4]

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

### 6.2 Aba em segundo plano [Fase 4]

Quando a aba fica oculta, o `requestAnimationFrame` é suspenso. Para
evitar uma rajada de passos ao voltar: (a) limite máximo de passos de
recuperação por quadro; (b) a simulação é pausada automaticamente quando
a aba fica oculta.

### 6.3 Determinismo [Fase 4 e Fase 7]

-   Mesmo estado + mesmos comandos ⇒ mesmo resultado.
-   Proibido no domínio: `Math.random`, `Date.now`, `performance.now`
    (regras de ESLint, seção 3.6).
-   Aleatoriedade somente via PRNG do domínio, cujo **estado completo**
    (`rng`) é parte do `GameState` e do salvamento [Fase 7; algoritmo:
    pendência P-07].
-   IDs por contador (`nextEntityId`).
-   O relógio e o tempo real ficam fora do domínio: o domínio recebe
    "execute um passo".

### 6.4 Política numérica e de recursos [Fase 5]

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

## 7. Comandos [Fase 4]

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

Os tipos definitivos deverão distinguir dados de domínio e dados
puramente visuais. Posição e orientação podem ser persistidas, mas
meshes e materiais não.

## 9. Posicionamento no mundo [Fase 2 e Fase 6]

-   O domínio usa um **grid discreto 2D** de células inteiras `(x, y)`.
-   Cada edifício ocupa um `footprint` retangular de células, com
    rotação em passos de 90°.
-   A área construível é **plana e limitada**; o relevo do terreno é
    visual no início.
-   Regras de ocupação (sem sobreposição, dentro da área) vivem no
    domínio e são testadas sem renderização [Fase 6].
-   O espaço do Babylon.js (esquerdo, Y para cima) é uma questão de
    renderização: a conversão grid → mundo 3D existe em **um único
    módulo** de `rendering/world/` [Fase 2].
-   As posições dos edifícios da Fase 2 já são células do grid, definidas
    no cenário inicial do conteúdo.

## 10. Persistência e portabilidade [Fase 8]

A porta `SaveProvider` fica em `game/application/ports/` e é
**assíncrona** (retorna `Promise`), para que a simulação não dependa de
`localStorage` e o backend possa mudar (por exemplo, IndexedDB ou arquivo
no desktop) sem alterar o contrato.

Implementação inicial (`platform/storage/`): - Salvamento local no
navegador, com tratamento de erro e versão do esquema.

Regras: - `schemaVersion` e `contentVersion` no salvamento. - Migrações
**em cadeia** (v1→v2→…), cada uma testada. A população (Fase 9) é a
primeira migração real. - Todo dado carregado é **não confiável**:
validar formato, tipos e **chaves contra o conteúdo** (rejeitar, por
exemplo, `__proto__`), com tratamento de versões incompatíveis. - O
estado ativo só é substituído depois de o dado carregado ser validado;
falha não corrompe a partida em curso. - Partida carregada começa
pausada. - Limitar o tamanho de registros que crescem (como o log de
eventos). - Slots, autosave e exportação em arquivo: pendência P-06.

Possíveis implementações futuras: - Arquivo local no desktop. -
Sincronização em nuvem. - Backend para contas e partidas online.

Não implementar as opções futuras antes de existir requisito.

## 11. Comunicação entre interface e jogo [Fase 3 e Fase 4]

**Fonte única de verdade:** o `GameController` (camada de aplicação)
mantém o estado da partida e expõe `subscribe` e `getSnapshot`. Cada
passo ou comando aplicado publica um **snapshot imutável**.

-   A interface React lê o snapshot por `useSyncExternalStore` e
    **seletores** (por exemplo, "recursos", "edifício X"), para não
    re-renderizar tudo a cada passo. Não se adiciona biblioteca de
    estado.
-   A **barra de recursos lê somente do snapshot**. É proibido copiar
    valores de recursos para o estado do React ou manter números fixos
    na interface. Na Fase 3, antes da economia, a barra lê os recursos
    do `GameState` mínimo (valores iniciais vindos do conteúdo).
-   `rendering/` recebe o snapshot por um contrato injetado pelo `app/`
    e atualiza apenas o que mudou (sem recriar a cena inteira).
-   A interface envia comandos (seção 7) ao controlador. O controlador
    coordena; as regras de validação vivem no domínio (sem duplicação).
-   Seleção segue a seção 5.3 e não passa pelo controlador.

Não permitir que um componente React altere diretamente estoques ou
atributos internos da simulação.

## 12. Performance 3D e ciclo de vida [Fase 2]

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
-   **Componentes React:** React Testing Library com jsdom, introduzidos
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
