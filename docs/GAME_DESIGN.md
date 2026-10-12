# GAME DESIGN DOCUMENT (GDD)

## Projeto: Civilização Alienígena — versão 0.2

**Status:** Revisado na Fase 0 (ver `REVIEW.md` e `DECISIONS.md`)\
**Plataforma-alvo inicial:** Navegador desktop\
**Perspectiva:** 3D, câmera isométrica livre\
**Gênero:** Estratégia e simulação de civilização

**Terminologia:** neste documento, **Era** designa a progressão do jogo (seção 7). **Fase** designa as etapas de desenvolvimento do `ROADMAP.md`.

------------------------------------------------------------------------

## 1. Visão do jogo

O jogador lidera um grupo de sobreviventes após a queda de uma nave em
um planeta alienígena. A missão inicial é sobreviver e organizar o
acampamento; a missão de longo prazo é fundar uma sociedade estável e
decidir como ela será governada.

A experiência combina construção de colônia, gestão econômica, simulação
social e estratégia política. Conforme a comunidade cresce, o jogador
poderá criar instituições, desenvolver tecnologia, explorar o planeta,
formar alianças, organizar forças militares e estabelecer diferentes
regimes políticos. Uma monarquia com corte, dinastia, prestígio e
veneração do governante será uma das possibilidades centrais de design,
sem necessariamente ser o único regime permitido.

A inspiração em jogos como Galaxy Life se limita a conceitos gerais de
construção, expansão e progressão. O universo, a narrativa, os
personagens, a arte, os nomes e os conteúdos devem ser originais.

## 2. Pilares de design

1.  **Construir e transformar:** o planeta deve mudar visivelmente
    conforme a colônia evolui.
2.  **Decisões com consequências:** escolhas econômicas, políticas e
    pessoais afetam outros sistemas.
3.  **Pessoas, não apenas números:** personagens importantes possuem
    competências, relações, ambições e lealdades.
4.  **Emergência sistêmica:** eventos podem surgir de regras combinadas,
    não apenas de roteiros fixos.
5.  **Liberdade de governo:** o jogador pode desenvolver instituições e
    formas de governo diferentes.
6.  **Progressão legível:** cada Era da civilização oferece novos
    problemas, ferramentas e objetivos.
7.  **Fundação extensível:** começar com um escopo pequeno e ampliar a
    simulação sem reescrever a fundação técnica. (Este pilar trata de
    extensibilidade do projeto; requisitos de acessibilidade para o
    jogador são tratados na seção 4.)

## 3. Gênero e referências

**Gênero principal:** Strategy & Civilization Simulation.

**Subgêneros:** Colony Builder, City Builder, Grand Strategy e Dynasty
Simulation.

Referências funcionais: - **Galaxy Life:** construção de base,
edifícios, recursos e expansão. - **RimWorld:** necessidades dos
habitantes e acontecimentos emergentes. - **Crusader Kings:** relações,
dinastias, intrigas e sucessão. - **Anno:** cadeias produtivas,
logística e equilíbrio econômico.

As referências servem para descrever objetivos de design; não devem ser
copiadas em arte, interface, narrativa, personagens ou conteúdo
protegido.

## 4. Público e experiência desejada

-   Jogadores que gostam de construção, gestão e estratégia.
-   Sessões de jogo que permitam pausar, planejar e avançar o tempo.
-   Interface clara, com informações detalhadas quando solicitadas.
-   Experiência inicialmente single-player.
-   Prioridade para desktop; compatibilidade com telas menores poderá
    ser avaliada depois.
-   Acessibilidade para o jogador (navegação por teclado, contraste,
    informação que não dependa só de cor): requisitos mínimos a definir
    junto da interface (pendência P-12 em `DECISIONS.md`).

## 5. Fantasia e papel do jogador

O jogador começa como capitão ou líder de emergência, responsável pelos
sobreviventes. Sua autoridade inicial pode ser baseada na necessidade e
na confiança do grupo, mas precisará evoluir para instituições mais
estáveis.

O jogador não precisa tornar-se rei automaticamente. Pode estabelecer um
conselho, uma república, uma monarquia, um regime autoritário ou um
sistema híbrido, conforme os sistemas forem implementados.

A corte real é uma área importante de conteúdo: funcionários,
conselheiros, cerimônias, prestígio, relacionamentos, consortes,
herdeiros, sucessão, favoritos, rivalidades e conspirações. A
disponibilidade e os efeitos dessas mecânicas devem depender do regime
político e das regras do mundo.

## 6. Ciclo principal de gameplay

1.  Observar a situação: população, estoques, produção, necessidades,
    ameaças e estabilidade.
2.  Definir prioridades: construção, pesquisa, políticas, cargos e
    exploração.
3.  Avançar o tempo.
4.  Resolver os resultados: produção, consumo, crescimento, doenças,
    relações e eventos.
5.  Responder às consequências e oportunidades.
6.  Expandir a colônia e desbloquear novas capacidades.

O ciclo deve permanecer interessante tanto em uma pequena colônia quanto
em uma civilização avançada.

## 7. Progressão planejada (Eras)

