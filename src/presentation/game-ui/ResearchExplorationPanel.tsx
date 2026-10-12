import { useState } from 'react';
import type { GameController } from '@/game/application/GameController';
import {
  requestPointExploration,
  requestResearch,
  selectPointOfInterestCatalog,
  selectTechnologyCatalog,
} from '@/game/application/contentExpansion';
import { useGameSelector } from '../hooks/useGameSelector';

export function ResearchExplorationPanel({ controller }: { readonly controller: GameController }) {
  const state = useGameSelector(controller, (snapshot) => snapshot);
  const [feedback, setFeedback] = useState('');
  const submit = (action: () => ReturnType<GameController['submitCommand']>, success: string) => {
    const result = action();
    setFeedback(result.ok ? success : `Ação recusada (${result.error}).`);
  };
  const active = state.research.activeTechnologyId;
  const labReady = state.buildings.some((building) => building.definitionId === 'field-laboratory');
  return (
    <section className="hud-panel" aria-label="Pesquisa e exploração">
      <h2 className="hud-panel__title">Pesquisa e exploração</h2>
      <h3 className="hud-panel__name">Tecnologias</h3>
      {!labReady && <p>Construa um Laboratório de Campo para iniciar pesquisas.</p>}
      <ul>
        {selectTechnologyCatalog().map((tech) => {
          const complete = state.research.unlockedTechnologyIds.includes(tech.id);
          const prerequisitesMet = tech.prerequisites.every((id) =>
            state.research.unlockedTechnologyIds.includes(id),
          );
          return (
            <li key={tech.id}>
              <strong>{tech.name}</strong> —{' '}
              {complete
                ? 'Concluída'
                : active === tech.id
                  ? `Em andamento: ${state.research.progress}/${tech.researchPoints}`
                  : tech.description}
              {!complete && active !== tech.id && (
                <button
                  type="button"
                  disabled={!labReady || active !== null || !prerequisitesMet}
                  onClick={() =>
                    submit(
                      () => requestResearch(controller, tech.id),
                      `Pesquisa iniciada: ${tech.name}.`,
                    )
                  }
                >
                  Pesquisar (
                  {Object.entries(tech.cost)
                    .map(([resource, amount]) => `${resource} ${amount}`)
                    .join(', ')}
                  )
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <h3 className="hud-panel__name">Pontos de interesse</h3>
      <ul>
        {selectPointOfInterestCatalog().map((point) => {
          const discovered = state.exploration.discoveredPointIds.includes(point.id);
          const unlocked =
            !point.requiredTechnologyId ||
            state.research.unlockedTechnologyIds.includes(point.requiredTechnologyId);
          return (
            <li key={point.id}>
              <strong>{point.name}</strong> —{' '}
              {discovered ? `Descoberto. ${point.description}` : point.description}
              {!discovered && (
                <button
                  type="button"
                  disabled={!unlocked}
                  onClick={() =>
                    submit(
                      () => requestPointExploration(controller, point.id),
                      `Local explorado: ${point.name}.`,
                    )
                  }
                >
                  Investigar (energia {point.surveyCost.energy})
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p role="status">{feedback}</p>
    </section>
  );
}
