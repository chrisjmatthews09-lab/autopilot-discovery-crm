import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
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

export default function TopBar({ onOpenSearch, isProcessing = false, pendingCount = 0, reviewCount = 0 }) {
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

      <IngestionStatus
        isProcessing={isProcessing}
        pendingCount={pendingCount}
        reviewCount={reviewCount}
      />

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

function IngestionStatus({ isProcessing, pendingCount, reviewCount }) {
  const navigate = useNavigate();
  const showProcessing = isProcessing || pendingCount > 0;
  if (!showProcessing && reviewCount === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {showProcessing && (
        <div
          title={pendingCount > 0 ? `${pendingCount} interview${pendingCount === 1 ? '' : 's'} pending` : 'Processing…'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: COLORS.cardAlt,
            border: `1px solid ${COLORS.border}`,
            fontSize: 12,
            color: COLORS.textMuted,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: COLORS.accent,
              animation: 'ingestionPulse 1.2s ease-in-out infinite',
            }}
          />
          <span>Processing{pendingCount > 0 ? ` (${pendingCount})` : '…'}</span>
          <style>{`@keyframes ingestionPulse { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }`}</style>
        </div>
      )}
      {reviewCount > 0 && (
        <button
          type="button"
          onClick={() => navigate('/review')}
          title={`${reviewCount} item${reviewCount === 1 ? '' : 's'} awaiting review — click to open`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: COLORS.warning,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span>Review</span>
          <span style={{ background: 'rgba(255,255,255,0.25)', padding: '1px 6px', borderRadius: 999, fontSize: 11 }}>
            {reviewCount}
          </span>
        </button>
      )}
    </div>
  );
}
