import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { TASK_STATUSES, TASK_PRIORITIES, TASK_PRIORITY_COLORS } from '../config/enums';
import { useCollection } from '../hooks/useCollection';
import { createTask, updateTask, deleteTask, bulkUpdateTasks, isOverdue } from '../data/tasks';
import { personPath, companyPath, interviewPath } from '../config/workspaces';

const RELATED_TYPES = [
  { value: 'any', label: 'Any' },
  { value: 'person', label: 'Person', idKey: 'related_person_id' },
  { value: 'company', label: 'Company', idKey: 'related_company_id' },
  { value: 'interview', label: 'Interview', idKey: 'related_interview_id' },
  { value: 'deal', label: 'Deal', idKey: 'related_deal_id' },
  { value: 'none', label: 'Unlinked' },
];

export default function Tasks({ workspace = null }) {
  const { data: allTasks, loading } = useCollection('tasks');
  const { data: people } = useCollection('people');
  const { data: companies } = useCollection('companies');
  const { data: interviews } = useCollection('interviews');
  const { data: deals } = useCollection('deals');
  const tasks = useMemo(
    () => (workspace ? allTasks.filter((t) => (t.workspace || 'crm') === workspace) : allTasks),
    [allTasks, workspace]
  );

  const [statusFilter, setStatusFilter] = useState('open');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState('any');
  const [relatedFilter, setRelatedFilter] = useState('any');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const peopleById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);
  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const interviewsById = useMemo(() => Object.fromEntries(interviews.map((i) => [i.id, i])), [interviews]);
  const dealsById = useMemo(() => Object.fromEntries(deals.map((d) => [d.id, d])), [deals]);

  const filtered = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now).setHours(0, 0, 0, 0);
    const endOfWeek = startOfDay + 7 * 24 * 60 * 60 * 1000;
    return tasks.filter((t) => {
      if (statusFilter === 'open' && (t.status === 'Done' || t.status === 'Cancelled')) return false;
      if (statusFilter !== 'all' && statusFilter !== 'open' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (dueFilter === 'overdue' && !isOverdue(t)) return false;
      if (dueFilter === 'today') {
        if (!t.due_date) return false;
        const due = new Date(t.due_date).getTime();
        if (due < startOfDay || due >= startOfDay + 86400000) return false;
      }
      if (dueFilter === 'week') {
        if (!t.due_date) return false;
        const due = new Date(t.due_date).getTime();
        if (due < startOfDay || due >= endOfWeek) return false;
      }
      if (dueFilter === 'nodate' && t.due_date) return false;
      if (relatedFilter === 'none' && (t.related_person_id || t.related_company_id || t.related_interview_id || t.related_deal_id || t.related_target_id)) return false;
      if (relatedFilter !== 'any' && relatedFilter !== 'none') {
        const type = RELATED_TYPES.find((r) => r.value === relatedFilter);
        if (type?.idKey && !t[type.idKey]) return false;
      }
      return true;
    }).sort((a, b) => {
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return (a.priority || 'P3').localeCompare(b.priority || 'P3');
    });
  }, [tasks, statusFilter, priorityFilter, dueFilter, relatedFilter]);

  const resolveRelated = (t) => {
    if (t.related_person_id && peopleById[t.related_person_id]) { const p = peopleById[t.related_person_id]; return { label: p.name || '(person)', path: personPath(p), icon: '👤' }; }
    if (t.related_company_id && companiesById[t.related_company_id]) { const c = companiesById[t.related_company_id]; return { label: c.name || '(company)', path: companyPath(c), icon: '🏢' }; }
    if (t.related_interview_id && interviewsById[t.related_interview_id]) { const iv = interviewsById[t.related_interview_id]; return { label: iv.intervieweeName || iv.intervieweeBusinessName || 'Interview', path: interviewPath(iv), icon: '🎙' }; }
    if (t.related_deal_id && dealsById[t.related_deal_id]) return { label: dealsById[t.related_deal_id].name || '(deal)', path: `/crm/deals/${t.related_deal_id}`, icon: '💼' };
    return null;
  };

  const handleQuickCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      await createTask({ title: newTitle.trim() });
      setNewTitle('');
    } catch (err) {
      console.error('Failed to create task', err);
      alert('Could not create task — check console.');
    } finally {
      setCreating(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((t) => t.id)));
  };

  const doBulk = async (action) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (action === 'done') await bulkUpdateTasks(ids, { status: 'Done' });
    else if (action === 'open') await bulkUpdateTasks(ids, { status: 'Open' });
    else if (action === 'delete') {
      if (!window.confirm(`Delete ${ids.length} task(s)?`)) return;
      for (const id of ids) await deleteTask(id);
    } else if (action === 'due') {
      const d = window.prompt('New due date (YYYY-MM-DD), blank to clear:');
      if (d === null) return;
      await bulkUpdateTasks(ids, { due_date: d.trim() || null });
    } else if (action === 'priority') {
      const p = window.prompt('Priority (P0 / P1 / P2 / P3):', 'P2');
      if (!p || !TASK_PRIORITIES.includes(p.trim().toUpperCase())) return;
      await bulkUpdateTasks(ids, { priority: p.trim().toUpperCase() });
    }
    setSelectedIds(new Set());
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 26, color: COLORS.text }}>Tasks</h1>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{filtered.length} of {tasks.length} {loading && '· loading…'}</div>
        </div>
      </div>

      <form onSubmit={handleQuickCreate} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="+ Add task (press Enter)…"
          style={{ flex: 1, padding: '10px 12px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 14, background: COLORS.card, color: COLORS.text }} />
        <button type="submit" disabled={!newTitle.trim() || creating}
          style={{ padding: '10px 16px', background: newTitle.trim() ? COLORS.primary : COLORS.border, color: '#fff', border: 'none', borderRadius: 6, cursor: newTitle.trim() ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
          {creating ? 'Adding…' : 'Add'}
        </button>
      </form>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select value={statusFilter} onChange={setStatusFilter} options={[
          { v: 'open', l: 'Open (not done)' }, { v: 'all', l: 'All statuses' },
          ...TASK_STATUSES.map((s) => ({ v: s, l: s })),
        ]} />
        <Select value={priorityFilter} onChange={setPriorityFilter} options={[
          { v: 'all', l: 'Any priority' },
          ...TASK_PRIORITIES.map((p) => ({ v: p, l: p })),
        ]} />
        <Select value={dueFilter} onChange={setDueFilter} options={[
          { v: 'any', l: 'Any due date' }, { v: 'overdue', l: 'Overdue' },
          { v: 'today', l: 'Due today' }, { v: 'week', l: 'Due this week' },
          { v: 'nodate', l: 'No due date' },
        ]} />
        <Select value={relatedFilter} onChange={setRelatedFilter} options={RELATED_TYPES.map((r) => ({ v: r.value, l: r.label }))} />

        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>{selectedIds.size} selected</span>
            <button onClick={() => doBulk('done')} style={bulkBtn}>✓ Mark done</button>
            <button onClick={() => doBulk('open')} style={bulkBtn}>↺ Reopen</button>
            <button onClick={() => doBulk('due')} style={bulkBtn}>📅 Due date</button>
            <button onClick={() => doBulk('priority')} style={bulkBtn}>⚡ Priority</button>
            <button onClick={() => doBulk('delete')} style={{ ...bulkBtn, color: COLORS.danger, borderColor: COLORS.danger }}>🗑 Delete</button>
          </div>
        )}
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 120px 80px 110px 1fr 100px 40px', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.cardAlt, fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length} onChange={toggleAll} />
          <div>Title</div>
          <div>Due</div>
          <div>Priority</div>
          <div>Status</div>
          <div>Related</div>
          <div>Assignee</div>
          <div></div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: COLORS.textDim, fontSize: 13 }}>No tasks match these filters.</div>
        ) : filtered.map((t) => {
          const rel = resolveRelated(t);
          const overdue = isOverdue(t);
          const prio = TASK_PRIORITY_COLORS[t.priority] || TASK_PRIORITY_COLORS.P3;
          return (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 120px 80px 110px 1fr 100px 40px', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, alignItems: 'center', fontSize: 13, background: selectedIds.has(t.id) ? COLORS.primaryLight : 'transparent' }}>
              <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={t.status === 'Done'} onChange={(e) => updateTask(t.id, { status: e.target.checked ? 'Done' : 'Open' })} style={{ accentColor: COLORS.success }} />
                <span style={{ fontWeight: 500, color: COLORS.text, textDecoration: t.status === 'Done' ? 'line-through' : 'none', opacity: t.status === 'Done' ? 0.6 : 1 }}>{t.title || '(untitled)'}</span>
              </div>
              <div style={{ color: overdue ? COLORS.danger : COLORS.textMuted, fontWeight: overdue ? 600 : 400 }}>
                {t.due_date || <span style={{ color: COLORS.textDim }}>—</span>}
              </div>
              <div>
                <span style={{ padding: '2px 8px', borderRadius: 3, background: prio.bg, color: prio.fg, fontSize: 11, fontWeight: 700 }}>{t.priority}</span>
              </div>
              <div>
                <select value={t.status} onChange={(e) => updateTask(t.id, { status: e.target.value })}
                  style={{ padding: '3px 6px', borderRadius: 4, border: `1px solid ${COLORS.border}`, fontSize: 11, background: COLORS.card, color: COLORS.text }}>
                  {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                {rel ? (
                  <Link to={rel.path} style={{ fontSize: 12, color: COLORS.primary, textDecoration: 'none', background: COLORS.primaryLight, padding: '2px 8px', borderRadius: 10 }}>
                    {rel.icon} {rel.label}
                  </Link>
                ) : <span style={{ color: COLORS.textDim, fontSize: 12 }}>—</span>}
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: 12 }}>{t.assignee || 'Chris'}</div>
              <button onClick={() => { if (window.confirm('Delete task?')) deleteTask(t.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textDim, fontSize: 14 }} title="Delete">✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ padding: '6px 10px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontSize: 12, cursor: 'pointer' }}>
      {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

const bulkBtn = { padding: '5px 10px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
