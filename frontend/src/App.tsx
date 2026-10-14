import { useState, useEffect, useCallback, useMemo } from 'react';
import type { HierarchyData, HierarchyMode, TraversalResult, TraversalType, BackendStatus } from './api/types';
import { checkBackendStatus, fetchBackendTraversal } from './api/client';
import { computeBinaryTraversal } from './utils/binaryTraversal';
import { Navbar } from './components/layout/Navbar';
import { QuickInfoBar } from './components/editor/QuickInfoBar';
import { NodeInspector } from './components/editor/NodeInspector';
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
  const [activeTraversal, setActiveTraversal] = useState<TraversalType | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(true);

  // Traversal sequence & stepper state
  const [traversalResult, setTraversalResult] = useState<TraversalResult | null>(null);
  const [traversalSource, setTraversalSource] = useState<'backend' | 'client' | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);

  const fetchStatus = useCallback(async () => {
    setIsChecking(true);
    const result = await checkBackendStatus();
    setBackendStatus(result);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll backend status gently every 10 seconds
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Mode switching resets traversal and clears active selection
  const handleModeChange = (newMode: HierarchyMode) => {
    setMode(newMode);
    setActiveTraversal(null);
    setSelectedNodeId(null);
    setTraversalResult(null);
    setCurrentStepIndex(-1);
  };

  const handleSelectTraversal = (type: TraversalType) => {
    setActiveTraversal(prev => (prev === type ? null : type));
  };

  // Node selection handlers
  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(prev => (prev === nodeId ? null : nodeId));
  };

  const handleClearSelection = () => {
    setSelectedNodeId(null);
  };

  // Keyboard shortcut: Escape clears selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Select active client demo data for the current mode
  const activeHierarchy = mode === 'org'
    ? FRONTEND_DEMO_ORG_HIERARCHY
    : FRONTEND_DEMO_FAMILY_HIERARCHY;

  // Resolve selected node object from active data
  const selectedNode = activeHierarchy.nodes.find(n => n.id === selectedNodeId) ?? null;

  // Clear stale selection if selected ID is not present in active hierarchy
  useEffect(() => {
    if (selectedNodeId && !activeHierarchy.nodes.some(n => n.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, activeHierarchy]);

  // Execute traversal whenever activeTraversal, mode, or activeHierarchy changes
  useEffect(() => {
    let isCancelled = false;

    if (!activeTraversal) {
      setTraversalResult(null);
      setTraversalSource(null);
      setCurrentStepIndex(-1);
      return;
    }

    const loadTraversal = async () => {
      // 1. Prefer calling backend traversal API if active (Requirement 3)
      const backendResult = await fetchBackendTraversal(mode, activeTraversal);
      if (isCancelled) return;

      if (backendResult && backendResult.order && backendResult.order.length > 0) {
        setTraversalResult(backendResult);
        setTraversalSource('backend');
        setCurrentStepIndex(0);
      } else {
        // 2. Fall back to isolated client-side traversal utility (Requirement 4)
        const clientResult = computeBinaryTraversal(activeHierarchy, activeTraversal);
        if (isCancelled) return;
        setTraversalResult(clientResult);
        setTraversalSource('client');
        setCurrentStepIndex(clientResult.order.length > 0 ? 0 : -1);
      }
    };

    loadTraversal();

    return () => {
      isCancelled = true;
    };
  }, [activeTraversal, mode, activeHierarchy]);

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
        status={backendStatus}
        isChecking={isChecking}
        onRefreshStatus={fetchStatus}
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
          status={backendStatus}
        />

        <div className="workspace-grid">
          <section className="canvas-section" aria-label="Hierarchy Canvas">
            <TreeCanvas
              data={activeHierarchy}
              mode={mode}
              activeTraversal={activeTraversal}
              selectedNodeId={selectedNodeId}
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
