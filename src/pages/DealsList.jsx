import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DndContext, useDraggable, useDroppable, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { useCollection } from '../hooks/useCollection';
import { moveDealStage, daysInStage, findStage, getDefaultPipeline, updateDeal } from '../data/deals';
import { updateDoc } from '../data/firestore';
import { logInteraction } from '../data/interactions';
import CloseDealModal from '../components/ui/CloseDealModal';

export default function DealsList() {
  const { data: deals } = useCollection('deals');
  const { data: allPipelines } = useCollection('pipelines');
  const pipelines = useMemo(() => allPipelines.filter((p) => (p.object_type || 'deal') === 'deal'), [allPipelines]);
  const { data: companies } = useCollection('companies');
  const { data: people } = useCollection('people');

  const defaultPipeline = useMemo(() => getDefaultPipeline(pipelines), [pipelines]);
  const [pipelineId, setPipelineId] = useState(null);
  const [view, setView] = useState('kanban');
  const [activeDragId, setActiveDragId] = useState(null);
  const [closeModal, setCloseModal] = useState(null); // { deal, targetStage, mode }

  const currentPipeline = useMemo(() => pipelines.find((p) => p.id === pipelineId) || defaultPipeline, [pipelines, pipelineId, defaultPipeline]);
  React.useEffect(() => {
    if (!pipelineId && defaultPipeline) setPipelineId(defaultPipeline.id);
  }, [defaultPipeline, pipelineId]);

  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const peopleById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);

  const pipelineDeals = useMemo(() => {
    if (!currentPipeline) return [];
    return deals.filter((d) => d.pipeline_id === currentPipeline.id);
  }, [deals, currentPipeline]);

  const dealsByStage = useMemo(() => {
    const map = {};
    if (!currentPipeline) return map;
    for (const s of currentPipeline.stages) map[s.id] = [];
    for (const d of pipelineDeals) {
      const sid = d.stage_id || currentPipeline.stages[0].id;
      if (!map[sid]) map[sid] = [];
      map[sid].push(d);
    }
    return map;
  }, [pipelineDeals, currentPipeline]);

  // MouseSensor + TouchSensor (instead of PointerSensor) so we can tune press-and-
  // hold timing for touch separately from mouse drag. The 150ms delay on touch
  // avoids hijacking scroll gestures on the kanban column.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  if (!currentPipeline) {
    return <div style={{ padding: 24, color: COLORS.textMuted }}>Loading pipelines…</div>;
  }

  const handleDragEnd = async (event) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const dealId = active.id;
    const targetStageId = over.id;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === targetStageId) return;
    const target = findStage(currentPipeline, targetStageId);
    if (!target) return;

    if (target.is_won || target.is_lost) {
      setCloseModal({ deal, targetStage: target, mode: target.is_won ? 'won' : 'lost' });
      return;
    }

    await moveDealStage(deal, targetStageId);
    logInteraction({
      kind: 'stage_change',
      entity_type: 'deal',
      entity_id: deal.id,
      title: `Stage → ${target.label}`,
      from_stage: deal.stage_id,
      to_stage: targetStageId,
    }).catch(() => {});
  };

  const handleCloseConfirm = async ({ actual_close_date, lost_reason }) => {
    const { deal, targetStage } = closeModal;
    const status = targetStage.is_won ? 'Won' : 'Lost';
    await moveDealStage(deal, targetStage.id, {
      status,
      actual_close_date,
      lost_reason: lost_reason || null,
    });
    logInteraction({
      kind: 'stage_change',
      entity_type: 'deal',
      entity_id: deal.id,
      title: `Closed ${status} → ${targetStage.label}`,
      from_stage: deal.stage_id,
      to_stage: targetStage.id,
      body: lost_reason || null,
      meta: { close_date: actual_close_date, status },
    }).catch(() => {});

    if (status === 'Won' && deal.primary_person_id) {
      const person = peopleById[deal.primary_person_id];
      if (person) {
        await updateDoc('people', person.id, { lifecycle_stage: 'Customer' });
        logInteraction({
          kind: 'stage_change',
          entity_type: 'person',
          entity_id: person.id,
          title: 'Auto-advanced to Customer (deal won)',
          from_stage: person.lifecycle_stage || null,
          to_stage: 'Customer',
          meta: { deal_id: deal.id },
        }).catch(() => {});
      }
    }

    setCloseModal(null);
  };

  const activeDeal = deals.find((d) => d.id === activeDragId);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 24, color: COLORS.text }}>💼 Deals</h1>
          <select value={currentPipeline.id} onChange={(e) => setPipelineId(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 5, border: `1px solid ${COLORS.border}`, background: COLORS.card, color: COLORS.text, fontSize: 13 }}>
            {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}{p.is_default ? ' ★' : ''}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <ToggleBtn active={view === 'kanban'} onClick={() => setView('kanban')}>📊 Kanban</ToggleBtn>
          <ToggleBtn active={view === 'table'} onClick={() => setView('table')}>☰ Table</ToggleBtn>
        </div>
      </div>

      {view === 'kanban' ? (
        <DndContext sensors={sensors} onDragStart={(e) => setActiveDragId(e.active.id)} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragId(null)}>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {currentPipeline.stages.map((stage) => (
              <StageColumn key={stage.id} stage={stage} deals={dealsByStage[stage.id] || []} companiesById={companiesById} peopleById={peopleById} />
            ))}
          </div>
          <DragOverlay>
            {activeDeal ? <DealCard deal={activeDeal} company={companiesById[activeDeal.company_id]} person={peopleById[activeDeal.primary_person_id]} dragging /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <TableView deals={pipelineDeals} pipeline={currentPipeline} companiesById={companiesById} peopleById={peopleById} />
      )}

      {closeModal && (
        <CloseDealModal
          mode={closeModal.mode}
          dealName={closeModal.deal.name}
          onCancel={() => setCloseModal(null)}
          onConfirm={handleCloseConfirm}
        />
      )}
    </div>
  );
}

