import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { COLORS, TOPBAR_HEIGHT } from '../../config/design-tokens';
import { WORKSPACES } from '../../config/workspaces';

const LABELS = {
  '': 'Dashboard',
  people: 'People',
  companies: 'Companies',
  interviews: 'Interviews',
  board: 'Board',
  insights: 'Insights',
  scripts: 'Scripts',
  settings: 'Settings',
  practitioners: 'Practitioners',
  firms: 'Firms',
  targets: 'Targets',
  referrals: 'Referral Partners',
  pipeline: 'Pipeline',
};

// Workspace prefixes become a labelled + iconified header crumb so
// "/crm" → "💼 CRM", "/deal-flow" → "🎯 Deal Flow" (bold, slightly
// bigger than the workspace toggle in the sidebar).
const WORKSPACE_BY_PREFIX = {
  crm: WORKSPACES.crm,
  'deal-flow': WORKSPACES.deal_flow,
};

function breadcrumbSegments(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return [{ label: 'Dashboard', to: '/' }];
  const crumbs = [];
  let acc = '';
  parts.forEach((part, idx) => {
    acc += '/' + part;
    if (idx === 0 && WORKSPACE_BY_PREFIX[part]) {
      const ws = WORKSPACE_BY_PREFIX[part];
      crumbs.push({ label: ws.label, to: acc, icon: ws.icon, isWorkspace: true });
    } else {
      crumbs.push({ label: LABELS[part] || part, to: acc });
    }
  });
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
      <nav style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: COLORS.textMuted, flex: 1, minWidth: 0 }}>
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <React.Fragment key={c.to}>
              {i > 0 && <span style={{ color: COLORS.borderDark }}>/</span>}
              <Link to={c.to}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: c.isWorkspace ? 6 : 0,
                  color: isLast ? COLORS.text : COLORS.textMuted,
                  textDecoration: 'none',
                  fontWeight: c.isWorkspace ? 700 : (isLast ? 600 : 400),
                  fontSize: c.isWorkspace ? 15 : 13,
                  textTransform: c.isWorkspace ? 'none' : 'capitalize',
                  whiteSpace: 'nowrap',
                }}>
                {c.icon && <span style={{ fontSize: 16 }}>{c.icon}</span>}
                <span>{c.label}</span>
              </Link>
            </React.Fragment>
          );
        })}
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
