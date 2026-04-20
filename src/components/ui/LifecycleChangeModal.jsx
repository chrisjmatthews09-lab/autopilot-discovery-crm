import React, { useState } from 'react';
import { COLORS } from '../../config/design-tokens';

export default function LifecycleChangeModal({ fromStage, toStage, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim() || saving) return;
    setSaving(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.card, borderRadius: 10, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Moving backward in pipeline</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
            <strong>{fromStage}</strong> → <strong>{toStage}</strong> is a non-standard transition. Please capture why.
          </div>
        </div>
        <form onSubmit={submit} style={{ padding: 18 }}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
            placeholder="Why is this record moving backward? (required)"
            style={{ width: '100%', minHeight: 90, padding: 10, border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: 13, fontFamily: 'inherit', background: COLORS.card, color: COLORS.text, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" onClick={onCancel}
              style={{ padding: '7px 14px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>
              Cancel
            </button>
            <button type="submit" disabled={!reason.trim() || saving}
              style={{ padding: '7px 16px', background: reason.trim() ? COLORS.warning : COLORS.border, color: '#fff', border: 'none', borderRadius: 5, cursor: reason.trim() && !saving ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
              {saving ? 'Saving…' : 'Confirm change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
