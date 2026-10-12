# ROADMAP DE DESENVOLVIMENTO

## Projeto: Civilização Alienígena — versão 0.2

**Estratégia:** entregas incrementais, sempre executáveis e
verificáveis.\
**Regra:** concluir e validar uma fase antes de ampliar
significativamente o escopo.\
**Terminologia:** **Fase** designa as etapas de desenvolvimento deste
documento. A progressão do jogo no GDD usa **Era**.\
**Documentos relacionados:** `GAME_DESIGN.md`,
`TECHNICAL_ARCHITECTURE.md`, `DECISIONS.md` (decisões e pendências por
fase) e `REVIEW.md` (revisão da Fase 0).

------------------------------------------------------------------------

## Princípios de execução

1.  O Claude Sonnet trabalha em tarefas pequenas com critérios de aceite
    explícitos.
2.  Nenhuma fase é considerada concluída apenas porque o código foi
    escrito.
3.  Executar typecheck, lint, testes e build conforme os scripts
    disponíveis.
4.  Revisar o diff e testar manualmente as mudanças visíveis.
5.  Fazer commits pequenos e funcionais.
6.  Atualizar GDD e arquitetura quando as regras mudarem.
7.  Não implementar todos os sistemas de design no primeiro ciclo.
8.  Usar ativos provisórios no início; não bloquear o projeto pela arte
    final.
9.  Não iniciar uma fase sem aprovação explícita do responsável pelo
    projeto.

## Fase 0 — Definição e planejamento

### Tarefas

-   Revisar `GAME_DESIGN.md`.
-   Revisar `TECHNICAL_ARCHITECTURE.md`.
-   Confirmar o escopo do MVP.
-   Registrar decisões pendentes e riscos.
-   Definir critérios de aceite para a primeira cena.

### Entregáveis

-   Documentos aprovados.
-   Backlog inicial.
-   Decisões técnicas registradas (`DECISIONS.md`, `REVIEW.md`).

### Critério de saída

O escopo inicial está claro e não depende de decisões importantes
escondidas.

## Fase 1 — Estrutura do projeto

### Tarefas

-   Criar repositório Git local (sem remoto por enquanto).
-   Organizar a documentação em `docs/`.
-   Configurar Vite, React e TypeScript.
-   Habilitar TypeScript estrito e o alias `@/` para `src/`.
-   Configurar Babylon.js (`@babylonjs/core`).
-   Configurar Vitest, ESLint e Prettier, incluindo as regras de
    dependência entre camadas (Arquitetura §3.6).
-   Criar scripts de desenvolvimento, validação e build.
-   Criar teste básico de inicialização e teste headless do Babylon.js
    com `NullEngine`.
-   Criar README com requisitos e comandos.

### Critérios de aceite

-   Instalação reproduzível a partir das instruções (`npm ci`).
-   Aplicação inicia localmente.
-   Testes de exemplo passam (inicialização e `NullEngine`).
-   Typecheck, lint e build passam.
-   As regras de dependência entre camadas foram verificadas com um caso
    de violação temporário.
-   Nenhuma funcionalidade de jogo é necessária ainda (sem terreno,
    câmera, nave, construções nem cena gráfica).

## Fase 2 — Primeira cena 3D

**Status:** concluída e verificada. Detalhes em
`TECHNICAL_ARCHITECTURE.md` §17 e em `DECISIONS.md` (D-24 a D-34). **Pendências que não bloqueiam a fase:** medir o FPS em
hardware real (P-02) e confirmar o pan com o botão direito do mouse em
um mouse real (P-14).

### Tarefas

-   Resolver a pendência P-01 (câmera) antes de começar (resolvida: D-24).
-   Criar o **`GameState` mínimo somente leitura** (`schemaVersion`,
    `contentVersion`, `tick`, `resources`, `buildings` com
    `instanceId` estáveis) a partir de um cenário inicial em
    `game/content`, com posições em células do grid.
-   Inicializar Babylon.js dentro do ciclo de vida React, em
    `src/rendering/` (fora de `game/`).
