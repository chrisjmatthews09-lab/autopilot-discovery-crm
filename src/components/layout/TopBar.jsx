import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { COLORS, TOPBAR_HEIGHT } from '../../config/design-tokens';

const LABELS = {
  '': 'Dashboard',
  people: 'People',
  companies: 'Companies',
  interviews: 'Interviews',
  board: 'Board',
  insights: 'Insights',
  scripts: 'Scripts',
  settings: 'Settings',
};

function breadcrumbSegments(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return [{ label: 'Dashboard', to: '/' }];
  const crumbs = [];
  let acc = '';
  for (const part of parts) {
    acc += '/' + part;
    crumbs.push({ label: LABELS[part] || part, to: acc });
  }
  return crumbs;
}

export default function TopBar({ onOpenSearch }) {
  const { pathname } = useLocation();
  const crumbs = breadcrumbSegments(pathname);

  return (
    <header
      style={{
        height: TOPBAR_HEIGHT,
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.card,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
        flexShrink: 0,
      }}
    >
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: COLORS.textMuted, flex: 1, minWidth: 0 }}>
        {crumbs.map((c, i) => (
          <React.Fragment key={c.to}>
            {i > 0 && <span style={{ color: COLORS.borderDark }}>/</span>}
            <Link to={c.to}
              style={{ color: i === crumbs.length - 1 ? COLORS.text : COLORS.textMuted, textDecoration: 'none', fontWeight: i === crumbs.length - 1 ? 600 : 400, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
              {c.label}
            </Link>
          </React.Fragment>
        ))}
      </nav>

      <button
        onClick={onOpenSearch}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 6,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.cardAlt,
          color: COLORS.textMuted,
          cursor: 'pointer',
          fontSize: 12,
          minWidth: 220,
        }}
      >
        <span>🔍</span>
        <span style={{ flex: 1, textAlign: 'left' }}>Search…</span>
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: COLORS.border, color: COLORS.text }}>⌘K</span>
      </button>
    </header>
  );
}
