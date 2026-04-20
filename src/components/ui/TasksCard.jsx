import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS } from '../../config/design-tokens';
import { TASK_PRIORITIES, TASK_PRIORITY_COLORS } from '../../config/enums';
import { useCollection } from '../../hooks/useCollection';
import { createTask, updateTask, deleteTask, RELATED_KEYS, isOverdue } from '../../data/tasks';
import { useWorkspace } from '../../hooks/useWorkspace';

export default function TasksCard({ entityType, entityId, recordLabel = 'record' }) {
  const { data: tasks, loading } = useCollection('tasks');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('P2');
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const { id: workspaceId } = useWorkspace();
  const tasksListPath = workspaceId === 'deal_flow' ? '/deal-flow/tasks' : '/crm/tasks';

  const relatedKey = RELATED_KEYS[entityType];

  const scoped = useMemo(() => {
    if (!relatedKey) return [];
    return tasks.filter((t) => t[relatedKey] === entityId).sort((a, b) => {
      const aDue = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bDue = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return (a.priority || 'P3').localeCompare(b.priority || 'P3');
    });
  }, [tasks, relatedKey, entityId]);

  const visible = showDone ? scoped : scoped.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled');
  const doneCount = scoped.filter((t) => t.status === 'Done').length;

  const submit = async (e) => {
    e?.preventDefault();
    if (!title.trim() || adding) return;
    setAdding(true);
    try {
      await createTask({
        title: title.trim(),
        due_date: dueDate || null,
        priority,
        related: { type: entityType, id: entityId },
        workspace: workspaceId,
      });
      setTitle('');
      setDueDate('');
      setPriority('P2');
    } catch (err) {
      console.error('Failed to add task', err);
      alert('Could not add task — check console.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={{ marginTop: 20, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>✅ Tasks <span style={{ color: COLORS.textMuted, fontWeight: 400, fontSize: 12 }}>({visible.length}{doneCount > 0 && ` · ${doneCount} done`})</span></div>
        {doneCount > 0 && (
          <button onClick={() => setShowDone((v) => !v)}
            style={{ background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            {showDone ? 'Hide done' : 'Show done'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: COLORS.textDim }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic', padding: '4px 0' }}>No open tasks.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {visible.map((t) => {
            const prio = TASK_PRIORITY_COLORS[t.priority] || TASK_PRIORITY_COLORS.P3;
            const overdue = isOverdue(t);
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 5, background: COLORS.cardAlt }}>
                <input type="checkbox" checked={t.status === 'Done'} onChange={(e) => updateTask(t.id, { status: e.target.checked ? 'Done' : 'Open' })} style={{ accentColor: COLORS.success }} />
                <span style={{ flex: 1, fontSize: 13, color: COLORS.text, textDecoration: t.status === 'Done' ? 'line-through' : 'none', opacity: t.status === 'Done' ? 0.6 : 1 }}>{t.title || '(untitled)'}</span>
                {t.due_date && <span style={{ fontSize: 11, color: overdue ? COLORS.danger : COLORS.textMuted, fontWeight: overdue ? 600 : 400 }}>{t.due_date}</span>}
                <span style={{ padding: '1px 6px', borderRadius: 3, background: prio.bg, color: prio.fg, fontSize: 10, fontWeight: 700 }}>{t.priority}</span>
                <button onClick={() => { if (window.confirm('Delete task?')) deleteTask(t.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textDim, fontSize: 12 }} title="Delete">✕</button>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`+ Add task for this ${recordLabel}…`}
          style={inputStyle} />
        <div style={{ display: 'flex', gap: 6 }}>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ ...inputStyle, width: 80 }}>
            {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button type="submit" disabled={!title.trim() || adding}
            style={{ padding: '6px 14px', background: title.trim() ? COLORS.primary : COLORS.border, color: '#fff', border: 'none', borderRadius: 4, cursor: title.trim() ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600 }}>
            {adding ? '…' : 'Add'}
          </button>
        </div>
      </form>

      <Link to={tasksListPath} style={{ display: 'inline-block', marginTop: 8, fontSize: 11, color: COLORS.primary, textDecoration: 'none' }}>
        View all tasks →
      </Link>
    </div>
  );
}

const inputStyle = { padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 12, background: COLORS.card, color: COLORS.text, boxSizing: 'border-box' };