As Eras são uma visão de produto e **não** correspondem às Fases do
Roadmap. O MVP (seção 10) cobre apenas um recorte da Era 1.

### Era 1 — Sobrevivência

-   Nave acidentada e recursos iniciais limitados.
-   Grupo pequeno de sobreviventes.
-   Água, alimentos, abrigo e reparos.
-   Primeiras construções e definição de prioridades.

### Era 2 — Colônia

-   Produção estável de recursos.
-   Especialização profissional.
-   Armazenamento, saúde e infraestrutura.
-   Primeiras decisões coletivas e distribuição de responsabilidades.

### Era 3 — Cidade

-   Cadeias produtivas e comércio.
-   Educação, cultura, justiça e instituições.
-   Diferenciação de grupos sociais.
-   Maior complexidade administrativa.

### Era 4 — Governo e reino

-   Constituição, leis, impostos e cargos.
-   Conselho, diplomacia e legitimidade.
-   Corte, dinastia e sucessão caso exista monarquia.
-   Facções e disputas pelo poder.

### Era 5 — Expansão

-   Exploração de regiões.
-   Relações com espécies ou comunidades alienígenas.
-   Defesa, forças militares e conflitos.
-   Novos territórios e recursos.

### Era 6 — Civilização avançada

-   Recuperação e desenvolvimento de tecnologia espacial.
-   Influência regional ou interestelar.
-   Objetivos de longo prazo e finais alternativos.

Essas Eras são uma visão de produto, não uma promessa de que todas
estarão presentes no MVP.

## 8. Sistemas de jogo

### 8.1 Mundo e construção

-   Terreno 3D com relevo e pontos de interesse.
-   Nave acidentada como elemento narrativo inicial.
-   Construções selecionáveis e posicionáveis.
-   Custos, requisitos, ocupação de espaço e melhorias.
-   Recursos visuais provisórios no protótipo; ativos finais em etapa
    posterior.
-   No MVP, as construções ocupam células de um grid discreto, dentro de
    uma área construível plana e limitada. O relevo do terreno é, no
    início, apenas visual. Detalhes em `TECHNICAL_ARCHITECTURE.md` §9.

### 8.2 População e personagens

Cada personagem importante poderá ter: - Identificador único, nome e
retrato/modelo. - Idade ou etapa de vida, quando relevante. - Profissão
e competências. - Saúde, necessidades e estado atual. - Traços de
personalidade. - Lealdade, ambição e reputação. - Relações, objetivos e
segredos, quando aplicável.

Habitantes comuns podem usar uma simulação agregada para evitar custo
excessivo. Não é obrigatório simular individualmente todos os habitantes
desde o início. No MVP, a população é um valor agregado simplificado.

### 8.3 Economia

Recursos iniciais sugeridos: - Alimentos. - Água. - Materiais. -
Energia. - Medicamentos. - Conhecimento. - Créditos. - Influência
política, se fizer sentido para o sistema implementado.

**Subconjunto do MVP:** alimentos, água, materiais e energia. Os demais
recursos só são introduzidos junto dos sistemas que os usam.

Toda produção deve definir insumos, mão de obra, tempo e resultado.
Consumo e produção são calculados pela simulação, não por texto gerado
por IA.

### 8.4 Necessidades e satisfação

Separar conceitos que não são equivalentes: - Necessidades básicas
atendidas. - Bem-estar ou satisfação da população. - Estabilidade
política. - Legitimidade do governo. - Prestígio do governante. - Medo
ou coerção. - Veneração ou culto à personalidade.

Nenhum desses indicadores deve ser um simples substituto dos demais. Um
governante pode ser temido e impopular, ou venerado enquanto a economia
entra em crise.

No MVP, apenas as necessidades básicas (alimentos e água) são
simuladas.

### 8.5 Política e instituições

Sistemas futuros: - Forma de governo. - Leis e constituição. -
Tributação e gastos públicos. - Cargos e competências administrativas. -
Conselhos, facções e interesses. - Justiça, direitos e punições. -
Legitimidade, protestos, revoltas e mudança de regime.

### 8.6 Corte e dinastia

Para governos monárquicos: - Soberano e atributos pessoais. - Camareiro,
tesoureiro, médico, mestre de cerimônias e mestre dos espiões. -
Lealdade, competência, ambição e custo dos funcionários. - Prestígio,
cerimônias, luxo e orçamento da corte. - Consortes, parceiros,
relacionamentos e acordos dinásticos. - Herdeiros, legitimidade,
regência e disputas sucessórias. - Favoritos, rivalidades, intrigas e
conspirações. - Veneração religiosa ou culto à personalidade como opções
políticas, com custos e consequências.

Personagens devem ter agência e objetivos próprios. Relações íntimas
devem ser tratadas entre personagens adultos e com consentimento; não
devem ser representadas apenas como recursos de satisfação do
governante.

### 8.7 Tecnologia e exploração

-   Pesquisa com custos, requisitos e desbloqueios.
-   Recuperação de componentes da nave.
-   Exploração de locais, recursos e ruínas.
-   Descobertas que podem gerar dilemas ou riscos.

