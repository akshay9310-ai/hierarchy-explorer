import React from 'react';
import type { TraversalResult, TraversalType } from '../../api/types';

export interface TraversalControlsProps {
  activeTraversal: TraversalType | null;
  onSelectTraversal: (type: TraversalType) => void;
  traversalResult: TraversalResult | null;
  traversalSource: 'backend' | 'client' | null;
  currentStepIndex: number; // -1 if not started, or 0..N-1
  onNextStep: () => void;
  onPrevStep: () => void;
  onResetSteps: () => void;
  onStepSelect: (index: number) => void;
  isEmptyTree?: boolean;
}

export const TraversalControls: React.FC<TraversalControlsProps> = ({
  activeTraversal,
  onSelectTraversal,
  traversalResult,
  traversalSource,
  currentStepIndex,
  onNextStep,
  onPrevStep,
  onResetSteps,
  onStepSelect,
  isEmptyTree = false,
}) => {
  const totalSteps = traversalResult?.order.length ?? 0;
  const hasSteps = totalSteps > 0 && !isEmptyTree;

  const isAtStart = currentStepIndex <= 0;
  const isAtEnd = currentStepIndex >= totalSteps - 1;
  const currentStep = hasSteps && currentStepIndex >= 0 ? traversalResult?.order[currentStepIndex] : null;

  return (
    <div className="traversal-card">
      <div className="card-header">
        <h2 className="card-title">Binary Tree Traversals</h2>
        <span className="badge">LCRS Algorithms</span>
      </div>

      {/* Traversal Algorithm Selectors */}
      <div className="traversal-buttons-grid">
        <button
          type="button"
          className={`traversal-btn ${activeTraversal === 'preorder' ? 'selected' : ''}`}
          onClick={() => onSelectTraversal('preorder')}
          aria-pressed={activeTraversal === 'preorder'}
        >
          <div className="btn-main">
            <span className="btn-name">Preorder</span>
            <span className="btn-tag">N → L → R</span>
          </div>
          <p className="btn-desc">Visits leader first, then subordinate branch, then siblings.</p>
        </button>

        <button
          type="button"
          className={`traversal-btn ${activeTraversal === 'inorder' ? 'selected' : ''}`}
          onClick={() => onSelectTraversal('inorder')}
          aria-pressed={activeTraversal === 'inorder'}
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
          aria-pressed={activeTraversal === 'postorder'}
        >
          <div className="btn-main">
            <span className="btn-name">Postorder</span>
            <span className="btn-tag">L → R → N</span>
          </div>
          <p className="btn-desc">Visits all subordinates & siblings before leader.</p>
        </button>
      </div>

      {/* Traversal Stepper & Results Presentation */}
      {activeTraversal && (
        <div className="traversal-stepper-panel">
          <div className="stepper-header">
            <div className="stepper-title-row">
              <span className="stepper-title">
                {activeTraversal === 'preorder' && 'Preorder Sequence'}
                {activeTraversal === 'inorder' && 'Inorder Sequence'}
                {activeTraversal === 'postorder' && 'Postorder Sequence'}
              </span>
              <span className="stepper-counter-badge">
                {isEmptyTree
                  ? 'Empty Tree'
                  : currentStepIndex < 0
                  ? `0 / ${totalSteps} Visited`
                  : `Step ${currentStepIndex + 1} of ${totalSteps}`}
              </span>
            </div>

            {/* Clearly labeled source indicator */}
            <div className="traversal-source-indicator">
              <span className={`source-dot ${traversalSource === 'backend' ? 'backend' : 'client'}`} />
              <span className="source-label">
                {traversalSource === 'backend'
                  ? 'Source: C++ WinSock2 API'
                  : 'Source: Client LCRS Engine (Milestone 1 Fallback)'}
              </span>
            </div>
          </div>

          {/* Stepper Controls Bar */}
          <div className="stepper-controls-bar">
            <button
              type="button"
              className="stepper-nav-btn reset-btn"
              onClick={onResetSteps}
              disabled={!hasSteps || currentStepIndex === -1}
              title="Reset traversal sequence"
              aria-label="Reset traversal sequence"
            >
              ⏮ Reset
            </button>

            <button
              type="button"
              className="stepper-nav-btn"
              onClick={onPrevStep}
              disabled={!hasSteps || isAtStart}
              title="Step to previous node"
              aria-label="Previous traversal node"
            >
              ◀ Previous
            </button>

            <button
              type="button"
              className="stepper-nav-btn next-btn"
              onClick={onNextStep}
              disabled={!hasSteps || isAtEnd}
              title="Step to next node"
              aria-label="Next traversal node"
            >
              Next ▶
            </button>
          </div>

          {/* Active Node Announcement */}
          {currentStep && (
            <div className="current-step-callout" aria-live="polite" aria-atomic="true">
              <span className="current-step-badge">#{currentStep.step}</span>
              <div className="current-step-info">
                <span className="current-step-name">{currentStep.name}</span>
                <span className="current-step-role">{currentStep.role}</span>
              </div>
            </div>
          )}

          {/* Traversal Order Result Sequence List */}
          <div className="traversal-sequence-container">
            <span className="sequence-label">Traversal Sequence (Order of Visitation):</span>
            {hasSteps ? (
              <div className="sequence-steps-list" role="list">
                {traversalResult?.order.map((step, idx) => {
                  const isCurrent = idx === currentStepIndex;
                  const isVisited = currentStepIndex >= 0 && idx < currentStepIndex;

                  let stepClass = 'pending';
                  if (isCurrent) stepClass = 'current';
                  else if (isVisited) stepClass = 'visited';

                  return (
                    <button
                      type="button"
                      key={step.id}
                      className={`sequence-step-btn ${stepClass}`}
                      onClick={() => onStepSelect(idx)}
                      title={`Jump to step #${step.step}: ${step.name}`}
                      aria-label={`Step ${step.step}: ${step.name}, ${step.role}. ${isCurrent ? 'Current step.' : ''}`}
                    >
                      <span className="step-num">#{step.step}</span>
                      <span className="step-name">{step.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="empty-sequence-text">
                No nodes available for traversal in the current hierarchy.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Domain & Theoretical Insights */}
      {activeTraversal === 'inorder' && (
        <div className="academic-callout">
          <div className="callout-icon">💡</div>
          <div className="callout-body">
            <strong>Theoretical Insight:</strong> In an LCRS binary tree, <em>Inorder Traversal</em> does not correspond to traditional hierarchical rank or generation order. It processes the eldest child sub-hierarchy, ascends to the parent, and then explores the parent's siblings.
          </div>
        </div>
      )}

      {activeTraversal === 'preorder' && (
        <div className="academic-callout">
          <div className="callout-icon">🏢</div>
          <div className="callout-body">
            <strong>Organizational Meaning:</strong> <em>Preorder Traversal</em> represents top-down command and reporting. It visits an executive leader first, finishes their entire subordinate division, and then proceeds to peer departments.
          </div>
        </div>
      )}

      {activeTraversal === 'postorder' && (
        <div className="academic-callout">
          <div className="callout-icon">📊</div>
          <div className="callout-body">
            <strong>Aggregation Insight:</strong> <em>Postorder Traversal</em> visits all subordinates and sibling peers before the parent. It is the canonical data structure pattern for bottom-up budget rollups, headcount summations, and memory deallocation.
          </div>
        </div>
      )}
    </div>
  );
};

export default TraversalControls;
