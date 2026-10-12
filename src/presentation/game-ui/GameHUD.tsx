import type { GameController } from '@/game/application/GameController';
import type { SelectionStore } from '@/session/selectionStore';
import { ResourceBar } from '../hud/ResourceBar';
import { BuildingDetailsPanel } from './BuildingDetailsPanel';
import './hud.css';

export interface GameHUDProps {
  readonly controller: GameController;
  readonly selection: SelectionStore;
  /** Chamado quando o jogador fecha o painel pelo botão (para devolver o foco ao jogo). */
  readonly onPanelDismissed?: () => void;
}

/**
 * HUD de estratégia: HTML sobreposto ao canvas (não se usa Babylon GUI). O contêiner não captura o
 * ponteiro; só a barra superior e o painel o capturam, então o resto da tela continua entregando
 * cliques, arrastos e a roda do mouse ao canvas (câmera e seleção).
 */
export function GameHUD({ controller, selection, onPanelDismissed }: GameHUDProps) {
  return (
    <div className="hud">
      <header className="hud__top hud-topbar">
        <h1 className="hud-title">Civilização Alienígena</h1>
        <ResourceBar controller={controller} />
      </header>
      <div className="hud__side">
        <BuildingDetailsPanel
          controller={controller}
          selection={selection}
          onDismissed={onPanelDismissed}
        />
      </div>
      <p className="hud__hint">
        Arrastar: girar · Botão direito (ou Ctrl + arrastar) ou W A S D: mover · Roda do mouse: zoom
        · Clique: selecionar · Esc: limpar a seleção
      </p>
    </div>
  );
}
