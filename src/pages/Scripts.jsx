import React, { useEffect, useState } from 'react';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { useCollection } from '../hooks/useCollection';
import { batchWrite, listDocs } from '../data/firestore';
import { DEFAULT_SCRIPTS } from '../data/defaultScripts';
import ScriptEditor from './ScriptEditor';

export default function Scripts({ ScriptPage, contacts, workspace = 'deal_flow' }) {
  const scriptType = workspace === 'crm' ? 'biz' : 'pro';
  const [mode, setMode] = useState('run');
  const [seeding, setSeeding] = useState(false);
  const { data: scripts, loading } = useCollection('scripts');

  const script = scripts.find((s) => s.type === scriptType || s.id === scriptType);

  // Self-heal: if Firestore has no scripts at all (e.g. collection was wiped),
  // re-seed from the bundled defaults so the page is never "empty forever".
  useEffect(() => {
    if (loading || seeding) return;
    if (scripts.length > 0) return;
    (async () => {
      setSeeding(true);
      try {
        const existing = await listDocs('scripts');
        if (existing.length === 0) {
          const ops = DEFAULT_SCRIPTS.map((s) => ({ type: 'set', collection: 'scripts', id: s.id, data: s }));
          await batchWrite(ops);
        }
      } catch (err) {
        console.error('Scripts re-seed failed', err);
      } finally {
        setSeeding(false);
      }
    })();
  }, [loading, scripts.length, seeding]);

  const scriptLabel = scriptType === 'biz' ? 'Business Owner Script' : 'Practitioner Script';

  return (
    <div>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 24, color: COLORS.text }}>Scripts</h1>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>{scriptLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ToggleBtn active={mode === 'run'} onClick={() => setMode('run')}>▶ Run</ToggleBtn>
          <ToggleBtn active={mode === 'edit'} onClick={() => setMode('edit')}>✎ Edit</ToggleBtn>
        </div>
      </div>
      {(loading || seeding) && !script && <div style={{ padding: 20, color: COLORS.textDim }}>Loading script…</div>}
      {!loading && !seeding && !script && <div style={{ padding: 20, color: COLORS.textDim }}>No {scriptLabel.toLowerCase()} found.</div>}
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
