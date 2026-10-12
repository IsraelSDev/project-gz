import { useState } from 'react';
import type { GameController } from '@/game/application/GameController';
import { appointCharacter, removeCharacterFromOffice } from '@/game/application/governmentUseCases';
import type { Character, GovernmentOffice } from '@/game/content/characters';
import { useGameSelector } from '@/presentation/hooks/useGameSelector';

const OFFICE_LABELS: Readonly<Record<GovernmentOffice | 'leader', string>> = {
  leader: 'Líder da colônia',
  science: 'Ciência',
  engineering: 'Engenharia',
  production: 'Produção',
};
const ALIEN_SHAPES = ['round', 'tall', 'wide', 'lumpy'] as const;

function qualification(character: Character, office: GovernmentOffice | 'leader'): boolean {
  const skill = office === 'leader' ? 'leadership' : office;
  return character.alive && character.available && character.skills[skill] >= 2;
}

export function CharacterGovernmentPanel({ controller }: { readonly controller: GameController }) {
  const state = useGameSelector(controller, (snapshot) => snapshot);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const people = state.characters;
  const selected = people.find((person) => person.characterId === selectedId) ?? people[0];
  const assignments: Readonly<Record<GovernmentOffice | 'leader', string | null>> = {
    leader: state.government.leaderId,
    ...state.government.offices,
  };
  const currentOffice = (characterId: string) =>
    Object.entries(assignments).find(([, holder]) => holder === characterId)?.[0] as
      GovernmentOffice | 'leader' | undefined;

  const appoint = (office: GovernmentOffice | 'leader') => {
    if (!selected) return;
    const result = appointCharacter(controller, office, selected.characterId);
    setFeedback(
      result.ok
        ? `${selected.name} nomeado: ${OFFICE_LABELS[office]}.`
        : 'Nomeação recusada. Verifique a competência e se a pessoa está disponível e sem outro cargo.',
    );
  };
  const remove = (office: GovernmentOffice | 'leader') => {
    const result = removeCharacterFromOffice(controller, office);
    setFeedback(
      result.ok
        ? `Cargo removido: ${OFFICE_LABELS[office]}.`
        : 'Não foi possível remover este cargo.',
    );
  };

  return (
    <section className="hud-panel character-panel" aria-label="Personagens e governo">
      <header className="hud-panel__header">
        <h2 className="hud-panel__title">Personagens e governo</h2>
      </header>
      <p className="character-panel__population">
        {state.population.survivors} habitantes · {people.filter((person) => person.alive).length}{' '}
        personagens importantes
      </p>
      <ul className="character-roster" aria-label="Personagens importantes">
        {people.map((person, index) => (
          <li key={person.characterId}>
            <button
              className="character-roster__item"
              type="button"
              aria-pressed={selected?.characterId === person.characterId}
              onClick={() => setSelectedId(person.characterId)}
            >
              <span
                className="character-roster__avatar"
                data-shape={ALIEN_SHAPES[index % ALIEN_SHAPES.length]}
                aria-hidden="true"
              >
                <i className="character-roster__eyes">••</i>
                <i className="character-roster__mouth">⌣</i>
              </span>
              <span>
                <strong>{person.name}</strong>
                <small>
                  {person.species}
                  {currentOffice(person.characterId)
                    ? ` · ${OFFICE_LABELS[currentOffice(person.characterId)!]}`
                    : ''}
                  {person.alive ? '' : ' · falecido'}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <div className="character-detail">
          <h3>{selected.name}</h3>
          <p>
            {selected.species} ·{' '}
            {selected.lifeStage === 'adult'
              ? 'Adulto'
              : selected.lifeStage === 'young'
                ? 'Jovem'
                : 'Ancião'}
          </p>
          <p>Traços: {selected.traits.join(', ')}.</p>
          <dl className="hud-facts character-skills">
            <div className="hud-facts__row">
              <dt>Liderança</dt>
              <dd>{selected.skills.leadership}/5</dd>
            </div>
            <div className="hud-facts__row">
              <dt>Ciência</dt>
              <dd>{selected.skills.science}/5</dd>
            </div>
            <div className="hud-facts__row">
              <dt>Engenharia</dt>
              <dd>{selected.skills.engineering}/5</dd>
            </div>
            <div className="hud-facts__row">
              <dt>Produção</dt>
              <dd>{selected.skills.production}/5</dd>
            </div>
          </dl>
        </div>
      )}
      <section className="government-roles" aria-label="Cargos governamentais">
        {(Object.keys(OFFICE_LABELS) as (GovernmentOffice | 'leader')[]).map((office) => {
          const occupantId = assignments[office];
          const occupant = people.find((person) => person.characterId === occupantId);
          const eligible = selected
            ? qualification(selected, office) &&
              !Object.values(assignments).includes(selected.characterId)
            : false;
          const hasEligibleCandidate = people.some(
            (person) =>
              qualification(person, office) &&
              !Object.values(assignments).includes(person.characterId),
          );
          return (
            <div className="government-role" key={office}>
              <span>
                <strong>{OFFICE_LABELS[office]}</strong>
                <small>
                  {occupant?.name ?? 'Vago'}
                  {!occupant && !hasEligibleCandidate ? ' · sem pessoas elegíveis' : ''}
                </small>
              </span>
              {occupantId ? (
                <button
                  className="build-button"
                  type="button"
                  aria-label={`Remover ${OFFICE_LABELS[office]}`}
                  onClick={() => remove(office)}
                >
                  Remover
                </button>
              ) : (
                <button
                  className="build-button"
                  type="button"
                  aria-label={`Nomear ${OFFICE_LABELS[office]}`}
                  disabled={!eligible}
                  onClick={() => appoint(office)}
                >
                  Nomear
                </button>
              )}
            </div>
          );
        })}
      </section>
      {selected &&
        !Object.values(assignments).includes(selected.characterId) &&
        !(['leader', 'science', 'engineering', 'production'] as const).some((office) =>
          qualification(selected, office),
        ) && (
          <p className="character-panel__empty">
            Sem competência mínima para os cargos disponíveis.
          </p>
        )}
      <p className="character-panel__feedback" role="status">
        {feedback}
      </p>
    </section>
  );
}
