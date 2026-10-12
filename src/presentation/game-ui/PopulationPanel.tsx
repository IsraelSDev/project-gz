import type { GameController } from '@/game/application/GameController';
import { selectPopulationSummary } from '@/game/application/populationSelectors';
import { useGameSelector } from '@/presentation/hooks/useGameSelector';

export function PopulationPanel({ controller }: { readonly controller: GameController }) {
  const state = useGameSelector(controller, (snapshot) => snapshot);
  const summary = selectPopulationSummary(state);
  const crowded = summary.survivors > summary.capacity;
  const foodLow = summary.food < summary.foodNeed;
  const waterLow = summary.water < summary.waterNeed;
  const crisis = crowded || foodLow || waterLow || summary.shortageTicks > 0;
  const outcomeText =
    summary.outcome === 'victory'
      ? 'Acampamento estabilizado!'
      : summary.outcome === 'defeat'
        ? 'A colônia foi perdida.'
        : undefined;

  return (
    <section className="hud-panel population-panel" aria-label="Sobrevivência">
      <header className="hud-panel__header">
        <h2 className="hud-panel__title">Sobrevivência</h2>
      </header>
      <dl className="hud-facts">
        <div className="hud-facts__row">
          <dt>Sobreviventes</dt>
          <dd>{summary.survivors}</dd>
        </div>
        <div className="hud-facts__row">
          <dt>Abrigo</dt>
          <dd>{summary.capacity}</dd>
        </div>
        <div className="hud-facts__row">
          <dt>Alimento</dt>
          <dd>
            {summary.food} (−{summary.foodNeed}/tick)
          </dd>
        </div>
        <div className="hud-facts__row">
          <dt>Água</dt>
          <dd>
            {summary.water} (−{summary.waterNeed}/tick)
          </dd>
        </div>
      </dl>
      {outcomeText ? (
        <p className="population-panel__status" role="status">
          {outcomeText}
        </p>
      ) : crisis ? (
        <p className="population-panel__status" data-danger="true" role="status">
          {crowded ? 'Falta capacidade habitacional. ' : ''}
          {foodLow ? 'Comida insuficiente. ' : ''}
          {waterLow ? 'Água insuficiente. ' : ''}
          {summary.shortageTicks > 0
            ? `Escassez: ${summary.shortageTicks}/${summary.shortageLimit} ticks.`
            : ''}
        </p>
      ) : (
        <p className="population-panel__status">
          Estabilidade: {summary.stableTicks}/{summary.stabilityGoal} ticks.
        </p>
      )}
    </section>
  );
}
