import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { V2_SCHEMA } from './ContactPage';

export default function PipelinePage({ people, companies, onUpdateStatus }) {
  const navigate = useNavigate();
  const [kind, setKind] = useState('person');
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const cfg = V2_SCHEMA[kind];
  const rows = kind === 'company' ? companies : people;
  const basePath = kind === 'company' ? '/crm/companies' : '/crm/people';

  const columns = cfg.statusOptions;
  const grouped = columns.reduce((acc, s) => {
    acc[s] = rows.filter((r) => (r.status || 'new') === s);
    return acc;
  }, {});

  const onDrop = async (status) => {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    const row = rows.find((r) => r.id === id);
    if (!row || (row.status || 'new') === status) return;
    await onUpdateStatus(kind, id, status);
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: COLORS.text, fontFamily: DISPLAY, fontSize: 24 }}>
          📊 Pipeline
        </h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setKind('person')}
            style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${kind === 'person' ? COLORS.primary : COLORS.border}`, background: kind === 'person' ? COLORS.primary : 'transparent', color: kind === 'person' ? '#fff' : COLORS.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            👥 People
          </button>
          <button onClick={() => setKind('company')}
            style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${kind === 'company' ? COLORS.primary : COLORS.border}`, background: kind === 'company' ? COLORS.primary : 'transparent', color: kind === 'company' ? '#fff' : COLORS.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            🏢 Companies
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))`, gap: 12, overflowX: 'auto' }}>
        {columns.map((status) => (
          <div key={status}
            onDragOver={(e) => { e.preventDefault(); setOverCol(status); }}
            onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
            onDrop={() => onDrop(status)}
            style={{ background: overCol === status ? COLORS.cardAlt : COLORS.card, borderRadius: 10, border: `1px solid ${overCol === status ? COLORS.primary : COLORS.border}`, padding: 10, minHeight: 200, transition: 'background 0.1s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
              <div style={{ textTransform: 'capitalize', fontSize: 12, fontWeight: 700, color: COLORS.text }}>{status}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.cardAlt, padding: '2px 8px', borderRadius: 10 }}>{grouped[status].length}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grouped[status].map((r) => (
                <div key={r.id}
                  draggable
                  onDragStart={() => setDragId(r.id)}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  onClick={() => navigate(`${basePath}/${r.id}`)}
                  style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 10, cursor: 'grab', opacity: dragId === r.id ? 0.5 : 1, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>{r.name || '(unnamed)'}</div>
                  {r.company && <div style={{ fontSize: 11, color: COLORS.textMuted }}>{r.company}</div>}
                  {r.role && <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{r.role}</div>}
                </div>
              ))}
              {grouped[status].length === 0 && (
                <div style={{ color: COLORS.textDim, fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: 12 }}>Drop here</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
