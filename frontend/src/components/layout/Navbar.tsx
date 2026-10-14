import React from 'react';
import type { HierarchyMode, BackendStatus } from '../../api/types';

interface NavbarProps {
  mode: HierarchyMode;
  onModeChange: (mode: HierarchyMode) => void;
  status: BackendStatus | null;
  isChecking: boolean;
  onRefreshStatus: () => void;
  errorMessage?: string | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  mode,
  onModeChange,
  status,
  isChecking,
  onRefreshStatus,
  errorMessage,
}) => {
  const isOnline = status !== null;

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <div className="brand-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="5" r="3" />
            <circle cx="5" cy="19" r="3" />
            <circle cx="19" cy="19" r="3" />
            <line x1="12" y1="8" x2="5" y2="16" />
            <line x1="12" y1="8" x2="19" y2="16" />
          </svg>
        </div>
        <div>
          <h1 className="brand-title">Hierarchy Explorer</h1>
          <p className="brand-subtitle">Binary Tree Traversals (LCRS Representation)</p>
        </div>
      </div>

      <div className="navbar-center">
        <div className="mode-toggle-group">
          <button
            type="button"
            className={`mode-btn ${mode === 'org' ? 'active' : ''}`}
            onClick={() => onModeChange('org')}
          >
            <span className="mode-icon">🏢</span>
            Organization Mode
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === 'family' ? 'active' : ''}`}
            onClick={() => onModeChange('family')}
          >
            <span className="mode-icon">🌳</span>
            Family Mode
          </button>
        </div>
      </div>

      <div className="navbar-actions">
        <div
          className="status-badge-container"
          title={
            status
              ? `${status.service} (${status.compiler}) — Connected via WinSock2 on port 8080`
              : errorMessage
              ? `Backend Offline: ${errorMessage}`
              : 'Backend server offline at localhost:8080'
          }
        >
          <span className={`status-indicator-dot ${isOnline ? 'online' : 'offline'}`} />
          <span className="status-text">
            {isChecking ? 'Checking...' : isOnline ? 'Backend Online' : 'Backend Offline'}
          </span>
          <button
            type="button"
            className="refresh-btn"
            onClick={onRefreshStatus}
            disabled={isChecking}
            title="Recheck backend health"
            aria-label="Recheck backend health"
          >
            ↻
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