function StageColumn({ stage, deals, companiesById, peopleById }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const mrrSum = deals.reduce((s, d) => s + (Number(d.amount_mrr) || 0), 0);
  const accent = stage.is_won ? COLORS.success : stage.is_lost ? COLORS.danger : COLORS.primary;

  return (
    <div ref={setNodeRef}
      style={{ flex: '0 0 280px', background: isOver ? COLORS.primaryLight : COLORS.cardAlt, border: `1px solid ${isOver ? COLORS.primary : COLORS.border}`, borderRadius: 8, padding: 10, transition: 'background 0.15s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '2px 4px', borderBottom: `2px solid ${accent}` }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{stage.label}</div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 }}>
            {deals.length} · ${mrrSum.toLocaleString()}/mo
          </div>
        </div>
        <div style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 600 }}>{Math.round((stage.probability || 0) * 100)}%</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
        {deals.length === 0 ? (
          <div style={{ fontSize: 11, color: COLORS.textDim, fontStyle: 'italic', padding: 8, textAlign: 'center' }}>Drop here</div>
        ) : deals.map((d) => (
          <DraggableDeal key={d.id} deal={d} company={companiesById[d.company_id]} person={peopleById[d.primary_person_id]} />
        ))}
      </div>
    </div>
  );
}

function DraggableDeal({ deal, company, person }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab' }}>
      <DealCard deal={deal} company={company} person={person} />
    </div>
  );
}

function DealCard({ deal, company, person, dragging }) {
  const navigate = useNavigate();
  const stall = daysInStage(deal);
  const isStalled = stall > 30 && deal.status === 'Open';
  const closeRel = relativeDate(deal.expected_close_date);

  return (
    <Link to={`/crm/deals/${deal.id}`} onClick={(e) => dragging && e.preventDefault()}
      style={{ display: 'block', background: COLORS.card, border: `1px solid ${isStalled ? COLORS.warning : COLORS.border}`, borderRadius: 6, padding: 10, boxShadow: dragging ? '0 8px 24px rgba(0,0,0,0.2)' : 'none', textDecoration: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {deal.name || company?.name || '(deal)'}
        </div>
        {isStalled && <span title={`${stall} days in stage`} style={{ fontSize: 13 }}>⚠</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: COLORS.textMuted }}>
        <span style={{ fontWeight: 600, color: COLORS.text }}>${(deal.amount_mrr || 0).toLocaleString()}/mo</span>
        {person && (
          <span title={person.name} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', background: COLORS.primaryLight, color: COLORS.primary, fontSize: 10, fontWeight: 700 }}>
            {initials(person.name)}
          </span>
        )}
      </div>
      {closeRel && (
        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>📅 {closeRel}</div>
      )}
    </Link>
  );
}

function TableView({ deals, pipeline, companiesById, peopleById }) {
  const stages = Object.fromEntries(pipeline.stages.map((s) => [s.id, s]));
  const sorted = [...deals].sort((a, b) => {
    const ai = pipeline.stages.findIndex((s) => s.id === a.stage_id);
    const bi = pipeline.stages.findIndex((s) => s.id === b.stage_id);
    if (ai !== bi) return ai - bi;
    return (b.amount_mrr || 0) - (a.amount_mrr || 0);
  });

  if (sorted.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLORS.textDim, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>No deals in this pipeline yet.</div>;
  }

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 100px 90px 90px', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.cardAlt, fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        <div>Deal</div><div>Company</div><div>Stage</div><div>Contact</div><div>MRR</div><div>Close</div><div>Status</div>
      </div>
      {sorted.map((d) => (
        <Link key={d.id} to={`/crm/deals/${d.id}`}
          style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 100px 90px 90px', gap: 8, padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, alignItems: 'center', fontSize: 13, textDecoration: 'none', color: COLORS.text }}>
          <div style={{ fontWeight: 600 }}>{d.name || '(deal)'}</div>
          <div style={{ color: COLORS.textMuted }}>{companiesById[d.company_id]?.name || '—'}</div>
          <div>{stages[d.stage_id]?.label || d.stage_id}</div>
          <div style={{ color: COLORS.textMuted, fontSize: 12 }}>{peopleById[d.primary_person_id]?.name || '—'}</div>
          <div style={{ fontWeight: 600 }}>${(d.amount_mrr || 0).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>{d.expected_close_date || '—'}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: d.status === 'Won' ? COLORS.success : d.status === 'Lost' ? COLORS.danger : COLORS.text }}>{d.status}</div>
        </Link>
      ))}
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

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function relativeDate(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diffDays = Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'due today';
  if (diffDays === 1) return 'due tomorrow';
  if (diffDays === -1) return '1 day overdue';
  if (diffDays < 0) return `${-diffDays} days overdue`;
  if (diffDays < 30) return `in ${diffDays} days`;
  if (diffDays < 60) return `in ~1 month`;
  return new Date(iso).toLocaleDateString();
}