### 8.8 Diplomacia e militar

Planejados para etapas posteriores: - Contatos com outras comunidades e
espécies. - Tratados, comércio, alianças, tributos e espionagem. -
Recrutamento, equipamento, treinamento e defesa. - Conflitos com custos
econômicos, humanos e políticos.

## 9. Tempo e eventos

O jogo será pausável, com velocidades ajustáveis. A simulação não pode
depender do número de quadros por segundo.

**Pausa e planejamento:** com o jogo pausado, o jogador pode selecionar
objetos, consultar informações, construir e resolver eventos pendentes.
Essas ações são aplicadas imediatamente, sem avançar o tempo da
simulação (produção, consumo e crescimento só ocorrem quando o tempo
avança). Regras técnicas em `TECHNICAL_ARCHITECTURE.md` §7.

Uma partida carregada de um salvamento sempre começa pausada.

O sistema de eventos deverá suportar: - Gatilhos baseados no estado do
mundo. - Escolhas do jogador. - Custos e efeitos explícitos. - Condições
e consequências futuras. - Registro de eventos relevantes para depuração
e narrativa.

Eventos podem ser definidos em dados estruturados. IA generativa, caso
seja adicionada no futuro, poderá auxiliar em textos e variações
narrativas, mas não terá autoridade direta sobre os valores econômicos
ou o resultado mecânico das regras.

## 10. MVP — primeira versão jogável

O MVP deverá demonstrar um ciclo de jogo completo e pequeno, **alinhado
às Fases do `ROADMAP.md`**. A coluna da direita indica a Fase em que cada
item é entregue.

| #  | Item incluído no MVP                                                                      | Fase |
| -- | ----------------------------------------------------------------------------------------- | ---- |
| 1  | Cena 3D de um planeta alienígena estilizado.                                              | 2    |
| 2  | Nave acidentada.                                                                          | 2    |
| 3  | Câmera com zoom, rotação e pan (D-24).                                          | 2    |
| 4  | Três construções provisórias iniciais (até cinco com as estruturas produtivas).            | 2, 6 |
| 5  | Seleção de objetos e painel de informações.                                               | 3    |
| 6  | Barra de recursos que exibe o **estado real** da simulação (sem dados de demonstração).    | 3, 5 |
| 7  | Estado de jogo independente da cena gráfica.                                              | 2, 4 |
| 8  | Passagem do tempo com pausa e velocidade básica.                                          | 4    |
| 9  | Produção e consumo mínimos (alimentos, água, materiais, energia) e regra de falta.        | 5    |
| 10 | Construção funcional simples: custo, requisitos e posicionamento válido.                  | 6    |
| 11 | Um evento com escolha e consequência.                                                     | 7    |
| 12 | Salvamento e carregamento local.                                                          | 8    |
| 13 | População inicial simplificada com necessidade de alimentos e água e alertas de crise.    | 9    |
| 14 | Objetivo curto "estabilizar o acampamento", com resultado de sucesso ou fracasso.          | 9    |
| 15 | Tutorial mínimo.                                                                          | 9    |
| 16 | Testes e build de produção.                                                               | todas |

O salvamento (item 12) deixa de ser "se viável": está no Roadmap e só
sai do MVP por decisão registrada em `DECISIONS.md`. As condições
exatas de sucesso e fracasso do item 14 são definidas **antes da Fase 9**
(pendência P-08) e valem apenas para o MVP; as condições do jogo
completo continuam em aberto (seção 12).

Fora do MVP: - Multiplayer. - Backend obrigatório. - Economia
avançada. - Guerras completas. - Dinastias completas. - Diplomacia
avançada. - IA generativa integrada ao jogo. - Mundo procedural em
escala massiva. - Modelos 3D finais para todos os personagens e
edifícios. - Monetização. - Política, personagens e corte (Fase 10 do
Roadmap, depois do MVP).

## 11. Critérios de qualidade

-   O jogador entende o estado básico da colônia.
-   Selecionar uma construção atualiza a interface.
-   A interface exibe apenas estado proveniente da simulação; não há
    valores fictícios ou duplicados na interface.
-   A seleção atual é estado da interface e não é gravada no
    salvamento.
-   A passagem do tempo produz resultados determinísticos para um mesmo
    estado e conjunto de comandos, quando não houver aleatoriedade
    explicitamente controlada.
-   As regras econômicas podem ser testadas sem renderizar a cena.
-   O jogo não perde estado ao pausar e retomar a simulação.
-   A interface não apresenta controles falsos.
-   O projeto executa e gera build de produção sem erros.
-   O desempenho é medido antes de adicionar grandes quantidades de
    objetos ou habitantes.

## 12. Questões em aberto

Não tratar as opções abaixo como decisões finais sem análise: - Nome
definitivo do jogo. - Estilo de arte final e grau de realismo. -
Dimensão do mapa e geração do terreno. - Condições definitivas de
vitória e derrota do jogo completo (as do MVP: pendência P-08). -
Profundidade da simulação individual de habitantes. - Escopo e regras
detalhadas de combate. - Possível modo online futuro. - Estratégia final
de distribuição para PC.
