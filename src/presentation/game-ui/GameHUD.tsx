import type { GameController } from '@/game/application/GameController';
import type { BuildStore } from '@/session/buildStore';
import type { SelectionStore } from '@/session/selectionStore';
import type { SaveProvider } from '@/game/application/ports/SaveProvider';
import type { GameState } from '@/game/domain/state/GameState';
import type { BuildActions } from '../build/buildActions';
import { BuildPanel } from '../build/BuildPanel';
import { usePlacementActive } from '../hooks/useBuild';
import { useClock } from '../hooks/useClock';
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

/**
 * HUD de estratégia: HTML sobreposto ao canvas (não se usa Babylon GUI). O contêiner não captura o
 * ponteiro; só a barra superior e o painel o capturam, então o resto da tela continua entregando
 * cliques, arrastos e a roda do mouse ao canvas (câmera e seleção).
 */
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

  return (
    <div className="hud">
      {/* `data-paused` deixa evidente, pela cor da barra, que a simulação não está avançando. */}
      <header className="hud__top hud-topbar" data-paused={paused}>
        <h1 className="hud-title">Civilização Alienígena</h1>
        <TimeControls controller={controller} />
        <ResourceBar controller={controller} />
      </header>
      <div className="hud__side">
        <PopulationPanel controller={controller} />
        <CharacterGovernmentPanel controller={controller} />
        <ResearchExplorationPanel controller={controller} />
        <DiplomacyPanel controller={controller} />
        <TutorialPanel />
        <SavePanel
          controller={controller}
          provider={saveProvider}
          initialState={initialState}
          onStateReplaced={onStateReplaced}
        />
        <EventPanel controller={controller} />
        <BuildPanel controller={controller} build={build} actions={buildActions} />
        <BuildingDetailsPanel
          controller={controller}
          selection={selection}
          onDismissed={onPanelDismissed}
        />
      </div>
      <p className="hud__hint">
        {placing
          ? 'Arrastar: girar · W A S D: mover · Roda do mouse: zoom · Clique: fixar a posição · R: girar a prévia · Enter: confirmar · Esc: cancelar'
          : 'Arrastar: girar · Botão direito (ou Ctrl + arrastar) ou W A S D: mover · Roda do mouse: zoom · Clique: selecionar · Esc: limpar a seleção'}
      </p>
    </div>
  );
}
