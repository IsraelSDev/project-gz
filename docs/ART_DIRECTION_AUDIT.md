# Auditoria visual e direção de arte

**Fase 16.1 — auditoria documental concluída.** Esta entrega inspeciona o código e registra uma direção de arte e um plano incremental. Nenhum modelo, textura, dependência ou regra de gameplay foi alterado nesta fase; nenhuma imagem conceitual é tratada como modelo pronto.

## Escopo inspecionado

Arquivos principais: `src/rendering/props/propKit.ts`, `buildings/buildingModels.ts`, `buildings/BuildingLayer.ts`, `world/terrain.ts`, `world/heightField.ts`, `world/scatter.ts`, `world/scenery.ts`, `world/crashedShip.ts`, `world/StaticWorld.ts`, `scene/createSceneContext.ts`, `scene/materials.ts`, `scene/palette.ts`, `camera/cameraRig.ts`, `military/UnitLayer.ts`, `GameRenderer.ts`, `app/GameCanvas.tsx`, `app/worldSnapshot.ts`, `game/content/buildings.ts` e `game/content/characters.ts`.

Também foram verificados diretórios e formatos de assets fora de `node_modules/` e `dist/`: não existe `public/`, `src/assets/` ou arquivo local `.glb`, `.gltf`, `.obj`, `.fbx`, `.blend`, imagem ou textura de jogo. O projeto possui Babylon.js e geradores procedurais próprios; não possui pipeline ou carregador de modelos externos configurado.

## Inventário atual

| Elemento | Implementação encontrada | Classe | Observação |
| --- | --- | --- | --- |
| Terreno e relevo | Malha Babylon gerada em runtime, grade 100 × 100 subdivisões, altura por ruído e cores por vértice; a área construível é plana. | Aproveitável como sistema; aparência provisória | Mantém construção e relevo determinístico; não é um modelo artístico final. |
| Céu e horizonte | Domo esférico com gradiente por vértice, plano distante e duas luas em esferas segmentadas. | Provisório | Base de composição utilizável; geometria e fenômenos específicos do planeta ainda não foram desenhados como arte final. |
| Nave acidentada | Casco, asas, motor, cabine, antena, faíscas e solo revolvido feitos de caixas, cilindros e esferas fundidos por conjunto. | Provisório | Hero asset importante para a primeira impressão; está integrada ao cenário sem entidade no save. |
| Edifícios | Nove IDs com construtores dedicados, compostos por caixas, cilindros, esferas e toros. Estufa e cultivador proteico compartilham modelo; todos são marcados como provisórios no código. | Provisório | Habitat, extrator e matriz solar são as primeiras estruturas vistas; footprint, pivô, orientação, seleção e sombra já têm contratos estáveis. |
| Vegetação, cristais e rochas | Seis famílias: talos, cogumelos, cristais, rochas pequenas, rochas grandes e destroços. Modelos de poucas primitivas e cores por vértice. | Provisório | Distribuição pseudoaleatória determinística; até 440 props e mais 16 destroços tentados. Um mesh por família usa thin instances. |
| Recursos coletáveis | Não há objetos coletáveis no mundo. Recursos existem no estado e na interface, sem mesh, posição ou ciclo de coleta 3D. | Ausente | O próximo pacote só deve criar a camada visual se o escopo de gameplay posterior definir como esses objetos aparecem e são coletados. |
| Personagens civis | Nenhum colonizador é desenhado na cena 3D. Rostos CSS da HUD são avatares de interface com forma/cor; não são modelos 3D. | Provisório | Nomes, espécies, traços e competências são dados de domínio, separados da representação. |
| Unidades militares | Corpos esféricos pequenos com olhos e crista simples, material por tipo/suprimento; transformações ficam em `UnitLayer`. | Provisório, parcialmente aproveitável | Já estabelece escala e presença de criaturas, mas não constitui um alienígena de personagem final nem tem animação. |
| Materiais e luz | `StandardMaterial` compartilhado, cor por vértice, superfícies sem texturas; materiais emissivos separados. Luz hemisférica e direcional, sombra PCF de 2048, neblina exponencial. | Aproveitável como base técnica | Reuso reduz variedade de materiais; falta pipeline PBR e superfícies com acabamento diferenciado. |
| Interface | HUD CSS escura em violeta, ciano e âmbar, painéis e avatares geométricos. | Aproveitável | A hierarquia e a paleta são coerentes; ícones/avatares e acabamento ainda podem evoluir junto da arte. |

