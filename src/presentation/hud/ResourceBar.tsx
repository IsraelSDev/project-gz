import { useMemo } from 'react';
import type { GameStateReader } from '@/game/application/GameController';
import { selectResourceEntries } from '@/game/application/selectors';
import { useGameSelector } from '../hooks/useGameSelector';
import { ResourceIcon } from './ResourceIcon';

const amountFormat = new Intl.NumberFormat('pt-BR');

/**
 * Barra de recursos. Lê SÓ o snapshot do `GameController`: não há valor fixo, cópia do estado nem
 * regra econômica aqui (a economia roda no domínio, a cada passo da simulação), e só aparecem os
 * recursos que existem no estado. Os números mudam porque o estado muda; nada é inventado para
 * demonstrar movimento.
 */
export function ResourceBar({ controller }: { readonly controller: GameStateReader }) {
  // Só a fatia `resources`: ela mantém a referência enquanto a economia não altera nenhum estoque
  // (pausado, ou sem produção nem consumo), então a barra só re-renderiza quando um valor muda.
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
