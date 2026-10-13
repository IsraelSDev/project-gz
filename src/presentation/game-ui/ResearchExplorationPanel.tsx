import { useEffect, useState } from 'react';
import type { GameController } from '@/game/application/GameController';
import {
  requestPointExploration,
  requestResearch,
  describeContentExpansionError,
  subscribeToContentExpansionRejections,
  selectPointOfInterestCatalog,
  selectTechnologyCatalog,
  selectFieldLaboratoryCount,
  selectEraProgress,
} from '@/game/application/contentExpansion';
import { useGameSelector } from '../hooks/useGameSelector';

export function ResearchExplorationPanel({ controller }: { readonly controller: GameController }) {
  const buildings = useGameSelector(controller, (snapshot) => snapshot.buildings);
  const settlements = useGameSelector(controller, (snapshot) => snapshot.settlements);
  const resources = useGameSelector(controller, (snapshot) => snapshot.resources);
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
  const snapshot = controller.getSnapshot();
  const labCount = selectFieldLaboratoryCount({ buildings, settlements });
  const technologyCatalog = selectTechnologyCatalog({ ...snapshot, resources });
  const eraProgress = selectEraProgress(snapshot);
  const technologyNames = new Map<string, string>(
    technologyCatalog.map((technology) => [technology.id, technology.name]),
  );
  const labReady = labCount > 0;
  const scientistReady = characters.some(
    (character) =>
      character.characterId === scienceOfficeId && character.alive && character.available,
  );
  return (
    <section className="hud-panel" aria-label="Pesquisa e exploração">
      <h2 className="hud-panel__title">Pesquisa e exploração</h2>
      <h3 className="hud-panel__name">Tecnologias</h3>
      <p>
        Era atual: <strong>Era de {eraProgress.currentName}</strong>
      </p>
      {eraProgress.next ? (
        <p>
          Próxima era: {eraProgress.next.name} · Marcos:{' '}
          {eraProgress.next.milestones
            .map((milestone) => `${milestone.completed ? '✓' : '○'} ${milestone.name}`)
            .join(', ')}
        </p>
      ) : (
        <p>Última era alcançada.</p>
      )}
      <p>
        Laboratórios: {labCount} · Cientista: {scientistReady ? 'designado' : 'indisponível'}
      </p>
      {!labReady && <p>Construa um Laboratório de Campo para iniciar pesquisas.</p>}
      {labReady && !scientistReady && (
        <p>Designe um personagem apto ao cargo de ciência para iniciar pesquisas.</p>
      )}
      <ul>
        {technologyCatalog.map((tech) => {
          const complete = research.unlockedTechnologyIds.includes(tech.id);
          const blockReason = tech.blockReason;
          const reasonText =
            blockReason === 'another-project'
              ? `Conclua primeiro ${technologyNames.get(active ?? '') ?? 'a pesquisa ativa'}.`
              : blockReason === 'in-progress'
                ? 'Esta pesquisa já está em andamento.'
                : blockReason === 'era'
                  ? `Requer a Era de ${tech.eraName}.`
                  : blockReason === 'prerequisites'
                    ? `Pré-requisitos: ${tech.prerequisiteNames.join(', ')}.`
                    : blockReason === 'laboratory'
                      ? 'Construa um Laboratório de Campo em qualquer assentamento.'
                      : blockReason === 'scientist'
                        ? 'Designe um cientista apto ao cargo de ciência.'
                        : blockReason === 'resources'
                          ? 'Recursos insuficientes para iniciar.'
                          : '';
          return (
            <li key={tech.id}>
              <strong>{tech.name}</strong> · Era de {tech.eraName} · {tech.categoryName}
              <p>{tech.description}</p>
              <p>
                {complete
                  ? 'Concluída'
                  : active === tech.id
                    ? `Em andamento: ${research.progress}/${tech.researchPoints} pontos`
                    : blockReason
                      ? `Bloqueada: ${reasonText}`
                      : 'Disponível'}
              </p>
              <p>
                Pré-requisitos:{' '}
                {tech.prerequisites.length ? tech.prerequisiteNames.join(', ') : 'nenhum'} · Custo:{' '}
                {tech.costLines.map((line) => `${line.name} ${line.amount}`).join(', ')} · Pesquisa:{' '}
                {tech.researchPoints} pontos
              </p>
              <p>Efeito: {tech.effectDescription}</p>
              {!complete && active !== tech.id && (
                <button
                  type="button"
                  disabled={blockReason !== null}
                  onClick={() =>
                    submit(
                      () => requestResearch(controller, tech.id),
                      `Pesquisa iniciada: ${tech.name}.`,
                    )
                  }
                >
                  Pesquisar
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