**Nenhum asset visual 3D atual foi classificado como definitivo.** O kit de primitivas, a paleta, os contratos de escala/orientação, a geração do terreno, a distribuição determinística, os thin instances e as camadas de ciclo de vida são infraestrutura aproveitável, não substitutos de modelos finais.

## Criação, atualização, seleção e descarte

1. `app/worldSnapshot.ts` é a ponte única: converte instâncias persistidas de edifícios e unidades em especificações visuais; `GameState` não guarda mesh, material, arquivo ou animação.
2. `GameCanvas` cria e descarta `GameRenderer` no ciclo de vida React. O renderizador cria engine, cena, câmera e camadas; redimensiona por `ResizeObserver`, sinaliza perda/restauração de contexto e possui descarte idempotente.
3. `BuildingLayer.sync` faz diff por `instanceId`, cria/remover modelos e atualiza posição/rotação; seleção usa metadado no nó e marcador transitório. `UnitLayer` mantém meshes fora do estado. `StaticWorld` reúne terreno, grid, vegetação e nave, e os libera explicitamente.
4. Seleção e prévia são estado de sessão. Construções são persistidas por ID, coordenada e rotação; a aparência é recriada a partir do catálogo ao carregar. Saves não dependem dos assets nem armazenam dados de renderização.
5. Picking ignora props e usa os metadados dos edifícios. Um asset futuro deve preservar essa regra: raiz identificável, meshes decorativos não selecionáveis e proxy de clique estável.

## Diagnóstico visual e técnico

- **Paleta:** o planeta atual combina céu violeta/coral, areia ocre, musgo verde-azulado, flora rosa/ciano/violeta e detalhes metálicos. A direção de cor já é distintiva, mas o próprio módulo chama a paleta de provisória.
- **Silhueta e acabamento:** há variedade de primitivas, formas e pequenos sinais luminosos, porém materiais lisos de cor sólida e arestas geométricas revelam o blockout. O kit funde peças com material compartilhado, então não há texturas, mapas normais, roughness controlada por peça ou decalques.
- **Composição:** câmera perspectiva ArcRotate com campo de visão de 0,7 rad, limite de zoom/pan e ajuste pelo aspecto da janela. Domo e luas definem um horizonte de fim de tarde; ainda há somente um planeta/bioma jogável e nenhum clima/efeito animado do ambiente.
- **Escala:** cada célula do grid mede 2 unidades Babylon; construções usam footprint convertido e base em `y=0`, orientação 0 voltada para `-Z`. Não existe escala visual aprovada para civil, porta, nave e vegetação em conjunto.
- **Desempenho:** props repetidos usam thin instances e meshes/material são compartilhados. O terreno usa 10.201 vértices; a dispersão tenta no máximo 440 objetos ambientais e 16 destroços. A arquitetura permite remover/recriar camadas e não reinicializa a cena por tick. Sombras em vegetação e limites altos de geometria precisam ser revistos com assets finais.
- **Métricas disponíveis:** a documentação da Fase 12 registra medição histórica aproximada em NullEngine de 199 mil triângulos, 24 meshes, 456 instâncias e 13 materiais. Ela não foi recontada nesta auditoria e não mede FPS, GPU, memória ou WebGL. O código atual não fornece uma medição de navegador atual nesta tarefa.
- **Validação visual:** nenhum navegador/WebGL ou captura de tela foi usado nesta auditoria. A direção proposta não é declarada visualmente aprovada em execução real.

## Direção de arte oficial definida

### Tom e silhuetas

3D estilizado, colorido e com personalidade, com leitura de estratégia em câmera alta. Formas macias e assimétricas coexistem com detalhes tecnológicos precisos; evitar acabamento plástico uniforme, excesso de neon e proporções de brinquedo. Aliens são pequenos, robustos, expressivos e não humanoides: volumes corporais simples, poucos traços faciais legíveis e uma característica de espécie que funcione à distância. Não padronizar todas as espécies à mesma cabeça/olhos/silhueta.

