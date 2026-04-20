import React, { useState } from 'react';
import { COLORS } from '../../config/design-tokens';
import { createView } from '../../data/views';
import { useWorkspace } from '../../hooks/useWorkspace';

export default function SaveViewModal({ open, onClose, objectType, filters, sort = null, defaultName = '', onSaved }) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { id: workspaceId } = useWorkspace();

  if (!open) return null;

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true); setError(null);
    try {
      const id = await createView({ name: name.trim(), object_type: objectType, filters, sort, workspace: workspaceId });
      setSaving(false);
      setName(defaultName);
      onSaved && onSaved(id);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save');
      setSaving(false);
    }
  };

  const describe = describeFilters(filters);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.card, borderRadius: 10, padding: 20, minWidth: 360, maxWidth: '90vw' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Save view</div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          Name
        </label>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose(); }}
          placeholder="e.g. CPAs in Colorado"
          style={{ width: '100%', padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />

        <div style={{ marginTop: 12, background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 10, fontSize: 11, color: COLORS.textMuted }}>
          <div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Filters captured</div>
          {describe.length === 0 ? <div>No filters — saves the raw list.</div> : (
            <ul style={{ margin: 0, paddingLeft: 14 }}>
              {describe.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
        </div>

        {error && <div style={{ fontSize: 11, color: COLORS.danger, marginTop: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button onClick={onClose}
            style={{ padding: '8px 14px', background: 'none', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving || !name.trim()}
            style={{ padding: '8px 16px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: saving || !name.trim() ? 0.5 : 1 }}>
            {saving ? 'Saving…' : 'Save view'}
          </button>
        </div>
      </div>
    </div>
  );
}

function describeFilters(filters) {
  if (!filters) return [];
  const out = [];
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) || v === false) continue;
    if (Array.isArray(v)) out.push(`${humanize(k)}: ${v.join(', ')}`);
    else if (typeof v === 'boolean') out.push(humanize(k));
    else out.push(`${humanize(k)}: ${v}`);
  }
  return out;
}

function humanize(k) {
  return k.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
