# Changelog

## v0.8.0 — 2026-10-12

### Adicionado

- Salvamento local em um slot, com envelope versionado e porta assíncrona `SaveProvider`.
- Carregamento validado de recursos, construções e eventos; dados inválidos ou incompatíveis não substituem a partida ativa.
- Controles para salvar, carregar e iniciar nova partida. A partida carregada inicia pausada em 1×; nova partida confirma o descarte de progresso não salvo.
- Testes de serialização, validação, persistência, restauração, interface e reconstrução do snapshot visual.

### Decisões

- Slots múltiplos, autosave e importação/exportação de arquivos permanecem pendentes (P-06).
- Migrações encadeadas serão adicionadas quando houver uma versão anterior do esquema publicada; a população da Fase 9 será a primeira mudança planejada.