Construções comunicam função primeiro — abrigo, água, energia, alimento, ciência ou indústria — por uma massa principal reconhecível, anexos funcionais e 1–3 sinais de cor/luz. Evitar ruído de peças pequenas que desaparece na câmera estratégica.

### Cor e contraste

Manter como ponto de partida o céu violeta/coral, terreno ocre, vegetação verde-azulada e acentos ciano/âmbar. Definir cores por planeta e por família de material em tokens reutilizáveis. Cada objeto deve ter uma cor dominante, uma cor de estrutura e um acento limitado; luz emissiva fica reservada a informação funcional. Silhueta, valor claro/escuro e marcador de seleção precisam continuar legíveis sobre areia, musgo, sombras e UI.

### Materiais e luz

Preferir superfícies stylized PBR com roughness variada e metal restrito a armações/peças técnicas. Usar albedo/vertex color para a cor-base; adicionar normal/roughness somente quando uma revisão em navegador mostrar benefício na escala da câmera. Manter uma luz direcional principal quente, preenchimento frio e uma única sombra direcional com orçamento explícito. Priorizar sombras de contato legíveis, sem bloom obrigatório nem várias luzes por asset.

### Escala, orientação e animação

Preservar a célula de 2 unidades, pivô centrado no footprint, base em `y=0`, frente 0 em `-Z` e rotação do grid. Proporção inicial para a folha comparativa: alien adulto com 0,9–1,2 unidade de altura (cerca de 45–60% de uma célula), porta com 1,8–2,2, edifício comum com 2,5–4,5 e vegetação baixa abaixo de 1,5. Assim o alien fica legível e pequeno diante das estruturas. Validar esses números no enquadramento inicial e no zoom mínimo antes de fixá-los como escala de produção.

Animações devem reforçar vida sem interferir na leitura ou no tick: idle curto com respiração/balanço de antena, movimentos suaves e ciclos defasados por instância. Começar com um único alien e poucas animações. Animação visual não altera disponibilidade, cargo, combate ou qualquer regra do jogo.

### Desempenho e organização

- Uma mesh consolidada por objeto simples e thin instances para vegetação repetida; evitar uma malha por folha/peça decorativa.
- Limite inicial sugerido (a revisar por medição): terreno sem aumento da grade atual; edifício comum até 4 mil triângulos; nave hero até 10 mil; alien até 5 mil; prop ambiental até 1 mil por protótipo. Usar LOD/culling só quando medições em navegador demonstrarem necessidade.
- Texturas em atlas por família/bioma, resolução inicial 512–1024 para objetos comuns e até 2048 para a nave; compressão e tamanho baixado precisam ser medidos em dispositivo-alvo. Não duplicar textura/material por instância.
- Assets 3D em GLB, uma origem por asset em `public/assets/<bioma>/`; fonte autoral em pasta de produção separada e não carregada em runtime. Usar nomes estáveis por função/ID, ex.: `building-habitat-module.glb` e `alien-nuvori-aru.glb`.
- Manter manifesto de origem, autor/licença, versão, escala, triângulos, texturas, animações e dependências. Assets externos só entram com licença compatível registrada.
- O projeto não tem `public/` nem dependência de loader glTF. Quando o primeiro GLB aprovado estiver pronto, avaliar/adicionar `@babylonjs/loaders` e resolver URLs por base path do Vite. Carregamento assíncrono precisa manter fallback e descarte correto; não adicionar agora.

Os números de triângulos e textura acima são **orçamentos iniciais propostos**, não medições de desempenho nem metas já aprovadas. Medir cena inicial e cenário com muitos edifícios/props em WebGL antes de ampliar o orçamento.

## Plano do primeiro pacote de arte

