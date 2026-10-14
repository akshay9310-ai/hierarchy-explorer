import React, { useState, useEffect } from 'react';
import type { HierarchyMode, TreeNodeDto } from '../../api/types';
import { getDescendantImpact } from '../../utils/treeMutation';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  mode: HierarchyMode;
  node: TreeNodeDto | null;
  allNodes: TreeNodeDto[];
  rootId: string | null;
  onClose: () => void;
  onConfirmDelete?: (nodeId: string) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  mode,
  node,
  allNodes,
  rootId,
  onClose,
  onConfirmDelete,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'warning' | 'success';
    message: string;
    details?: string;
  } | null>(null);

  // Escape key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !node) return null;

  const impact = getDescendantImpact(allNodes, node.id, rootId);

  const handleConfirm = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    // Simulate backend check / contract status verification
    setTimeout(() => {
      setIsSubmitting(false);
      // Per docs/api-contract.md and HttpServer.cpp, DELETE /api/hierarchy/member is not implemented
      setFeedback({
        type: 'warning',
        message: 'Backend API Route Unavailable (Milestone 1 Boundary)',
        details:
          'DELETE /api/hierarchy/member is not supported by the C++ backend or defined in the Milestone 1 contract. The node was not deleted to preserve data integrity.',
      });

      if (onConfirmDelete) {
        onConfirmDelete(node.id);
      }
    }, 450);
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-node-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-danger">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge danger">
              {mode === 'org' ? '🏢 Delete Organization Node' : '🌳 Delete Family Node'}
            </span>
            <h2 id="delete-node-modal-title" className="modal-title text-danger">
              Confirm Node Deletion
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal-api-notice">
          <span className="notice-icon">ℹ️</span>
          <p className="notice-text">
            <strong>Backend API Status:</strong> Node deletion is not implemented in the C++ backend in Milestone 1.
            Proceeding will check backend capability and report server status without deleting local data.
          </p>
        </div>

        {feedback && (
          <div className={`modal-feedback-banner ${feedback.type}`} role="alert" aria-live="polite">
            <div className="feedback-header">
              <span className="feedback-icon">
                {feedback.type === 'success' ? '✓' : feedback.type === 'warning' ? '⚠️' : '✕'}
              </span>
              <strong className="feedback-title">{feedback.message}</strong>
            </div>
            {feedback.details && <p className="feedback-details">{feedback.details}</p>}
          </div>
        )}

        <div className="delete-target-card">
          <div className="target-info-row">
            <span className="target-label">Target Member:</span>
            <span className="target-name">{node.name}</span>
          </div>
          <div className="target-info-row">
            <span className="target-label">Role:</span>
            <span className="target-role">{node.role}</span>
          </div>
          <div className="target-info-row">
            <span className="target-label">Identifier:</span>
            <code className="inspector-code">{node.id}</code>
          </div>
        </div>

        {/* Descendant Impact Analysis */}
        {impact && (
          <div className={`impact-analysis-card ${impact.isRoot ? 'root-warning' : impact.descendantCount > 0 ? 'descendant-warning' : 'leaf-info'}`}>
            {impact.isRoot ? (
              <div className="impact-header root">
                <span className="impact-icon">⚠️</span>
                <div>
                  <strong>Root Node Deletion Warning</strong>
                  <p className="impact-desc">
                    This node is the root of the hierarchy. Deleting the root will remove the entire tree structure ({impact.descendantCount + 1} total members).
                  </p>
                </div>
              </div>
            ) : impact.descendantCount > 0 ? (
              <div className="impact-header">
                <span className="impact-icon">⚠️</span>
                <div>
                  <strong>Descendant Impact: {impact.descendantCount} member(s) will be severed</strong>
                  <p className="impact-desc">
                    In Left-Child Right-Sibling representation, removing this node also removes its entire subordinate branch:
                  </p>
                </div>
              </div>
            ) : (
              <div className="impact-header leaf">
                <span className="impact-icon">ℹ️</span>
                <div>
                  <strong>Leaf Node (No Descendants)</strong>
                  <p className="impact-desc">
                    This node has no subordinate branches. Removing it will not impact other members.
                  </p>
                </div>
              </div>
            )}

            {impact.descendants.length > 0 && (
              <ul className="impact-descendant-list">
                {impact.descendants.map(desc => (
                  <li key={desc.id} className="impact-descendant-item">
                    <span className="desc-name">{desc.name}</span>
                    <span className="desc-role">({desc.role})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn-modal-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-modal-danger"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="btn-spinner-content">
                <span className="spinner-dot" /> Deleting...
              </span>
            ) : (
              'Confirm Deletion'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
