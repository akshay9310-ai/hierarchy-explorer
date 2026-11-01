import { useState, useEffect, useCallback, useMemo } from 'react';
import type { HierarchyData, HierarchyMode, HierarchyStats, TraversalResult, TraversalType, BackendStatus, ApiState } from './api/types';
import { getBackendStatus, getHierarchyData as getHierarchy, getStats, getTraversal, searchMembers, addMember, deleteMember, exportHierarchy, importHierarchy } from './api/client';
import { Navbar } from './components/layout/Navbar';
import { QuickInfoBar } from './components/editor/QuickInfoBar';
import { NodeInspector } from './components/editor/NodeInspector';
import { MemberEditor } from './components/editor/MemberEditor';
import { NodeCreateModal } from './components/editor/NodeCreateModal';
import { NodeEditModal } from './components/editor/NodeEditModal';
import { DeleteConfirmModal } from './components/editor/DeleteConfirmModal';
import { TreeCanvas } from './components/tree/TreeCanvas';
import { TraversalControls } from './components/traversal/TraversalControls';
import './App.css';

const message = (error: unknown) => error instanceof Error ? error.message : 'The request failed. Please retry.';

export function App() {
  const [mode, setMode] = useState<HierarchyMode>('org');
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [stats, setStats] = useState<HierarchyStats | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [backendState, setBackendState] = useState<ApiState<BackendStatus>>({ status: 'loading', data: null, error: null, statusCode: null });
  const [activeTraversal, setActiveTraversal] = useState<TraversalType | null>(null);
  const [traversalResult, setTraversalResult] = useState<TraversalResult | null>(null);
  const [traversalError, setTraversalError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(800);
  const [query, setQuery] = useState('');
  const [searchIds, setSearchIds] = useState<string[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [modal, setModal] = useState<'create' | 'edit' | 'delete' | null>(null);

  const resetTraversal = () => { setTraversalResult(null); setTraversalError(null); setCurrentStepIndex(-1); setPlaying(false); };
  const reload = () => {
    setLoading(true); setError(null); setHierarchy(null); setStats(null);
    resetTraversal(); setSearchIds([]); setSearchError(null); setSearching(Boolean(query.trim()));
    setRevision(value => value + 1);
  };

  const fetchStatus = useCallback(() => getBackendStatus().then(setBackendState), []);
  useEffect(() => { void fetchStatus(); const timer = setInterval(fetchStatus, 10000); return () => clearInterval(timer); }, [fetchStatus]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([getHierarchy(mode), getStats(mode)]).then(([data, metrics]) => {
      if (!cancelled) {
        setHierarchy(data); setStats(metrics);
        setSelectedNodeId(id => data.nodes.some(node => node.id === id) ? id : null);
      }
    }).catch(reason => { if (!cancelled) setError(message(reason)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, revision]);
  useEffect(() => {
    let cancelled = false;
    if (activeTraversal && hierarchy) getTraversal(mode, activeTraversal).then(result => { if (!cancelled) setTraversalResult(result); }).catch(reason => { if (!cancelled) setTraversalError(message(reason)); });
    return () => { cancelled = true; };
  }, [mode, activeTraversal, hierarchy]);
  useEffect(() => {
    if (!playing || !traversalResult) return;
    const timer = setTimeout(() => {
      if (currentStepIndex + 1 >= traversalResult.order.length - 1) setPlaying(false);
      setCurrentStepIndex(step => Math.min(step + 1, traversalResult.order.length - 1));
    }, speed);
    return () => clearTimeout(timer);
  }, [playing, currentStepIndex, speed, traversalResult]);
  useEffect(() => {
    let cancelled = false;
    if (!query.trim() || !hierarchy) return;
    const timer = setTimeout(() => {
      searchMembers(mode, query).then(result => { if (!cancelled) setSearchIds(result.ids); }).catch(reason => { if (!cancelled) setSearchError(message(reason)); }).finally(() => { if (!cancelled) setSearching(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, mode, hierarchy]);
  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !modal) setSelectedNodeId(null); };
    window.addEventListener('keydown', keyDown); return () => window.removeEventListener('keydown', keyDown);
  }, [modal]);

  const mutate = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(null); setNotice(''); setPlaying(false);
    try { await operation(); setNotice(success); reload(); return true; }
    catch (reason) { setError(message(reason)); return false; }
    finally { setBusy(false); }
  };
  const selectNode = (id: string) => setSelectedNodeId(previous => previous === id ? null : id);
  const selectedNode = hierarchy?.nodes.find(node => node.id === selectedNodeId) ?? null;
  const currentStep = traversalResult?.order[currentStepIndex] ?? null;
  const visitedIds = useMemo(() => traversalResult?.order.slice(0, Math.max(0, currentStepIndex)).map(step => step.id) ?? [], [traversalResult, currentStepIndex]);
  const disabled = busy || loading || modal !== null;
  const openModal = (next: 'create' | 'edit' | 'delete') => { if (!disabled) { setPlaying(false); setModal(next); } };
  const completeModal = () => { setModal(null); setNotice('Hierarchy changes saved.'); reload(); };

  return <div className="app-container">
    <Navbar mode={mode} onModeChange={next => {
      if (busy || modal || mode === next) return;
      reload(); setMode(next); setSelectedNodeId(null); setActiveTraversal(null); setQuery(''); setSearching(false); setNotice('');
    }} status={backendState.data} isChecking={backendState.status === 'loading'} onRefreshStatus={() => { setBackendState(previous => ({ ...previous, status: 'loading' })); void fetchStatus(); }} errorMessage={backendState.error} />
    <main className="main-content">
      <header className="page-header"><div className="page-header-text">
        <div className="page-header-badge"><span className="badge-dot" />Live hierarchy workspace</div>
        <h2 className="page-title">{mode === 'org' ? 'Organization' : 'Family'} Hierarchy</h2>
        <p className="page-description">Explore relationships, manage members, and follow binary traversals computed by the C++ backend.</p>
      </div></header>
      <QuickInfoBar mode={mode} activeTraversal={activeTraversal} status={backendState.data} dataSource="backend" stats={stats} />
      <section className="workspace-toolbar" aria-label="Hierarchy tools">
        <label className="search-field">Find a member<input type="search" placeholder="Name, role, branch, or ID" value={query} disabled={!hierarchy || disabled} onChange={event => { setQuery(event.target.value); setSearchIds([]); setSearchError(null); setSearching(Boolean(event.target.value.trim())); }} /></label>
        <div className="management-actions">
          <button disabled={disabled} onClick={reload}>Refresh</button>
          <button disabled={disabled || !hierarchy?.rootId} onClick={() => {
            if (hierarchy?.rootId && window.confirm('Clear every member in this hierarchy? Export a backup first. This cannot be undone.')) void mutate(() => deleteMember(mode, hierarchy.rootId!), 'Hierarchy cleared and saved.');
          }}>Clear hierarchy</button>
          <button disabled={disabled || !hierarchy} onClick={async () => {
            setBusy(true); setError(null);
            try {
              const data = await exportHierarchy(mode);
              const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
              const link = document.createElement('a'); link.href = url; link.download = `${mode}-hierarchy.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
              setNotice('Hierarchy exported.');
            } catch (reason) { setError(message(reason)); } finally { setBusy(false); }
          }}>Export JSON</button>
          <label className={`file-button ${disabled ? 'disabled' : ''}`}>Import JSON<input type="file" accept=".json,application/json" disabled={disabled} onChange={async event => {
            const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
            if (file.size > 512 * 1024) { setError('Import files must be smaller than 512 KB.'); return; }
            if (!window.confirm(`Replace the entire ${mode === 'org' ? 'organization' : 'family'} hierarchy with ${file.name}? Export first if you need a backup.`)) return;
            await mutate(async () => importHierarchy(mode, await file.text()), 'Hierarchy imported and saved.');
          }} /></label>
        </div>
        {stats && <p className="workspace-metrics" aria-live="polite"><strong>{stats.totalMembers}</strong> members <span>·</span> Binary height <strong>{stats.binaryTreeHeight}</strong></p>}
      </section>
      {query.trim() && <section className="search-results" aria-label="Search results" aria-live="polite">
        <p>{searching ? 'Searching…' : searchError ?? `${searchIds.length} matching members`}</p>
        {searchIds.map(id => <button key={id} onClick={() => setSelectedNodeId(id)} aria-pressed={selectedNodeId === id}>{hierarchy?.nodes.find(node => node.id === id)?.name ?? id}</button>)}
      </section>}
      {error && <div className="request-error" role="alert">{error} <button disabled={disabled} onClick={reload}>Retry loading</button></div>}
      {notice && <p className="request-notice" role="status">{notice}</p>}
      {loading && <p role="status">Loading hierarchy and statistics…</p>}
      {hierarchy && <div className="workspace-grid" aria-busy={busy}>
        <section className="canvas-section" aria-label="Hierarchy Canvas"><TreeCanvas data={hierarchy} mode={mode} activeTraversal={activeTraversal} selectedNodeId={selectedNodeId} onSelectNode={selectNode} highlightedNodeIds={searchIds} currentTraversalNodeId={currentStep?.id ?? null} traversalStepNumber={currentStep?.step ?? null} visitedNodeIds={visitedIds} /></section>
        <aside className="controls-sidebar" aria-label="Controls and Notes">
          <NodeInspector selectedNode={selectedNode} allNodes={hierarchy.nodes} onSelectNode={selectNode} onClearSelection={() => setSelectedNodeId(null)} onOpenCreateModal={() => openModal('create')} onOpenEditModal={() => openModal('edit')} onOpenDeleteModal={() => openModal('delete')} />
          {hierarchy.nodes.length === 0 && <MemberEditor key={`${mode}:${revision}`} selected={null} empty busy={disabled} onAdd={fields => mutate(() => addMember(mode, fields), 'Root member added and saved.')} onEdit={() => Promise.resolve(false)} onDelete={() => {}} />}
          {traversalError && <div className="request-error" role="alert">{traversalError} <button onClick={reload}>Retry traversal</button></div>}
          {activeTraversal && !traversalResult && !traversalError && <p role="status">Loading C++ traversal…</p>}
          <TraversalControls activeTraversal={activeTraversal} onSelectTraversal={type => { if (!busy) { resetTraversal(); setActiveTraversal(previous => previous === type ? null : type); } }} traversalResult={traversalResult} traversalSource={traversalResult ? 'backend' : null} currentStepIndex={currentStepIndex} onNextStep={() => { setPlaying(false); setCurrentStepIndex(step => Math.min(step + 1, (traversalResult?.order.length ?? 1) - 1)); }} onPrevStep={() => { setPlaying(false); setCurrentStepIndex(step => Math.max(step - 1, 0)); }} onResetSteps={() => { setPlaying(false); setCurrentStepIndex(-1); }} onStepSelect={index => { setPlaying(false); setCurrentStepIndex(index); }} isEmptyTree={hierarchy.nodes.length === 0} />
          {traversalResult && <section className="playback-controls" aria-label="Traversal playback">
            <button disabled={!traversalResult.order.length || busy} onClick={() => { if (!playing && currentStepIndex >= traversalResult.order.length - 1) setCurrentStepIndex(-1); setPlaying(value => !value); }}>{playing ? 'Pause' : 'Play traversal'}</button>
            <label>Step speed<select value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={1400}>Slow · 1.4s</option><option value={800}>Normal · 0.8s</option><option value={350}>Fast · 0.35s</option></select></label>
          </section>}
        </aside>
      </div>}
      {hierarchy && modal === 'create' && <NodeCreateModal isOpen mode={mode} existingNodes={hierarchy.nodes} defaultParentId={selectedNodeId} onClose={() => setModal(null)} onNodeCreated={completeModal} />}
      {hierarchy && modal === 'edit' && selectedNode && <NodeEditModal key={selectedNode.id} isOpen mode={mode} node={selectedNode} onClose={() => setModal(null)} onNodeUpdated={completeModal} />}
      {hierarchy && modal === 'delete' && selectedNode && <DeleteConfirmModal isOpen mode={mode} node={selectedNode} allNodes={hierarchy.nodes} rootId={hierarchy.rootId} onClose={() => setModal(null)} onConfirmDelete={completeModal} />}
    </main>
    <footer className="app-footer"><p>Organization &amp; Family Hierarchy Explorer · C++14 &amp; React · Left-Child Right-Sibling trees</p></footer>
  </div>;
}
export default App;
