import { useEffect, useState } from 'react';
import type { GameController } from '@/game/application/GameController';
import {
  requestPointExploration,
  requestResearch,
  describeContentExpansionError,
  subscribeToContentExpansionRejections,
  selectPointOfInterestCatalog,
  selectTechnologyCatalog,
} from '@/game/application/contentExpansion';
import { useGameSelector } from '../hooks/useGameSelector';

export function ResearchExplorationPanel({ controller }: { readonly controller: GameController }) {
  const buildings = useGameSelector(controller, (snapshot) => snapshot.buildings);
  const research = useGameSelector(controller, (snapshot) => snapshot.research);
  const exploration = useGameSelector(controller, (snapshot) => snapshot.exploration);
  const scienceOfficeId = useGameSelector(
    controller,
    (snapshot) => snapshot.government.offices.science,
  );
  const characters = useGameSelector(controller, (snapshot) => snapshot.characters);
  const [feedback, setFeedback] = useState('');
  useEffect(() => subscribeToContentExpansionRejections(controller, setFeedback), [controller]);
  const submit = (action: () => ReturnType<GameController['submitCommand']>, success: string) => {
    const result = action();
    setFeedback(
      result.ok
        ? result.value === 'queued'
          ? 'Ação enviada; será aplicada no próximo tick.'
          : success
        : describeContentExpansionError(result.error),
    );
  };
  const active = research.activeTechnologyId;
  const labReady = buildings.some((building) => building.definitionId === 'field-laboratory');
  const scientistReady = characters.some(
    (character) =>
      character.characterId === scienceOfficeId && character.alive && character.available,
  );
  return (
    <section className="hud-panel" aria-label="Pesquisa e exploração">
      <h2 className="hud-panel__title">Pesquisa e exploração</h2>
      <h3 className="hud-panel__name">Tecnologias</h3>
      {!labReady && <p>Construa um Laboratório de Campo para iniciar pesquisas.</p>}
      {labReady && !scientistReady && (
        <p>Designe um personagem apto ao cargo de ciência para iniciar pesquisas.</p>
      )}
      <ul>
        {selectTechnologyCatalog().map((tech) => {
          const complete = research.unlockedTechnologyIds.includes(tech.id);
          const prerequisitesMet = tech.prerequisites.every((id) =>
            research.unlockedTechnologyIds.includes(id),
          );
          return (
            <li key={tech.id}>
              <strong>{tech.name}</strong> —{' '}
              {complete
                ? 'Concluída'
                : active === tech.id
                  ? `Em andamento: ${research.progress}/${tech.researchPoints}`
                  : tech.description}
              {!complete && active !== tech.id && (
                <button
                  type="button"
                  disabled={!labReady || !scientistReady || active !== null || !prerequisitesMet}
                  onClick={() =>
                    submit(
                      () => requestResearch(controller, tech.id),
                      `Pesquisa iniciada: ${tech.name}.`,
                    )
                  }
                >
                  Pesquisar (
                  {tech.costLines.map((line) => `${line.name} ${line.amount}`).join(', ')})
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <h3 className="hud-panel__name">Pontos de interesse</h3>
      <ul>
        {selectPointOfInterestCatalog().map((point) => {
          const discovered = exploration.discoveredPointIds.includes(point.id);
          const unlocked =
            !point.requiredTechnologyId ||
            research.unlockedTechnologyIds.includes(point.requiredTechnologyId);
          return (
            <li key={point.id}>
              <strong>{point.name}</strong> —{' '}
              {discovered ? `Descoberto. ${point.description}` : point.description}
              {discovered && point.rewardLines.length > 0 && (
                <>
                  {' '}
                  Recompensa:{' '}
                  {point.rewardLines.map((line) => `${line.name} ${line.amount}`).join(', ')}.
                </>
              )}
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
                  Investigar (
                  {point.surveyCostLines.map((line) => `${line.name} ${line.amount}`).join(', ')})
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
