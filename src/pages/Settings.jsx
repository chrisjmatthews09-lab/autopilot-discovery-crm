import React, { useState } from 'react';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { TAG_COLORS } from '../config/enums';
import { useCollection } from '../hooks/useCollection';
import { createTag, renameTag, recolorTag, changeTagScope, removeTag } from '../data/tags';

export default function Settings({ user, onSignOut }) {
  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ margin: '0 0 4px', fontFamily: DISPLAY, fontSize: 28, color: COLORS.text }}>Settings</h1>
      <p style={{ margin: '0 0 20px', color: COLORS.textMuted, fontSize: 14 }}>
        Account, tags, and workspace preferences.
      </p>

      <Section title="Account">
        <Row label="Email" value={user && user.email} />
        {onSignOut && (
          <button onClick={onSignOut}
            style={{ marginTop: 12, padding: '8px 14px', background: 'none', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            Sign out
          </button>
        )}
      </Section>

      <TagsSection />

      <Section title="Dashboard widgets" subtitle="Toggle visibility — ships in Sprint 4 catch-up">
        <div style={{ color: COLORS.textDim, fontSize: 13, fontStyle: 'italic' }}>Coming soon.</div>
      </Section>
    </div>
  );
}

function TagsSection() {
  const { data: tags, loading } = useCollection('tags');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [scope, setScope] = useState('any');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!label.trim()) return;
    setBusy(true);
    await createTag({ label: label.trim(), color, scope });
    setLabel('');
    setBusy(false);
  };

  return (
    <Section title="Tags" subtitle="Labels for People and Companies.">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New tag label"
          onKeyDown={(e) => e.key === 'Enter' && add()}
          style={{ flex: '1 1 180px', padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13 }} />
        <select value={scope} onChange={(e) => setScope(e.target.value)}
          style={{ padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, background: '#fff' }}>
          <option value="any">Any</option>
          <option value="person">People only</option>
          <option value="company">Companies only</option>
        </select>
        <ColorPicker value={color} onChange={setColor} />
        <button onClick={add} disabled={busy || !label.trim()}
          style={{ padding: '8px 14px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: busy || !label.trim() ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: busy || !label.trim() ? 0.5 : 1 }}>
          Add
        </button>
      </div>

      {loading ? (
        <div style={{ color: COLORS.textDim, fontSize: 13 }}>Loading…</div>
      ) : tags.length === 0 ? (
        <div style={{ color: COLORS.textDim, fontSize: 13, fontStyle: 'italic' }}>No tags yet. Create one above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tags.map((t) => <TagRow key={t.id} tag={t} />)}
        </div>
      )}
    </Section>
  );
}

function TagRow({ tag }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(tag.label);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: `1px solid ${COLORS.border}`, borderRadius: 6, background: COLORS.cardAlt }}>
      <ColorPicker value={tag.color} onChange={(c) => recolorTag(tag.id, c)} small />
      {editing ? (
        <input value={label} onChange={(e) => setLabel(e.target.value)}
          onBlur={() => { if (label.trim() && label !== tag.label) renameTag(tag.id, label.trim()); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setLabel(tag.label); setEditing(false); } }}
          autoFocus
          style={{ flex: 1, padding: '4px 8px', border: `1px solid ${COLORS.primary}`, borderRadius: 4, fontSize: 13 }} />
      ) : (
        <button onClick={() => setEditing(true)}
          style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: COLORS.text, padding: '4px 8px' }}>
          <span style={{ background: tag.color, color: '#fff', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{tag.label}</span>
        </button>
      )}
      <select value={tag.scope || 'any'} onChange={(e) => changeTagScope(tag.id, e.target.value)}
        style={{ padding: '4px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 12, background: '#fff' }}>
        <option value="any">Any</option>
        <option value="person">People</option>
        <option value="company">Companies</option>
      </select>
      <button onClick={() => { if (window.confirm(`Delete tag "${tag.label}"?`)) removeTag(tag.id); }}
        style={{ padding: '4px 10px', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, color: COLORS.danger }}>
        Delete
      </button>
    </div>
  );
}

function ColorPicker({ value, onChange, small }) {
  const [open, setOpen] = useState(false);
  const size = small ? 16 : 22;
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ width: size, height: size, background: value, border: `1px solid ${COLORS.border}`, borderRadius: '50%', cursor: 'pointer', padding: 0 }} />
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: size + 6, left: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 8, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {TAG_COLORS.map((c) => (
              <button key={c} onClick={() => { onChange(c); setOpen(false); }}
                style={{ width: 22, height: 22, background: c, border: value === c ? `2px solid ${COLORS.text}` : `1px solid ${COLORS.border}`, borderRadius: '50%', cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ color: COLORS.text }}>{value}</span>
    </div>
  );
}
