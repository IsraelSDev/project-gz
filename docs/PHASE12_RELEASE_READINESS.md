# Fase 12 - prontidao para distribuicao

**Escopo:** auditoria do prototipo e correcoes pequenas para navegador. Nao houve implementacao de novos sistemas grandes.

## Auditoria priorizada

| Prioridade | Evidencia | Acao |
| --- | --- | --- |
| Alta para liberacao | Nenhum executavel de navegador acessivel nem Playwright no ambiente; testes headless nao provam WebGL, entrada real, redimensionamento ou pausa em aba oculta. | Registrado como pendencia; nenhum navegador ou FPS real foi declarado. |
| Media | CharacterGovernmentPanel lia o GameState completo. O snapshot muda a cada tick, mesmo quando elenco, cargos e total de sobreviventes nao mudam. | Agora assina somente personagens, governo e sobreviventes; teste com Profiler confirma nenhuma renderizacao em cinco ticks sem mudanca desses dados. |
| Media | A HUD de pesquisa/exploracao exibia codigos internos de erro e nomes de recursos em ingles. | Mensagens e custos apresentados em pt-BR; requisitos de cientista e laboratorio ficam explicitos. |
| Baixa | README ainda dizia que so a Fase 6 estava implementada e negava salvamento e eventos; notas da Fase 11 tinham perda de acentos. | README e documentos afetados atualizados; texto corrompido corrigido. |
| Observacao, sem correcao especulativa | Build inicial: bundle principal 1.347,23 kB minificado / 344,51 kB gzip (Vite); limite de aviso configurado em 1.400 kB. Sem medicao de rede ou tempo de carregamento no navegador. | Mantido o grafo de modulos; nao foi demonstrado gargalo que justifique mais divisoes. Build usa caminhos relativos para raiz ou subpasta estatica. |

## Metricas e limites

A documentacao anterior registra linha de base Babylon NullEngine de aproximadamente 199 mil triangulos, 24 meshes, 456 instancias finas, 13 materiais e 2 luzes com mapa de sombra 2048. NullEngine nao mede FPS, GPU, memoria ou WebGL real; nao ha comparacao FPS antes/depois. A cena nao foi substituida nem recebeu ajustes visuais sem inspecao visual real.

O ambiente tinha Node v24.21.0 (compativel com o minimo documentado: Node 22.13+) e nao expoe executavel Chrome, Edge ou Firefox nem ferramenta de navegador. Nenhum navegador ou cenario manual foi declarado testado.

## Verificacoes automatizadas

- Linha de base: 47 arquivos, 724 testes aprovados; typecheck, lint e build aprovados.
- Apos as correcoes: typecheck, lint e Prettier aprovados; 47 arquivos e 726 testes aprovados; build de producao aprovado.
- Bundle principal final: 1.348,98 kB minificado / 344,84 kB gzip. Frente à linha de base, houve aumento de 1,75 kB minificado e 0,33 kB gzip; não foi observada melhoria de tamanho.
- Testes existentes cobrem construcao/economia, eventos, pesquisa/desbloqueios, governo/personagens, save/load/migracao, renderizacao headless e fluxos React de construcao, relogio e selecao. Nao equivalem a uma sessao completa em navegador WebGL.

## Requisitos conhecidos e publicacao

- Desenvolvimento/build: Node 24 LTS recomendado; minimo declarado pelo projeto Node 22.13+; npm do Node.
- Runtime conhecido: navegador desktop moderno com ECMAScript 2023 e WebGL. Versao minima e matriz Chrome/Edge/Firefox/Safari ainda precisam de validacao real. O jogo mostra erro se WebGL nao estiver disponivel.
- Instalar: npm ci. Executar localmente: npm run dev. Verificar: npm run validate. Gerar artefato: npm run build grava em dist/.
- Publicar o conteudo de dist/ em hospedagem estatica com MIME de modulos JavaScript. URLs sao relativas; servir index.html na rota do jogo. npm run preview serve o build localmente. Saves usam um slot de localStorage na mesma origem.

## Checklist antes de uma versao publica

- Executar build em Chrome, Edge e Firefox desktop com WebGL2; registrar versoes e sistema operacional.
- Fazer roteiro manual completo: nova partida, construcao/economia, crise de sobrevivencia, evento, pesquisa/desbloqueio, cargos, save/load e migracao.
- Testar redimensionamento, zoom, proporcoes estreitas/largas, escala de tela, alternancia de abas e recuperacao de contexto WebGL.
- Medir frame time/FPS e memoria em hardware-alvo com cena inicial e colonia ampliada; nao tratar NullEngine como FPS.
- Revisar contraste, teclado, leitor de tela, arte, iluminacao e sombras em tela real.
- Escolher hospedagem/dominio e executar deploy de teste; configurar CI e registrar licencas se assets externos forem adicionados.
