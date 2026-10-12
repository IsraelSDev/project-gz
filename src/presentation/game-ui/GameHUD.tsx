import { useState } from 'react';
import type { GameController } from '@/game/application/GameController';
import type { BuildStore } from '@/session/buildStore';
import type { SelectionStore } from '@/session/selectionStore';
import type { SaveProvider } from '@/game/application/ports/SaveProvider';
import type { GameState } from '@/game/domain/state/GameState';
import type { BuildActions } from '../build/buildActions';
import { BuildPanel } from '../build/BuildPanel';
import { selectPopulationSummary } from '@/game/application/populationSelectors';
import { usePlacementActive } from '../hooks/useBuild';
import { useClock } from '../hooks/useClock';
import { useSelection } from '../hooks/useSelection';
import { useGameSelector } from '../hooks/useGameSelector';
import { ResourceBar } from '../hud/ResourceBar';
import { TimeControls } from '../hud/TimeControls';
import { BuildingDetailsPanel } from './BuildingDetailsPanel';
import { EventPanel } from './EventPanel';
import { SavePanel } from './SavePanel';
import { PopulationPanel } from './PopulationPanel';
import { TutorialPanel } from './TutorialPanel';
import { CharacterGovernmentPanel } from './CharacterGovernmentPanel';
import { ResearchExplorationPanel } from './ResearchExplorationPanel';
import { DiplomacyPanel } from './DiplomacyPanel';
import { MilitaryPanel } from './MilitaryPanel';
import './hud.css';

export interface GameHUDProps {
  readonly controller: GameController;
  readonly selection: SelectionStore;
  /** Estado de sessão do modo de construção e as ações do jogador nele. */
  readonly build: BuildStore;
  readonly buildActions: BuildActions;
  readonly saveProvider: SaveProvider;
  readonly initialState: GameState;
  readonly onStateReplaced: () => void;
  /** Chamado quando o jogador fecha o painel pelo botão (para devolver o foco ao jogo). */
  readonly onPanelDismissed?: () => void;
}

type HUDSection =
  | 'overview'
  | 'build'
  | 'people'
  | 'research'
  | 'diplomacy'
  | 'military'
  | 'events'
  | 'tutorial'
  | 'save'
  | 'building';

const NAV_ITEMS: readonly {
  readonly id: HUDSection;
  readonly label: string;
  readonly icon: string;
}[] = [
  { id: 'overview', label: 'Visão geral', icon: '◉' },
  { id: 'build', label: 'Construção', icon: '⌂' },
  { id: 'people', label: 'Personagens e governo', icon: '☻' },
  { id: 'research', label: 'Pesquisa e exploração', icon: '⌕' },
  { id: 'diplomacy', label: 'Diplomacia', icon: '◇' },
  { id: 'military', label: 'Exército e defesa', icon: '⚔' },
  { id: 'events', label: 'Eventos', icon: '!' },
  { id: 'tutorial', label: 'Primeiros passos', icon: '?' },
  { id: 'save', label: 'Partida e salvamento', icon: '▣' },
];

function PopulationIndicator({ controller }: { readonly controller: GameController }) {
  const population = useGameSelector(controller, (snapshot) => snapshot.population);
  const buildings = useGameSelector(controller, (snapshot) => snapshot.buildings);
  const resources = useGameSelector(controller, (snapshot) => snapshot.resources);
  const summary = selectPopulationSummary({ population, buildings, resources });

  return (
    <p className="hud-population" aria-label="População e capacidade">
      <span aria-hidden="true">☻</span> {summary.survivors}/{summary.capacity}
    </p>
  );
}

