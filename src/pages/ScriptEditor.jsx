import React, { useState, useEffect } from 'react';
import { COLORS } from '../config/design-tokens';
import { updateDoc } from '../data/firestore';
import { useConfirm } from '../components/ui/ConfirmDialog';

const COLOR_KEYS = ['primary', 'accent', 'blue', 'purple', 'gold'];
const resolveColor = (k) => COLORS[k] || k || COLORS.primary;
const newId = (p) => `${p}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export default function ScriptEditor({ script }) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState(script);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [dirty, setDirty] = useState(false);
  const [dragging, setDragging] = useState(null);

  useEffect(() => { setDraft(script); setDirty(false); }, [script.id]);

  const update = (patch) => { setDraft((d) => ({ ...d, ...patch })); setDirty(true); };
  const updateSection = (sid, patch) => update({ sections: draft.sections.map((s) => s.id === sid ? { ...s, ...patch } : s) });
  const updateQuestion = (sid, qid, patch) => update({
    sections: draft.sections.map((s) => s.id === sid ? { ...s, questions: s.questions.map((q) => q.id === qid ? { ...q, ...patch } : q) } : s),
  });

  const addSection = () => update({ sections: [...draft.sections, { id: newId('s'), name: 'New Section', color: 'primary', questions: [] }] });
  const removeSection = async (sid) => {
    const ok = await confirm({ title: 'Delete this section and all its questions?', confirmLabel: 'Delete', destructive: true });
    if (ok) update({ sections: draft.sections.filter((s) => s.id !== sid) });
  };
  const moveSection = (sid, dir) => {
    const i = draft.sections.findIndex((s) => s.id === sid);
    const j = i + dir;
    if (j < 0 || j >= draft.sections.length) return;
    const next = [...draft.sections];
    [next[i], next[j]] = [next[j], next[i]];
    update({ sections: next });
  };

  const addQuestion = (sid) => updateSection(sid, { questions: [...draft.sections.find((s) => s.id === sid).questions, { id: newId('q'), q: 'New question?', why: '' }] });
  const removeQuestion = (sid, qid) => updateSection(sid, { questions: draft.sections.find((s) => s.id === sid).questions.filter((q) => q.id !== qid) });
  const moveQuestion = (sid, qid, dir) => {
    const section = draft.sections.find((s) => s.id === sid);
    const i = section.questions.findIndex((q) => q.id === qid);
    const j = i + dir;
    if (j < 0 || j >= section.questions.length) return;
    const next = [...section.questions];
    [next[i], next[j]] = [next[j], next[i]];
    updateSection(sid, { questions: next });
  };

  // HTML5 drag-drop for sections
  const onSectionDragStart = (sid) => setDragging({ kind: 'section', sid });
  const onSectionDrop = (targetSid) => {
    if (!dragging || dragging.kind !== 'section' || dragging.sid === targetSid) { setDragging(null); return; }
    const from = draft.sections.findIndex((s) => s.id === dragging.sid);
    const to = draft.sections.findIndex((s) => s.id === targetSid);
    const next = [...draft.sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update({ sections: next });
    setDragging(null);
  };

  // HTML5 drag-drop for questions within a section
  const onQuestionDragStart = (sid, qid) => setDragging({ kind: 'question', sid, qid });
  const onQuestionDrop = (sid, targetQid) => {
    if (!dragging || dragging.kind !== 'question' || dragging.sid !== sid || dragging.qid === targetQid) { setDragging(null); return; }
    const section = draft.sections.find((s) => s.id === sid);
    const from = section.questions.findIndex((q) => q.id === dragging.qid);
    const to = section.questions.findIndex((q) => q.id === targetQid);
    const next = [...section.questions];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateSection(sid, { questions: next });
    setDragging(null);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const { id, ...data } = draft;
      await updateDoc('scripts', id, data);
      setSaveStatus('saved');
      setDirty(false);
      setTimeout(() => setSaveStatus('idle'), 1800);
    } catch (err) {
      console.error('Failed to save script', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  const handleReset = async () => {
    const ok = await confirm({ title: 'Discard unsaved changes?', confirmLabel: 'Discard', destructive: true });
    if (ok) { setDraft(script); setDirty(false); }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 18, marginBottom: 16 }}>
        <label style={labelStyle}>Title</label>
        <input value={draft.title || ''} onChange={(e) => update({ title: e.target.value })} style={inputStyle} />
        <label style={{ ...labelStyle, marginTop: 14 }}>Intro</label>
        <textarea value={draft.intro || ''} onChange={(e) => update({ intro: e.target.value })} style={{ ...inputStyle, minHeight: 80, fontFamily: 'inherit' }} />
      </div>

      {draft.sections.map((section, si) => (
        <div key={section.id}
          draggable
          onDragStart={() => onSectionDragStart(section.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onSectionDrop(section.id)}
          style={{ background: COLORS.card, border: `2px solid ${dragging && dragging.kind === 'section' && dragging.sid === section.id ? COLORS.primary : COLORS.border}`, borderLeft: `6px solid ${resolveColor(section.color)}`, borderRadius: 8, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span title="Drag to reorder" style={{ cursor: 'grab', color: COLORS.textDim, fontSize: 16 }}>⋮⋮</span>
            <input value={section.name} onChange={(e) => updateSection(section.id, { name: e.target.value })}
              style={{ ...inputStyle, flex: 1, fontSize: 15, fontWeight: 700, color: resolveColor(section.color) }} />
            <select value={section.color} onChange={(e) => updateSection(section.id, { color: e.target.value })}
              style={{ ...inputStyle, width: 100 }}>
              {COLOR_KEYS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => moveSection(section.id, -1)} disabled={si === 0} style={iconBtn} title="Move up">↑</button>
            <button onClick={() => moveSection(section.id, 1)} disabled={si === draft.sections.length - 1} style={iconBtn} title="Move down">↓</button>
            <button onClick={() => removeSection(section.id)} style={{ ...iconBtn, color: COLORS.danger }} title="Delete section">✕</button>
          </div>

          {section.questions.map((q, qi) => (
            <div key={q.id}
              draggable
              onDragStart={(e) => { e.stopPropagation(); onQuestionDragStart(section.id, q.id); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => { e.stopPropagation(); onQuestionDrop(section.id, q.id); }}
              style={{ border: `1px solid ${dragging && dragging.kind === 'question' && dragging.qid === q.id ? COLORS.primary : COLORS.border}`, background: COLORS.cardAlt, borderRadius: 6, padding: 10, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span title="Drag to reorder" style={{ cursor: 'grab', color: COLORS.textDim, fontSize: 14, paddingTop: 6 }}>⋮⋮</span>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input value={q.q} onChange={(e) => updateQuestion(section.id, q.id, { q: e.target.value })}
                    placeholder="Question" style={{ ...inputStyle, fontWeight: 500 }} />
                  <input value={q.why || ''} onChange={(e) => updateQuestion(section.id, q.id, { why: e.target.value })}
                    placeholder="Why this question matters…" style={{ ...inputStyle, fontSize: 12, color: COLORS.textDim }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => moveQuestion(section.id, q.id, -1)} disabled={qi === 0} style={iconBtn} title="Move up">↑</button>
                  <button onClick={() => moveQuestion(section.id, q.id, 1)} disabled={qi === section.questions.length - 1} style={iconBtn} title="Move down">↓</button>
                  <button onClick={() => removeQuestion(section.id, q.id)} style={{ ...iconBtn, color: COLORS.danger }} title="Delete question">✕</button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => addQuestion(section.id)} style={addBtn}>+ Add question</button>
        </div>
      ))}

      <button onClick={addSection} style={{ ...addBtn, width: '100%', padding: '12px', fontSize: 14 }}>+ Add section</button>

      <div style={{ position: 'sticky', bottom: 0, background: COLORS.bg, padding: '14px 0', marginTop: 20, borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={handleSave} disabled={!dirty || saveStatus === 'saving'}
          style={{ padding: '10px 20px', background: dirty ? COLORS.success : COLORS.border, color: '#fff', border: 'none', borderRadius: 6, cursor: dirty && saveStatus !== 'saving' ? 'pointer' : 'not-allowed', fontWeight: 600 }}>
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? '✗ Retry' : 'Save changes'}
        </button>
        <button onClick={handleReset} disabled={!dirty}
          style={{ padding: '10px 16px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: dirty ? 'pointer' : 'not-allowed' }}>
          Reset
        </button>
        {dirty && <span style={{ fontSize: 12, color: COLORS.warning }}>Unsaved changes</span>}
      </div>
    </div>
  );
}

const inputStyle = { padding: '7px 9px', border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: 13, background: COLORS.card, color: COLORS.text, width: '100%', boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 5 };
const iconBtn = { padding: '4px 8px', border: `1px solid ${COLORS.border}`, background: COLORS.card, borderRadius: 4, cursor: 'pointer', fontSize: 12, color: COLORS.textMuted };
const addBtn = { padding: '6px 12px', background: 'transparent', color: COLORS.primary, border: `1px dashed ${COLORS.primary}`, borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginTop: 4 };
