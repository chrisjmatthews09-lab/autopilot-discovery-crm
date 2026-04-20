import React, { useState } from 'react';
import { COLORS } from '../../config/design-tokens';

export default function CloseDealModal({ mode, dealName, onConfirm, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [closeDate, setCloseDate] = useState(today);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const isWon = mode === 'won';
  const canSubmit = isWon ? !!closeDate : !!reason.trim();

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      await onConfirm({
        actual_close_date: closeDate,
        lost_reason: isWon ? null : reason.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.card, borderRadius: 10, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
            {isWon ? '🎉 Close as Won' : '❌ Close as Lost'}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{dealName || 'Deal'}</div>
        </div>
        <form onSubmit={submit} style={{ padding: 18 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>
              {isWon ? 'Actual close date' : 'Lost date'}
            </label>
            <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: 13, background: COLORS.card, color: COLORS.text, boxSizing: 'border-box' }} />
          </div>
          {!isWon && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>
                Lost reason *
              </label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
                placeholder="Why was this deal lost? (required)"
                style={{ width: '100%', minHeight: 80, padding: 10, border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: 13, fontFamily: 'inherit', background: COLORS.card, color: COLORS.text, boxSizing: 'border-box' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="button" onClick={onCancel}
              style={{ padding: '7px 14px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit || saving}
              style={{ padding: '7px 16px', background: isWon ? COLORS.success : COLORS.danger, color: '#fff', border: 'none', borderRadius: 5, cursor: canSubmit && !saving ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, opacity: canSubmit ? 1 : 0.5 }}>
              {saving ? 'Saving…' : isWon ? '✓ Mark Won' : 'Mark Lost'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
