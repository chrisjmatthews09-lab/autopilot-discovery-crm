import React from 'react';
import { COLORS } from '../../config/design-tokens';

export default function DedupeModal({ open, existing, match, onCancel, onCreateAnyway, onViewExisting }) {
  if (!open || !existing) return null;
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.card, borderRadius: 10, padding: 20, maxWidth: 460, width: '100%' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>Possible duplicate</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 14 }}>
          <strong style={{ color: COLORS.text }}>{existing.name || '(unnamed)'}</strong>{' '}
          {match ? <>({match})</> : null} already exists.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel}
            style={{ padding: '8px 14px', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, color: COLORS.text }}>
            Cancel
          </button>
          <button onClick={onViewExisting}
            style={{ padding: '8px 14px', background: 'none', border: `1px solid ${COLORS.primary}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, color: COLORS.primary, fontWeight: 600 }}>
            View existing
          </button>
          <button onClick={onCreateAnyway}
            style={{ padding: '8px 14px', background: COLORS.accent, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#fff', fontWeight: 600 }}>
            Create anyway
          </button>
        </div>
      </div>
    </div>
  );
}

export function findDuplicatePerson(rows, { email, name, company }) {
  if (email) {
    const e = email.trim().toLowerCase();
    const match = rows.find((r) => (r.email || '').trim().toLowerCase() === e);
    if (match) return { existing: match, match: `email: ${email}` };
  }
  if (name && company) {
    const n = name.trim().toLowerCase();
    const c = company.trim().toLowerCase();
    const match = rows.find((r) => (r.name || '').trim().toLowerCase() === n && (r.company || '').trim().toLowerCase() === c);
    if (match) return { existing: match, match: `name + firm` };
  }
  return null;
}

export function findDuplicateCompany(rows, { domain, name }) {
  if (domain) {
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    const match = rows.find((r) => {
      const existing = (r.domain || r.website || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
      return existing && existing === d;
    });
    if (match) return { existing: match, match: `domain: ${d}` };
  }
  if (name) {
    const n = name.trim().toLowerCase();
    const match = rows.find((r) => (r.name || '').trim().toLowerCase() === n);
    if (match) return { existing: match, match: 'name' };
  }
  return null;
}
