import React from 'react';
import { COLORS } from '../../config/design-tokens';

export default function EmptyState({ icon = '✨', title, body, primaryAction, secondaryAction }) {
  return (
    <div style={{ padding: 48, textAlign: 'center', background: COLORS.card, border: `1px dashed ${COLORS.border}`, borderRadius: 10 }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>{title}</div>
      {body && <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16, maxWidth: 380, margin: '0 auto 16px' }}>{body}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {primaryAction && (
          <button onClick={primaryAction.onClick}
            style={{ padding: '9px 18px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {primaryAction.label}
          </button>
        )}
        {secondaryAction && (
          <button onClick={secondaryAction.onClick}
            style={{ padding: '9px 18px', background: 'none', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
}
