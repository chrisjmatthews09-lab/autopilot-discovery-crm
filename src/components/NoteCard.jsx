// Sprint 7 — Timeline card for a manually-entered note. Supports inline
// edit + delete.

import React, { useState } from 'react';
import { COLORS } from '../config/design-tokens';
import { updateDoc, deleteDoc } from '../data/firestore';

function shortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fullTimestamp(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export default function NoteCard({ interaction, authorLabel = 'Chris', contactLabel }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(interaction.title || '');
  const [body, setBody] = useState(interaction.body || '');
  const [saving, setSaving] = useState(false);

  const dateValue = interaction.occurred_at || interaction.createdAt;

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc('interactions', interaction.id, {
        title: title.trim(),
        body: body.trim(),
      });
      setEditing(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save note — check console.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this note?')) return;
    try { await deleteDoc('interactions', interaction.id); }
    catch (err) { console.error(err); alert('Failed to delete.'); }
  };

  return (
    <div style={{
      padding: 14,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      background: COLORS.card,
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📝</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
            Note{contactLabel ? ` · on ${contactLabel}` : ''}
          </span>
          <span title={fullTimestamp(dateValue)} style={{ fontSize: 12, color: COLORS.textMuted }}>
            {shortDate(dateValue)}
          </span>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>· {authorLabel}</span>
        </div>
        {!editing && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditing(true)} style={ghostBtn}>Edit</button>
            <button onClick={remove} style={{ ...ghostBtn, color: COLORS.danger }}>Delete</button>
          </div>
        )}
      </div>

      {editing ? (
        <div style={{ marginTop: 8 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Note…"
            style={{ ...inputStyle, width: '100%', minHeight: 80, boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={save} disabled={saving} style={primaryBtn(saving)}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setTitle(interaction.title || ''); setBody(interaction.body || ''); }}
              style={ghostBtn}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {interaction.title && (
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginTop: 6 }}>
              {interaction.title}
            </div>
          )}
          {interaction.body && (
            <div style={{ fontSize: 13, color: COLORS.text, whiteSpace: 'pre-wrap', marginTop: 4 }}>
              {interaction.body}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ghostBtn = { padding: '4px 8px', background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, color: COLORS.textMuted };
const primaryBtn = (saving) => ({ padding: '6px 14px', background: saving ? COLORS.border : COLORS.success, color: '#fff', border: 'none', borderRadius: 5, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 });
const inputStyle = { padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 13, background: COLORS.card, color: COLORS.text };
