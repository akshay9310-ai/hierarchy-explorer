import React, { useState, useEffect, useRef } from 'react';
import type { HierarchyMode, TreeNodeDto, UpdateMemberRequest } from '../../api/types';

export interface NodeEditModalProps {
  isOpen: boolean;
  mode: HierarchyMode;
  node: TreeNodeDto | null;
  onClose: () => void;
  onNodeUpdated?: (updates: UpdateMemberRequest) => void;
}

export const NodeEditModal: React.FC<NodeEditModalProps> = ({
  isOpen,
  mode,
  node,
  onClose,
  onNodeUpdated,
}) => {
  const [name, setName] = useState(node?.name ?? '');
  const [role, setRole] = useState(node?.role ?? '');
  const [department, setDepartment] = useState(node?.department ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'warning' | 'success';
    message: string;
    details?: string;
  } | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    role?: string;
  }>({});

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);
  }, []);

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

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};

    if (!name.trim()) {
      errors.name = 'Full name is required';
    } else if (name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (!role.trim()) {
      errors.role = mode === 'org' ? 'Role / title is required' : 'Kinship / role is required';
    } else if (role.trim().length < 2) {
      errors.role = 'Role must be at least 2 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    const updates: UpdateMemberRequest = {
      id: node.id,
      name: name.trim(),
      role: role.trim(),
      department: department.trim() ? department.trim() : undefined,
    };

    // Simulate backend check / contract status verification
    setTimeout(() => {
      setIsSubmitting(false);
      // Per docs/api-contract.md and HttpServer.cpp, PUT/PATCH /api/hierarchy/member is not implemented
      setFeedback({
        type: 'warning',
        message: 'Backend API Route Unavailable (Milestone 1 Boundary)',
        details:
          'Node editing endpoints (PUT/PATCH /api/hierarchy/member) are not defined in the backend API contract. Changes cannot be persisted to the C++ server. Local demo data was preserved.',
      });

      if (onNodeUpdated) {
        // Callback available if parent component enables state updates
        onNodeUpdated(updates);
      }
    }, 400);
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-node-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">
              {mode === 'org' ? '🏢 Edit Organization Member' : '🌳 Edit Family Member'}
            </span>
            <h2 id="edit-node-modal-title" className="modal-title">
              Edit Node Details
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
            <strong>Backend API Status:</strong> Node editing (<code>PUT /api/hierarchy/member</code>) is not yet
            supported by the C++ backend or defined in the Milestone 1 contract. Form inputs are validated cleanly.
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

        <form onSubmit={handleSubmit} className="modal-form" noValidate>
          {/* Node Identifier (Read-only) */}
          <div className="form-group">
            <label className="form-label">Node Identifier</label>
            <div className="static-id-box font-mono">{node.id}</div>
          </div>

          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="edit-node-name" className="form-label">
              Full Name <span className="required-star">*</span>
            </label>
            <input
              id="edit-node-name"
              ref={nameInputRef}
              type="text"
              className={`form-input ${fieldErrors.name ? 'error' : ''}`}
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'edit-name-error' : undefined}
            />
            {fieldErrors.name && (
              <span id="edit-name-error" className="field-error-text" role="alert">
                {fieldErrors.name}
              </span>
            )}
          </div>

          {/* Role / Title */}
          <div className="form-group">
            <label htmlFor="edit-node-role" className="form-label">
              {mode === 'org' ? 'Job Title / Role' : 'Kinship / Title'}{' '}
              <span className="required-star">*</span>
            </label>
            <input
              id="edit-node-role"
              type="text"
              className={`form-input ${fieldErrors.role ? 'error' : ''}`}
              value={role}
              onChange={e => setRole(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.role)}
              aria-describedby={fieldErrors.role ? 'edit-role-error' : undefined}
            />
            {fieldErrors.role && (
              <span id="edit-role-error" className="field-error-text" role="alert">
                {fieldErrors.role}
              </span>
            )}
          </div>

          {/* Department / Branch */}
          <div className="form-group">
            <label htmlFor="edit-node-dept" className="form-label">
              {mode === 'org' ? 'Department / Team' : 'Family Branch / House'}
            </label>
            <input
              id="edit-node-dept"
              type="text"
              className="form-input"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

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
              type="submit"
              className="btn-modal-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="btn-spinner-content">
                  <span className="spinner-dot" /> Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NodeEditModal;
