import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS } from '../../config/design-tokens';
import { useCollection } from '../../hooks/useCollection';
import { findStage } from '../../data/deals';

export default function DealsCard({ entityType, entityId }) {
  const { data: deals, loading } = useCollection('deals');
  const { data: pipelines } = useCollection('pipelines');
  const [showClosed, setShowClosed] = useState(false);

  const pipelinesById = useMemo(() => Object.fromEntries(pipelines.map((p) => [p.id, p])), [pipelines]);

  const scoped = useMemo(() => {
    if (entityType === 'person') {
      return deals.filter((d) => d.primary_person_id === entityId || (d.buying_committee || []).includes(entityId));
    }
    if (entityType === 'company') {
      return deals.filter((d) => d.company_id === entityId);
    }
    return [];
  }, [deals, entityType, entityId]);

  const open = scoped.filter((d) => d.status === 'Open');
  const closed = scoped.filter((d) => d.status !== 'Open');
  const visible = showClosed ? scoped : open;

  const openMRR = open.reduce((s, d) => s + (Number(d.amount_mrr) || 0), 0);

  if (loading) return null;
  if (scoped.length === 0) return null;

  return (
    <div style={{ marginTop: 20, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
          💼 Deals <span style={{ color: COLORS.textMuted, fontWeight: 400, fontSize: 12 }}>({open.length} open · ${openMRR.toLocaleString()}/mo)</span>
        </div>
        {closed.length > 0 && (
          <button onClick={() => setShowClosed((v) => !v)}
            style={{ background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            {showClosed ? 'Open only' : `Show closed (${closed.length})`}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic' }}>No {showClosed ? '' : 'open '}deals.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {visible.map((d) => {
            const pipeline = pipelinesById[d.pipeline_id];
            const stage = findStage(pipeline, d.stage_id);
            const statusColor = d.status === 'Won' ? COLORS.success : d.status === 'Lost' ? COLORS.danger : COLORS.primary;
            return (
              <Link key={d.id} to={`/deals/${d.id}`}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 90px 70px', gap: 10, alignItems: 'center', padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 5, background: COLORS.cardAlt, textDecoration: 'none', color: COLORS.text, fontSize: 12 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name || '(deal)'}</div>
                <div style={{ color: COLORS.textMuted, fontSize: 11 }}>{stage?.label || d.stage_id}</div>
                <div style={{ fontWeight: 600, textAlign: 'right' }}>${(Number(d.amount_mrr) || 0).toLocaleString()}/mo</div>
                <div style={{ textAlign: 'right', fontSize: 10, fontWeight: 700, color: statusColor }}>{d.status}</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
