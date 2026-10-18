import React, { useState, useEffect } from 'react';
import type { HierarchyMode, TreeNodeDto } from '../../api/types';
import { getDescendantImpact } from '../../utils/treeMutation';
import { deleteBackendMember } from '../../api/client';

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

    if (impact?.isRoot) {
      setFeedback({
        type: 'error',
        message: 'Root Member Cannot Be Deleted',
        details: 'The root member anchors the entire hierarchy tree and cannot be deleted.',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await deleteBackendMember(mode, node.id);

      if (response.status === 'success' && response.data) {
        setFeedback({
          type: 'success',
          message: `Member "${node.name}" (${response.data.deletedCount} member${response.data.deletedCount === 1 ? '' : 's'}) deleted from C++ backend.`,
        });

        if (onConfirmDelete) {
          onConfirmDelete(node.id);
        }
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        setFeedback({
          type: 'error',
          message: 'Deletion Failed',
          details: response.error || 'The backend rejected the deletion request.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network request failed';
      setFeedback({
        type: 'error',
        message: 'Network / API Error',
        details: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
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
              {mode === 'org' ? '🏢 Delete Organization Member' : '🌳 Delete Family Member'}
            </span>
            <h2 id="delete-node-modal-title" className="modal-title text-danger">
              Confirm Member Deletion
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
            <strong>Live C++ API:</strong> Deleting this member will be persisted to the WinSock2 server (<code>DELETE /api/hierarchy/member</code>). Removing a member also safely cascades to all subordinates/descendants to prevent orphaned nodes.
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
            disabled={isSubmitting || impact?.isRoot}
            title={impact?.isRoot ? 'Root member cannot be deleted' : undefined}
          >
            {isSubmitting ? (
              <span className="btn-spinner-content">
                <span className="spinner-dot" /> Deleting...
              </span>
            ) : (
              'Delete Member'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
