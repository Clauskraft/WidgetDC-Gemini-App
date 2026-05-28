import type { CanvasMode } from '../types/widgetdc';

interface TopBarProps {
  activeMode: CanvasMode['id'];
  onModeChange: (mode: CanvasMode['id']) => void;
  modes: CanvasMode[];
  authenticated: boolean;
}

export function TopBar({ activeMode, onModeChange, modes, authenticated }: TopBarProps) {
  return (
    <header className="topbar glass-panel">
      <div className="brand-lockup">
        <div className="brand-mark">W</div>
        <div>
          <div className="brand-title aurora-text">WidgeTDC Aurora</div>
          <div className="brand-subtitle">Governed agent control plane frontend</div>
        </div>
      </div>

      <nav className="mode-tabs" aria-label="Workspace modes">
        {modes.map((mode) => (
          <button
            key={mode.id}
            className={`mode-tab ${activeMode === mode.id ? 'active' : ''}`}
            onClick={() => onModeChange(mode.id)}
            title={mode.description}
          >
            {mode.label}
          </button>
        ))}
      </nav>

      <div className="auth-pill" data-state={authenticated ? 'good' : 'warn'}>
        <span className="pulse-dot" />
        {authenticated ? 'Authenticated' : 'Server token pending'}
      </div>
    </header>
  );
}
