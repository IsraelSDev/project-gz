export function TutorialPanel({ onDismissed }: { readonly onDismissed: () => void }) {
  return (
    <section className="hud-panel tutorial-panel" aria-label="Como sobreviver">
      <header className="hud-panel__header">
        <h2 className="hud-panel__title">Primeiros passos</h2>
        <button
          className="hud-panel__close"
          type="button"
          aria-label="Fechar tutorial"
          onClick={onDismissed}
        >
          ×
        </button>
      </header>
      <p className="event-panel__description tutorial-panel__copy">
        Mantenha comida e água para os 8 sobreviventes. Construa uma estufa hidropônica antes que os
        estoques acabem; ela precisa de água e energia. A energia diminui enquanto os edifícios
        funcionam, então amplie a geração com outra matriz solar. O abrigo comporta 8. Use Espaço
        para pausar enquanto planeja, acompanhe os eventos e mantenha a colônia abastecida por 15
        minutos de jogo para estabilizá-la.
      </p>
    </section>
  );
}
