import React, { useMemo, useState } from 'react';
import { COLORS } from '../../config/design-tokens';
import { useCollection } from '../../hooks/useCollection';
import { logInteraction, kindMeta, INTERACTION_KINDS } from '../../data/interactions';

function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'object' && v.seconds) return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function relativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function Timeline({ entityType, entityId }) {
  const { data: interactions, loading } = useCollection('interactions');
  const [composing, setComposing] = useState(false);

  const items = useMemo(() => {
    return interactions
      .filter((i) => i.entity_type === entityType && i.entity_id === entityId)
      .sort((a, b) => toMs(b.occurred_at || b.createdAt) - toMs(a.occurred_at || a.createdAt));
  }, [interactions, entityType, entityId]);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>🕑 Timeline</div>
        {!composing && (
          <button onClick={() => setComposing(true)}
            style={{ padding: '6px 12px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            + Log note
          </button>
        )}
      </div>

      {composing && (
        <LogForm entityType={entityType} entityId={entityId} onDone={() => setComposing(false)} />
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: COLORS.textDim }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic', padding: '8px 0' }}>
          No interactions yet. Log a call, meeting, or note to start the timeline.
        </div>
      ) : (
        <div style={{ borderLeft: `2px solid ${COLORS.border}`, marginLeft: 8, paddingLeft: 14 }}>
          {items.map((item) => <TimelineItem key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function TimelineItem({ item }) {
  const meta = kindMeta(item.kind);
  const ts = toMs(item.occurred_at || item.createdAt);
  return (
    <div style={{ position: 'relative', paddingBottom: 14 }}>
      <div style={{ position: 'absolute', left: -22, top: 2, width: 18, height: 18, borderRadius: '50%', background: COLORS.card, border: `2px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
        {meta.icon}
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 2 }}>
        <span style={{ fontWeight: 600, color: COLORS.text }}>{meta.label}</span>
        <span> · {relativeTime(ts)}</span>
      </div>
      {item.kind === 'stage_change' ? (
        <div style={{ fontSize: 13, color: COLORS.text }}>
          Lifecycle stage changed
          {item.from_stage && <> from <strong>{item.from_stage}</strong></>}
          {item.to_stage && <> to <strong>{item.to_stage}</strong></>}
        </div>
      ) : (
        <>
          {item.title && <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{item.title}</div>}
          {item.body && <div style={{ fontSize: 13, color: COLORS.text, whiteSpace: 'pre-wrap', marginTop: 2 }}>{item.body}</div>}
        </>
      )}
    </div>
  );
}

function LogForm({ entityType, entityId, onDone }) {
  const [kind, setKind] = useState('note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() && !body.trim()) { onDone(); return; }
    setSaving(true);
    try {
      await logInteraction({ kind, entity_type: entityType, entity_id: entityId, title: title.trim(), body: body.trim() });
      onDone();
    } catch (err) {
      console.error('Failed to log interaction', err);
      alert('Failed to save note — check console.');
      setSaving(false);
    }
  };

  return (
    <div style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
          {INTERACTION_KINDS.filter((k) => k.value !== 'stage_change').map((k) => (
            <option key={k.value} value={k.value}>{k.icon} {k.label}</option>
          ))}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" style={{ ...inputStyle, flex: 1 }} />
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Notes…" autoFocus
        style={{ ...inputStyle, width: '100%', minHeight: 70, boxSizing: 'border-box', fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={save} disabled={saving}
          style={{ padding: '6px 14px', background: COLORS.success, color: '#fff', border: 'none', borderRadius: 5, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onDone}
          style={{ padding: '6px 14px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const inputStyle = { padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 13, background: COLORS.card, color: COLORS.text };
