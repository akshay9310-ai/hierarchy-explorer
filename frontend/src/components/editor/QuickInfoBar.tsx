import React from 'react';
import type { HierarchyMode, TraversalType, BackendStatus } from '../../api/types';

interface QuickInfoBarProps {
  mode: HierarchyMode;
  activeTraversal: TraversalType | null;
  status: BackendStatus | null;
}

export const QuickInfoBar: React.FC<QuickInfoBarProps> = ({
  mode,
  activeTraversal,
  status,
}) => {
  return (
    <div className="quick-info-bar">
      <div className="info-stat">
        <span className="stat-label">Active Mode</span>
        <span className="stat-value">{mode === 'org' ? '🏢 Organization' : '🌳 Family'}</span>
      </div>

      <div className="info-stat">
        <span className="stat-label">Data Structure</span>
        <span className="stat-value">Binary Tree (LCRS)</span>
      </div>

      <div className="info-stat">
        <span className="stat-label">Traversal Selected</span>
        <span className="stat-value highlight">
          {activeTraversal ? activeTraversal.toUpperCase() : 'None (Select below)'}
        </span>
      </div>

      <div className="info-stat">
        <span className="stat-label">Backend Engine</span>
        <span className="stat-value">
          {status ? `${status.compiler}` : 'WinSock2 Server (Localhost:8080)'}
        </span>
      </div>
    </div>
  );
};
