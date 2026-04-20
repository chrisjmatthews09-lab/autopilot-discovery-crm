import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { COLORS } from '../../config/design-tokens';
import { useCollection } from '../../hooks/useCollection';
import { daysSinceLastTouch, estimatedEV, RELATIONSHIP_COLORS } from '../../data/targets';
import { findStage } from '../../data/deals';

export default function TargetsCard({ entityType, entityId }) {
  const { data: targets, loading } = useCollection('targets');
  const { data: pipelines } = useCollection('pipelines');
  const { data: companies } = useCollection('companies');

  const pipelinesById = useMemo(() => Object.fromEntries(pipelines.map((p) => [p.id, p])), [pipelines]);
  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);

  const scoped = useMemo(() => {
    if (entityType === 'person') {
      return targets.filter((t) => {
        if (t.owner_person_id === entityId) return true;
        return (t.introduction_paths || []).some((ip) => ip.person_id === entityId);
      });
    }
    if (entityType === 'company') {
      return targets.filter((t) => t.company_id === entityId);
    }
    return [];
  }, [targets, entityType, entityId]);

  if (loading || scoped.length === 0) return null;

  const totalEV = scoped.reduce((s, t) => s + estimatedEV(t), 0);

  return (
    <div style={{ marginTop: 20, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>
        🎯 M&A Targets <span style={{ color: COLORS.textMuted, fontWeight: 400, fontSize: 12 }}>({scoped.length} · Est. EV ${shortDollar(totalEV)})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {scoped.map((t) => {
          const pipeline = pipelinesById[t.pipeline_id];
          const stage = findStage(pipeline, t.stage_id);
          const days = daysSinceLastTouch(t);
          const strength = RELATIONSHIP_COLORS[t.relationship_strength] || RELATIONSHIP_COLORS.Cold;
          return (
            <Link key={t.id} to={`/targets/${t.id}`}
              style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 110px 90px', gap: 10, alignItems: 'center', padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 5, background: COLORS.cardAlt, textDecoration: 'none', color: COLORS.text, fontSize: 12 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {companiesById[t.company_id]?.name || '(target)'}
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: 11 }}>{stage?.label || t.stage_id}</div>
              <div style={{ fontWeight: 600, textAlign: 'right' }}>${shortDollar(estimatedEV(t))} EV</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, alignItems: 'center' }}>
                <span style={{ padding: '1px 6px', borderRadius: 9, background: strength.bg, color: strength.fg, fontSize: 10, fontWeight: 700 }}>
                  {t.relationship_strength || 'Cold'}
                </span>
                <span style={{ fontSize: 10, color: days !== null && days > 60 ? COLORS.danger : COLORS.textMuted }}>
                  {days === null ? '—' : `${days}d`}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function shortDollar(n) {
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
