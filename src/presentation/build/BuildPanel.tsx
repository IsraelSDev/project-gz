import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { GameStateReader } from '@/game/application/GameController';
import {
  selectBuildCatalog,
  selectPlacementPreview,
  type BuildCatalogEntry,
  type CostLine,
  type PlacementPreview,
} from '@/game/application/buildSelectors';
import type { BuildFeedback, BuildStore } from '@/session/buildStore';
import { useBuild } from '../hooks/useBuild';
import { useGameSelector } from '../hooks/useGameSelector';
import { describeError } from './buildMessages';
import type { BuildActions } from './buildActions';

const numberFormat = new Intl.NumberFormat('pt-BR');

export interface BuildPanelProps {
  /** Fonte do estoque e dos edifícios (somente leitura). */
  readonly controller: GameStateReader;
  /** Estado de sessão do modo de construção (fora do `GameState`). */
  readonly build: BuildStore;
  readonly actions: BuildActions;
  /** Abre o catálogo quando a seção de construção é escolhida na navegação. */
  readonly initialOpen?: boolean;
}

/** "Materiais 40", e "— faltam 10" quando o estoque não cobre. O texto, não só a cor, diz que falta. */
function CostItem({ line }: { readonly line: CostLine }) {
  return (
    <li className="build-cost__line" data-enough={line.missing === 0}>
      <span>
        {line.name} {numberFormat.format(line.amount)}
      </span>
      {line.missing > 0 && (
        <span className="build-cost__missing">
          {' '}
          — faltam {numberFormat.format(line.missing)} (há {numberFormat.format(line.available)})
        </span>
      )}
    </li>
  );
}

function CatalogItem({
  entry,
  selected,
  onChoose,
}: {
  readonly entry: BuildCatalogEntry;
  readonly selected: boolean;
  readonly onChoose: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="build-item"
        aria-pressed={selected}
        data-affordable={entry.affordable}
        disabled={!entry.unlocked}
        onClick={onChoose}
      >
        <span className="build-item__name">{entry.name}</span>
        <span className="build-item__size">
          {entry.footprint.width} × {entry.footprint.depth} células
        </span>
        <span className="build-item__cost">
          Custo: {entry.cost.length === 0 ? 'grátis' : entry.cost.map(costText).join(' · ')}
        </span>
        {!entry.affordable && (
          <span className="build-item__warning">Recursos insuficientes agora</span>
        )}
        {!entry.unlocked && <span className="build-item__warning">Requer tecnologia</span>}
      </button>
    </li>
  );
}

const costText = (line: CostLine) => `${line.name} ${numberFormat.format(line.amount)}`;

function placementStatusText(status: PlacementPreview['status']): string {
  switch (status.kind) {
    case 'no-position':
      return 'Aponte para o terreno e clique para fixar a posição.';
    case 'valid':
      return 'Posição válida.';
    case 'invalid':
      return status.error === 'TECHNOLOGY_LOCKED'
        ? 'Pesquise a tecnologia necessária primeiro.'
        : describeError(status.error);
  }
}

function feedbackText(feedback: BuildFeedback, catalog: readonly BuildCatalogEntry[]): string {
  if (feedback.kind === 'rejected') {
    return `Construção recusada: ${describeError(feedback.error)}`;
  }
  const name = catalog.find((entry) => entry.definitionId === feedback.definitionId)?.name ?? '';
  return feedback.kind === 'applied'
    ? `${name} construído.`
    : `${name}: construção enviada; será aplicada no próximo passo da simulação.`;
}

