import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  HierarchyData,
  HierarchyMode,
  TraversalResult,
  TraversalType,
  BackendStatus,
  ApiState,
  InsertMemberRequest,
  UpdateMemberRequest,
} from './api/types';
import { getBackendStatus } from './api/client';
import { computeBinaryTraversal } from './utils/binaryTraversal';
import {
  insertMemberIntoHierarchy,
  updateMemberInHierarchy,
  deleteMemberFromHierarchy,
} from './utils/treeMutation';
import { Navbar } from './components/layout/Navbar';
import { QuickInfoBar } from './components/editor/QuickInfoBar';
import { NodeInspector } from './components/editor/NodeInspector';
import { NodeCreateModal } from './components/editor/NodeCreateModal';
import { NodeEditModal } from './components/editor/NodeEditModal';
import { DeleteConfirmModal } from './components/editor/DeleteConfirmModal';
import { TreeCanvas } from './components/tree/TreeCanvas';
import { TraversalControls } from './components/traversal/TraversalControls';
import './App.css';

// ============================================================================
// FRONTEND-ONLY DEMO DATA (Milestone 1 Canvas Scaffolding)
// Note: These mock hierarchies are strictly client-side demo fixtures used to
// verify the SVG canvas layout engine before backend CRUD endpoints are wired.
// ============================================================================

const FRONTEND_DEMO_ORG_HIERARCHY: HierarchyData = {
  mode: 'org',
  rootId: 'org-ceo',
  nodes: [
    {
      id: 'org-ceo',
      name: 'Sarah Connor',
      role: 'Chief Executive Officer',
      department: 'Executive',
      parentId: null,
      leftChildId: 'org-vp-tech',
      rightSiblingId: null,
    },
    {
      id: 'org-vp-tech',
      name: 'John Connor',
      role: 'VP Technology',
      department: 'Engineering',
      parentId: 'org-ceo',
      leftChildId: 'org-lead-arch',
      rightSiblingId: 'org-vp-ops',
    },
    {
      id: 'org-vp-ops',
      name: 'Kyle Reese',
      role: 'VP Operations',
      department: 'Operations',
      parentId: 'org-ceo',
      leftChildId: null,
      rightSiblingId: null,
    },
    {
      id: 'org-lead-arch',
      name: 'Miles Dyson',
      role: 'Lead Architect',
      department: 'Systems Architecture',
      parentId: 'org-vp-tech',
      leftChildId: null,
      rightSiblingId: null,
    },
  ],
};

const FRONTEND_DEMO_FAMILY_HIERARCHY: HierarchyData = {
  mode: 'family',
  rootId: 'fam-patriarch',
  nodes: [
    {
      id: 'fam-patriarch',
      name: 'Arthur Pendragon',
      role: 'Family Patriarch',
      department: 'Royal House',
      parentId: null,
      leftChildId: 'fam-first-child',
      rightSiblingId: null,
    },
    {
      id: 'fam-first-child',
      name: 'Galahad',
      role: 'First Child (Eldest)',
      department: 'Line of Avalon',
      parentId: 'fam-patriarch',
      leftChildId: 'fam-grandchild',
      rightSiblingId: 'fam-sibling',
    },
    {
      id: 'fam-sibling',
      name: 'Gawain',
      role: 'Second Child (Sibling)',
      department: 'Line of Orkney',
      parentId: 'fam-patriarch',
      leftChildId: null,
      rightSiblingId: null,
    },
    {
      id: 'fam-grandchild',
      name: 'Lancelot',
      role: 'Grandchild (Branch)',
      department: 'Champions',
      parentId: 'fam-first-child',
      leftChildId: null,
      rightSiblingId: null,
    },
  ],
};

