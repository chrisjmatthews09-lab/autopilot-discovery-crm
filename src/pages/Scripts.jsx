import React, { useState } from 'react';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { useCollection } from '../hooks/useCollection';
import ScriptEditor from './ScriptEditor';

export default function Scripts({ ScriptPage, contacts }) {
  const [scriptType, setScriptType] = useState('pro');
  const [mode, setMode] = useState('run');
  const { data: scripts, loading } = useCollection('scripts');

  const script = scripts.find((s) => s.type === scriptType || s.id === scriptType);

  return (
    <div>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 24, color: COLORS.text }}>Scripts</h1>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ToggleBtn active={scriptType === 'pro'} onClick={() => setScriptType('pro')}>📝 PRO Script</ToggleBtn>
          <ToggleBtn active={scriptType === 'biz'} onClick={() => setScriptType('biz')}>📝 BIZ Script</ToggleBtn>
          <span style={{ width: 1, background: COLORS.border, margin: '0 4px' }} />
          <ToggleBtn active={mode === 'run'} onClick={() => setMode('run')}>▶ Run</ToggleBtn>
          <ToggleBtn active={mode === 'edit'} onClick={() => setMode('edit')}>✎ Edit</ToggleBtn>
        </div>
      </div>
      {loading && !script && <div style={{ padding: 20, color: COLORS.textDim }}>Loading script…</div>}
      {!loading && !script && <div style={{ padding: 20, color: COLORS.textDim }}>No script found for "{scriptType}".</div>}
      {script && mode === 'run' && <ScriptPage contacts={contacts} scriptType={scriptType} script={script} />}
      {script && mode === 'edit' && <ScriptEditor script={script} />}
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
