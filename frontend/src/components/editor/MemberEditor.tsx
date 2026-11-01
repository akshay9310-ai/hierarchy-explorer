import { useState } from 'react';
import type { TreeNodeDto } from '../../api/types';

interface Props {
  selected: TreeNodeDto | null;
  empty: boolean;
  busy: boolean;
  onAdd: (fields: { id: string; name: string; role: string; department: string; parentId: string }) => Promise<boolean>;
  onEdit: (fields: { name: string; role: string; department: string }) => Promise<boolean>;
  onDelete: () => void;
}

export function MemberEditor({ selected, empty, busy, onAdd, onEdit, onDelete }: Props) {
  const [action, setAction] = useState<'edit' | 'add'>('add');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const choose = (next: 'edit' | 'add') => {
    setAction(next);
    setName(next === 'edit' ? selected?.name ?? '' : '');
    setRole(next === 'edit' ? selected?.role ?? '' : '');
    setDepartment(next === 'edit' ? selected?.department ?? '' : '');
  };
  return <section className="management-card">
    <h2 className="card-title">Manage members</h2>
    <p className="management-hint">{empty ? 'Create the first member of this hierarchy.' : selected ? `Selected: ${selected.name}` : 'Select a member to edit or add a child.'}</p>
    <div className="management-actions">
      <button disabled={busy || !selected} aria-pressed={action === 'edit'} onClick={() => choose('edit')}>Edit member</button>
      <button disabled={busy || (!selected && !empty)} aria-pressed={action === 'add'} onClick={() => choose('add')}>{empty ? 'Add root' : 'Add child'}</button>
    </div>
    {(selected || empty) && <form onSubmit={async event => {
      event.preventDefault();
      const fields = { name: name.trim(), role: role.trim(), department: department.trim() };
      if (!fields.name || !fields.role) return;
      const saved = action === 'edit' && selected ? await onEdit(fields) : await onAdd({ ...fields, id: crypto.randomUUID(), parentId: selected?.id ?? '' });
      if (saved && action === 'add') { setName(''); setRole(''); setDepartment(''); }
    }}>
      <fieldset disabled={busy} className="member-fields">
        <label>Name<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} /></label>
        <label>Role / relationship<input required maxLength={200} value={role} onChange={event => setRole(event.target.value)} /></label>
        <label>Department / family branch<input maxLength={200} value={department} onChange={event => setDepartment(event.target.value)} /></label>
        <button type="submit" disabled={!name.trim() || !role.trim()}>{busy ? 'Saving…' : action === 'edit' ? 'Save changes' : empty ? 'Create root' : 'Add child'}</button>
      </fieldset>
    </form>}
    {selected && <><button className="danger-button" disabled={busy} onClick={onDelete}>Delete member and descendants</button><p className="management-hint">Sibling branches are preserved. Deleting the root clears this hierarchy.</p></>}
  </section>;
}
