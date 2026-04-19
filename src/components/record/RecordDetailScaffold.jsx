import React, { useState } from 'react';
import { COLORS, BREAKPOINT_MOBILE } from '../../config/design-tokens';
import { useWindowWidth } from '../../hooks/useWindowWidth';

export default function RecordDetailScaffold({ leftPanel, tabs = [], rightPanel, defaultTab }) {
  const width = useWindowWidth();
  const isMobile = width < BREAKPOINT_MOBILE;

  const [activeTab, setActiveTab] = useState(defaultTab || (tabs[0] && tabs[0].id));
  const [rightSheetOpen, setRightSheetOpen] = useState(false);

  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];

  if (isMobile) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
          {leftPanel}
        </div>

        {tabs.length > 0 && (
          <>
            <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, overflowX: 'auto', marginBottom: 12 }}>
              {tabs.map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  style={{ padding: '10px 14px', border: 'none', borderBottom: `2px solid ${activeTab === t.id ? COLORS.accent : 'transparent'}`, background: 'none', color: activeTab === t.id ? COLORS.text : COLORS.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400, whiteSpace: 'nowrap' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div>{currentTab && currentTab.content}</div>
          </>
        )}

        {rightPanel && (
          <>
            <button onClick={() => setRightSheetOpen(true)}
              style={{ marginTop: 16, padding: '10px 14px', width: '100%', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              Show Related ↑
            </button>
            {rightSheetOpen && (
              <div onClick={() => setRightSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}>
                <div onClick={(e) => e.stopPropagation()}
                  style={{ position: 'absolute', bottom: 60, left: 0, right: 0, background: COLORS.card, padding: 16, borderRadius: '14px 14px 0 0', maxHeight: '75vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Related</div>
                    <button onClick={() => setRightSheetOpen(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: COLORS.textMuted }}>×</button>
                  </div>
                  {rightPanel}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `250px 1fr ${rightPanel ? '320px' : '0px'}`, gap: 16, padding: 20, alignItems: 'start' }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16, position: 'sticky', top: 16 }}>
        {leftPanel}
      </div>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {tabs.length > 0 && (
          <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.cardAlt, overflowX: 'auto' }}>
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ padding: '12px 18px', border: 'none', borderBottom: `2px solid ${activeTab === t.id ? COLORS.accent : 'transparent'}`, background: 'none', color: activeTab === t.id ? COLORS.text : COLORS.textMuted, cursor: 'pointer', fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400, whiteSpace: 'nowrap' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ padding: 20 }}>{currentTab && currentTab.content}</div>
      </div>

      {rightPanel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 16 }}>
          {rightPanel}
        </div>
      )}
    </div>
  );
}
