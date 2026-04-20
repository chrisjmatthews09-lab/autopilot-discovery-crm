import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { useCollection } from '../hooks/useCollection';
import { batchWrite, listDocs } from '../data/firestore';
import { DEFAULT_SCRIPTS } from '../data/defaultScripts';
import ScriptEditor from './ScriptEditor';

const SCRIPT_TYPES = [
  { id: 'biz', label: 'Business Owner', hint: 'CRM — business clients' },
  { id: 'pro', label: 'Practitioner', hint: 'Deal Flow — accounting firms' },
];

export default function Scripts({ ScriptPage, contacts }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'pro' ? 'pro' : 'biz';
  const [scriptType, setScriptType] = useState(initialType);
  const [mode, setMode] = useState('run');
  const [seeding, setSeeding] = useState(false);
  const { data: scripts, loading } = useCollection('scripts');

  const script = scripts.find((s) => s.type === scriptType || s.id === scriptType);

  useEffect(() => {
    const current = searchParams.get('type');
    if (current !== scriptType) {
      const next = new URLSearchParams(searchParams);
      next.set('type', scriptType);
      setSearchParams(next, { replace: true });
    }
  }, [scriptType]);

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

  return (
    <div>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 24, color: COLORS.text }}>Scripts</h1>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>Pick a script for this interview.</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ToggleBtn active={mode === 'run'} onClick={() => setMode('run')}>▶ Run</ToggleBtn>
          <ToggleBtn active={mode === 'edit'} onClick={() => setMode('edit')}>✎ Edit</ToggleBtn>
        </div>
      </div>

      <div style={{ padding: '14px 20px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SCRIPT_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setScriptType(t.id)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: `1px solid ${scriptType === t.id ? COLORS.primary : COLORS.border}`,
              background: scriptType === t.id ? COLORS.primary : COLORS.card,
              color: scriptType === t.id ? '#fff' : COLORS.text,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 2,
              minWidth: 180,
            }}
          >
            <span>{t.label}</span>
            <span style={{ fontSize: 10, fontWeight: 400, color: scriptType === t.id ? 'rgba(255,255,255,0.85)' : COLORS.textMuted }}>
              {t.hint}
            </span>
          </button>
        ))}
      </div>

      {(loading || seeding) && !script && <div style={{ padding: 20, color: COLORS.textDim }}>Loading script…</div>}
      {!loading && !seeding && !script && <div style={{ padding: 20, color: COLORS.textDim }}>No {scriptType === 'biz' ? 'business owner' : 'practitioner'} script found.</div>}
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
