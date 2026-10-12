import { useMemo } from 'react';
import type { GameStateReader } from '@/game/application/GameController';
import { selectResourceEntries } from '@/game/application/selectors';
import { useGameSelector } from '../hooks/useGameSelector';
import { ResourceIcon } from './ResourceIcon';

const amountFormat = new Intl.NumberFormat('pt-BR');

/**
 * Barra de recursos. Lê SÓ o snapshot do `GameController`: não há valor fixo nem cópia do estado
 * aqui, e só aparecem os recursos que existem no estado. Nesta fase os valores são os iniciais do
 * cenário (a economia é da Fase 5); nada é inventado para demonstrar movimento.
 */
export function ResourceBar({ controller }: { readonly controller: GameStateReader }) {
  // Só a fatia `resources`: ela mantém a referência a cada tick, então a barra não re-renderiza
  // enquanto os recursos não mudam.
  const resources = useGameSelector(controller, (snapshot) => snapshot.resources);
  const entries = useMemo(() => selectResourceEntries(resources), [resources]);

  return (
    <ul className="resource-bar" aria-label="Recursos da colônia">
      {entries.map((entry) => (
        <li key={entry.id} className="resource" data-resource={entry.id}>
          <ResourceIcon id={entry.id} />
          <span className="resource__name">{entry.name}</span>
          <span className="resource__amount">
            {entry.amount === null ? (
              <>
                <span aria-hidden="true">—</span>
                <span className="visually-hidden">indisponível</span>
              </>
            ) : (
              amountFormat.format(entry.amount)
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
