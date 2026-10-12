import { useEffect, useState } from 'react';
import {
  describeDiplomaticError,
  requestDiplomaticAction,
  selectKnownCivilizations,
  subscribeToDiplomaticRejections,
} from '@/game/application/diplomacy';
import type { DiplomaticActionId } from '@/game/domain/diplomacy/diplomacyCommands';
import type { DiplomaticAction } from '@/game/domain/state/GameState';
import type { GameController } from '@/game/application/GameController';
import { useGameSelector } from '@/presentation/hooks/useGameSelector';

const GIFT_COST = 10;

const ACTION_LABELS: Readonly<Record<DiplomaticAction, string>> = {
  'civilization-discovered': 'Sociedade descoberta',
  'signal-deferred': 'Sinal arquivado',
  'contact-established': 'Contato estabelecido',
  'information-requested': 'Informações solicitadas',
  'gift-offered': 'Presente enviado',
  'pact-proposed': 'Pacto proposto',
  'pact-accepted': 'Pacto aceito',
  'pact-rejected': 'Pacto recusado',
  'pact-ended': 'Pacto encerrado',
};

export function DiplomacyPanel({ controller }: { readonly controller: GameController }) {
  const diplomacy = useGameSelector(controller, (snapshot) => snapshot.diplomacy);
  const materials = useGameSelector(controller, (snapshot) => snapshot.resources.materials);
  const [selectedId, setSelectedId] = useState<string>();
  const [feedback, setFeedback] = useState('');

  useEffect(
    () =>
      subscribeToDiplomaticRejections(controller, (error) =>
        setFeedback(describeDiplomaticError(error)),
      ),
    [controller],
  );

  const discovered = selectKnownCivilizations({ diplomacy });
  const selectedRelation =
    discovered.find((relation) => relation.civilizationId === selectedId) ?? discovered[0];
  const civilization = selectedRelation?.civilization;

  const submit = (action: DiplomaticActionId) => {
    if (!selectedRelation) return;
    const result = requestDiplomaticAction(controller, selectedRelation.civilizationId, action);
    if (!result.ok) {
      setFeedback(describeDiplomaticError(result.error));
      return;
    }
    setFeedback(
      result.value === 'queued'
        ? 'Ação enviada; será aplicada no próximo tick.'
        : 'Ação diplomática registrada.',
    );
  };

  return (
    <section className="hud-panel diplomacy-panel" aria-label="Diplomacia">
      <h2 className="hud-panel__title">Diplomacia</h2>
      {discovered.length === 0 ? (
        <p>Explore pontos de interesse para encontrar sociedades independentes.</p>
      ) : (
        <>
          <ul className="diplomacy-roster" aria-label="Civilizações descobertas">
            {discovered.map((relation) => (
              <li key={relation.civilizationId}>
                <button
                  type="button"
                  className="diplomacy-roster__item"
                  aria-pressed={selectedRelation?.civilizationId === relation.civilizationId}
                  onClick={() => setSelectedId(relation.civilizationId)}
                >
                  <span
                    className="diplomacy-avatar"
                    data-civilization={relation.civilizationId}
                    aria-hidden="true"
                  >
                    ●
                  </span>
                  <span>
                    <strong>{relation.civilization.name}</strong>
                    <small>{relation.statusLabel}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selectedRelation && civilization && (
            <article className="diplomacy-detail">
              <h3>{civilization.name}</h3>
              <p>
                <strong>Espécie:</strong> {civilization.species}
              </p>
              <p>{civilization.identity}</p>
              <p>{civilization.culture}</p>
              {selectedRelation.informationRequested && (
                <>
                  <p>
                    <strong>Governo:</strong> {civilization.government}
                  </p>
                  <p>
                    <strong>Desenvolvimento:</strong> {civilization.development}
                  </p>
                </>
              )}
              <p>
                <strong>Relação:</strong> {selectedRelation.statusLabel}
                {selectedRelation.contactStatus === 'contacted' &&
                  ` (${selectedRelation.relationshipScore}/100)`}
              </p>
              <p>
                <strong>Pacto de não agressão:</strong>{' '}
                {selectedRelation.nonAggressionPact === 'active'
                  ? 'Ativo'
                  : selectedRelation.nonAggressionPact === 'rejected'
                    ? 'Proposta recusada'
                    : selectedRelation.nonAggressionPact === 'ended'
                      ? 'Encerrado'
                      : 'Nenhum'}
              </p>
              {selectedRelation.contactStatus === 'discovered' && (
                <button type="button" onClick={() => submit('establish-contact')}>
                  Iniciar contato
                </button>
              )}
              {selectedRelation.contactStatus === 'contacted' && (
                <div className="diplomacy-actions">
                  <button
                    type="button"
                    disabled={selectedRelation.informationRequested}
                    onClick={() => submit('request-information')}
                  >
                    {selectedRelation.informationRequested
                      ? 'Informações recebidas'
                      : 'Solicitar informações'}
                  </button>
                  <button
                    type="button"
                    disabled={selectedRelation.giftOffered || materials < GIFT_COST}
                    onClick={() => submit('offer-gift')}
                  >
                    {selectedRelation.giftOffered
                      ? 'Presente já enviado'
                      : `Oferecer presente (−${GIFT_COST} materiais)`}
                  </button>
                  {selectedRelation.nonAggressionPact === 'none' && (
                    <button type="button" onClick={() => submit('propose-non-aggression-pact')}>
                      Propor não agressão
                    </button>
                  )}
                  {selectedRelation.nonAggressionPact === 'active' && (
                    <button type="button" onClick={() => submit('end-negotiation')}>
                      Encerrar o pacto
                    </button>
                  )}
                </div>
              )}
              {selectedRelation.history.length > 0 && (
                <div className="diplomacy-history">
                  <h4>Histórico</h4>
                  <ol>
                    {[...selectedRelation.history].reverse().map((entry, index) => (
                      <li key={`${entry.tick}-${entry.action}-${index}`}>
                        <span>
                          Tick {entry.tick}: {ACTION_LABELS[entry.action]}
                        </span>
                        {entry.relationshipChange !== 0 && (
                          <small>
                            {' '}
                            {entry.relationshipChange > 0 ? '+' : ''}
                            {entry.relationshipChange} relação
                          </small>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </article>
          )}
          <p role="status" aria-live="polite">
            {feedback}
          </p>
        </>
      )}
    </section>
  );
}