/** HUD de estratégia: HTML sobreposto ao canvas; apenas seus controles capturam o ponteiro. */
export function GameHUD({
  controller,
  selection,
  build,
  buildActions,
  saveProvider,
  initialState,
  onStateReplaced,
  onPanelDismissed,
}: GameHUDProps) {
  const { paused } = useClock(controller.clock);
  const placing = usePlacementActive(build);
  const { selectedEntityId } = useSelection(selection);
  const activeEventCount = useGameSelector(
    controller,
    (snapshot) => snapshot.events.filter((event) => event.status === 'active').length,
  );
  const [activeSection, setActiveSection] = useState<HUDSection | null>('overview');
  const [selectionAtNavigation, setSelectionAtNavigation] = useState(selectedEntityId);
  // Uma nova seleção abre os detalhes; a navegação explícita do jogador passa a ter prioridade.
  const visibleSection =
    selectedEntityId !== null && selectedEntityId !== selectionAtNavigation
      ? 'building'
      : activeSection === 'building' && selectedEntityId === null
        ? 'overview'
        : activeSection;

  const showSection = (section: HUDSection) => {
    setSelectionAtNavigation(selectedEntityId);
    setActiveSection((active) => (active === section ? null : section));
  };
  const sectionVisible = (section: HUDSection) => visibleSection === section;
  const panelOpen = visibleSection !== null;
  const navItems =
    selectedEntityId === null
      ? NAV_ITEMS
      : [...NAV_ITEMS, { id: 'building' as const, label: 'Edifício selecionado', icon: '▦' }];

  return (
    <div className="hud">
      <header className="hud__top hud-topbar" data-paused={paused}>
        <h1 className="hud-title">Civilização Alienígena</h1>
        <TimeControls controller={controller} />
        <PopulationIndicator controller={controller} />
        <ResourceBar controller={controller} />
      </header>

      <nav className="hud-nav" aria-label="Seções da colônia">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="hud-nav__item"
            data-active={sectionVisible(item.id)}
            aria-label={item.label}
            aria-pressed={sectionVisible(item.id)}
            title={item.label}
            onClick={() => showSection(item.id)}
          >
            <span className="hud-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="hud-nav__label">{item.label}</span>
            {item.id === 'events' && activeEventCount > 0 && (
              <span className="hud-nav__badge" aria-hidden="true">
                {activeEventCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <aside className="hud-context" aria-label="Painel da colônia" hidden={!panelOpen}>
        <header className="hud-context__header">
          <h2>
            {visibleSection === 'building'
              ? 'Construção selecionada'
              : navItems.find((item) => item.id === visibleSection)?.label}
          </h2>
          <button
            type="button"
            className="hud-panel__close"
            aria-label="Fechar painel"
            onClick={() => {
              setSelectionAtNavigation(selectedEntityId);
              setActiveSection(null);
              onPanelDismissed?.();
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="hud-context__content">
          <div hidden={!sectionVisible('overview')}>
            <PopulationPanel controller={controller} />
          </div>
          <div hidden={!sectionVisible('build')}>
            <BuildPanel controller={controller} build={build} actions={buildActions} initialOpen />
          </div>
          <div hidden={!sectionVisible('people')}>
            <CharacterGovernmentPanel controller={controller} />
          </div>
          <div hidden={!sectionVisible('research')}>
            <ResearchExplorationPanel controller={controller} />
          </div>
          <div hidden={!sectionVisible('diplomacy')}>
            <DiplomacyPanel controller={controller} />
          </div>
          <div hidden={!sectionVisible('military')}>
            <MilitaryPanel controller={controller} />
          </div>
          <div hidden={!sectionVisible('events')}>
            <EventPanel controller={controller} showEmptyState />
          </div>
          <div hidden={!sectionVisible('tutorial')}>
            <TutorialPanel onDismissed={() => setActiveSection('overview')} />
          </div>
          <div hidden={!sectionVisible('save')}>
            <SavePanel
              controller={controller}
              provider={saveProvider}
              initialState={initialState}
              onStateReplaced={onStateReplaced}
            />
          </div>
          <div hidden={!sectionVisible('building')}>
            <BuildingDetailsPanel
              controller={controller}
              selection={selection}
              onDismissed={onPanelDismissed}
            />
          </div>
        </div>
      </aside>

      <p className="hud__hint">
        {placing
          ? 'Arrastar: girar · W A S D: mover · Roda do mouse: zoom · Clique: fixar a posição · R: girar a prévia · Enter: confirmar · Esc: cancelar'
          : 'Arrastar: girar · Botão direito (ou Ctrl + arrastar) ou W A S D: mover · Roda do mouse: zoom · Clique: selecionar · Esc: limpar a seleção'}
      </p>
    </div>
  );
}
