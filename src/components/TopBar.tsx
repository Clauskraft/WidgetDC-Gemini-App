import type { CanvasMode } from '../types/widgetdc';

interface TopBarProps {
  activeMode: CanvasMode['id'];
  onModeChange: (mode: CanvasMode['id']) => void;
  modes: CanvasMode[];
  authenticated: boolean;
  serverReachable: boolean;
}

export function TopBar({ activeMode, onModeChange, modes, authenticated, serverReachable }: TopBarProps) {
  const authLabel = !serverReachable ? 'Static preview' : authenticated ? 'Authenticated' : 'Server token pending';
  const authState = !serverReachable ? 'static' : authenticated ? 'good' : 'warn';

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

      <div className="auth-pill" data-state={authState}>
        <span className="pulse-dot" />
        {authLabel}
      </div>
    </header>
  );
}
