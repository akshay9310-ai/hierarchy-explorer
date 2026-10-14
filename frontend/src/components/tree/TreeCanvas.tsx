import React, { useMemo } from 'react';
import type { HierarchyData, HierarchyMode, TraversalType, TreeNodeDto } from '../../api/types';

// ============================================================================
// Layout Engine Types
// ============================================================================

export interface PositionedNode {
  node: TreeNodeDto;
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
}

export interface ConnectorEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'child' | 'sibling';
  path: string;
  labelX: number;
  labelY: number;
}

export interface TreeLayoutResult {
  nodes: PositionedNode[];
  edges: ConnectorEdge[];
  viewBox: string;
  totalWidth: number;
  totalHeight: number;
}

export interface TreeCanvasProps {
  data?: HierarchyData | null;
  mode?: HierarchyMode;
  activeTraversal?: TraversalType | null;
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
  highlightedNodeIds?: string[];
}

// Layout Configuration Constants
const NODE_WIDTH = 200;
const NODE_HEIGHT = 66;
const LEVEL_HEIGHT = 135;
const SIBLING_GAP = 48;
const CANVAS_MIN_WIDTH = 900;
const CANVAS_MIN_HEIGHT = 500;
const CANVAS_PADDING = 40;

function truncateText(str: string | undefined, maxLen: number): string {
  if (!str) return '';
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
}

/**
 * Deterministic Layout Function for Left-Child Right-Sibling (LCRS) Binary Trees.
 *
 * Traversal semantics & geometry:
 * - leftChild: represents first direct child (descends vertically to the next generation).
 * - rightSibling: represents next sibling (extends horizontally along the same level).
 *
 * Algorithm:
 * 1. Bottom-up branch measurement: calculates subtree bounding width for each node.
 * 2. Top-down coordinate assignment: centers parent over child chain while spacing siblings.
 * 3. Bounding box computation & auto-centering: prevents edge/node clipping for any tree size.
 */
