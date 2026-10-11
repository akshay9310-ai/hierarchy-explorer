import React from 'react';
import type { HierarchyMode, TraversalType } from '../../api/types';

interface TreeCanvasProps {
  mode: HierarchyMode;
  activeTraversal: TraversalType | null;
}

export const TreeCanvas: React.FC<TreeCanvasProps> = ({ mode, activeTraversal }) => {
  // Sample demonstration node positions for the LCRS visual scaffolding
  const isOrg = mode === 'org';

  const rootTitle = isOrg ? 'Chief Executive Officer' : 'Family Patriarch';
  const rootName = isOrg ? 'Sarah Connor' : 'Arthur Pendragon';

  const childTitle = isOrg ? 'VP Technology' : 'First Child (Eldest)';
  const childName = isOrg ? 'John Connor' : 'Galahad';

  const siblingTitle = isOrg ? 'VP Operations (Sibling)' : 'Second Child (Sibling)';
  const siblingName = isOrg ? 'Kyle Reese' : 'Gawain';

  const subChildTitle = isOrg ? 'Lead Architect' : 'Grandchild';
  const subChildName = isOrg ? 'Miles Dyson' : 'Lancelot';

  return (
    <div className="tree-canvas-wrapper">
      <div className="canvas-toolbar">
        <div className="toolbar-info">
          <span className="info-title">Interactive SVG Canvas</span>
          <span className="info-subtitle">Left-Child Right-Sibling Binary Model</span>
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
          viewBox="0 0 900 500"
          className="hierarchy-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
            </pattern>
            {/* Arrowhead marker for Left (Child) */}
            <marker id="arrow-left" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
            </marker>
            {/* Arrowhead marker for Right (Sibling) */}
            <marker id="arrow-right" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#34d399" />
            </marker>
          </defs>

          {/* Canvas Background Grid */}
          <rect width="100%" height="100%" fill="#0d1117" />
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Tree Edge: Root -> Left Child */}
          <path
            d="M 450 110 C 450 170, 270 170, 270 230"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeDasharray={activeTraversal ? '4 4' : 'none'}
            markerEnd="url(#arrow-left)"
          />
          <text x="330" y="180" fill="#38bdf8" fontSize="12" fontWeight="600" textAnchor="middle">
            left (first child)
          </text>

          {/* Tree Edge: Left Child -> Next Sibling */}
          <path
            d="M 370 270 L 630 270"
            fill="none"
            stroke="#34d399"
            strokeWidth="2.5"
            strokeDasharray={activeTraversal ? '4 4' : 'none'}
            markerEnd="url(#arrow-right)"
          />
          <text x="500" y="260" fill="#34d399" fontSize="12" fontWeight="600" textAnchor="middle">
            right (sibling)
          </text>

          {/* Tree Edge: Left Child -> Sub Child */}
          <path
            d="M 270 310 C 270 350, 170 350, 170 390"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            markerEnd="url(#arrow-left)"
          />
          <text x="180" y="355" fill="#38bdf8" fontSize="12" fontWeight="600" textAnchor="middle">
            left (subordinate)
          </text>

          {/* Node 1: Root */}
          <g transform="translate(350, 50)" className="tree-node-group">
            <rect width="200" height="60" rx="10" fill="#1e293b" stroke="#60a5fa" strokeWidth="2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.4))" />
            <text x="100" y="25" fill="#f8fafc" fontSize="14" fontWeight="600" textAnchor="middle">{rootName}</text>
            <text x="100" y="45" fill="#94a3b8" fontSize="12" textAnchor="middle">{rootTitle}</text>
          </g>

          {/* Node 2: First Child */}
          <g transform="translate(170, 230)" className="tree-node-group">
            <rect width="200" height="60" rx="10" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.4))" />
            <text x="100" y="25" fill="#f8fafc" fontSize="14" fontWeight="600" textAnchor="middle">{childName}</text>
            <text x="100" y="45" fill="#94a3b8" fontSize="12" textAnchor="middle">{childTitle}</text>
          </g>

          {/* Node 3: Sibling */}
          <g transform="translate(530, 230)" className="tree-node-group">
            <rect width="200" height="60" rx="10" fill="#1e293b" stroke="#34d399" strokeWidth="2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.4))" />
            <text x="100" y="25" fill="#f8fafc" fontSize="14" fontWeight="600" textAnchor="middle">{siblingName}</text>
            <text x="100" y="45" fill="#94a3b8" fontSize="12" textAnchor="middle">{siblingTitle}</text>
          </g>

          {/* Node 4: Subordinate */}
          <g transform="translate(70, 390)" className="tree-node-group">
            <rect width="200" height="60" rx="10" fill="#1e293b" stroke="#818cf8" strokeWidth="2" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.4))" />
            <text x="100" y="25" fill="#f8fafc" fontSize="14" fontWeight="600" textAnchor="middle">{subChildName}</text>
            <text x="100" y="45" fill="#94a3b8" fontSize="12" textAnchor="middle">{subChildTitle}</text>
          </g>
        </svg>
      </div>
    </div>
  );
};
