import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { COLORS, MOBILE_NAV_HEIGHT } from '../../config/design-tokens';
import { useWorkspace } from '../../hooks/useWorkspace';
import { WORKSPACES } from '../../config/workspaces';

const NAV_CRM = {
  primary: [
    { to: '/crm', label: 'Home', icon: '🏠', end: true },
    { to: '/crm/people', label: 'People', icon: '👥' },
    { to: '/crm/deals', label: 'Deals', icon: '💼' },
    { to: '/crm/tasks', label: 'Tasks', icon: '✅' },
  ],
  more: [
    { to: '/crm/companies', label: 'Companies', icon: '🏢' },
    { to: '/crm/interviews', label: 'Interviews', icon: '🎙️' },
    { to: '/crm/board', label: 'Board', icon: '📊' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ],
};

const NAV_DEAL_FLOW = {
  primary: [
    { to: '/deal-flow', label: 'Home', icon: '🏠', end: true },
    { to: '/deal-flow/targets', label: 'Targets', icon: '🎯' },
    { to: '/deal-flow/referrals', label: 'Referrals', icon: '🤝' },
    { to: '/deal-flow/interviews', label: 'Interviews', icon: '🎙️' },
  ],
  more: [
    { to: '/deal-flow/practitioners', label: 'Practitioners', icon: '👥' },
    { to: '/deal-flow/firms', label: 'Firms', icon: '🏢' },
    { to: '/deal-flow/referrals/pipeline', label: 'Referral Pipeline', icon: '📊' },
    { to: '/deal-flow/insights', label: 'Insights', icon: '🧠' },
    { to: '/deal-flow/scripts', label: 'Scripts', icon: '📝' },
    { to: '/deal-flow/tasks', label: 'Tasks', icon: '✅' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ],
};

export default function MobileNav({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { id: workspaceId, switchTo } = useWorkspace();
  const config = workspaceId === 'deal_flow' ? NAV_DEAL_FLOW : NAV_CRM;

  return (
    <>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 199 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', bottom: MOBILE_NAV_HEIGHT, left: 0, right: 0, background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, padding: 16, borderRadius: '14px 14px 0 0', maxHeight: '60vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 10 }}>Workspace</div>
            <div style={{ display: 'flex', padding: 3, background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 14, gap: 2 }}>
              {Object.values(WORKSPACES).map((ws) => {
                const active = ws.id === workspaceId;
                return (
                  <button key={ws.id} onClick={() => { switchTo(ws.id); setOpen(false); }}
                    style={{ flex: 1, padding: '8px 10px', border: 'none', borderRadius: 6, background: active ? COLORS.card : 'transparent', color: active ? COLORS.text : COLORS.textMuted, fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
                    {ws.icon} {ws.label}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 10 }}>More</div>
            {config.more.map((item) => (
              <button key={item.to}
                onClick={() => { navigate(item.to); setOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', width: '100%', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, color: COLORS.text, textAlign: 'left' }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
            {user && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 11, color: COLORS.textMuted, padding: '0 10px 8px', wordBreak: 'break-all' }}>{user.email}</div>
                {onSignOut && (
                  <button onClick={() => { setOpen(false); onSignOut(); }}
                    style={{ padding: '10px 10px', background: 'none', color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, width: '100%', textAlign: 'left' }}>
                    Sign out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: MOBILE_NAV_HEIGHT,
          background: COLORS.sidebar,
          borderTop: `1px solid ${COLORS.border}`,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 100,
        }}
      >
        {config.primary.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end}
            style={({ isActive }) => ({ flex: 1, height: '100%', color: isActive ? COLORS.primary : COLORS.textMuted, textDecoration: 'none', fontSize: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontWeight: isActive ? 600 : 400 })}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <button onClick={() => setOpen((v) => !v)}
          style={{ flex: 1, height: '100%', background: 'none', border: 'none', color: open ? COLORS.primary : COLORS.textMuted, cursor: 'pointer', fontSize: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontWeight: open ? 600 : 400 }}>
          <span style={{ fontSize: 18 }}>⋯</span>
          More
        </button>
      </nav>
    </>
  );
}
