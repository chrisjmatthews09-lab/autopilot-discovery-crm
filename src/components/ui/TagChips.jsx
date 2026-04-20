import React from 'react';
import { COLORS } from '../../config/design-tokens';
import { FIRM_ROLES } from '../../config/workspaces';

export function TagChips({ ids, tags, max = 4 }) {
  if (!ids || ids.length === 0) return <span style={{ color: COLORS.textDim, fontSize: 12 }}>—</span>;
  const resolved = ids.map((id) => tags.find((t) => t.id === id)).filter(Boolean);
  const visible = resolved.slice(0, max);
  const extra = resolved.length - visible.length;
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
      {visible.map((t) => (
        <span key={t.id} style={{ background: t.color || COLORS.textMuted, color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
          {t.label}
        </span>
      ))}
      {extra > 0 && <span style={{ color: COLORS.textMuted, fontSize: 10, fontWeight: 600, alignSelf: 'center' }}>+{extra}</span>}
    </div>
  );
}

export function RoleChips({ roles }) {
  if (!roles || roles.length === 0) return <span style={{ color: COLORS.textDim, fontSize: 12 }}>—</span>;
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
      {roles.map((rid) => {
        const r = FIRM_ROLES.find((x) => x.id === rid);
        if (!r) return null;
        return (
          <span key={rid} style={{ background: r.color, color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>
            {r.label}
          </span>
        );
      })}
    </div>
  );
}

export function RolePicker({ selected, onChange, compact }) {
  const set = new Set(selected || []);
  const toggle = (id) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(Array.from(next));
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {FIRM_ROLES.map((r) => {
        const on = set.has(r.id);
        return (
          <button key={r.id} type="button" onClick={() => toggle(r.id)}
            style={{
              background: on ? r.color : 'transparent',
              color: on ? '#fff' : r.color,
              border: `1px solid ${r.color}`,
              padding: compact ? '2px 8px' : '4px 10px',
              borderRadius: 12,
              fontSize: compact ? 10 : 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
            {on && '✓ '}{r.label}
          </button>
        );
      })}
    </div>
  );
}

export function TagPicker({ tags, selectedIds, onChange, scope, compact }) {
  const filtered = scope ? tags.filter((t) => !t.scope || t.scope === 'any' || t.scope === scope) : tags;
  const selected = new Set(selectedIds || []);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  if (filtered.length === 0) return <div style={{ fontSize: 11, color: COLORS.textDim, fontStyle: 'italic' }}>No tags. Create them in Settings → Tags.</div>;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {filtered.map((t) => {
        const on = selected.has(t.id);
        return (
          <button key={t.id} type="button" onClick={() => toggle(t.id)}
            style={{
              background: on ? t.color || COLORS.primary : 'transparent',
              color: on ? '#fff' : t.color || COLORS.text,
              border: `1px solid ${t.color || COLORS.border}`,
              padding: compact ? '2px 8px' : '4px 10px',
              borderRadius: 12,
              fontSize: compact ? 10 : 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
            {on && '✓ '}{t.label}
          </button>
        );
      })}
    </div>
  );
}