-   Criar cena, câmera e iluminação.
-   Criar terreno provisório.
-   Adicionar nave acidentada e três construções provisórias, **criadas
    a partir das `BuildingInstance` do estado**, nunca de dados fixos
    na renderização.
-   Implementar zoom, rotação, pan e limites de câmera (pan incluído, D-24).
-   Incluir, só em desenvolvimento, um indicador simples de FPS (D-32).
-   Garantir redimensionamento da cena.
-   Liberar recursos ao desmontar a aplicação (`dispose` idempotente,
    StrictMode ativo, HMR e perda de contexto WebGL tratados).
-   Concentrar a conversão grid → espaço do Babylon em um único módulo.

### Critérios de aceite

-   A cena funciona no navegador.
-   A câmera responde aos controles.
-   Não há inicializações duplicadas ao remontar componentes.
-   A limpeza de recursos está implementada.
-   Cada objeto visual de edifício corresponde a um `instanceId` do
    estado.
-   `rendering/` não importa código de `game/` em tempo de execução
    (somente tipos).
-   Build e verificações continuam passando.

## Fase 3 — Seleção e interface

**Status:** concluída e verificada (relatório da fase). Detalhes em
`TECHNICAL_ARCHITECTURE.md` §18 e em `DECISIONS.md` (D-35 a D-40).
**Pendências que não bloqueiam a fase:** acessibilidade do mundo 3D
(P-16), medição real de FPS (P-02) e pan com o botão direito em um mouse
real (P-14).

### Tarefas

-   Introduzir React Testing Library e jsdom para testes de componentes.
-   Criar o store de **seleção de sessão** em `src/session/` (fora do
    `GameState`, não persistido).
-   Permitir selecionar construções por mouse, convertendo o picking em
    `instanceId` e entregando-o ao store por callback.
-   Criar o `GameController` com `subscribe`/`getSnapshot` para expor o
    estado atual (somente leitura nesta fase).
-   Criar painel React de detalhes, lendo do snapshot.
-   Criar barra superior provisória de recursos, **lendo somente do
    snapshot** (sem valores copiados ou fictícios na interface).
-   Exibir estado vazio quando nada estiver selecionado.
-   Tratar seleção de objetos desconhecidos ou removidos.
-   Definir requisitos mínimos de acessibilidade da interface (P-12).

### Critérios de aceite

-   Selecionar objetos diferentes atualiza corretamente o painel.
-   A seleção não depende de nomes de meshes como identificadores
    permanentes.
-   A seleção não faz parte do `GameState` e não é salva.
-   Nenhum valor de recurso existe na interface fora do snapshot.
-   A interface permanece utilizável em diferentes tamanhos de janela.

## Fase 4 — Estado do jogo e relógio

**Status:** concluída, validada e aprovada. Detalhes em
`TECHNICAL_ARCHITECTURE.md` §19 e em `DECISIONS.md`
(D-41 a D-46; P-04 resolvida). **Pendências que não bloqueiam a fase:**
verificação com uma aba realmente em segundo plano (P-18) e feedback dos
comandos recusados na aplicação (P-17). Nenhum comando de simulação
concreto existe ainda (Fases 6 e 7): só a infraestrutura, testada com
comandos de teste.

### Tarefas

-   Resolver a pendência P-04 (duração do tick e velocidades).
-   Completar o modelo de estado serializável.
-   Evoluir o controlador de partida para aceitar comandos.
-   Criar o `SimulationClock` com **passo fixo**, pausa, retomada e
    velocidade básica; `paused` e `speed` fora do `GameState`.
-   Implementar comandos de **controle** e de **simulação** com as
    regras da Arquitetura §7 (inclusive o comportamento com o jogo
    pausado).
-   Limitar passos de recuperação e pausar automaticamente com a aba
    oculta.
-   Aplicar as regras de determinismo (sem `Math.random`, `Date.now`,
    `performance.now` no domínio).
-   Introduzir `Result` com códigos de erro para validação de comandos.
-   Separar render loop de simulação.
-   Criar testes para o relógio, comandos e transições de estado.

### Critérios de aceite

