import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { PACKAGES } from '../config/enums';
import { useCollection } from '../hooks/useCollection';
import { updateDeal, deleteDeal, moveDealStage, daysInStage, findStage } from '../data/deals';
import { updateDoc } from '../data/firestore';
import { logInteraction } from '../data/interactions';
import { personPath, companyPath } from '../config/workspaces';
import RecordDetailScaffold from '../components/record/RecordDetailScaffold';
import Timeline from '../components/ui/Timeline';
import TasksCard from '../components/ui/TasksCard';
import CloseDealModal from '../components/ui/CloseDealModal';
import { useConfirm } from '../components/ui/ConfirmDialog';

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data: deals } = useCollection('deals');
  const { data: pipelines } = useCollection('pipelines');
  const { data: companies } = useCollection('companies');
  const { data: people } = useCollection('people');

  const deal = deals.find((d) => d.id === id);
  const pipeline = deal ? pipelines.find((p) => p.id === deal.pipeline_id) : null;
  const stage = findStage(pipeline, deal?.stage_id);
  const company = deal?.company_id ? companies.find((c) => c.id === deal.company_id) : null;
  const primaryPerson = deal?.primary_person_id ? people.find((p) => p.id === deal.primary_person_id) : null;

  const [editing, setEditing] = useState(false);
  const [closeModal, setCloseModal] = useState(null);

  if (!deal) {
    return (
      <div style={{ padding: 24 }}>
        <Link to="/crm/deals" style={{ color: COLORS.primary, fontSize: 13, textDecoration: 'none' }}>← Back to Deals</Link>
        <div style={{ marginTop: 20, color: COLORS.textMuted }}>Deal not found.</div>
      </div>
    );
  }

  const handleStageChange = async (newStageId) => {
    const target = findStage(pipeline, newStageId);
    if (!target || target.id === deal.stage_id) return;
    if (target.is_won || target.is_lost) {
      setCloseModal({ targetStage: target, mode: target.is_won ? 'won' : 'lost' });
      return;
    }
    await moveDealStage(deal, newStageId);
    logInteraction({
      kind: 'stage_change',
      entity_type: 'deal',
      entity_id: deal.id,
      title: `Stage → ${target.label}`,
      from_stage: deal.stage_id,
      to_stage: newStageId,
    }).catch(() => {});
  };

  const handleCloseConfirm = async ({ actual_close_date, lost_reason }) => {
    const { targetStage } = closeModal;
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

    if (status === 'Won' && primaryPerson) {
      await updateDoc('people', primaryPerson.id, { lifecycle_stage: 'Customer' });
      logInteraction({
        kind: 'stage_change',
        entity_type: 'person',
        entity_id: primaryPerson.id,
        title: 'Auto-advanced to Customer (deal won)',
        from_stage: primaryPerson.lifecycle_stage || null,
        to_stage: 'Customer',
        meta: { deal_id: deal.id },
      }).catch(() => {});
    }
    setCloseModal(null);
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: `Delete deal "${deal.name}"?`, description: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    await deleteDeal(deal.id);
    navigate('/crm/deals');
  };

  const leftPanel = (
    <DealLeftPanel
      deal={deal} pipeline={pipeline} stage={stage} pipelines={pipelines}
      editing={editing} setEditing={setEditing}
      onStageChange={handleStageChange}
      onDelete={handleDelete}
    />
  );

  const rightPanel = (
    <DealRightPanel
      deal={deal} company={company} primaryPerson={primaryPerson}
      people={people} companies={companies}
    />
  );

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: <DealOverview deal={deal} stage={stage} pipeline={pipeline} />,
    },
    {
      id: 'timeline',
      label: 'Timeline',
      content: <Timeline entityType="deal" entityId={deal.id} />,
    },
    {
      id: 'tasks',
      label: 'Tasks',
      content: <TasksCard entityType="deal" entityId={deal.id} recordLabel="deal" />,
    },
    {
      id: 'notes',
      label: 'Notes',
      content: <DealNotes deal={deal} />,
    },
  ];

  return (
    <>
      <div style={{ padding: '12px 20px 0' }}>
        <Link to="/crm/deals" style={{ color: COLORS.primary, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>← Back to Deals</Link>
      </div>
      <RecordDetailScaffold leftPanel={leftPanel} tabs={tabs} rightPanel={rightPanel} defaultTab="overview" />
      {closeModal && (
        <CloseDealModal
          mode={closeModal.mode}
          dealName={deal.name}
          onCancel={() => setCloseModal(null)}
          onConfirm={handleCloseConfirm}
        />
      )}
    </>
  );
}

function DealLeftPanel({ deal, pipeline, stage, pipelines, editing, setEditing, onStageChange, onDelete }) {
  const stall = daysInStage(deal);
  const isStalled = stall > 30 && deal.status === 'Open';
  const statusColor = deal.status === 'Won' ? COLORS.success : deal.status === 'Lost' ? COLORS.danger : COLORS.primary;

  if (editing) {
    return <DealEditForm deal={deal} pipelines={pipelines} onDone={() => setEditing(false)} />;
  }

  return (
    <div>
      <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>Deal</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, color: COLORS.text, marginBottom: 10, lineHeight: 1.2 }}>
        {deal.name || '(Unnamed deal)'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ padding: '3px 10px', borderRadius: 10, background: statusColor === COLORS.primary ? COLORS.primaryLight : statusColor === COLORS.success ? '#DCFCE7' : '#FEE2E2', color: statusColor, fontSize: 11, fontWeight: 700 }}>
          {deal.status || 'Open'}
        </span>
        {isStalled && (
          <span title={`${stall} days in stage`} style={{ padding: '3px 8px', borderRadius: 10, background: '#FEF3C7', color: COLORS.warning, fontSize: 11, fontWeight: 700 }}>
            ⚠ {stall}d
          </span>
        )}
      </div>

      <Field label="Pipeline" value={pipeline?.name || '—'} />

      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Stage</div>
        <select value={deal.stage_id || ''} onChange={(e) => onStageChange(e.target.value)}
          style={{ ...inputStyle, width: '100%' }}>
          {(pipeline?.stages || []).map((s) => (
            <option key={s.id} value={s.id}>{s.label}{s.is_won ? ' ✓' : s.is_lost ? ' ✕' : ''}</option>
          ))}
        </select>
      </div>

      <Field label="MRR" value={deal.amount_mrr ? `$${Number(deal.amount_mrr).toLocaleString()}/mo` : '—'} />
      <Field label="Setup fee" value={deal.amount_setup ? `$${Number(deal.amount_setup).toLocaleString()}` : '—'} />
      <Field label="Package" value={PACKAGES.find((p) => p.id === deal.package)?.label || deal.package || '—'} />
      <Field label="Expected close" value={deal.expected_close_date || '—'} />
      {deal.actual_close_date && <Field label="Actual close" value={deal.actual_close_date} />}
      <Field label="Owner" value={deal.owner || '—'} />
      <Field label="Days in stage" value={stall} />
      {deal.lost_reason && (
        <div style={{ marginTop: 8, padding: 8, background: '#FEE2E2', border: `1px solid ${COLORS.danger}`, borderRadius: 5 }}>
          <div style={labelStyle}>Lost reason</div>
          <div style={{ fontSize: 12, color: COLORS.text }}>{deal.lost_reason}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 14, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
        <button onClick={() => setEditing(true)}
          style={{ flex: 1, padding: '7px 10px', background: COLORS.blueLight, color: COLORS.blue, border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          ✎ Edit
        </button>
        <button onClick={onDelete}
          style={{ flex: 1, padding: '7px 10px', background: '#FEF2F2', color: COLORS.danger, border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          🗑 Delete
        </button>
      </div>
    </div>
  );
}

function DealEditForm({ deal, pipelines, onDone }) {
  const [name, setName] = useState(deal.name || '');
  const [mrr, setMrr] = useState(deal.amount_mrr || 0);
  const [setup, setSetup] = useState(deal.amount_setup || 0);
  const [pkg, setPkg] = useState(deal.package || '');
  const [closeDate, setCloseDate] = useState(deal.expected_close_date || '');
  const [pipelineId, setPipelineId] = useState(deal.pipeline_id);
  const [stageId, setStageId] = useState(deal.stage_id);
  const [owner, setOwner] = useState(deal.owner || 'Chris');
  const [saving, setSaving] = useState(false);

  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const save = async () => {
    setSaving(true);
    try {
      await updateDeal(deal.id, {
        name: name.trim(),
        amount_mrr: Number(mrr) || 0,
        amount_setup: Number(setup) || 0,
        package: pkg || null,
        expected_close_date: closeDate || null,
        pipeline_id: pipelineId,
        stage_id: stageId,
        owner: owner.trim() || 'Chris',
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Edit Deal</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FormField label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Pipeline">
          <select value={pipelineId} onChange={(e) => { setPipelineId(e.target.value); const first = pipelines.find((p) => p.id === e.target.value)?.stages?.[0]; if (first) setStageId(first.id); }} style={inputStyle}>
            {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormField>
        <FormField label="Stage">
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} style={inputStyle}>
            {(pipeline?.stages || []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </FormField>
        <FormField label="Package">
          <select value={pkg} onChange={(e) => { setPkg(e.target.value); const p = PACKAGES.find((x) => x.id === e.target.value); if (p) { setMrr(p.mrr); setSetup(p.setup); } }} style={inputStyle}>
            <option value="">—</option>
            {PACKAGES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </FormField>
        <div style={{ display: 'flex', gap: 6 }}>
          <FormField label="MRR ($)" style={{ flex: 1 }}>
            <input type="number" value={mrr} onChange={(e) => setMrr(e.target.value)} style={inputStyle} />
          </FormField>
          <FormField label="Setup ($)" style={{ flex: 1 }}>
            <input type="number" value={setup} onChange={(e) => setSetup(e.target.value)} style={inputStyle} />
          </FormField>
        </div>
        <FormField label="Expected close">
          <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Owner">
          <input value={owner} onChange={(e) => setOwner(e.target.value)} style={inputStyle} />
        </FormField>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <button onClick={save} disabled={saving}
          style={{ flex: 1, padding: '8px 10px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          {saving ? 'Saving…' : '✓ Save'}
        </button>
        <button onClick={onDone}
          style={{ flex: 1, padding: '8px 10px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function DealOverview({ deal, stage, pipeline }) {
  const weighted = (Number(deal.amount_mrr) || 0) * (stage?.probability ?? 0);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <Tile label="MRR" value={`$${(deal.amount_mrr || 0).toLocaleString()}`} />
        <Tile label="Setup Fee" value={`$${(deal.amount_setup || 0).toLocaleString()}`} />
        <Tile label="Probability" value={stage ? `${Math.round(stage.probability * 100)}%` : '—'} />
        <Tile label="Weighted MRR" value={`$${Math.round(weighted).toLocaleString()}`} />
      </div>

      <Section title="Pipeline Progress">
        {pipeline ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {pipeline.stages.map((s) => {
              const active = s.id === deal.stage_id;
              const color = s.is_won ? COLORS.success : s.is_lost ? COLORS.danger : COLORS.primary;
              return (
                <div key={s.id}
                  style={{ padding: '5px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: active ? color : COLORS.cardAlt, color: active ? '#fff' : COLORS.textMuted, border: `1px solid ${active ? color : COLORS.border}` }}>
                  {s.label}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: COLORS.textDim, fontSize: 12, fontStyle: 'italic' }}>No pipeline.</div>
        )}
      </Section>

      {deal.notes_md && (
        <Section title="Notes">
          <div style={{ fontSize: 13, color: COLORS.text, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{deal.notes_md}</div>
        </Section>
      )}
    </div>
  );
}

function DealNotes({ deal }) {
  const [notes, setNotes] = useState(deal.notes_md || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateDeal(deal.id, { notes_md: notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Markdown notes about this deal… objections, discovery findings, pricing rationale, stakeholders…"
        style={{ width: '100%', minHeight: 260, padding: 12, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: COLORS.card, color: COLORS.text }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <button onClick={save} disabled={saving || notes === (deal.notes_md || '')}
          style={{ padding: '8px 14px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving || notes === (deal.notes_md || '') ? 0.5 : 1 }}>
          {saving ? 'Saving…' : '💾 Save notes'}
        </button>
        {saved && <span style={{ fontSize: 12, color: COLORS.success }}>✓ Saved</span>}
      </div>
    </div>
  );
}

function DealRightPanel({ deal, company, primaryPerson, people, companies }) {
  const committeeIds = deal.buying_committee || [];
  const committee = committeeIds.map((id) => people.find((p) => p.id === id)).filter(Boolean);

  const [addingMember, setAddingMember] = useState(false);
  const [memberPick, setMemberPick] = useState('');

  const companyPeople = useMemo(() => {
    if (!deal.company_id) return [];
    return people.filter((p) => p.company_id === deal.company_id && p.id !== deal.primary_person_id && !committeeIds.includes(p.id));
  }, [people, deal.company_id, deal.primary_person_id, committeeIds]);

  const addMember = async () => {
    if (!memberPick) return;
    await updateDeal(deal.id, { buying_committee: [...committeeIds, memberPick] });
    setMemberPick('');
    setAddingMember(false);
  };

  const removeMember = async (id) => {
    await updateDeal(deal.id, { buying_committee: committeeIds.filter((x) => x !== id) });
  };

  return (
    <>
      <RightCard title="🏢 Company">
        {company ? (
          <Link to={companyPath(company)}
            style={{ display: 'block', padding: 10, border: `1px solid ${COLORS.border}`, borderRadius: 6, textDecoration: 'none', background: COLORS.cardAlt }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{company.name || '(unnamed)'}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
              {company.industry || '—'}{company.revenue_band ? ` · ${company.revenue_band}` : ''}
            </div>
          </Link>
        ) : (
          <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic' }}>No company linked.</div>
        )}
      </RightCard>

      <RightCard title="👤 Primary Contact">
        {primaryPerson ? (
          <Link to={personPath(primaryPerson)}
            style={{ display: 'block', padding: 10, border: `1px solid ${COLORS.border}`, borderRadius: 6, textDecoration: 'none', background: COLORS.cardAlt }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{primaryPerson.name || '(unnamed)'}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
              {primaryPerson.role || ''}{primaryPerson.lifecycle_stage ? ` · ${primaryPerson.lifecycle_stage}` : ''}
            </div>
          </Link>
        ) : (
          <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic' }}>No primary contact.</div>
        )}
      </RightCard>

      <RightCard title={`👥 Buying Committee (${committee.length})`}>
        {committee.length === 0 ? (
          <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic', marginBottom: 8 }}>No additional stakeholders.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            {committee.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, border: `1px solid ${COLORS.border}`, borderRadius: 5, background: COLORS.cardAlt }}>
                <Link to={personPath(m)} style={{ flex: 1, fontSize: 12, color: COLORS.text, textDecoration: 'none' }}>
                  <div style={{ fontWeight: 600 }}>{m.name || '(unnamed)'}</div>
                  {m.role && <div style={{ fontSize: 10, color: COLORS.textMuted }}>{m.role}</div>}
                </Link>
                <button onClick={() => removeMember(m.id)}
                  aria-label="Remove from buying committee"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textDim, fontSize: 12 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        {addingMember ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <select value={memberPick} onChange={(e) => setMemberPick(e.target.value)} style={inputStyle}>
              <option value="">— Pick a person —</option>
              {companyPeople.map((p) => <option key={p.id} value={p.id}>{p.name}{p.role ? ` · ${p.role}` : ''}</option>)}
              {companyPeople.length === 0 && <option disabled>No other people at this company</option>}
            </select>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={addMember} disabled={!memberPick}
                style={{ flex: 1, padding: '6px 8px', background: memberPick ? COLORS.primary : COLORS.border, color: '#fff', border: 'none', borderRadius: 4, cursor: memberPick ? 'pointer' : 'not-allowed', fontSize: 11, fontWeight: 600 }}>
                Add
              </button>
              <button onClick={() => { setAddingMember(false); setMemberPick(''); }}
                style={{ flex: 1, padding: '6px 8px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingMember(true)}
            style={{ width: '100%', padding: '6px 8px', background: 'transparent', color: COLORS.primary, border: `1px dashed ${COLORS.primary}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
            + Add stakeholder
          </button>
        )}
      </RightCard>

      <OpenTasksCard entityType="deal" entityId={deal.id} />
    </>
  );
}

function OpenTasksCard({ entityType, entityId }) {
  const { data: tasks } = useCollection('tasks');
  const open = tasks.filter((t) => t.related_deal_id === entityId && t.status !== 'Done' && t.status !== 'Cancelled');
  return (
    <RightCard title={`✅ Open Tasks (${open.length})`}>
      {open.length === 0 ? (
        <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic' }}>No open tasks.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {open.slice(0, 5).map((t) => (
            <div key={t.id} style={{ fontSize: 12, color: COLORS.text, padding: '4px 0', borderBottom: `1px solid ${COLORS.border}` }}>
              <div style={{ fontWeight: 500 }}>{t.title}</div>
              {t.due_date && <div style={{ fontSize: 10, color: COLORS.textMuted }}>Due {t.due_date}</div>}
            </div>
          ))}
        </div>
      )}
    </RightCard>
  );
}

function RightCard({ title, children }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 13, color: COLORS.text }}>{value}</div>
    </div>
  );
}

function FormField({ label, children, style }) {
  return (
    <div style={style}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div style={{ padding: 12, background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

const labelStyle = { fontSize: 10, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 };
const inputStyle = { padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 12, background: COLORS.card, color: COLORS.text, width: '100%', boxSizing: 'border-box' };
