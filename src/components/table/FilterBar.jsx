import React, { useState } from 'react';
import { COLORS } from '../../config/design-tokens';

export default function FilterBar({ search, onSearchChange, searchPlaceholder = 'Search…', multiSelects = [], toggles = [], rightSlot }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: 12, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 12 }}>
      <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
        <input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder}
          style={{ width: '100%', padding: '8px 10px 8px 28px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13 }} />
        <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
      </div>
      {multiSelects.map((ms) => (
        <MultiSelect key={ms.key} label={ms.label} options={ms.options} value={ms.value} onChange={ms.onChange} renderOption={ms.renderOption} />
      ))}
      {toggles.map((t) => (
        <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORS.text, cursor: 'pointer' }}>
          <input type="checkbox" checked={t.value} onChange={(e) => t.onChange(e.target.checked)} />
          {t.label}
        </label>
      ))}
      {rightSlot}
    </div>
  );
}

function MultiSelect({ label, options, value, onChange, renderOption }) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value || []);

  const toggle = (opt) => {
    const next = new Set(selected);
    if (next.has(opt)) next.delete(opt);
    else next.add(opt);
    onChange(Array.from(next));
  };

  const summary = selected.size === 0 ? label : selected.size === 1 ? Array.from(selected)[0] : `${label} (${selected.size})`;

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ padding: '7px 12px', border: `1px solid ${selected.size > 0 ? COLORS.primary : COLORS.border}`, borderRadius: 6, background: selected.size > 0 ? COLORS.primaryLight : COLORS.cardAlt, color: COLORS.text, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
        {summary} ▾
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 6, minWidth: 180, maxHeight: 280, overflowY: 'auto', zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {selected.size > 0 && (
              <button onClick={() => onChange([])}
                style={{ display: 'block', width: '100%', padding: '6px 10px', background: 'none', border: 'none', textAlign: 'left', color: COLORS.textMuted, fontSize: 11, cursor: 'pointer', borderBottom: `1px solid ${COLORS.border}`, marginBottom: 4 }}>
                Clear all
              </button>
            )}
            {options.map((opt) => {
              const val = typeof opt === 'object' ? opt.value : opt;
              const isOn = selected.has(val);
              return (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 12, borderRadius: 4, background: isOn ? COLORS.primaryLight : 'transparent' }}>
                  <input type="checkbox" checked={isOn} onChange={() => toggle(val)} />
                  {renderOption ? renderOption(opt) : (typeof opt === 'object' ? opt.label : opt)}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
