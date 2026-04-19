import React, { useState } from 'react';
import { COLORS, DISPLAY } from '../config/design-tokens';

export default function Scripts({ ScriptPage, contacts }) {
  const [scriptType, setScriptType] = useState('pro');

  return (
    <div>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 24, color: COLORS.text }}>Scripts</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <ToggleBtn active={scriptType === 'pro'} onClick={() => setScriptType('pro')}>
            📝 PRO Script
          </ToggleBtn>
          <ToggleBtn active={scriptType === 'biz'} onClick={() => setScriptType('biz')}>
            📝 BIZ Script
          </ToggleBtn>
        </div>
      </div>
      <ScriptPage contacts={contacts} scriptType={scriptType} />
    </div>
  );
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${active ? COLORS.primary : COLORS.border}`, background: active ? COLORS.primary : 'transparent', color: active ? '#fff' : COLORS.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
      {children}
    </button>
  );
}