-   A simulação avança independentemente do FPS.
-   Pausar interrompe a simulação (o `tick` não avança).
-   Com o jogo pausado, comandos de controle funcionam e comandos de
    simulação válidos são aplicados sem avançar o `tick`.
-   Uma partida carregada ou iniciada começa pausada.
-   O estado pode ser inspecionado sem inicializar Babylon.js.
-   Testes cobrem os principais comportamentos do relógio e dos
    comandos.

## Fase 5 — Economia mínima

**Status:** concluída e validada; aguardando aprovação para iniciar a
Fase 6. Detalhes em `TECHNICAL_ARCHITECTURE.md` §20 e em `DECISIONS.md`
(D-47 a D-52; P-19 a P-21 novas). **Pendências que não bloqueiam a fase:**
a verificação com uma aba realmente em segundo plano (P-18, herdada da
Fase 4) e o balanceamento dos números provisórios (P-21). Alimentos e
materiais ainda não têm produtor nem consumidor: o consumo de alimentos é
da população (Fase 9) e os materiais entram com a construção (Fase 6).

### Tarefas

-   Definir alimentos, água, materiais e energia.
-   Implementar estoques com **inteiros em unidades escaladas** e
    validação de valores (D-14).
-   Criar produção e consumo simples, com a ordem documentada.
-   Ligar a simulação à barra de recursos já existente.
-   Implementar uma regra de falta de recursos (sem estoque negativo).
-   Criar testes unitários para casos normais e extremos.

### Critérios de aceite

-   Os recursos mudam de acordo com regras documentadas.
-   A simulação não produz valores inválidos silenciosamente.
-   Produção e consumo podem ser testados sem renderização.
-   A interface exibe o estado real da simulação, não valores
    duplicados.

## Fase 6 — Construção funcional

### Tarefas

-   Definir dados estáticos de edifícios e escolher a validação do
    conteúdo (P-05).
-   Implementar custo de construção.
-   Permitir posicionamento no grid, em uma área limitada.
-   Validar ocupação e colisão básica no domínio (footprint e rotação
    de 90°).
-   Introduzir IDs por contador (`nextEntityId`).
-   Criar uma ou duas estruturas produtivas.
-   Mostrar custos e requisitos antes de confirmar a construção.
-   Retornar códigos de erro de validação e traduzi-los na interface.

### Critérios de aceite

-   Não é possível construir sem recursos suficientes.
-   Construções inválidas são rejeitadas com feedback claro.
-   O estado do edifício é separado do mesh gráfico.
-   Os custos, a ocupação e os resultados possuem testes.

## Fase 7 — Primeiro evento narrativo

**Status:** evento inicial implementado; `typecheck` passou. A validação por testes e a revisão visual ainda estão pendentes.

### Tarefas

-   ~~Resolver P-07 (PRNG) e P-10 (idioma e textos) antes de começar~~ (resolvidas em D-59 e D-60).
-   Criar um evento com contexto e duas ou três escolhas.
-   Definir pré-condições e efeitos estruturados (conjunto fechado de
    tipos de efeito).
-   Aplicar os efeitos ao estado do jogo por comandos validados.
-   Se houver aleatoriedade, usar o PRNG do domínio, com estado dentro
    do `GameState`.
-   Registrar a resolução para depuração (com limite de tamanho).
-   Exibir feedback visual.

### Critérios de aceite

-   As escolhas produzem consequências reproduzíveis.
-   O evento não altera o estado por caminhos ocultos.
-   O sistema de eventos pode ser testado sem a interface.

## Fase 8 — Salvamento e restauração

### Tarefas

-   Resolver P-06 (slots, autosave, arquivo).
-   Definir a porta `SaveProvider` **assíncrona** em
    `game/application/ports/`.
-   Implementar salvamento local em `platform/storage/`.
-   Versionar o esquema de dados e o conteúdo.
-   Criar a estrutura de migrações em cadeia.
-   Validar dados carregados, inclusive chaves contra o conteúdo.
-   Tratar falhas e versões incompatíveis sem corromper o estado ativo.
-   Criar testes de serialização e restauração.

### Critérios de aceite

