// Sprint 9 — Shared contact picker modal used by both "Merge into another
// contact" and "Move interview to different contact" flows.

import React, { useMemo, useState, useEffect } from 'react';
import { COLORS } from '../config/design-tokens';

/**
 * @param {object} props
 * @param {string} props.title             Modal heading.
 * @param {Array}  props.contacts          Candidate list (already filtered by kind/workspace).
 * @param {(contact: object) => void} props.onSelect
 * @param {() => void} props.onClose
 * @param {(contact: object) => boolean} [props.disabled] Optional predicate
 *                                         to grey out rows (e.g. the current
 *                                         contact — can't merge into yourself).
 * @param {string}   [props.confirmLabel]  Override the primary button label.
 * @param {(contact: object) => import('react').ReactNode} [props.rowExtra]
 *                                         Render extra metadata per row.
 */
export default function ContactPickerModal({
  title,
  contacts,
  onSelect,
  onClose,
  disabled,
  confirmLabel = 'Select',
  rowExtra,
}) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const src = contacts || [];
    if (!q) return src.slice(0, 200);
    return src
      .filter((c) => {
        const hay = [c.name, c.fullName, c.firstName, c.lastName, c.email, c.company, c.businessName, c.role]
          .filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 200);
  }, [contacts, query]);

  const selected = contacts.find((c) => c.id === selectedId) || null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, borderRadius: 10, padding: 18,
          width: 560, maxWidth: '94%', maxHeight: '82vh', display: 'flex', flexDirection: 'column',
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{title}</div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, company…"
          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
        />
        <div style={{ overflowY: 'auto', flex: 1, border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic', padding: 18, textAlign: 'center' }}>
              No matches.
            </div>
          ) : (
            filtered.map((c) => {
              const isDisabled = typeof disabled === 'function' ? disabled(c) : false;
              const isSel = selectedId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => !isDisabled && setSelectedId(c.id)}
                  style={{
                    padding: '8px 12px',
                    borderBottom: `1px solid ${COLORS.border}`,
                    background: isSel ? COLORS.cardAlt : 'transparent',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.45 : 1,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                    {c.name || c.fullName || '(Unnamed)'}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                    {c.email || '—'}
                    {c.company && <> · {c.company}</>}
                    {c.role && <> · {c.role}</>}
                  </div>
                  {rowExtra ? <div style={{ marginTop: 3 }}>{rowExtra(c)}</div> : null}
                </div>
              );
            })
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button
            onClick={() => selected && onSelect(selected)}
            disabled={!selected}
            style={selected ? btnPrimary : { ...btnPrimary, opacity: 0.5, cursor: 'not-allowed' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = { padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 13, background: COLORS.card, color: COLORS.text };
const btnPrimary = { padding: '8px 14px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const btnGhost = { padding: '8px 14px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 13 };
const closeBtn = { background: 'none', border: 'none', color: COLORS.textMuted, cursor: 'pointer', fontSize: 16 };
