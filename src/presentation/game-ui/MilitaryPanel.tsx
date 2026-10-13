import { useState } from 'react';
import type { GameController } from '@/game/application/GameController';
import {
  describeMilitaryError,
  MILITARY_UNIT_CATALOG,
  requestMilitaryAction,
  selectMilitaryCivilizationName,
  selectMilitaryUnit,
  type MilitaryAction,
  type MilitaryActionFields,
} from '@/game/application/military';
import { useGameSelector } from '@/presentation/hooks/useGameSelector';

const numberFormat = new Intl.NumberFormat('pt-BR');

export function MilitaryPanel({ controller }: { readonly controller: GameController }) {
  const buildings = useGameSelector(controller, (snapshot) => snapshot.buildings);
  const military = useGameSelector(controller, (snapshot) => snapshot.military);
  const resources = useGameSelector(controller, (snapshot) => snapshot.resources);
  const diplomacy = useGameSelector(controller, (snapshot) => snapshot.diplomacy);
  const [feedback, setFeedback] = useState('');
  const posts = buildings.filter((building) => building.definitionId === 'guard-post').length;
  const battle = military.battle;
  const send = (action: MilitaryAction, fields: MilitaryActionFields = {}) => {
    const result = requestMilitaryAction(controller, action, fields);
    setFeedback(
      result.ok
        ? result.value === 'queued'
          ? 'Ação enviada para o próximo tick.'
          : 'Ordem registrada.'
        : describeMilitaryError(result.error),
    );
  };
  return (
    <section className="hud-panel military-panel" aria-label="Exército e defesa">
      <h2 className="hud-panel__title">Exército e defesa</h2>
      <p>
        Postos de defesa: {posts} · Capacidade: {posts * 4} unidades
      </p>
      <p>
        Manutenção:{' '}
        {military.units
          .filter((unit) => unit.supplied)
          .reduce((sum, unit) => sum + selectMilitaryUnit(unit.type).upkeep, 0)}{' '}
        alimentos/tick
      </p>
      {posts > 0 ? (
        <>
          <h3>Recrutamento</h3>
          <ul>
            {MILITARY_UNIT_CATALOG.map((unit) => {
              const { type } = unit;
              return (
                <li key={type}>
                  <button
                    type="button"
                    disabled={military.units.length >= posts * 4 || resources.materials < unit.cost}
                    onClick={() => send('recruit', { unitType: type })}
                  >
                    Recrutar {unit.name} · {unit.cost} materiais · {unit.upkeep} alimento/tick
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p>Construa um Posto de Defesa para recrutar unidades e proteger a colônia.</p>
      )}
      <h3>Unidades ({military.units.length})</h3>
      {military.units.length ? (
        <ul>
          {military.units.map((unit) => (
            <li key={unit.unitId}>
              {selectMilitaryUnit(unit.type).name} · {unit.health}/
              {selectMilitaryUnit(unit.type).health} PV ·{' '}
              {unit.supplied ? 'abastecida' : 'sem suprimentos'}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhuma unidade recrutada.</p>
      )}
      {battle && (
        <section aria-live="polite">
          <h3>Confronto: {selectMilitaryCivilizationName(battle.civilizationId)}</h3>
          <p>
            {battle.status === 'active'
              ? `Rodada ${battle.round + 1} · Integridade adversária ${numberFormat.format(battle.enemyHealth)}`
              : `Resultado: ${battle.status}`}
          </p>
          {battle.status === 'active' && (
            <button
              type="button"
              onClick={() => send('retreat', { civilizationId: battle.civilizationId })}
            >
              Recuar
            </button>
          )}
        </section>
      )}
      <h3>Civilizações em contato</h3>
      {diplomacy.civilizations
        .filter((relation) => relation.contactStatus === 'contacted')
        .map((relation) => {
          const mayDeclare =
            relation.relationshipScore <= -30 &&
            relation.nonAggressionPact !== 'active' &&
            relation.warStatus !== 'active';
          return (
            <article key={relation.civilizationId} className="military-civilization">
              <strong>{selectMilitaryCivilizationName(relation.civilizationId)}</strong>
              <p>
                Relação {relation.relationshipScore} ·{' '}
                {relation.warStatus === 'active'
                  ? 'Em guerra'
                  : relation.warStatus === 'ended'
                    ? 'Paz estabelecida'
                    : 'Paz'}
              </p>
              {relation.warStatus === 'active' ? (
                <>
                  <button
                    type="button"
                    disabled={
                      battle?.status === 'active' || !military.units.some((unit) => unit.supplied)
                    }
                    onClick={() =>
                      send('start-battle', { civilizationId: relation.civilizationId })
                    }
                  >
                    Iniciar confronto
                  </button>
                  {battle?.status !== 'active' && (
                    <button
                      type="button"
                      onClick={() => send('end-war', { civilizationId: relation.civilizationId })}
                    >
                      Estabelecer paz
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  disabled={!mayDeclare}
                  title={
                    relation.nonAggressionPact === 'active'
                      ? 'Pacto ativo'
                      : relation.relationshipScore > -30
                        ? 'Relação precisa chegar a −30'
                        : undefined
                  }
                  onClick={() => send('declare-war', { civilizationId: relation.civilizationId })}
                >
                  Declarar guerra
                </button>
              )}
            </article>
          );
        })}
      {military.history.length > 0 && (
        <>
          <h3>Últimos confrontos</h3>
          <ol>
            {[...military.history].reverse().map((entry, index) => (
              <li key={`${entry.tick}-${index}`}>
                Tick {entry.tick}: {selectMilitaryCivilizationName(entry.civilizationId)} ·{' '}
                {entry.outcome}
              </li>
            ))}
          </ol>
        </>
      )}
      <p role="status" aria-live="polite">
        {feedback}
      </p>
    </section>
  );
}
