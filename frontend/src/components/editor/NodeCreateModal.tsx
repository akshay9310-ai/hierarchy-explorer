import React, { useState, useEffect, useRef } from 'react';
import type { HierarchyMode, TreeNodeDto, InsertMemberRequest } from '../../api/types';
import { createBackendMember } from '../../api/client';

export interface NodeCreateModalProps {
  isOpen: boolean;
  mode: HierarchyMode;
  existingNodes: TreeNodeDto[];
  defaultParentId: string | null;
  onClose: () => void;
  onNodeCreated?: (request: InsertMemberRequest) => void;
}

export const NodeCreateModal: React.FC<NodeCreateModalProps> = ({
  isOpen,
  mode,
  existingNodes,
  defaultParentId,
  onClose,
  onNodeCreated,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [parentId, setParentId] = useState<string>(defaultParentId ?? (existingNodes[0]?.id ?? ''));
  const [relation, setRelation] = useState<'child' | 'sibling'>('child');
  const [customId, setCustomId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'warning' | 'success';
    message: string;
    details?: string;
  } | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    role?: string;
    id?: string;
    parentId?: string;
  }>({});

  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (val.trim()) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const prefix = mode === 'org' ? 'org' : 'fam';
      setCustomId(`${prefix}-${slug}`);
    } else {
      setCustomId('');
    }
  };

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

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

    if (!customId.trim()) {
      errors.id = 'Unique identifier is required';
    } else if (existingNodes.some(n => n.id === customId.trim())) {
      errors.id = `Identifier '${customId.trim()}' is already taken`;
    }

    if (existingNodes.length > 0 && !parentId) {
      errors.parentId = 'A parent node must be selected';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    const payload: InsertMemberRequest = {
      mode,
      id: customId.trim(),
      name: name.trim(),
      role: role.trim(),
      department: department.trim() ? department.trim() : undefined,
      parentId: existingNodes.length > 0 ? parentId : null,
      relation,
    };

    try {
      // Call centralized API client
      const response = await createBackendMember(payload);

      if (response.status === 'success' && response.data) {
        setFeedback({
          type: 'success',
          message: `Member "${payload.name}" successfully created in backend.`,
        });
        if (onNodeCreated) {
          onNodeCreated(payload);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        // Backend returned 404 or offline (Expected in Milestone 1)
        setFeedback({
          type: 'warning',
          message: 'Backend API Route Unavailable (Milestone 1 Boundary)',
          details:
            response.error ||
            'POST /api/hierarchy/member is planned for Milestone 2 and not yet implemented in the C++ backend. Changes cannot be persisted to the server. Local demo data was preserved.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
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
      aria-labelledby="create-node-modal-title"
      onClick={e => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">
              {mode === 'org' ? '🏢 Organization Mode' : '🌳 Family Lineage Mode'}
            </span>
            <h2 id="create-node-modal-title" className="modal-title">
              Create New Hierarchy Node
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
            <strong>Milestone 1 API Status:</strong> The C++ backend currently implements{' '}
            <code>GET /api/status</code>. The member insertion route (<code>POST /api/hierarchy/member</code>) is planned
            for Milestone 2. Submitting this form validates input schemas without modifying mock data.
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
          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="create-node-name" className="form-label">
              Full Name <span className="required-star">*</span>
            </label>
            <input
              id="create-node-name"
              ref={nameInputRef}
              type="text"
              className={`form-input ${fieldErrors.name ? 'error' : ''}`}
              placeholder={mode === 'org' ? 'e.g. Alex Mercer' : 'e.g. Arthur Pendragon'}
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'create-name-error' : undefined}
            />
            {fieldErrors.name && (
              <span id="create-name-error" className="field-error-text" role="alert">
                {fieldErrors.name}
              </span>
            )}
          </div>

          {/* Role / Title */}
          <div className="form-group">
            <label htmlFor="create-node-role" className="form-label">
              {mode === 'org' ? 'Job Title / Role' : 'Kinship / Title'}{' '}
              <span className="required-star">*</span>
            </label>
            <input
              id="create-node-role"
              type="text"
              className={`form-input ${fieldErrors.role ? 'error' : ''}`}
              placeholder={mode === 'org' ? 'e.g. Lead Architect' : 'e.g. Eldest Daughter'}
              value={role}
              onChange={e => setRole(e.target.value)}
              disabled={isSubmitting}
              aria-invalid={Boolean(fieldErrors.role)}
              aria-describedby={fieldErrors.role ? 'create-role-error' : undefined}
            />
            {fieldErrors.role && (
              <span id="create-role-error" className="field-error-text" role="alert">
                {fieldErrors.role}
              </span>
            )}
          </div>

          {/* Department / Branch */}
          <div className="form-group">
            <label htmlFor="create-node-dept" className="form-label">
              {mode === 'org' ? 'Department / Team (Optional)' : 'Family Branch / House (Optional)'}
            </label>
            <input
              id="create-node-dept"
              type="text"
              className="form-input"
              placeholder={mode === 'org' ? 'e.g. Engineering' : 'e.g. Line of Avalon'}
              value={department}
              onChange={e => setDepartment(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Parent Node Selection */}
          {existingNodes.length > 0 && (
            <div className="form-group">
              <label htmlFor="create-node-parent" className="form-label">
                Hierarchy Parent Node <span className="required-star">*</span>
              </label>
              <select
                id="create-node-parent"
                className={`form-select ${fieldErrors.parentId ? 'error' : ''}`}
                value={parentId}
                onChange={e => setParentId(e.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(fieldErrors.parentId)}
                aria-describedby={fieldErrors.parentId ? 'create-parent-error' : undefined}
              >
                {existingNodes.map(node => (
                  <option key={node.id} value={node.id}>
                    {node.name} ({node.role})
                  </option>
                ))}
              </select>
              {fieldErrors.parentId && (
                <span id="create-parent-error" className="field-error-text" role="alert">
                  {fieldErrors.parentId}
                </span>
              )}
            </div>
          )}

          {/* LCRS Pointer Relation */}
          {existingNodes.length > 0 && (
            <div className="form-group">
              <span className="form-label">Binary Pointer Placement</span>
              <div className="relation-radio-group">
                <label className={`radio-pill ${relation === 'child' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="relation"
                    value="child"
                    checked={relation === 'child'}
                    onChange={() => setRelation('child')}
                    disabled={isSubmitting}
                  />
                  <div className="radio-content">
                    <span className="radio-title">First Child (Left Pointer)</span>
                    <span className="radio-desc">Subordinate / descendant branch</span>
                  </div>
                </label>

                <label className={`radio-pill ${relation === 'sibling' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="relation"
                    value="sibling"
                    checked={relation === 'sibling'}
                    onChange={() => setRelation('sibling')}
                    disabled={isSubmitting}
                  />
                  <div className="radio-content">
                    <span className="radio-title">Next Sibling (Right Pointer)</span>
                    <span className="radio-desc">Peer on same hierarchy level</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Identifier */}
          <div className="form-group">
            <label htmlFor="create-node-id" className="form-label">
              Node Identifier (Unique) <span className="required-star">*</span>
            </label>
            <input
              id="create-node-id"
              type="text"
              className={`form-input font-mono ${fieldErrors.id ? 'error' : ''}`}
              value={customId}
              onChange={e => setCustomId(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. org-lead-arch"
              aria-invalid={Boolean(fieldErrors.id)}
              aria-describedby={fieldErrors.id ? 'create-id-error' : undefined}
            />
            {fieldErrors.id && (
              <span id="create-id-error" className="field-error-text" role="alert">
                {fieldErrors.id}
              </span>
            )}
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
                  <span className="spinner-dot" /> Submitting...
                </span>
              ) : (
                'Create Member'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NodeCreateModal;
