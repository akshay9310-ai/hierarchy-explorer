import React from 'react';
import type { TraversalType } from '../../api/types';

interface TraversalControlsProps {
  activeTraversal: TraversalType | null;
  onSelectTraversal: (type: TraversalType) => void;
}

export const TraversalControls: React.FC<TraversalControlsProps> = ({
  activeTraversal,
  onSelectTraversal,
}) => {
  return (
    <div className="traversal-card">
      <div className="card-header">
        <h2 className="card-title">Binary Tree Traversals</h2>
        <span className="badge">LCRS Algorithms</span>
      </div>

      <div className="traversal-buttons-grid">
        <button
          type="button"
          className={`traversal-btn ${activeTraversal === 'preorder' ? 'selected' : ''}`}
          onClick={() => onSelectTraversal('preorder')}
        >
          <div className="btn-main">
            <span className="btn-name">Preorder</span>
            <span className="btn-tag">N → L → R</span>
          </div>
          <p className="btn-desc">Visits leader first, then first child, then sibling.</p>
        </button>

        <button
          type="button"
          className={`traversal-btn ${activeTraversal === 'inorder' ? 'selected' : ''}`}
          onClick={() => onSelectTraversal('inorder')}
        >
          <div className="btn-main">
            <span className="btn-name">Inorder</span>
            <span className="btn-tag">L → N → R</span>
          </div>
          <p className="btn-desc">Visits first child, then leader, then siblings.</p>
        </button>

        <button
          type="button"
          className={`traversal-btn ${activeTraversal === 'postorder' ? 'selected' : ''}`}
          onClick={() => onSelectTraversal('postorder')}
        >
          <div className="btn-main">
            <span className="btn-name">Postorder</span>
            <span className="btn-tag">L → R → N</span>
          </div>
          <p className="btn-desc">Visits all subordinates & siblings before leader.</p>
        </button>
      </div>

      {activeTraversal === 'inorder' && (
        <div className="academic-callout">
          <div className="callout-icon">💡</div>
          <div className="callout-body">
            <strong>Theoretical Insight:</strong> In an LCRS binary tree, <em>Inorder Traversal</em> does not correspond to traditional hierarchical rank or generation order. It processes the eldest child sub-hierarchy, ascends to the parent, and then explores the parent's siblings.
          </div>
        </div>
      )}
    </div>
  );
};
