import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { COLORS, SIDEBAR_WIDTH } from '../../config/design-tokens';
import { useCollection } from '../../hooks/useCollection';
import { isOverdue } from '../../data/tasks';
import { deleteView, parseFilters, encodeFiltersToSearch, VIEW_OBJECT_ICONS, viewRoute } from '../../data/views';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useHasHover } from '../../hooks/useHasHover';
import { WORKSPACES } from '../../config/workspaces';
import { useConfirm } from '../ui/ConfirmDialog';

// Research, Tasks, and Review queue are platform-level — identical in both
// workspaces. They read from / write to the same global collections, so we
// render them the same way regardless of which workspace the user is in.
const SHARED_SECTIONS = [
  {
    label: 'Research',
    items: [
      { to: '/interviews', label: 'Interviews', icon: '🎙️' },
      { to: '/insights', label: 'Insights', icon: '🧠' },
      { to: '/scripts', label: 'Scripts', icon: '📝' },
    ],
  },
  {
    label: 'Work',
    items: [
      { to: '/tasks', label: 'Tasks', icon: '✅', badgeKey: 'overdueTasks' },
      { to: '/review', label: 'Review queue', icon: '🕵️', badgeKey: 'reviewAll', badgeTone: 'warning' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { to: '/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

const SECTIONS_CRM = [
  {
    label: null,
    items: [
      { to: '/crm', label: 'Dashboard', icon: '🏠', end: true },
    ],
  },
  {
    label: 'Records',
    items: [
      { to: '/crm/people', label: 'People', icon: '👥' },
      { to: '/crm/companies', label: 'Companies', icon: '🏢' },
    ],
  },
  {
    label: 'Pipeline',
    items: [
      { to: '/crm/deals', label: 'Deals', icon: '💼' },
      { to: '/crm/board', label: 'Board', icon: '📊' },
    ],
  },
  ...SHARED_SECTIONS,
];

const SECTIONS_DEAL_FLOW = [
  {
    label: null,
    items: [
      { to: '/deal-flow', label: 'Dashboard', icon: '🏠', end: true },
    ],
  },
  {
    label: 'Records',
    items: [
      { to: '/deal-flow/practitioners', label: 'Practitioners', icon: '👥' },
      { to: '/deal-flow/firms', label: 'Firms', icon: '🏢' },
    ],
  },
  {
    label: 'Pipeline',
    items: [
      { to: '/deal-flow/targets', label: 'Targets', icon: '🎯' },
      { to: '/deal-flow/referrals', label: 'Referral Partners', icon: '🤝', end: true },
      { to: '/deal-flow/referrals/pipeline', label: 'Referral Pipeline', icon: '📊' },
    ],
  },
  ...SHARED_SECTIONS,
];

export default function Sidebar({ user, onSignOut }) {
  const { data: tasks } = useCollection('tasks');
  const { data: views } = useCollection('views');
  const { data: reviewItems } = useCollection('dedupReviewQueue', {
    filters: [['status', '==', 'pending']],
  });
  const { id: workspaceId, switchTo, workspace } = useWorkspace();
  const sections = workspaceId === 'deal_flow' ? SECTIONS_DEAL_FLOW : SECTIONS_CRM;
  const badges = {
    // Research + work are now platform-level, so counts are across both workspaces.
    overdueTasks: tasks.filter((t) => isOverdue(t)).length,
    reviewAll: (reviewItems || []).length,
  };
  const pinnedViews = (views || [])
    .filter((v) => v.pinned !== false && (!v.workspace || v.workspace === workspaceId))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '4px 0 16px 6px' }}>
        <img
          src="/aa-logo.png"
          alt="Autopilot Accounting"
          style={{ width: 64, height: 64, flexShrink: 0, objectFit: 'contain' }}
        />
        <h1 style={{
          fontSize: 24,
          fontWeight: 700,
          margin: 0,
          letterSpacing: '-0.01em',
          fontFamily: `'PT Serif', Georgia, 'Times New Roman', serif`,
          lineHeight: 1,
          WebkitTextStroke: '0.5px currentColor',
        }}>
          <span style={{ color: '#000000' }}>Autopilot</span>{' '}
          <span style={{ color: '#2E48AE' }}>Accounting</span>
        </h1>
      </div>

      <WorkspaceToggle currentId={workspaceId} onSwitch={switchTo} />

      {sections.map((section, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          {section.label && (
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 10px 4px' }}>
              {section.label}
            </div>
          )}
          {section.items.map((item) => {
            const badge = item.badgeKey ? badges[item.badgeKey] : 0;
            const badgeBg = item.badgeTone === 'warning' ? COLORS.warning : COLORS.danger;
            return (
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
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge > 0 && (
                  <span style={{ background: badgeBg, color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, minWidth: 16, textAlign: 'center' }}>{badge}</span>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}

      {pinnedViews.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 10px 4px' }}>
            Pinned Views
          </div>
          {pinnedViews.map((v) => <PinnedViewLink key={v.id} view={v} />)}
        </div>
      )}

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

function WorkspaceToggle({ currentId, onSwitch }) {
  return (
    <div style={{ display: 'flex', padding: 3, background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, margin: '0 6px 12px', gap: 2 }}>
      {Object.values(WORKSPACES).map((ws) => {
        const active = ws.id === currentId;
        return (
          <button key={ws.id} onClick={() => onSwitch(ws.id)}
            title={ws.subtitle}
            style={{
              flex: 1,
              padding: '7px 8px',
              border: 'none',
              borderRadius: 6,
              background: active ? COLORS.card : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              color: active ? COLORS.text : COLORS.textMuted,
              fontWeight: active ? 700 : 500,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.12s',
            }}>
            <span style={{ fontSize: 13 }}>{ws.icon}</span>
            <span>{ws.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PinnedViewLink({ view }) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const route = viewRoute(view);
  const hasHover = useHasHover();
  const icon = VIEW_OBJECT_ICONS[view.object_type] || '⭐';
  if (!route) return null;

  const open = () => {
    const filters = parseFilters(view);
    const qs = encodeFiltersToSearch(filters);
    const href = qs ? `${route}?${qs}&view=${view.id}` : `${route}?view=${view.id}`;
    navigate(href);
  };

  const remove = async (e) => {
    e.stopPropagation();
    const ok = await confirm({ title: `Remove pinned view "${view.name}"?`, confirmLabel: 'Remove', destructive: true });
    if (!ok) return;
    await deleteView(view.id);
  };

  return (
    <div onClick={open}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', color: COLORS.text, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
      onMouseEnter={(e) => e.currentTarget.style.background = COLORS.primaryLight}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{view.name}</span>
      <button onClick={remove}
        title="Unpin view"
        aria-label={`Unpin ${view.name}`}
        style={{
          background: 'none',
          border: 'none',
          color: COLORS.textMuted,
          cursor: 'pointer',
          fontSize: 11,
          // Touch devices get a wider, fully-opaque hit area; pointer devices
          // keep the original subtle hover-only treatment.
          padding: hasHover ? '2px 4px' : '8px 10px',
          opacity: hasHover ? 0.6 : 1,
        }}>
        ✕
      </button>
    </div>
  );
}