function PlacementControls({
  preview,
  actions,
}: {
  readonly preview: PlacementPreview;
  readonly actions: BuildActions;
}) {
  const valid = preview.status.kind === 'valid';
  return (
    <div className="build-placement" role="group" aria-label={`Posicionar ${preview.name}`}>
      <h3 className="hud-panel__name">{preview.name}</h3>
      <p className="build-placement__size">
        Ocupa {preview.occupied.width} × {preview.occupied.depth} células · rotação{' '}
        {preview.rotation}°
      </p>
      <p className="build-placement__status" data-state={preview.status.kind}>
        <span aria-hidden="true" className="build-placement__mark">
          {preview.status.kind === 'valid' ? '✔' : preview.status.kind === 'invalid' ? '✖' : '•'}
        </span>
        <span>{placementStatusText(preview.status)}</span>
      </p>
      <ul className="build-cost" aria-label="Custo da construção">
        {preview.cost.length === 0 ? (
          <li className="build-cost__line">Grátis</li>
        ) : (
          preview.cost.map((line) => <CostItem key={line.id} line={line} />)
        )}
      </ul>
      <div className="build-placement__actions">
        <button type="button" className="build-button" onClick={actions.rotate}>
          Girar 90° (R)
        </button>
        <button
          type="button"
          className="build-button build-button--primary"
          disabled={!valid}
          onClick={actions.confirm}
        >
          Confirmar construção
        </button>
        <button type="button" className="build-button" onClick={actions.cancel}>
          Cancelar (Esc)
        </button>
      </div>
    </div>
  );
}

function BuildBody({ controller, build, actions, id }: BuildPanelProps & { readonly id: string }) {
  // Só as fatias de que precisa: o estoque (custos e disponibilidade) e as construções (colisão).
  const resources = useGameSelector(controller, (snapshot) => snapshot.resources);
  const buildings = useGameSelector(controller, (snapshot) => snapshot.buildings);
  const research = useGameSelector(controller, (snapshot) => snapshot.research);
  const state = useBuild(build);

  const catalog = useMemo(
    () => selectBuildCatalog(resources, research.unlockedTechnologyIds),
    [resources, research],
  );
  const preview = useMemo(
    () => selectPlacementPreview({ resources, buildings, research }, state),
    [resources, buildings, research, state],
  );

  // Esc e R funcionam também com o foco nos botões do painel (no canvas, quem trata é o GameCanvas).
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (state.definitionId === null) {
      return;
    }
    if (event.key === 'Escape') {
      actions.cancel();
    } else if (event.key === 'r' || event.key === 'R') {
      actions.rotate();
    }
  };

  return (
    // O painel recebe teclas só para atalhos (Esc e R); os controles continuam sendo os botões.
    <div id={id} className="hud-panel build-panel__body" onKeyDown={handleKeyDown}>
      <h2 className="hud-panel__title build-panel__title">Construção</h2>
      <ul className="build-catalog" aria-label="Edifícios disponíveis">
        {catalog.map((entry) => (
          <CatalogItem
            key={entry.definitionId}
            entry={entry}
            selected={state.definitionId === entry.definitionId}
            onChoose={() => actions.start(entry.definitionId)}
          />
        ))}
      </ul>

      {preview ? (
        <PlacementControls preview={preview} actions={actions} />
      ) : (
        <p className="hud-panel__empty">Escolha um edifício para ver a prévia no terreno.</p>
      )}

      {/* Anúncio do resultado da construção para leitores de tela. */}
      <p role="status" className="build-panel__feedback" data-kind={state.feedback?.kind}>
        {state.feedback ? feedbackText(state.feedback, catalog) : ''}
      </p>
    </div>
  );
}

/**
 * Painel de construção da HUD: botão "Construir" e, aberto, o catálogo de edifícios com custo e
 * disponibilidade, os controles da prévia (girar, confirmar, cancelar) e o resultado. Não tem regra
 * de posicionamento nem de custo: lê catálogo, prévia e validade dos seletores da aplicação, que usam
 * as mesmas regras do comando `PlaceBuilding`, e envia a confirmação pelas ações. O estado do modo
 * (qual edifício, rotação, posição) vive no store de sessão, não aqui.
 */
export function BuildPanel({ controller, build, actions, initialOpen = false }: BuildPanelProps) {
  const [open, setOpen] = useState(initialOpen);
  const bodyId = useId();

  const toggle = () => {
    if (open) {
      // Fechar o painel cancela o posicionamento: nada da partida muda.
      actions.cancel();
    }
    setOpen(!open);
  };

  return (
    <section className="build-panel" aria-label="Construção">
      <button
        type="button"
        className="build-panel__toggle"
        aria-expanded={open}
        aria-controls={open ? bodyId : undefined}
        onClick={toggle}
      >
        <span aria-hidden="true">{open ? '⌃' : '⌄'}</span>
        <span>{open ? 'Recolher catálogo' : 'Exibir catálogo'}</span>
      </button>
      {open && <BuildBody controller={controller} build={build} actions={actions} id={bodyId} />}
    </section>
  );
}
