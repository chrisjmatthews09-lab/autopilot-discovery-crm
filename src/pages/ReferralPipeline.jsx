import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '../config/design-tokens';
import { REFERRAL_STAGES, REFERRAL_STAGE_COLORS } from '../config/workspaces';
import { SkeletonKanban } from '../components/ui/Skeleton';

export default function ReferralPipeline({ firms, loading, onUpdateCompany }) {
  const navigate = useNavigate();
  const [dragId, setDragId] = useState(null);

  const partners = useMemo(
    () => (firms || []).filter((f) => Array.isArray(f.roles) && f.roles.includes('referral_partner')),
    [firms]
  );

  const byStage = useMemo(() => {
    const groups = Object.fromEntries(REFERRAL_STAGES.map((s) => [s.id, []]));
    for (const p of partners) {
      const stage = p.referral_stage || 'introd';
      if (groups[stage]) groups[stage].push(p);
      else groups.introd.push(p);
    }
    return groups;
  }, [partners]);

  const handleDrop = async (stageId) => {
    if (!dragId) return;
    const partner = partners.find((p) => p.id === dragId);
    setDragId(null);
    if (!partner || partner.referral_stage === stageId) return;
    await onUpdateCompany(dragId, { referral_stage: stageId });
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Referral Pipeline</h1>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>Drag partners across stages. Intro'd → Sent lead → Closed.</div>
        </div>
        <button onClick={() => navigate('/deal-flow/referrals')}
          style={{ padding: '8px 14px', background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          📋 List view
        </button>
      </div>

      {!loading && partners.length === 0 && (
        <div style={{ padding: '10px 14px', background: COLORS.cardAlt, border: `1px dashed ${COLORS.border}`, borderRadius: 8, marginBottom: 12, fontSize: 12, color: COLORS.textMuted }}>
          No referral partners yet. <button onClick={() => navigate('/deal-flow/referrals')} style={{ padding: 0, background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Add a partner</button> to populate this board.
        </div>
      )}

      {loading ? (
        <SkeletonKanban />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${REFERRAL_STAGES.length}, 1fr)`, gap: 12, alignItems: 'flex-start' }}>
          {REFERRAL_STAGES.map((stage) => {
            const rows = byStage[stage.id] || [];
            const colors = REFERRAL_STAGE_COLORS[stage.id];
            return (
              <div key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage.id)}
                style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12, minHeight: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: colors?.fg, background: colors?.bg, padding: '3px 10px', borderRadius: 999 }}>{stage.label}</div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 600 }}>{rows.length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rows.map((p) => (
                    <div key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => navigate(`/deal-flow/firms/${p.id}`)}
                      style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 10, cursor: 'grab', opacity: dragId === p.id ? 0.5 : 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 2 }}>{p.company || p.name || 'Unnamed'}</div>
                      {p.intro_source && <div style={{ fontSize: 11, color: COLORS.textMuted }}>Intro: {p.intro_source}</div>}
                      {(p.referrals_sent || p.referrals_closed) && (
                        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
                          {p.referrals_sent || 0} sent · {p.referrals_closed || 0} closed
                        </div>
                      )}
                    </div>
                  ))}
                  {rows.length === 0 && (
                    <div style={{ fontSize: 11, color: COLORS.textDim, fontStyle: 'italic', padding: 12, textAlign: 'center' }}>Drop here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