-   Uma partida salva pode ser carregada com os valores esperados.
-   Dados inválidos não corrompem silenciosamente o estado ativo.
-   O domínio não depende diretamente de `localStorage`.
-   Uma partida carregada começa pausada.

## Fase 9 — Protótipo de sobrevivência jogável

### Pré-requisito

Definir, no GDD, as condições de sucesso e fracasso de "estabilizar o
acampamento" (P-08) e atualizar o MVP.

### Tarefas

-   Criar um objetivo curto: estabilizar o acampamento.
-   Adicionar população inicial simplificada, introduzida por
    **migração de esquema v1→v2 com teste** (D-18).
-   Implementar necessidade de alimentos e água.
-   Exibir alertas de crise.
-   Adicionar tutorial mínimo.
-   Ajustar interface e feedback.

### Critérios de aceite

-   Uma pessoa consegue jogar por 15–30 minutos.
-   As decisões alteram o estado e têm consequências compreensíveis.
-   É possível chegar a um resultado de sucesso ou fracasso.
-   Salvamentos anteriores à população são migrados corretamente.
-   O jogo não exige editar arquivos ou variáveis manualmente.

## Fase 10 — Política, personagens e corte

Somente iniciar depois de o protótipo econômico ser estável.

### Etapas futuras

1.  Entidades de personagens e traços.
2.  Competências, lealdade e ambição.
3.  Cargos administrativos e conselhos.
4.  Satisfação popular, legitimidade e autoridade.
5.  Formas de governo e leis.
6.  Corte real, orçamento e prestígio.
7.  Relações, consortes, herdeiros e sucessão.
8.  Intrigas, conspirações e veneração do governante.

Cada etapa deve ser projetada, testada e integrada separadamente. Não
implementar toda a corte em um único prompt.

## Fase 11 — Expansão de conteúdo

Possíveis sistemas, em ordem a definir após testes: - Tecnologia e
recuperação da nave. - Exploração territorial. - Saúde e doenças. -
Cultura e religião. - Comércio e cadeias produtivas. - Diplomacia e
facções. - Segurança, forças militares e guerras. - Sociedades
alienígenas. - Progressão de cidade para reino e império.

## Fase 12 — Polimento e preparação para distribuição

### Tarefas

-   Testes de desempenho com cenas representativas.
-   Otimização de meshes, materiais, sombras e objetos repetidos.
-   Melhorias de acessibilidade e usabilidade.
-   Tratamento de erros e salvamentos.
-   Arte, animação, som e feedback.
-   Verificação do build de produção.
-   Avaliar empacotamento desktop com Electron ou Tauri (P-13).
-   Testar diferenças de armazenamento, tela cheia, entrada e
    desempenho.

### Critério de saída

O jogo possui um ciclo central estável, documentação de instalação e um
plano validado para a distribuição escolhida.

------------------------------------------------------------------------

## Modelo de trabalho com o Claude Sonnet

Para cada tarefa, fornecer: 1. Contexto do jogo. 2. Arquivos relevantes
e regras existentes. 3. Objetivo único. 4. Escopo incluído e
explicitamente excluído. 5. Critérios de aceite. 6. Comandos de
verificação disponíveis.

Ao terminar, exigir: - Resumo das mudanças. - Lista dos arquivos
alterados. - Decisões técnicas tomadas. - Resultado real dos testes,
lint, typecheck e build executados. - Limitações conhecidas. - Próxima
tarefa sugerida, sem implementá-la automaticamente.

## Definition of Done

Uma tarefa só está concluída quando: - O comportamento solicitado está
implementado. - Os critérios de aceite foram verificados. - Os testes
relevantes passam. - O projeto compila e gera build, quando aplicável. -
Não há regressões conhecidas introduzidas pela mudança. - A documentação
foi atualizada quando necessário. - O usuário consegue executar e
validar a entrega.

## Observação sobre cronograma

Não estimar a data de lançamento com precisão antes de concluir as
primeiras fases e medir a velocidade real de desenvolvimento. A
prioridade é validar o ciclo de jogo e a arquitetura antes de aumentar o
escopo.
