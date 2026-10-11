import { useState, useEffect, useCallback } from 'react';
import type { HierarchyMode, TraversalType, BackendStatus } from './api/types';
import { checkBackendStatus } from './api/client';
import { Navbar } from './components/layout/Navbar';
import { QuickInfoBar } from './components/editor/QuickInfoBar';
import { TreeCanvas } from './components/tree/TreeCanvas';
import { TraversalControls } from './components/traversal/TraversalControls';

export function App() {
  const [mode, setMode] = useState<HierarchyMode>('org');
  const [activeTraversal, setActiveTraversal] = useState<TraversalType | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(true);

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

  const handleModeChange = (newMode: HierarchyMode) => {
    setMode(newMode);
    setActiveTraversal(null);
  };

  const handleSelectTraversal = (type: TraversalType) => {
    setActiveTraversal(prev => (prev === type ? null : type));
  };

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
        <QuickInfoBar
          mode={mode}
          activeTraversal={activeTraversal}
          status={backendStatus}
        />

        <div className="workspace-grid">
          <section className="canvas-section">
            <TreeCanvas
              mode={mode}
              activeTraversal={activeTraversal}
            />
          </section>

          <aside className="controls-sidebar">
            <TraversalControls
              activeTraversal={activeTraversal}
              onSelectTraversal={handleSelectTraversal}
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