export function computeLcrsLayout(data?: HierarchyData | null): TreeLayoutResult {
  const emptyResult: TreeLayoutResult = {
    nodes: [],
    edges: [],
    viewBox: `0 0 ${CANVAS_MIN_WIDTH} ${CANVAS_MIN_HEIGHT}`,
    totalWidth: CANVAS_MIN_WIDTH,
    totalHeight: CANVAS_MIN_HEIGHT,
  };

  if (!data || !data.rootId || !data.nodes || data.nodes.length === 0) {
    return emptyResult;
  }

  // Index nodes by ID
  const nodeMap = new Map<string, TreeNodeDto>();
  for (const n of data.nodes) {
    nodeMap.set(n.id, n);
  }

  if (!nodeMap.has(data.rootId)) {
    return emptyResult;
  }

  // Phase 1: Measure subtree branch widths with cycle protection
  const branchWidthMap = new Map<string, number>();
  const measureVisited = new Set<string>();

  function measureBranch(nodeId: string): number {
    if (!nodeId || measureVisited.has(nodeId) || !nodeMap.has(nodeId)) {
      return 0;
    }
    measureVisited.add(nodeId);
    const node = nodeMap.get(nodeId)!;

    if (!node.leftChildId || !nodeMap.has(node.leftChildId)) {
      branchWidthMap.set(nodeId, NODE_WIDTH);
      return NODE_WIDTH;
    }

    // Traverse the sibling chain of the first child
    let childrenWidth = 0;
    let childCount = 0;
    let currChildId: string | null | undefined = node.leftChildId;

    while (currChildId && nodeMap.has(currChildId) && !measureVisited.has(currChildId)) {
      const childW = measureBranch(currChildId);
      childrenWidth += childW;
      childCount++;
      currChildId = nodeMap.get(currChildId)?.rightSiblingId;
    }

    if (childCount > 1) {
      childrenWidth += (childCount - 1) * SIBLING_GAP;
    }

    const totalWidth = Math.max(NODE_WIDTH, childrenWidth);
    branchWidthMap.set(nodeId, totalWidth);
    return totalWidth;
  }

  // Measure from root across any root-level sibling chain
  const rootChain: string[] = [];
  let rootCurr: string | null | undefined = data.rootId;
  while (rootCurr && nodeMap.has(rootCurr) && !measureVisited.has(rootCurr)) {
    rootChain.push(rootCurr);
    measureBranch(rootCurr);
    rootCurr = nodeMap.get(rootCurr)?.rightSiblingId;
  }

  // Phase 2: Top-down positioning
  const positionedMap = new Map<string, PositionedNode>();
  const positionVisited = new Set<string>();

  function positionBranch(nodeId: string, startX: number, level: number): void {
    if (!nodeId || positionVisited.has(nodeId) || !nodeMap.has(nodeId)) {
      return;
    }
    positionVisited.add(nodeId);
    const node = nodeMap.get(nodeId)!;
    const branchW = branchWidthMap.get(nodeId) || NODE_WIDTH;

    // Collect direct children (sibling chain starting from leftChildId)
    const children: string[] = [];
    let currChild: string | null | undefined = node.leftChildId;
    while (currChild && nodeMap.has(currChild) && !positionVisited.has(currChild)) {
      children.push(currChild);
      currChild = nodeMap.get(currChild)?.rightSiblingId;
    }

    // Determine total width occupied by direct children
    let childrenTotalW = 0;
    for (let i = 0; i < children.length; i++) {
      const cw = branchWidthMap.get(children[i]) || NODE_WIDTH;
      childrenTotalW += cw;
      if (i > 0) childrenTotalW += SIBLING_GAP;
    }

    // Center current node over its child group if present, otherwise center in branch
    let nodeX = startX;
    if (children.length > 0) {
      nodeX = startX + (childrenTotalW - NODE_WIDTH) / 2;
    } else {
      nodeX = startX + (branchW - NODE_WIDTH) / 2;
    }

    const nodeY = CANVAS_PADDING + level * LEVEL_HEIGHT;

    positionedMap.set(node.id, {
      node,
      x: nodeX,
      y: nodeY,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      level,
    });

    // Recursively position child subtrees horizontally
    let currentChildX = startX;
    for (const childId of children) {
      const cWidth = branchWidthMap.get(childId) || NODE_WIDTH;
      positionBranch(childId, currentChildX, level + 1);
      currentChildX += cWidth + SIBLING_GAP;
    }
  }

  let rootX = CANVAS_PADDING;
  for (const rId of rootChain) {
    const rWidth = branchWidthMap.get(rId) || NODE_WIDTH;
    positionBranch(rId, rootX, 0);
    rootX += rWidth + SIBLING_GAP;
  }

  const nodesList = Array.from(positionedMap.values());
  if (nodesList.length === 0) {
    return emptyResult;
  }

  // Phase 3: Bounding box calculation & Auto-centering
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of nodesList) {
    if (p.x < minX) minX = p.x;
    if (p.x + p.width > maxX) maxX = p.x + p.width;
    if (p.y < minY) minY = p.y;
    if (p.y + p.height > maxY) maxY = p.y + p.height;
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const totalW = Math.max(CANVAS_MIN_WIDTH, contentW + CANVAS_PADDING * 2);
  const totalH = Math.max(CANVAS_MIN_HEIGHT, contentH + CANVAS_PADDING * 2);

  // Compute offset to center the tree within the SVG viewport
  const offsetX = (totalW - contentW) / 2 - minX;
  const offsetY = (totalH - contentH) / 2 - minY;

  for (const p of nodesList) {
    p.x += offsetX;
    p.y += offsetY;
  }

  // Phase 4: Construct directional connectors for the exact binary pointers
  const edges: ConnectorEdge[] = [];

  for (const p of nodesList) {
    const node = p.node;

    // 1. Left-Child Pointer (First Child: down-curve from bottom of parent to top of child)
    if (node.leftChildId && positionedMap.has(node.leftChildId)) {
      const child = positionedMap.get(node.leftChildId)!;
      const x1 = p.x + p.width / 2;
      const y1 = p.y + p.height;
      const x2 = child.x + child.width / 2;
      const y2 = child.y;
      const midY = (y1 + y2) / 2;

      const path = Math.abs(x1 - x2) < 2
        ? `M ${x1} ${y1} L ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

      edges.push({
        id: `${node.id}->child->${child.node.id}`,
        sourceId: node.id,
        targetId: child.node.id,
        type: 'child',
        path,
        labelX: (x1 + x2) / 2,
        labelY: midY,
      });
    }

    // 2. Right-Sibling Pointer (Next Sibling: rightward line from right edge to left edge)
    if (node.rightSiblingId && positionedMap.has(node.rightSiblingId)) {
      const sibling = positionedMap.get(node.rightSiblingId)!;
      const x1 = p.x + p.width;
      const y1 = p.y + p.height / 2;
      const x2 = sibling.x;
      const y2 = sibling.y + sibling.height / 2;
      const midX = (x1 + x2) / 2;

      const path = Math.abs(y1 - y2) < 2
        ? `M ${x1} ${y1} L ${x2} ${y2}`
        : `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

      edges.push({
        id: `${node.id}->sibling->${sibling.node.id}`,
        sourceId: node.id,
        targetId: sibling.node.id,
        type: 'sibling',
        path,
        labelX: midX,
        labelY: y1 - 8,
      });
    }
  }

  return {
    nodes: nodesList,
    edges,
    viewBox: `0 0 ${totalW} ${totalH}`,
    totalWidth: totalW,
    totalHeight: totalH,
  };
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
            const strokeColor = isChild ? '#C0E6FD' : '#80AAD3';
            const markerId = isChild ? 'url(#arrow-child)' : 'url(#arrow-sibling)';

            const strokeWidth = isOriginatingFromSelected ? '2.8' : '2.0';

            return (
              <g
                key={edge.id}
                className={`connector-group ${isOriginatingFromSelected ? 'selected-edge' : ''}`}
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
            const isHighlighted = highlightedNodeIds.includes(pos.node.id);

            let strokeColor = '#3F6593';
            let strokeWidth = '1.5';
            let fillColor = 'var(--bg-surface)';

            if (isSelected) {
              strokeColor = '#C0E6FD';
              strokeWidth = '2.5';
              fillColor = '#213d61'; // Elevated dark navy surface tint
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
                className={`tree-node-group ${isSelected ? 'selected' : ''}`}
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
                aria-label={`${pos.node.name}, ${pos.node.role}${pos.node.department ? ` (${pos.node.department})` : ''}. ${isSelected ? 'Currently selected. Press Enter or Space to deselect.' : 'Press Enter or Space to select.'}`}
              >
                <title>
                  {`${pos.node.name} — ${pos.node.role}${pos.node.department ? ` (${pos.node.department})` : ''}\nID: ${pos.node.id}\nClick or press Enter to ${isSelected ? 'deselect' : 'select'}`}
                </title>

                {/* Node Box */}
                <rect
                  width={pos.width}
                  height={pos.height}
                  rx="8"
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  filter={isSelected ? 'drop-shadow(0 0 10px rgba(192, 230, 253, 0.4))' : 'drop-shadow(0 4px 10px rgba(0, 7, 18, 0.45))'}
                />

                {/* Selected Accent Indicator Bar */}
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

                {/* Node Name */}
                <text
                  x={pos.width / 2}
                  y={nameY}
                  fill={isSelected ? '#C0E6FD' : '#F0F7FF'}
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
