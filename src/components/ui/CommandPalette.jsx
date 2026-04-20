import React, { useEffect, useMemo, useState, useRef } from 'react';
import Fuse from 'fuse.js';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '../../config/design-tokens';
import { useWorkspace } from '../../hooks/useWorkspace';
import { personPath, companyPath, interviewPath } from '../../config/workspaces';

const NAV_CRM = [
  { id: 'nav-crm-dashboard', label: 'Dashboard', icon: '🏠', path: '/crm', type: 'nav' },
  { id: 'nav-crm-people', label: 'People', icon: '👥', path: '/crm/people', type: 'nav' },
  { id: 'nav-crm-companies', label: 'Companies', icon: '🏢', path: '/crm/companies', type: 'nav' },
  { id: 'nav-crm-interviews', label: 'Interviews', icon: '🎙', path: '/crm/interviews', type: 'nav' },
  { id: 'nav-crm-deals', label: 'Deals', icon: '💼', path: '/crm/deals', type: 'nav' },
  { id: 'nav-crm-board', label: 'Board', icon: '📊', path: '/crm/board', type: 'nav' },
  { id: 'nav-crm-tasks', label: 'Tasks', icon: '✅', path: '/crm/tasks', type: 'nav' },
];

const NAV_DEAL_FLOW = [
  { id: 'nav-df-dashboard', label: 'Dashboard', icon: '🏠', path: '/deal-flow', type: 'nav' },
  { id: 'nav-df-practitioners', label: 'Practitioners', icon: '👥', path: '/deal-flow/practitioners', type: 'nav' },
  { id: 'nav-df-firms', label: 'Firms', icon: '🏢', path: '/deal-flow/firms', type: 'nav' },
  { id: 'nav-df-targets', label: 'Targets', icon: '🎯', path: '/deal-flow/targets', type: 'nav' },
  { id: 'nav-df-referrals', label: 'Referral Partners', icon: '🤝', path: '/deal-flow/referrals', type: 'nav' },
  { id: 'nav-df-referral-pipeline', label: 'Referral Pipeline', icon: '📊', path: '/deal-flow/referrals/pipeline', type: 'nav' },
  { id: 'nav-df-interviews', label: 'Interviews', icon: '🎙', path: '/deal-flow/interviews', type: 'nav' },
  { id: 'nav-df-insights', label: 'Insights', icon: '🧠', path: '/deal-flow/insights', type: 'nav' },
  { id: 'nav-df-scripts', label: 'Scripts', icon: '📝', path: '/deal-flow/scripts', type: 'nav' },
  { id: 'nav-df-tasks', label: 'Tasks', icon: '✅', path: '/deal-flow/tasks', type: 'nav' },
];

const NAV_SETTINGS = { id: 'nav-settings', label: 'Settings', icon: '⚙️', path: '/settings', type: 'nav' };

export default function CommandPalette({ open, onClose, people = [], companies = [], interviews = [] }) {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [global, setGlobal] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const { id: workspaceId } = useWorkspace();

  // Records in this workspace unless Shift-held search is active.
  const inWorkspace = (row, fallback) => global || (row.workspace || fallback) === workspaceId;

  const items = useMemo(() => {
    const navs = workspaceId === 'deal_flow' ? NAV_DEAL_FLOW : NAV_CRM;
    return [
      ...navs,
      NAV_SETTINGS,
      ...people.filter((p) => inWorkspace(p, 'deal_flow')).map((p) => ({ id: `p-${p.id}`, label: p.name || '(unnamed)', sub: p.company || '', icon: '👤', path: personPath(p), type: p.workspace === 'deal_flow' ? 'practitioner' : 'person', searchText: [p.name, p.company, p.email, p.role].filter(Boolean).join(' ') })),
      ...companies.filter((c) => inWorkspace(c, 'crm')).map((c) => ({ id: `c-${c.id}`, label: c.name || c.company || '(unnamed)', sub: c.industry || '', icon: '🏢', path: companyPath(c), type: c.workspace === 'deal_flow' ? 'firm' : 'company', searchText: [c.name, c.company, c.industry, c.domain, c.website].filter(Boolean).join(' ') })),
      ...interviews.filter((i) => inWorkspace(i, 'deal_flow')).map((i) => ({ id: `i-${i.id}`, label: i.intervieweeName || i.intervieweeBusinessName || 'Interview', sub: i.interviewDate || '', icon: '🎙', path: interviewPath(i), type: 'interview', searchText: [i.intervieweeName, i.intervieweeBusinessName, i.interviewDate].filter(Boolean).join(' ') })),
    ];
  }, [people, companies, interviews, workspaceId, global]);

  const fuse = useMemo(() => new Fuse(items, {
    keys: ['label', 'sub', 'searchText'],
    threshold: 0.4,
    ignoreLocation: true,
  }), [items]);

  const results = useMemo(() => {
    if (!query) return items.slice(0, 30);
    return fuse.search(query).slice(0, 30).map((r) => r.item);
  }, [query, fuse, items]);

  useEffect(() => { setActiveIdx(0); }, [query, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') {
        const sel = results[activeIdx];
        if (sel) { navigate(sel.path); onClose(); setQuery(''); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, activeIdx, navigate, onClose]);

  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.card, borderRadius: 12, width: '90%', maxWidth: 560, maxHeight: '70vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={global ? 'Search all workspaces…' : `Search ${workspaceId === 'deal_flow' ? 'Deal Flow' : 'CRM'}…`}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: COLORS.text, background: 'transparent' }} />
          <button onClick={() => setGlobal((v) => !v)}
            title={global ? 'Search limited to current workspace' : 'Search all workspaces'}
            style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, border: `1px solid ${global ? COLORS.primary : COLORS.border}`, borderRadius: 4, background: global ? COLORS.primary : 'transparent', color: global ? '#fff' : COLORS.textMuted, cursor: 'pointer' }}>
            {global ? 'GLOBAL' : 'WORKSPACE'}
          </button>
          <kbd style={{ fontSize: 10, padding: '2px 6px', border: `1px solid ${COLORS.border}`, borderRadius: 3, color: COLORS.textDim }}>esc</kbd>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {results.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: COLORS.textDim, fontSize: 13 }}>No matches</div>
          ) : (
            results.map((item, idx) => (
              <div key={item.id} onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => { navigate(item.path); onClose(); setQuery(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6, cursor: 'pointer', background: idx === activeIdx ? COLORS.primaryLight : 'transparent' }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                  {item.sub && <div style={{ fontSize: 11, color: COLORS.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>}
                </div>
                <span style={{ fontSize: 10, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.type}</span>
              </div>
            ))
          )}
        </div>
        <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: '8px 12px', fontSize: 11, color: COLORS.textDim, display: 'flex', gap: 14 }}>
          <span>↑↓ navigate</span>
          <span>⏎ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
