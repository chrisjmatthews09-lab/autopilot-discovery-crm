import React from 'react';
import { COLORS, DISPLAY } from '../config/design-tokens';

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

      <Section title="Tags" subtitle="Create, rename, color-code tags — ships in Sprint 2 catch-up">
        <div style={{ color: COLORS.textDim, fontSize: 13, fontStyle: 'italic' }}>Coming soon.</div>
      </Section>

      <Section title="Dashboard widgets" subtitle="Toggle visibility — ships in Sprint 4 catch-up">
        <div style={{ color: COLORS.textDim, fontSize: 13, fontStyle: 'italic' }}>Coming soon.</div>
      </Section>
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
