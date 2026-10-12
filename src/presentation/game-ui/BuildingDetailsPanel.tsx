import { useEffect, useId, useMemo } from 'react';
import type { GameStateReader } from '@/game/application/GameController';
import { selectBuildingDetails, type BuildingDetails } from '@/game/application/selectors';
import type { BuildingDefinition } from '@/game/content/buildings';
import type { SelectionStore } from '@/session/selectionStore';
import { useGameSelector } from '../hooks/useGameSelector';
import { useSelection } from '../hooks/useSelection';

const CATEGORY_LABELS: Readonly<Record<BuildingDefinition['category'], string>> = {
  shelter: 'Abrigo',
  infrastructure: 'Infraestrutura',
  food: 'Alimento',
  water: 'Água',
  energy: 'Energia',
  industry: 'Indústria',
  research: 'Pesquisa',
};

export interface BuildingDetailsPanelProps {
  /** Fonte de verdade da partida (somente leitura). */
  readonly controller: GameStateReader;
  /** Seleção atual da interface (estado de sessão, fora do `GameState`). */
  readonly selection: SelectionStore;
  /** Chamado depois que o jogador fecha o painel pelo botão (para devolver o foco ao jogo). */
  readonly onDismissed?: () => void;
}

const amountFormat = new Intl.NumberFormat('pt-BR');

/** Taxas por tick da definição ("Água 4 · Energia 3"), ou "Nenhum" quando não há nenhuma. */
function formatRates(entries: BuildingDetails['production']): string {
  return entries.length === 0
    ? 'Nenhum'
    : entries
        .map((entry) => `${entry.name} ${amountFormat.format(entry.amountPerTick)}`)
        .join(' · ');
}

function BuildingFacts({ details }: { readonly details: BuildingDetails }) {
  return (
    <>
      <h3 className="hud-panel__name">{details.name}</h3>
      <p className="hud-panel__category">{CATEGORY_LABELS[details.category]}</p>
      <dl className="hud-facts">
        <div className="hud-facts__row">
          <dt>Posição no grid</dt>
          <dd>
            x {details.position.x} · y {details.position.y}
          </dd>
        </div>
        <div className="hud-facts__row">
          <dt>Área ocupada</dt>
          <dd>
            {details.occupied.width} × {details.occupied.depth} células
          </dd>
        </div>
        <div className="hud-facts__row">
          <dt>Rotação</dt>
          <dd>{details.rotation}°</dd>
        </div>
        <div className="hud-facts__row">
          <dt>Produção por tick</dt>
          <dd>{formatRates(details.production)}</dd>
        </div>
        <div className="hud-facts__row">
          <dt>Consumo por tick</dt>
          <dd>{formatRates(details.consumption)}</dd>
        </div>
        <div className="hud-facts__row">
          <dt>Identificador</dt>
          <dd>
            <code>{details.instanceId}</code>
          </dd>
        </div>
      </dl>
    </>
  );
}

/**
 * Painel da construção selecionada. Cruza o `instanceId` do store de seleção com o snapshot do
 * `GameController`: nenhum dado da construção é copiado para o estado do React. Sem seleção mostra
 * uma mensagem de estado vazio. Se o identificador não existir (mais) no estado, mostra o estado
 * vazio e limpa a seleção inválida, sem lançar erro e sem laço de atualização.
 */
export function BuildingDetailsPanel({
  controller,
  selection,
  onDismissed,
}: BuildingDetailsPanelProps) {
  const titleId = useId();
  // Só a fatia `buildings`: ela mantém a referência a cada tick, então o painel não re-renderiza
  // enquanto as construções não mudam.
  const buildings = useGameSelector(controller, (snapshot) => snapshot.buildings);
  const { selectedEntityId } = useSelection(selection);

  const details = useMemo(
    () => (selectedEntityId === null ? null : selectBuildingDetails(buildings, selectedEntityId)),
    [buildings, selectedEntityId],
  );
  const isStale = selectedEntityId !== null && details === null;

  // Limpar é idempotente (não notifica quando já está vazio), então o efeito não gera laço, nem
  // mesmo com a dupla execução do StrictMode.
  useEffect(() => {
    if (isStale) {
      selection.clear();
    }
  }, [isStale, selection]);

  const dismiss = () => {
    selection.clear();
    onDismissed?.();
  };

  return (
    <aside className="hud-panel" aria-labelledby={titleId}>
      <header className="hud-panel__header">
        <h2 id={titleId} className="hud-panel__title">
          Construção selecionada
        </h2>
        {details && (
          <button
            type="button"
            className="hud-panel__close"
            aria-label="Limpar seleção"
            onClick={dismiss}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </header>

      {details ? (
        <BuildingFacts details={details} />
      ) : (
        <p className="hud-panel__empty">
          Selecione uma construção para consultar suas informações.
        </p>
      )}

      {/* Anúncio curto para leitores de tela quando a seleção muda (sem ler o painel inteiro). */}
      <p role="status" className="visually-hidden">
        {details ? `Selecionado: ${details.name}.` : 'Nenhuma construção selecionada.'}
      </p>
    </aside>
  );
}
