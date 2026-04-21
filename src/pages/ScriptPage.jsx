import React, { useState } from 'react';
import { COLORS } from '../config/design-tokens';
import { useConfirm } from '../components/ui/ConfirmDialog';

export default function ScriptPage({ contacts, scriptType, script }) {
  const confirm = useConfirm();
  if (!script) return null;
  const resolveColor = (k) => COLORS[k] || k || COLORS.primary;
  const [checkedQs, setCheckedQs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('autopilot-checklist') || '{}'); } catch { return {}; }
  });

  const toggleCheck = (key) => {
    const newChecked = { ...checkedQs, [key]: !checkedQs[key] };
    setCheckedQs(newChecked);
    localStorage.setItem('autopilot-checklist', JSON.stringify(newChecked));
  };

  const clearProgress = async () => {
    const ok = await confirm({ title: 'Clear all checklist progress?', confirmLabel: 'Clear', destructive: true });
    if (ok) {
      setCheckedQs({});
      localStorage.removeItem('autopilot-checklist');
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: COLORS.text, margin: 0 }}>{scriptType === 'pro' ? 'Professional' : 'Business'} Script</h2>
        <button onClick={clearProgress} style={{ padding: '8px 12px', backgroundColor: COLORS.danger, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Clear Progress</button>
      </div>
      <div style={{ backgroundColor: COLORS.card, padding: 20, borderRadius: 4, border: `1px solid ${COLORS.border}` }}>
        {script.sections.map((section, sectionIdx) => (
          <div key={section.id || sectionIdx} style={{ marginBottom: 28 }}>
            <h3 style={{ color: resolveColor(section.color), fontWeight: 700, marginBottom: 12, fontSize: 17 }}>{section.name}</h3>
            {section.questions.map((question, qIdx) => {
              const key = `${scriptType}-${sectionIdx}-${qIdx}`;
              const isChecked = checkedQs[key];
              return (
                <label key={qIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', color: COLORS.text, fontSize: 15, lineHeight: 1.6, marginBottom: 12, padding: 10, backgroundColor: isChecked ? COLORS.bg : 'transparent', borderRadius: 4, textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1, border: `1px solid ${COLORS.border}` }}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(key)} style={{ marginTop: 4, cursor: 'pointer', accentColor: COLORS.accent }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{question.q}</div>
                    <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>{question.why}</div>
                  </div>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
