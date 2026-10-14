import React from 'react';
import type { TreeNodeDto } from '../../api/types';

export interface NodeInspectorProps {
  selectedNode: TreeNodeDto | null;
  allNodes: TreeNodeDto[];
  onSelectNode: (nodeId: string) => void;
  onClearSelection: () => void;
}

export const NodeInspector: React.FC<NodeInspectorProps> = ({
  selectedNode,
  allNodes,
  onSelectNode,
  onClearSelection,
}) => {
  if (!selectedNode) {
    return (
      <div className="node-inspector-card empty">
        <div className="card-header">
          <h2 className="card-title">Node Inspector</h2>
          <span className="badge">No Selection</span>
        </div>
        <div className="inspector-empty-body">
          <p className="inspector-empty-text">
            Click any node on the hierarchy canvas or use <kbd>Tab</kbd> + <kbd>Enter</kbd> to inspect its details and Left-Child Right-Sibling binary pointers.
          </p>
        </div>
      </div>
    );
  }

  // Lookup related nodes
  const parentNode = selectedNode.parentId
    ? allNodes.find(n => n.id === selectedNode.parentId) ?? null
    : null;

  const leftChildNode = selectedNode.leftChildId
    ? allNodes.find(n => n.id === selectedNode.leftChildId) ?? null
    : null;

  const rightSiblingNode = selectedNode.rightSiblingId
    ? allNodes.find(n => n.id === selectedNode.rightSiblingId) ?? null
    : null;

  // Derive binary topology description
  let binaryTopology = 'Binary leaf node (no subordinates or siblings)';
  if (leftChildNode && rightSiblingNode) {
    binaryTopology = 'Has first child (left pointer) and next sibling (right pointer)';
  } else if (leftChildNode) {
    binaryTopology = 'Has first child (left pointer), no next sibling';
  } else if (rightSiblingNode) {
    binaryTopology = 'Has next sibling (right pointer), no direct subordinates';
  }

  return (
    <div className="node-inspector-card active">
      <div className="card-header">
        <div className="inspector-header-left">
          <h2 className="card-title">Node Inspector</h2>
          <span className="badge active">Selected</span>
        </div>
        <button
          type="button"
          className="clear-selection-btn"
          onClick={onClearSelection}
          title="Clear selection (Esc)"
          aria-label="Clear node selection"
        >
          ✕ Deselect
        </button>
      </div>

      <div className="inspector-node-header">
        <h3 className="inspector-node-name">{selectedNode.name}</h3>
        <div className="inspector-node-role-row">
          <span className="inspector-node-role">{selectedNode.role}</span>
          {selectedNode.department && (
            <span className="inspector-dept-badge">{selectedNode.department}</span>
          )}
        </div>
      </div>

      <div className="inspector-prop-list">
        {/* Node ID */}
        <div className="inspector-prop-row">
          <span className="inspector-prop-label">Node Identifier</span>
          <code className="inspector-code">{selectedNode.id}</code>
        </div>

        {/* Parent Relationship */}
        <div className="inspector-prop-row">
          <span className="inspector-prop-label">Hierarchy Parent</span>
          {parentNode ? (
            <button
              type="button"
              className="inspector-rel-btn"
              onClick={() => onSelectNode(parentNode.id)}
              title={`Jump to parent: ${parentNode.name}`}
            >
              <span>{parentNode.name}</span>
              <span className="rel-role">({parentNode.role})</span>
            </button>
          ) : (
            <span className="inspector-prop-none">Root of Tree (No Parent)</span>
          )}
        </div>

        {/* Left Child Pointer */}
        <div className="inspector-prop-row">
          <div className="prop-label-with-indicator">
            <span className="legend-indicator left" />
            <span className="inspector-prop-label">Left Pointer (First Child)</span>
          </div>
          {leftChildNode ? (
            <button
              type="button"
              className="inspector-rel-btn child-rel"
              onClick={() => onSelectNode(leftChildNode.id)}
              title={`Jump to first child: ${leftChildNode.name}`}
            >
              <span>{leftChildNode.name}</span>
              <span className="rel-role">({leftChildNode.role})</span>
            </button>
          ) : (
            <span className="inspector-prop-none">None (Leaf subordinate)</span>
          )}
        </div>

        {/* Right Sibling Pointer */}
        <div className="inspector-prop-row">
          <div className="prop-label-with-indicator">
            <span className="legend-indicator right" />
            <span className="inspector-prop-label">Right Pointer (Next Sibling)</span>
          </div>
          {rightSiblingNode ? (
            <button
              type="button"
              className="inspector-rel-btn sibling-rel"
              onClick={() => onSelectNode(rightSiblingNode.id)}
              title={`Jump to next sibling: ${rightSiblingNode.name}`}
            >
              <span>{rightSiblingNode.name}</span>
              <span className="rel-role">({rightSiblingNode.role})</span>
            </button>
          ) : (
            <span className="inspector-prop-none">None (Last in sibling chain)</span>
          )}
        </div>

        {/* LCRS Binary Structural Summary */}
        <div className="inspector-prop-row full-width">
          <span className="inspector-prop-label">Binary Topology</span>
          <span className="inspector-topology-text">{binaryTopology}</span>
        </div>
      </div>
    </div>
  );
};

export default NodeInspector;