export function App() {
  const [mode, setMode] = useState<HierarchyMode>('org');
  const [orgHierarchy, setOrgHierarchy] = useState<HierarchyData>(FRONTEND_DEMO_ORG_HIERARCHY);
  const [familyHierarchy, setFamilyHierarchy] = useState<HierarchyData>(FRONTEND_DEMO_FAMILY_HIERARCHY);

  const [activeTraversal, setActiveTraversal] = useState<TraversalType | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Modal Dialog Visibility States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Centralized backend connection lifecycle
  const [backendState, setBackendState] = useState<ApiState<BackendStatus>>({
    status: 'idle',
    data: null,
    error: null,
    statusCode: null,
  });

  // Traversal stepper step index (-1: unstarted, 0..N-1: active step)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);

  const fetchStatus = useCallback(async () => {
    setBackendState(prev => ({ ...prev, status: 'loading' }));
    const result = await getBackendStatus();
    setBackendState(result);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const poll = async () => {
      const result = await getBackendStatus();
      if (!isCancelled) {
        setBackendState(result);
      }
    };

    poll();
    // Poll backend status gently every 10 seconds
    const interval = setInterval(poll, 10000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Mode switching resets traversal, modals, and clears active selection
  const handleModeChange = (newMode: HierarchyMode) => {
    setMode(newMode);
    setActiveTraversal(null);
    setSelectedNodeId(null);
    setCurrentStepIndex(-1);
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
  };

  const handleSelectTraversal = (type: TraversalType) => {
    setActiveTraversal(prev => {
      const next = prev === type ? null : type;
      setCurrentStepIndex(next ? 0 : -1);
      return next;
    });
  };

  // Node selection handlers
  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(prev => (prev === nodeId ? null : nodeId));
  };

  const handleClearSelection = () => {
    setSelectedNodeId(null);
  };

  // Mutation Handlers: update state, canvas, selection, and traversal results
  const handleNodeCreated = (request: InsertMemberRequest) => {
    if (mode === 'org') {
      setOrgHierarchy(prev => insertMemberIntoHierarchy(prev, request));
    } else {
      setFamilyHierarchy(prev => insertMemberIntoHierarchy(prev, request));
    }
  };

  const handleNodeUpdated = (updates: UpdateMemberRequest) => {
    if (mode === 'org') {
      setOrgHierarchy(prev => updateMemberInHierarchy(prev, updates));
    } else {
      setFamilyHierarchy(prev => updateMemberInHierarchy(prev, updates));
    }
  };

  const handleNodeDeleted = (deletedId: string) => {
    const currentHierarchy = mode === 'org' ? orgHierarchy : familyHierarchy;
    const { updatedHierarchy, deletedNodeIds } = deleteMemberFromHierarchy(
      currentHierarchy,
      deletedId
    );

    if (mode === 'org') {
      setOrgHierarchy(updatedHierarchy);
    } else {
      setFamilyHierarchy(updatedHierarchy);
    }

    // Clean up selection if the deleted node or any of its descendants was selected
    if (selectedNodeId && deletedNodeIds.includes(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  };

  // Keyboard shortcut: Escape clears selection when no modal is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isCreateModalOpen && !isEditModalOpen && !isDeleteModalOpen) {
          setSelectedNodeId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen, isEditModalOpen, isDeleteModalOpen]);

  // Select active hierarchy data for the current mode
  const activeHierarchy = mode === 'org' ? orgHierarchy : familyHierarchy;

  // Resolve selected node object from active data
  const selectedNode = activeHierarchy.nodes.find(n => n.id === selectedNodeId) ?? null;
  const effectiveSelectedNodeId = selectedNode?.id ?? null;

  // Derive traversal result directly without cascading effect
  const traversalResult = useMemo<TraversalResult | null>(() => {
    if (!activeTraversal) return null;
    return computeBinaryTraversal(activeHierarchy, activeTraversal);
  }, [activeTraversal, activeHierarchy]);

  const traversalSource = traversalResult ? ('client' as const) : null;

  // Stepper Controls Handlers
  const handleNextStep = () => {
    if (!traversalResult || traversalResult.order.length === 0) return;
    setCurrentStepIndex(prev => {
      if (prev < 0) return 0;
      return Math.min(prev + 1, traversalResult.order.length - 1);
    });
  };

  const handlePrevStep = () => {
    if (!traversalResult || traversalResult.order.length === 0) return;
    setCurrentStepIndex(prev => Math.max(prev - 1, 0));
  };

  const handleResetSteps = () => {
    setCurrentStepIndex(-1);
  };

  const handleStepSelect = (index: number) => {
    if (!traversalResult || index < 0 || index >= traversalResult.order.length) return;
    setCurrentStepIndex(index);
  };

  // Derive current traversal node ID and visited node IDs
  const currentTraversalStep = (traversalResult && currentStepIndex >= 0 && currentStepIndex < traversalResult.order.length)
    ? traversalResult.order[currentStepIndex]
    : null;
  const currentTraversalNodeId = currentTraversalStep?.id ?? null;
  const currentTraversalStepNum = currentTraversalStep?.step ?? null;

  const visitedNodeIds = useMemo(() => {
    if (!traversalResult || currentStepIndex < 0) return [];
    return traversalResult.order.slice(0, currentStepIndex).map(s => s.id);
  }, [traversalResult, currentStepIndex]);

  const isEmptyTree = activeHierarchy.nodes.length === 0 || !activeHierarchy.rootId;

  return (
    <div className="app-container">
      <Navbar
        mode={mode}
        onModeChange={handleModeChange}
        status={backendState.data}
        isChecking={backendState.status === 'loading'}
        onRefreshStatus={fetchStatus}
        errorMessage={backendState.error}
      />

      <main className="main-content">
        <header className="page-header">
          <div className="page-header-text">
            <div className="page-header-badge">
              <span className="badge-dot" />
              <span>{mode === 'org' ? 'Corporate Structure' : 'Genealogical Descent'}</span>
            </div>
            <h2 className="page-title">
              {mode === 'org' ? 'Organization Hierarchy' : 'Family Hierarchy'}
            </h2>
            <p className="page-description">
              {mode === 'org'
                ? 'Interactive binary tree visualization modeling organizational reporting lines through Left-Child (subordinate) and Right-Sibling (peer) pointers.'
                : 'Interactive binary tree visualization modeling genealogical lineages through Left-Child (first offspring) and Right-Sibling (sibling) pointers.'}
            </p>
          </div>
        </header>

        <QuickInfoBar
          mode={mode}
          activeTraversal={activeTraversal}
          status={backendState.data}
        />

        <div className="workspace-grid">
          <section className="canvas-section" aria-label="Hierarchy Canvas">
            <TreeCanvas
              data={activeHierarchy}
              mode={mode}
              activeTraversal={activeTraversal}
              selectedNodeId={effectiveSelectedNodeId}
              onSelectNode={handleSelectNode}
              currentTraversalNodeId={currentTraversalNodeId}
              traversalStepNumber={currentTraversalStepNum}
              visitedNodeIds={visitedNodeIds}
            />
          </section>

          <aside className="controls-sidebar" aria-label="Controls and Notes">
            <NodeInspector
              selectedNode={selectedNode}
              allNodes={activeHierarchy.nodes}
              onSelectNode={handleSelectNode}
              onClearSelection={handleClearSelection}
              onOpenCreateModal={() => setIsCreateModalOpen(true)}
              onOpenEditModal={() => setIsEditModalOpen(true)}
              onOpenDeleteModal={() => setIsDeleteModalOpen(true)}
            />

            <TraversalControls
              activeTraversal={activeTraversal}
              onSelectTraversal={handleSelectTraversal}
              traversalResult={traversalResult}
              traversalSource={traversalSource}
              currentStepIndex={currentStepIndex}
              onNextStep={handleNextStep}
              onPrevStep={handlePrevStep}
              onResetSteps={handleResetSteps}
              onStepSelect={handleStepSelect}
              isEmptyTree={isEmptyTree}
            />

            <div className="system-notes-card">
              <h3 className="notes-title">Milestone 1 System Architecture</h3>
              <ul className="notes-list">
                <li>
                  <strong>Frontend:</strong> React 19 + TypeScript + Vite with custom SVG tree renderer.
                </li>
                <li>
                  <strong>Backend:</strong> C++14 native WinSock2 HTTP server running on port 8080.
                </li>
                <li>
                  <strong>Representation:</strong> Left-Child Right-Sibling (LCRS) mapping arbitrary hierarchies to binary trees.
                </li>
                <li>
                  <strong>C++ Standard:</strong> MinGW.org GCC 6.3.0 without <code>std::thread</code>.
                </li>
              </ul>
            </div>
          </aside>
        </div>

        {/* Hierarchy Mutation Modals */}
        {isCreateModalOpen && (
          <NodeCreateModal
            isOpen={isCreateModalOpen}
            mode={mode}
            existingNodes={activeHierarchy.nodes}
            defaultParentId={selectedNodeId}
            onClose={() => setIsCreateModalOpen(false)}
            onNodeCreated={handleNodeCreated}
          />
        )}

        {isEditModalOpen && selectedNode && (
          <NodeEditModal
            isOpen={isEditModalOpen}
            mode={mode}
            node={selectedNode}
            onClose={() => setIsEditModalOpen(false)}
            onNodeUpdated={handleNodeUpdated}
          />
        )}

        {isDeleteModalOpen && selectedNode && (
          <DeleteConfirmModal
            isOpen={isDeleteModalOpen}
            mode={mode}
            node={selectedNode}
            allNodes={activeHierarchy.nodes}
            rootId={activeHierarchy.rootId}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirmDelete={handleNodeDeleted}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>
          Data Structures Academic Project — <strong>Organization & Family Hierarchy Explorer</strong> (C++14 & React)
        </p>
      </footer>
    </div>
  );
}

export default App;
