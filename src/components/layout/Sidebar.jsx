import React from 'react';
import { NavLink } from 'react-router-dom';
import { COLORS, SIDEBAR_WIDTH } from '../../config/design-tokens';

const SECTIONS = [
  {
    label: null,
    items: [
      { to: '/', label: 'Dashboard', icon: '🏠', end: true },
    ],
  },
  {
    label: 'Records',
    items: [
      { to: '/people', label: 'People', icon: '👥' },
      { to: '/companies', label: 'Companies', icon: '🏢' },
      { to: '/interviews', label: 'Interviews', icon: '🎙️' },
    ],
  },
  {
    label: 'Views',
    items: [
      { to: '/board', label: 'Board', icon: '📊' },
      { to: '/insights', label: 'Insights', icon: '🧠' },
      { to: '/scripts', label: 'Scripts', icon: '📝' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

export default function Sidebar({ user, onSignOut }) {
  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        backgroundColor: COLORS.sidebar,
        borderRight: `1px solid ${COLORS.border}`,
        padding: '16px 10px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        flexShrink: 0,
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 800, margin: '4px 0 16px 10px', color: COLORS.accent, fontFamily: `'Fraunces', serif` }}>
        Autopilot
      </h1>

      {SECTIONS.map((section, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          {section.label && (
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 10px 4px' }}>
              {section.label}
            </div>
          )}
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                backgroundColor: isActive ? COLORS.primary : 'transparent',
                color: isActive ? '#fff' : COLORS.text,
                textDecoration: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.12s',
              })}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}

      {user && (
        <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted, padding: '0 10px', wordBreak: 'break-all' }}>{user.email}</div>
          {onSignOut && (
            <button onClick={onSignOut}
              style={{ padding: '7px 10px', background: 'none', color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>
              Sign out
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
