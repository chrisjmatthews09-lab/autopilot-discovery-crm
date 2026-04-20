import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { REVENUE_BANDS, US_STATES } from '../config/enums';
import { useCollection } from '../hooks/useCollection';
import { createTarget, moveTargetStage, daysSinceLastTouch, estimatedEV, RELATIONSHIP_STRENGTHS, RELATIONSHIP_COLORS } from '../data/targets';
import { findStage } from '../data/deals';
import { logInteraction } from '../data/interactions';
import { createDoc } from '../data/firestore';

export default function TargetsList() {
  const { data: targets } = useCollection('targets');
  const { data: pipelines } = useCollection('pipelines');
  const { data: companies } = useCollection('companies');
  const { data: people } = useCollection('people');

  const targetPipelines = useMemo(() => pipelines.filter((p) => p.object_type === 'target'), [pipelines]);
  const defaultTargetPipeline = targetPipelines.find((p) => p.is_default) || targetPipelines[0];
  const [pipelineId, setPipelineId] = useState(null);
  const [view, setView] = useState('kanban');
  const [activeDragId, setActiveDragId] = useState(null);
  const [filterState, setFilterState] = useState('');
  const [filterRevBand, setFilterRevBand] = useState('');
  const [filterStrength, setFilterStrength] = useState('');
  const [creating, setCreating] = useState(false);

  const currentPipeline = useMemo(() => targetPipelines.find((p) => p.id === pipelineId) || defaultTargetPipeline, [targetPipelines, pipelineId, defaultTargetPipeline]);
  React.useEffect(() => {
    if (!pipelineId && defaultTargetPipeline) setPipelineId(defaultTargetPipeline.id);
  }, [defaultTargetPipeline, pipelineId]);

  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const peopleById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);

  const filtered = useMemo(() => {
    if (!currentPipeline) return [];
    return targets.filter((t) => {
      if (t.pipeline_id !== currentPipeline.id) return false;
      if (filterStrength && t.relationship_strength !== filterStrength) return false;
      const company = companiesById[t.company_id];
      if (filterState && company?.state !== filterState) return false;
      if (filterRevBand && company?.revenue_band !== filterRevBand) return false;
      return true;
    });
  }, [targets, currentPipeline, filterStrength, filterState, filterRevBand, companiesById]);

  const targetsByStage = useMemo(() => {
    const map = {};
    if (!currentPipeline) return map;
    for (const s of currentPipeline.stages) map[s.id] = [];
    for (const t of filtered) {
      const sid = t.stage_id || currentPipeline.stages[0].id;
      if (!map[sid]) map[sid] = [];
      map[sid].push(t);
    }
    return map;
  }, [filtered, currentPipeline]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (!currentPipeline) {
    return <div style={{ padding: 24, color: COLORS.textMuted }}>Loading M&A pipeline…</div>;
  }

  const handleDragEnd = async (event) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const targetId = active.id;
    const targetStageId = over.id;
    const target = targets.find((t) => t.id === targetId);
    if (!target || target.stage_id === targetStageId) return;
    const stage = findStage(currentPipeline, targetStageId);
    if (!stage) return;

    const extras = {};
    if (stage.is_won) extras.status = 'Won';
    else if (stage.is_lost) extras.status = 'Passed';
    else extras.status = 'Open';

    await moveTargetStage(target, targetStageId, extras);
    logInteraction({
      kind: 'stage_change',
      entity_type: 'target',
      entity_id: target.id,
      title: stage.is_won ? `Closed-Won → ${stage.label}` : stage.is_lost ? `Passed → ${stage.label}` : `Stage → ${stage.label}`,
      from_stage: target.stage_id,
      to_stage: targetStageId,
    }).catch(() => {});
  };

  const activeTarget = targets.find((t) => t.id === activeDragId);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 24, color: COLORS.text }}>🎯 M&A Targets</h1>
          {targetPipelines.length > 1 && (
            <select value={currentPipeline.id} onChange={(e) => setPipelineId(e.target.value)}
              style={selectStyle}>
              {targetPipelines.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' ★' : ''}</option>)}
            </select>
          )}
          <select value={filterState} onChange={(e) => setFilterState(e.target.value)} style={selectStyle}>
            <option value="">All states</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterRevBand} onChange={(e) => setFilterRevBand(e.target.value)} style={selectStyle}>
            <option value="">All revenue</option>
            {REVENUE_BANDS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterStrength} onChange={(e) => setFilterStrength(e.target.value)} style={selectStyle}>
            <option value="">All strengths</option>
            {RELATIONSHIP_STRENGTHS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setCreating(true)}
            style={{ padding: '6px 12px', borderRadius: 5, border: 'none', background: COLORS.primary, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            + New Target
          </button>
          <ToggleBtn active={view === 'kanban'} onClick={() => setView('kanban')}>📊 Kanban</ToggleBtn>
          <ToggleBtn active={view === 'table'} onClick={() => setView('table')}>☰ Table</ToggleBtn>
        </div>
      </div>

      {view === 'kanban' ? (
        <DndContext sensors={sensors} onDragStart={(e) => setActiveDragId(e.active.id)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragId(null)}>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {currentPipeline.stages.map((stage) => (
              <StageColumn key={stage.id} stage={stage} targets={targetsByStage[stage.id] || []} companiesById={companiesById} peopleById={peopleById} />
            ))}
          </div>
          <DragOverlay>
            {activeTarget ? <TargetCard target={activeTarget} company={companiesById[activeTarget.company_id]} owner={peopleById[activeTarget.owner_person_id]} dragging /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <TableView targets={filtered} pipeline={currentPipeline} companiesById={companiesById} peopleById={peopleById} />
      )}

      {creating && (
        <CreateTargetModal pipeline={currentPipeline} companies={companies} people={people} onClose={() => setCreating(false)} />
      )}
    </div>
  );
}

function StageColumn({ stage, targets, companiesById, peopleById }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const evSum = targets.reduce((s, t) => s + estimatedEV(t), 0);
  const accent = stage.is_won ? COLORS.success : stage.is_lost ? COLORS.danger : COLORS.primary;

  return (
    <div ref={setNodeRef}
      style={{ flex: '0 0 280px', background: isOver ? COLORS.primaryLight : COLORS.cardAlt, border: `1px solid ${isOver ? COLORS.primary : COLORS.border}`, borderRadius: 8, padding: 10, transition: 'background 0.15s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '2px 4px', borderBottom: `2px solid ${accent}` }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{stage.label}</div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {targets.length} · EV ${shortDollar(evSum)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
        {targets.length === 0 ? (
          <div style={{ fontSize: 11, color: COLORS.textDim, fontStyle: 'italic', padding: 8, textAlign: 'center' }}>Drop here</div>
        ) : targets.map((t) => (
          <DraggableTarget key={t.id} target={t} company={companiesById[t.company_id]} owner={peopleById[t.owner_person_id]} />
        ))}
      </div>
    </div>
  );
}

function DraggableTarget({ target, company, owner }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: target.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab' }}>
      <TargetCard target={target} company={company} owner={owner} />
    </div>
  );
}

function TargetCard({ target, company, owner, dragging }) {
  const days = daysSinceLastTouch(target);
  const strengthColor = RELATIONSHIP_COLORS[target.relationship_strength] || RELATIONSHIP_COLORS.Cold;

  return (
    <Link to={`/deal-flow/targets/${target.id}`} onClick={(e) => dragging && e.preventDefault()}
      style={{ display: 'block', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 10, boxShadow: dragging ? '0 8px 24px rgba(0,0,0,0.2)' : 'none', textDecoration: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {company?.name || target.firm_name || '(target)'}
        </div>
        <span style={{ padding: '1px 7px', borderRadius: 10, background: strengthColor.bg, color: strengthColor.fg, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {target.relationship_strength || 'Cold'}
        </span>
      </div>
      {owner && (
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>👤 {owner.name}</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: COLORS.textMuted }}>
        <span>~${shortDollar(Number(target.est_revenue) || 0)} rev</span>
        <span style={{ color: days && days > 60 ? COLORS.danger : COLORS.textMuted, fontWeight: days && days > 60 ? 600 : 400 }}>
          {days === null ? 'no touch' : days === 0 ? 'today' : `${days}d ago`}
        </span>
      </div>
      {target.next_touch_date && (
        <div style={{ fontSize: 11, color: COLORS.primary, marginTop: 4 }}>📅 next: {target.next_touch_date}</div>
      )}
    </Link>
  );
}

function TableView({ targets, pipeline, companiesById, peopleById }) {
  const stages = Object.fromEntries(pipeline.stages.map((s) => [s.id, s]));
  const sorted = [...targets].sort((a, b) => {
    const ai = pipeline.stages.findIndex((s) => s.id === a.stage_id);
    const bi = pipeline.stages.findIndex((s) => s.id === b.stage_id);
    if (ai !== bi) return ai - bi;
    return estimatedEV(b) - estimatedEV(a);
  });

  if (sorted.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLORS.textDim, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>No targets match these filters.</div>;
  }

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 110px 110px 80px', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.cardAlt, fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        <div>Firm</div><div>Owner</div><div>Stage</div><div>Strength</div><div>Est. Rev</div><div>Est. EV</div><div>Last Touch</div>
      </div>
      {sorted.map((t) => {
        const days = daysSinceLastTouch(t);
        const strength = RELATIONSHIP_COLORS[t.relationship_strength] || RELATIONSHIP_COLORS.Cold;
        return (
          <Link key={t.id} to={`/deal-flow/targets/${t.id}`}
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 110px 110px 80px', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, alignItems: 'center', fontSize: 13, textDecoration: 'none', color: COLORS.text }}>
            <div style={{ fontWeight: 600 }}>{companiesById[t.company_id]?.name || t.firm_name || '(target)'}</div>
            <div style={{ color: COLORS.textMuted }}>{peopleById[t.owner_person_id]?.name || '—'}</div>
            <div>{stages[t.stage_id]?.label || t.stage_id}</div>
            <div>
              <span style={{ padding: '1px 7px', borderRadius: 10, background: strength.bg, color: strength.fg, fontSize: 10, fontWeight: 700 }}>
                {t.relationship_strength || 'Cold'}
              </span>
            </div>
            <div style={{ fontWeight: 600 }}>${shortDollar(Number(t.est_revenue) || 0)}</div>
            <div style={{ fontWeight: 600 }}>${shortDollar(estimatedEV(t))}</div>
            <div style={{ fontSize: 12, color: days && days > 60 ? COLORS.danger : COLORS.textMuted }}>{days === null ? '—' : `${days}d`}</div>
          </Link>
        );
      })}
    </div>
  );
}

function CreateTargetModal({ pipeline, companies, people, onClose }) {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [useExisting, setUseExisting] = useState(true);
  const [ownerPersonId, setOwnerPersonId] = useState('');
  const [estRevenue, setEstRevenue] = useState('');
  const [estEbitda, setEstEbitda] = useState('');
  const [bidMultiple, setBidMultiple] = useState('');
  const [strength, setStrength] = useState('Cold');
  const [saving, setSaving] = useState(false);

  const canSave = (useExisting ? !!companyId : !!newCompanyName.trim());

  const ownerChoices = useMemo(() => {
    const cid = useExisting ? companyId : null;
    return cid ? people.filter((p) => p.company_id === cid || !p.company_id) : people;
  }, [people, useExisting, companyId]);

  const submit = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      let finalCompanyId = companyId;
      if (!useExisting) {
        const cid = `company-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        await createDoc('companies', { name: newCompanyName.trim(), lifecycle_stage: 'Research-Contact', workspace: 'deal_flow', roles: ['target'] }, cid);
        finalCompanyId = cid;
      }
      const id = await createTarget({
        company_id: finalCompanyId,
        owner_person_id: ownerPersonId || null,
        pipeline_id: pipeline.id,
        stage_id: pipeline.stages[0].id,
        est_revenue: Number(estRevenue) || 0,
        est_ebitda: Number(estEbitda) || 0,
        bid_multiple: Number(bidMultiple) || 0,
        relationship_strength: strength,
      });
      logInteraction({
        kind: 'stage_change',
        entity_type: 'target',
        entity_id: id,
        title: `Target created → ${pipeline.stages[0].label}`,
        to_stage: pipeline.stages[0].id,
      }).catch(() => {});
      onClose();
      navigate(`/deal-flow/targets/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.card, borderRadius: 10, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${COLORS.border}`, fontSize: 14, fontWeight: 700, color: COLORS.text }}>
          🎯 New M&A Target
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <Label>Firm</Label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
              <label style={radioLabel}><input type="radio" checked={useExisting} onChange={() => setUseExisting(true)} /> Existing company</label>
              <label style={radioLabel}><input type="radio" checked={!useExisting} onChange={() => setUseExisting(false)} /> New</label>
            </div>
            {useExisting ? (
              <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} style={inputStyle}>
                <option value="">— Pick a company —</option>
                {[...companies].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((c) => (
                  <option key={c.id} value={c.id}>{c.name || '(unnamed)'}{c.state ? ` · ${c.state}` : ''}</option>
                ))}
              </select>
            ) : (
              <input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="Firm name" style={inputStyle} />
            )}
          </div>
          <div>
            <Label>Owner / Principal</Label>
            <select value={ownerPersonId} onChange={(e) => setOwnerPersonId(e.target.value)} style={inputStyle}>
              <option value="">— None —</option>
              {ownerChoices.map((p) => <option key={p.id} value={p.id}>{p.name || '(unnamed)'}{p.role ? ` · ${p.role}` : ''}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Label>Est. Revenue ($)</Label>
              <input type="number" value={estRevenue} onChange={(e) => setEstRevenue(e.target.value)} placeholder="0" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <Label>Est. EBITDA ($)</Label>
              <input type="number" value={estEbitda} onChange={(e) => setEstEbitda(e.target.value)} placeholder="0" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <Label>Bid Multiple</Label>
              <input type="number" step="0.1" value={bidMultiple} onChange={(e) => setBidMultiple(e.target.value)} placeholder="e.g. 3.5" style={inputStyle} />
            </div>
          </div>
          <div>
            <Label>Relationship Strength</Label>
            <select value={strength} onChange={(e) => setStrength(e.target.value)} style={inputStyle}>
              {RELATIONSHIP_STRENGTHS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={submit} disabled={!canSave || saving} style={{ padding: '7px 16px', background: canSave ? COLORS.primary : COLORS.border, color: '#fff', border: 'none', borderRadius: 5, cursor: canSave && !saving ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
            {saving ? 'Creating…' : '+ Create Target'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ padding: '6px 12px', borderRadius: 5, border: `1px solid ${active ? COLORS.primary : COLORS.border}`, background: active ? COLORS.primary : 'transparent', color: active ? '#fff' : COLORS.text, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
      {children}
    </button>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{children}</div>;
}

export function shortDollar(n) {
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

const selectStyle = { padding: '6px 10px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontSize: 13 };
const inputStyle = { padding: '7px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: 13, background: COLORS.card, color: COLORS.text, width: '100%', boxSizing: 'border-box' };
const radioLabel = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORS.text, cursor: 'pointer' };
