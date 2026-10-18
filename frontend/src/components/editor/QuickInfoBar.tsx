import React from 'react';
import type { HierarchyMode, TraversalType, BackendStatus, HierarchyStats } from '../../api/types';

interface QuickInfoBarProps {
  mode: HierarchyMode;
  activeTraversal: TraversalType | null;
  status: BackendStatus | null;
  dataSource?: 'backend' | 'demo';
  stats?: HierarchyStats | null;
}

export const QuickInfoBar: React.FC<QuickInfoBarProps> = ({
  mode,
  activeTraversal,
  status,
  dataSource = 'demo',
  stats,
}) => {
  return (
    <div className="quick-info-bar" role="region" aria-label="Hierarchy summary statistics">
      <div className="info-stat">
        <span className="stat-label">Active Mode</span>
        <span className="stat-value">{mode === 'org' ? '🏢 Organization' : '🌳 Family'}</span>
      </div>

      <div className="info-stat">
        <span className="stat-label">Data Source</span>
        <span className="stat-value">
          {dataSource === 'backend' ? '🟢 C++ Backend (Live API)' : '🟡 Local Demo (Offline)'}
        </span>
      </div>

      <div className="info-stat">
        <span className="stat-label">Traversal Selected</span>
        <span className="stat-value highlight">
          {activeTraversal ? activeTraversal.toUpperCase() : 'None (Select below)'}
        </span>
      </div>

      <div className="info-stat">
        <span className="stat-label">C++ Engine & Stats</span>
        <span className="stat-value">
          {stats
            ? `Height: ${stats.binaryTreeHeight} | Members: ${stats.totalMembers}`
            : status
            ? `${status.compiler} (WinSock2)`
            : 'WinSock2 Server (Port 8080)'}
        </span>
      </div>
    </div>
  );
};