| Ordem | Entrega | Técnica recomendada | Dependências | Dificuldade | Critérios de aceite |
| --- | --- | --- | --- | --- | --- |
| 1 | Terreno inicial | Refinar o gerador de malha/vertex color atual com formas e paleta autorais do bioma; preservar altura, seed, planalto plano, grade e limites de construção. Só testar textura atlas se a captura real justificar. | Folha de estilo, mapa de cor, câmera existente; nenhum loader para a primeira iteração. | Média | Silhueta do planalto e terreno legíveis; mesma seed gera a mesma cena; terreno continua plano onde se constrói; sem regressão de picking, culling visual ou build. |
| 2 | Nave acidentada | Modelar um GLB hero original em Blender, exportar malha consolidada com pivô e escala do contrato; manter transform de cenário, material emissivo contido e decalque/solo como camada separada. | Conceito aprovado, licença/fonte, avaliação de loader GLB, footprint e orientação. | Alta | Nariz/asa/dano legíveis no zoom inicial; não bloqueia seleção atrás incorretamente; recebe sombra; não altera posição de cenário nem save; carregamento e descarte sem vazamentos em testes. |
| 3 | Três edifícios iniciais | Produzir habitat, extrator e matriz solar como GLB modular, com paleta e superfícies comuns; preservar proxy de seleção e compartilhar materiais/texturas por atlas. | Kit de materiais, guia de escala/pivô, loader, manifesto. | Alta | Todos respeitam footprint 3×3/2×2/3×2, pivô central, base y=0 e frente -Z; rotação 90° continua correta; nome/ID e seleção permanecem estáveis; custo/estado/salvamento não mudam. |
| 4 | Vegetação e naturais | Criar protótipos autorais de talo, cogumelo, cristal e duas rochas; exportar variantes de baixo custo ou gerar meshes otimizados; continuar distribuição determinística e thin instances. | Direção do bioma, protótipos do terreno e orçamento por família. | Média | Mesmo seed e placements preservam estabilidade; famílias distinguíveis à câmera real; área construível continua livre; chamadas de desenho não crescem uma por instância. |
| 5 | Recursos coletáveis | Definir primeiro, numa fase de gameplay apropriada, o que nasce, como seleciona/coleta e como persiste. Depois criar modelos simples para alimento, água, material e energia como representação visual dos mesmos IDs. | Contrato funcional de coleta e localização, direção de ícones 3D, loader se forem GLB. | Média/alta | Cada recurso é distinguível por silhueta e cor; sem duplicar estoque no domínio; animação/seleção funciona na câmera; zero mudança de economia sem comando de coleta aprovado. Não implementar agora. |
| 6 | Primeiro alienígena definitivo | Criar Nuvori adulto original como GLB rigado e uma animação idle curta; testar escala/legibilidade primeiro no `UnitLayer` ou preview isolado, sem criar colonos individuais no estado. | Silhueta aprovada, rig simples, loader e fallback; captura desktop WebGL. | Alta | Expressivo e não humanoide a distância; identidade distinta das outras espécies; idle determinístico/defasado; renderização não cria entidade de população nem altera governo/sobrevivência; dispose libera rig, animações e meshes. |

### Critérios gerais do pacote

- Aprovação visual por captura em navegador/WebGL desktop com câmera inicial, zoom e ao menos uma proporção de tela estreita e larga; NullEngine sozinho não basta.
- Comparar cena inicial e cenário ampliado antes/depois: FPS/frame time, número de meshes, instâncias, materiais, triângulos, memória e bytes de assets. Registrar hardware e navegador, sem declarar meta sem medição.
- Repetir teste de seleção/construção/rotação, carregar save, resize e descarte do renderer.
- Conferir proveniência/licenças no manifesto, caminhos relativos de produção, cache e fallback de carregamento.
- Manter as primitivas atuais como fallback até os modelos aprovados serem substitutos comprovados.

## Riscos e decisões em aberto

- O maior risco não é falta de código de renderização, mas não haver pipeline, fonte/manifesto de assets, escala visual aprovada ou validação WebGL nesta máquina.
- GLB demanda loader e rotina assíncrona segura; introduzir loader antes da aprovação do primeiro modelo aumenta bundle inicial e manutenção.
- Texturas e animação podem aumentar bytes, draws e custo de GPU; os orçamentos precisam ser medidos e revistos em hardware-alvo.
- Definir se artistas usarão Blender e qual licença/fonte antes de incorporar conteúdo externo. Não há licença de asset 3D para registrar hoje.
- Recursos coletáveis e colonos visíveis dependem de decisões de gameplay/simulação; manter fora do pacote visual até haver contratos próprios.
- A primeira aprovação solicitada é para o plano/direção. Produção de modelos, texturas ou animações em larga escala fica aguardando esse aceite.
