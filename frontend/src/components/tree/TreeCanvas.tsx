import React, { useMemo } from 'react';
import type { HierarchyData, HierarchyMode, TraversalType } from '../../api/types';
import {
  computeLcrsLayout,
  truncateText,
} from '../../utils/layoutEngine';

export interface TreeCanvasProps {
  data?: HierarchyData | null;
  mode?: HierarchyMode;
  activeTraversal?: TraversalType | null;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  highlightedNodeIds?: string[];
  currentTraversalNodeId?: string | null;
  traversalStepNumber?: number | null;
  visitedNodeIds?: string[];
}

// ============================================================================
// TreeCanvas Component
// ============================================================================

export const TreeCanvas: React.FC<TreeCanvasProps> = ({
  data,
  activeTraversal,
  selectedNodeId,
  onSelectNode,
  highlightedNodeIds = [],
  currentTraversalNodeId = null,
  traversalStepNumber = null,
  visitedNodeIds = [],
}) => {
  const layout = useMemo(() => computeLcrsLayout(data), [data]);

  // Empty State Presentation
  if (layout.nodes.length === 0) {
    return (
      <div className="tree-canvas-wrapper">
        <div className="canvas-toolbar">
          <div className="toolbar-info">
            <span className="info-title">Interactive SVG Canvas</span>
            <span className="info-subtitle">Left-Child Right-Sibling Binary Model</span>
          </div>
        </div>

        <div
          className="empty-canvas-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px',
            padding: '3.5rem 2rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface-sunken)',
            gap: '0.85rem',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-muted)',
              fontSize: '1.4rem',
            }}
          >
            🌳
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            No Hierarchy Data Available
          </h3>
          <p
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              maxWidth: '440px',
              lineHeight: 1.55,
            }}
          >
            There are currently no nodes in this hierarchy. Select an active mode or supply data to
            visualize the Left-Child Right-Sibling binary representation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tree-canvas-wrapper">
      <div className="canvas-toolbar">
        <div className="toolbar-info">
          <span className="info-title">Interactive SVG Canvas</span>
          <span className="info-subtitle">
            Left-Child Right-Sibling Binary Model ({layout.nodes.length} nodes)
            {activeTraversal && ` — ${activeTraversal.toUpperCase()} ACTIVE`}
          </span>
        </div>
        <div className="legend-pills">
          <span className="legend-pill left-link">
            <span className="legend-indicator left" /> Left: First Child
          </span>
          <span className="legend-pill right-link">
            <span className="legend-indicator right" /> Right: Next Sibling
          </span>
        </div>
      </div>

      <div className="svg-container">
        <svg
          viewBox={layout.viewBox}
          className="hierarchy-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Dark background grid pattern */}
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path
                d="M 30 0 L 0 0 0 30"
                fill="none"
                stroke="rgba(128, 170, 211, 0.08)"
                strokeWidth="1"
              />
            </pattern>

            {/* Left-Child Arrow Marker (Icy Blue) */}
            <marker
              id="arrow-child"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#C0E6FD" />
            </marker>

            {/* Right-Sibling Arrow Marker (Muted Blue) */}
            <marker
              id="arrow-sibling"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#80AAD3" />
            </marker>
          </defs>

          {/* Grid Canvas Background */}
          <rect width="100%" height="100%" fill="var(--bg-surface-sunken)" />
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Connectors Layer */}
          {layout.edges.map(edge => {
            const isChild = edge.type === 'child';
            const isOriginatingFromSelected = selectedNodeId === edge.sourceId;
            const isOriginatingFromTraversal = currentTraversalNodeId === edge.sourceId;

            let strokeColor = isChild ? '#C0E6FD' : '#80AAD3';
            let strokeWidth = '2.0';

            if (isOriginatingFromTraversal) {
              strokeWidth = '2.8';
              strokeColor = '#C0E6FD';
            } else if (isOriginatingFromSelected) {
              strokeWidth = '2.5';
            }

            const markerId = isChild ? 'url(#arrow-child)' : 'url(#arrow-sibling)';

            return (
              <g
                key={edge.id}
                className={`connector-group ${isOriginatingFromTraversal ? 'traversal-active-edge' : ''}`}
              >
                <path
                  d={edge.path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={activeTraversal ? '4 4' : 'none'}
                  markerEnd={markerId}
                />
                <text
                  x={edge.labelX}
                  y={edge.labelY}
                  fill={strokeColor}
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                  style={{ userSelect: 'none' }}
                >
                  {isChild ? 'child' : 'sibling'}
                </text>
              </g>
            );
          })}

          {/* Nodes Layer */}
          {layout.nodes.map(pos => {
            const isSelected = selectedNodeId === pos.node.id;
            const isCurrentTraversal = currentTraversalNodeId === pos.node.id;
            const isVisited = visitedNodeIds.includes(pos.node.id);
            const isHighlighted = highlightedNodeIds.includes(pos.node.id);

            let strokeColor = '#3F6593';
            let strokeWidth = '1.5';
            let fillColor = 'var(--bg-surface)';

            if (isSelected) {
              strokeColor = '#C0E6FD';
              strokeWidth = '2.5';
              fillColor = '#213d61'; // Elevated dark navy surface tint
            } else if (isCurrentTraversal) {
              strokeColor = '#C0E6FD';
              strokeWidth = '2.5';
              fillColor = '#1f3c60';
            } else if (isVisited) {
              strokeColor = '#5B86B6';
              strokeWidth = '1.8';
            } else if (isHighlighted) {
              strokeColor = '#5B86B6';
              strokeWidth = '2';
            }

            const hasDept = Boolean(pos.node.department);
            const nameY = hasDept ? 22 : 28;
            const roleY = hasDept ? 41 : 47;
            const deptY = 55;

            return (
              <g
                key={pos.node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className={`tree-node-group ${isSelected ? 'selected' : ''} ${isCurrentTraversal ? 'traversal-current' : ''}`}
                onClick={() => onSelectNode?.(pos.node.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectNode?.(pos.node.id);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${pos.node.name}, ${pos.node.role}${pos.node.department ? ` (${pos.node.department})` : ''}. ${isCurrentTraversal ? `Current traversal step ${traversalStepNumber}. ` : ''}${isSelected ? 'Currently selected. Press Enter to deselect.' : 'Press Enter to select.'}`}
              >
                <title>
                  {`${pos.node.name} — ${pos.node.role}${pos.node.department ? ` (${pos.node.department})` : ''}\nID: ${pos.node.id}${isCurrentTraversal ? `\nTraversal Step #${traversalStepNumber}` : ''}\nClick or press Enter to ${isSelected ? 'deselect' : 'select'}`}
                </title>

                {/* Node Box */}
                <rect
                  width={pos.width}
                  height={pos.height}
                  rx="8"
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  filter={isSelected || isCurrentTraversal ? 'drop-shadow(0 0 10px rgba(192, 230, 253, 0.4))' : 'drop-shadow(0 4px 10px rgba(0, 7, 18, 0.45))'}
                />

                {/* Selected Accent Indicator Bar on Left */}
                {isSelected && (
                  <rect
                    x="0"
                    y="0"
                    width="4"
                    height={pos.height}
                    fill="#C0E6FD"
                    rx="2"
                  />
                )}

                {/* Current Traversal Step Badge on Top-Right */}
                {isCurrentTraversal && traversalStepNumber !== null && (
                  <g className="node-traversal-badge">
                    <rect
                      x={pos.width - 34}
                      y="6"
                      width="28"
                      height="18"
                      rx="4"
                      fill="#000F22"
                      stroke="#C0E6FD"
                      strokeWidth="1.2"
                    />
                    <text
                      x={pos.width - 20}
                      y="19"
                      fill="#C0E6FD"
                      fontSize="10"
                      fontWeight="700"
                      textAnchor="middle"
                      style={{ userSelect: 'none' }}
                    >
                      #{traversalStepNumber}
                    </text>
                  </g>
                )}

                {/* Visited Indicator Dot for Traversal Progress */}
                {isVisited && !isCurrentTraversal && (
                  <circle
                    cx={pos.width - 12}
                    cy="14"
                    r="3.5"
                    fill="#5B86B6"
                    opacity="0.8"
                  />
                )}

                {/* Node Name */}
                <text
                  x={pos.width / 2}
                  y={nameY}
                  fill={isSelected || isCurrentTraversal ? '#C0E6FD' : '#F0F7FF'}
                  fontSize="13"
                  fontWeight="600"
                  textAnchor="middle"
                  style={{ userSelect: 'none' }}
                >
                  {truncateText(pos.node.name, 22)}
                </text>

                {/* Node Role */}
                <text
                  x={pos.width / 2}
                  y={roleY}
                  fill="#80AAD3"
                  fontSize="11"
                  textAnchor="middle"
                  style={{ userSelect: 'none' }}
                >
                  {truncateText(pos.node.role, 24)}
                </text>

                {/* Optional Department */}
                {hasDept && (
                  <text
                    x={pos.width / 2}
                    y={deptY}
                    fill="#5B86B6"
                    fontSize="9.5"
                    fontWeight="500"
                    textAnchor="middle"
                    style={{ userSelect: 'none' }}
                  >
                    {truncateText(pos.node.department, 26)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default TreeCanvas;
