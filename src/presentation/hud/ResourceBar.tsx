import { useMemo } from 'react';
import type { GameController } from '@/game/application/GameController';
import { selectResourceEntries } from '@/game/application/selectors';
import { useGameSnapshot } from '../hooks/useGameSnapshot';
import { ResourceIcon } from './ResourceIcon';

const amountFormat = new Intl.NumberFormat('pt-BR');

/**
 * Barra de recursos. Lê SÓ o snapshot do `GameController`: não há valor fixo nem cópia do estado
 * aqui, e só aparecem os recursos que existem no estado. Nesta fase os valores são os iniciais do
 * cenário (a economia é da Fase 5); nada é inventado para demonstrar movimento.
 */
export function ResourceBar({ controller }: { readonly controller: GameController }) {
  const snapshot = useGameSnapshot(controller);
  const entries = useMemo(() => selectResourceEntries(snapshot), [snapshot]);

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
