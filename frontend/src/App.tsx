import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  HierarchyData,
  HierarchyMode,
  HierarchyStats,
  TraversalResult,
  TraversalType,
  BackendStatus,
  ApiState,
  InsertMemberRequest,
  UpdateMemberRequest,
} from './api/types';
import {
  getBackendStatus,
  getHierarchy,
  getHierarchyTraversal,
  getHierarchyStats,
} from './api/client';
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

  // Backend / demo data source tracking and live statistics
  const [dataSource, setDataSource] = useState<'backend' | 'demo'>('demo');
  const [hierarchyStats, setHierarchyStats] = useState<HierarchyStats | null>(null);
  const [isHierarchyLoading, setIsHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);

  const [activeTraversal, setActiveTraversal] = useState<TraversalType | null>(null);
  const [backendTraversal, setBackendTraversal] = useState<TraversalResult | null>(null);
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

  const backendOnlineRef = useRef(false);

  // Traversal stepper step index (-1: unstarted, 0..N-1: active step)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);

  // Load authoritative hierarchy and statistics from backend
  const loadHierarchy = useCallback(async (targetMode: HierarchyMode) => {
    setIsHierarchyLoading(true);
    setHierarchyError(null);
    try {
      const [hierRes, statsRes] = await Promise.all([
        getHierarchy(targetMode),
        getHierarchyStats(targetMode),
      ]);

      if (hierRes.status === 'success' && hierRes.data) {
        if (targetMode === 'org') {
          setOrgHierarchy(hierRes.data);
        } else {
          setFamilyHierarchy(hierRes.data);
        }
        setDataSource('backend');
      } else {
        setDataSource('demo');
        if (hierRes.error) {
          setHierarchyError(hierRes.error);
        }
      }

      if (statsRes.status === 'success' && statsRes.data) {
        setHierarchyStats(statsRes.data);
      } else {
        setHierarchyStats(null);
      }
    } catch (err) {
      setDataSource('demo');
      setHierarchyError(err instanceof Error ? err.message : 'Failed to load hierarchy');
    } finally {
      setIsHierarchyLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    setBackendState(prev => ({ ...prev, status: 'loading' }));
    const result = await getBackendStatus();
    setBackendState(result);
    if (result.status === 'success') {
      backendOnlineRef.current = true;
      await loadHierarchy(mode);
    } else {
      backendOnlineRef.current = false;
      setDataSource('demo');
      setHierarchyStats(null);
    }
  }, [mode, loadHierarchy]);

  useEffect(() => {
    let isCancelled = false;
    const poll = async () => {
      const result = await getBackendStatus();
      if (!isCancelled) {
        const wasOffline = !backendOnlineRef.current;
        const isOnline = result.status === 'success';
        backendOnlineRef.current = isOnline;
        setBackendState(result);
        if (isOnline && wasOffline) {
          await loadHierarchy(mode);
        } else if (!isOnline) {
          setDataSource('demo');
          setHierarchyStats(null);
        }
      }
    };

    poll();
    // Poll backend status gently every 10 seconds
    const interval = setInterval(poll, 10000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [mode, loadHierarchy]);

  // Mode switching resets traversal, modals, and clears active selection
  const handleModeChange = (newMode: HierarchyMode) => {
    setMode(newMode);
    setActiveTraversal(null);
    setBackendTraversal(null);
    setSelectedNodeId(null);
    setCurrentStepIndex(-1);
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
    if (backendState.status === 'success') {
      loadHierarchy(newMode);
    }
  };

  const handleSelectTraversal = (type: TraversalType) => {
    setActiveTraversal(prev => {
      const next = prev === type ? null : type;
      setCurrentStepIndex(next ? 0 : -1);
      return next;
    });
    setBackendTraversal(null);
  };

  // Node selection handlers
  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(prev => (prev === nodeId ? null : nodeId));
  };

  const handleClearSelection = () => {
    setSelectedNodeId(null);
  };

  // Mutation Handlers: update state, canvas, selection, and traversal results
  const handleNodeCreated = async (request: InsertMemberRequest) => {
    if (backendState.status === 'success') {
      // Authoritatively reload the hierarchy and stats from C++ engine
      await loadHierarchy(mode);
    } else {
      if (mode === 'org') {
        setOrgHierarchy(prev => insertMemberIntoHierarchy(prev, request));
      } else {
        setFamilyHierarchy(prev => insertMemberIntoHierarchy(prev, request));
      }
    }
  };

  const handleNodeUpdated = async (updates: UpdateMemberRequest) => {
    if (backendState.status === 'success') {
      await loadHierarchy(mode);
    } else {
      if (mode === 'org') {
        setOrgHierarchy(prev => updateMemberInHierarchy(prev, updates));
      } else {
        setFamilyHierarchy(prev => updateMemberInHierarchy(prev, updates));
      }
    }
  };

  const handleNodeDeleted = async (deletedId: string) => {
    if (backendState.status === 'success') {
      await loadHierarchy(mode);
    } else {
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
    }

    if (selectedNodeId === deletedId) {
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

  // Fetch backend traversal when active traversal changes and backend is online
  useEffect(() => {
    if (!activeTraversal || backendState.status !== 'success') {
      return;
    }

    let isCancelled = false;
    getHierarchyTraversal(mode, activeTraversal).then(res => {
      if (!isCancelled && res.status === 'success' && res.data) {
        setBackendTraversal(res.data);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [mode, activeTraversal, backendState.status, activeHierarchy]);

  // Derive traversal result: backend response prioritized when online, client fallback otherwise
  const clientTraversal = useMemo<TraversalResult | null>(() => {
    if (!activeTraversal) return null;
    return computeBinaryTraversal(activeHierarchy, activeTraversal);
  }, [activeTraversal, activeHierarchy]);

  const activeBackendTraversal =
    activeTraversal && backendState.status === 'success' && backendTraversal?.type === activeTraversal
      ? backendTraversal
      : null;

  const traversalResult = activeBackendTraversal ?? clientTraversal;
  const traversalSource: 'backend' | 'client' | null = !activeTraversal
    ? null
    : activeBackendTraversal
    ? 'backend'
    : 'client';

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

        {isHierarchyLoading && (
          <div className="system-loading-banner">
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--brand-icy)' }} />
            <span>Loading authoritative tree structure from C++ backend...</span>
          </div>
        )}

        {hierarchyError && (
          <div className="system-error-banner">
            <strong>Backend Notice:</strong> {hierarchyError} (Displaying client demo hierarchy).
          </div>
        )}

        <QuickInfoBar
          mode={mode}
          activeTraversal={activeTraversal}
          status={backendState.data}
          dataSource={dataSource}
          stats={hierarchyStats}
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
              <h3 className="notes-title">System Architecture</h3>
              <ul className="notes-list">
                <li>
                  <strong>Frontend:</strong> React 19 + TypeScript + Vite with custom SVG tree renderer.
                </li>
                <li>
                  <strong>Backend:</strong> C++14 native WinSock2 HTTP server with complete CRUD and binary traversals.
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
