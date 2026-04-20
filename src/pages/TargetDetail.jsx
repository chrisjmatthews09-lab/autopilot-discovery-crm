import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { useCollection } from '../hooks/useCollection';
import { updateTarget, deleteTarget, moveTargetStage, daysSinceLastTouch, estimatedEV, RELATIONSHIP_STRENGTHS, RELATIONSHIP_COLORS, INTRO_PATH_STRENGTHS } from '../data/targets';
import { findStage } from '../data/deals';
import { logInteraction } from '../data/interactions';
import { personPath, companyPath } from '../config/workspaces';
import RecordDetailScaffold from '../components/record/RecordDetailScaffold';
import Timeline from '../components/ui/Timeline';
import TasksCard from '../components/ui/TasksCard';
import { shortDollar } from './TargetsList';
import { generateDiligenceTasks, DILIGENCE_TASK_COUNT, DILIGENCE_CATEGORIES } from '../data/diligence';
import { updateTask } from '../data/tasks';

export default function TargetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: targets } = useCollection('targets');
  const { data: pipelines } = useCollection('pipelines');
  const { data: companies } = useCollection('companies');
  const { data: people } = useCollection('people');

  const target = targets.find((t) => t.id === id);
  const pipeline = target ? pipelines.find((p) => p.id === target.pipeline_id) : null;
  const stage = findStage(pipeline, target?.stage_id);
  const company = target?.company_id ? companies.find((c) => c.id === target.company_id) : null;
  const owner = target?.owner_person_id ? people.find((p) => p.id === target.owner_person_id) : null;

  const [editing, setEditing] = useState(false);

  if (!target) {
    return (
      <div style={{ padding: 24 }}>
        <Link to="/deal-flow/targets" style={{ color: COLORS.primary, fontSize: 13, textDecoration: 'none' }}>← Back to Targets</Link>
        <div style={{ marginTop: 20, color: COLORS.textMuted }}>Target not found.</div>
      </div>
    );
  }

  const handleStageChange = async (newStageId) => {
    const newStage = findStage(pipeline, newStageId);
    if (!newStage || newStage.id === target.stage_id) return;
    const extras = {};
    if (newStage.is_won) extras.status = 'Won';
    else if (newStage.is_lost) extras.status = 'Passed';
    else extras.status = 'Open';
    await moveTargetStage(target, newStageId, extras);
    logInteraction({
      kind: 'stage_change',
      entity_type: 'target',
      entity_id: target.id,
      title: newStage.is_won ? `Closed-Won → ${newStage.label}` : newStage.is_lost ? `Passed → ${newStage.label}` : `Stage → ${newStage.label}`,
      from_stage: target.stage_id,
      to_stage: newStageId,
    }).catch(() => {});
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete target "${company?.name || 'this target'}"? This cannot be undone.`)) return;
    await deleteTarget(target.id);
    navigate('/deal-flow/targets');
  };

  const leftPanel = (
    <TargetLeftPanel
      target={target} pipeline={pipeline} stage={stage} company={company}
      editing={editing} setEditing={setEditing}
      onStageChange={handleStageChange}
      onDelete={handleDelete}
    />
  );

  const rightPanel = (
    <TargetRightPanel
      target={target} company={company} owner={owner} people={people}
    />
  );

  const tabs = [
    { id: 'overview', label: 'Overview', content: <TargetOverview target={target} stage={stage} pipeline={pipeline} /> },
    { id: 'timeline', label: 'Timeline', content: <Timeline entityType="target" entityId={target.id} /> },
    { id: 'tasks', label: 'Tasks', content: <TasksCard entityType="target" entityId={target.id} recordLabel="target" /> },
    { id: 'diligence', label: 'Diligence', content: <DiligenceChecklist target={target} /> },
    { id: 'notes', label: 'Notes', content: <TargetNotes target={target} /> },
  ];

  return (
    <>
      <div style={{ padding: '12px 20px 0' }}>
        <Link to="/deal-flow/targets" style={{ color: COLORS.primary, fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>← Back to Targets</Link>
      </div>
      <RecordDetailScaffold leftPanel={leftPanel} tabs={tabs} rightPanel={rightPanel} defaultTab="overview" />
    </>
  );
}

function TargetLeftPanel({ target, pipeline, stage, company, editing, setEditing, onStageChange, onDelete }) {
  const ev = estimatedEV(target);
  const days = daysSinceLastTouch(target);
  const strengthColor = RELATIONSHIP_COLORS[target.relationship_strength] || RELATIONSHIP_COLORS.Cold;
  const statusColor = target.status === 'Won' ? COLORS.success : target.status === 'Passed' || target.status === 'Lost' ? COLORS.danger : COLORS.primary;

  if (editing) {
    return <TargetEditForm target={target} pipeline={pipeline} onDone={() => setEditing(false)} />;
  }

  return (
    <div>
      <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 4 }}>Target</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, color: COLORS.text, marginBottom: 10, lineHeight: 1.2 }}>
        {company?.name || '(Unnamed firm)'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ padding: '3px 10px', borderRadius: 10, background: statusColor === COLORS.primary ? COLORS.primaryLight : statusColor === COLORS.success ? '#DCFCE7' : '#FEE2E2', color: statusColor, fontSize: 11, fontWeight: 700 }}>
          {target.status || 'Open'}
        </span>
        <span style={{ padding: '3px 10px', borderRadius: 10, background: strengthColor.bg, color: strengthColor.fg, fontSize: 11, fontWeight: 700 }}>
          {target.relationship_strength || 'Cold'}
        </span>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>Stage</div>
        <select value={target.stage_id || ''} onChange={(e) => onStageChange(e.target.value)} style={{ ...inputStyle, width: '100%' }}>
          {(pipeline?.stages || []).map((s) => (
            <option key={s.id} value={s.id}>{s.label}{s.is_won ? ' ✓' : s.is_lost ? ' ✕' : ''}</option>
          ))}
        </select>
      </div>

      <Field label="Est. Revenue" value={target.est_revenue ? `$${shortDollar(Number(target.est_revenue))}` : '—'} />
      <Field label="Est. EBITDA" value={target.est_ebitda ? `$${shortDollar(Number(target.est_ebitda))}` : '—'} />
      <Field label="Bid Multiple" value={target.bid_multiple ? `${target.bid_multiple}×` : '—'} />
      <Field label="Estimated EV" value={ev ? `$${shortDollar(ev)}` : '—'} highlight />
      <Field label="Last contact" value={target.last_contact_date ? `${target.last_contact_date}${days !== null ? ` (${days}d ago)` : ''}` : 'never'} />
      <Field label="Next touch" value={target.next_touch_date || '—'} />

      {target.vdr_url && (
        <a href={target.vdr_url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'block', marginTop: 10, padding: '7px 10px', background: COLORS.blueLight, color: COLORS.blue, border: 'none', borderRadius: 5, textAlign: 'center', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
          🔗 Open VDR
        </a>
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

function TargetEditForm({ target, pipeline, onDone }) {
  const [estRevenue, setEstRevenue] = useState(target.est_revenue || 0);
  const [estEbitda, setEstEbitda] = useState(target.est_ebitda || 0);
  const [bidMultiple, setBidMultiple] = useState(target.bid_multiple || 0);
  const [strength, setStrength] = useState(target.relationship_strength || 'Cold');
  const [nextTouch, setNextTouch] = useState(target.next_touch_date || '');
  const [vdrUrl, setVdrUrl] = useState(target.vdr_url || '');
  const [stageId, setStageId] = useState(target.stage_id);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateTarget(target.id, {
        est_revenue: Number(estRevenue) || 0,
        est_ebitda: Number(estEbitda) || 0,
        bid_multiple: Number(bidMultiple) || 0,
        relationship_strength: strength,
        next_touch_date: nextTouch || null,
        vdr_url: vdrUrl.trim() || null,
        stage_id: stageId,
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>Edit Target</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <FormField label="Stage">
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} style={inputStyle}>
            {(pipeline?.stages || []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </FormField>
        <FormField label="Est. Revenue ($)">
          <input type="number" value={estRevenue} onChange={(e) => setEstRevenue(e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Est. EBITDA ($)">
          <input type="number" value={estEbitda} onChange={(e) => setEstEbitda(e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Bid Multiple">
          <input type="number" step="0.1" value={bidMultiple} onChange={(e) => setBidMultiple(e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="Relationship Strength">
          <select value={strength} onChange={(e) => setStrength(e.target.value)} style={inputStyle}>
            {RELATIONSHIP_STRENGTHS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="Next Touch Date">
          <input type="date" value={nextTouch} onChange={(e) => setNextTouch(e.target.value)} style={inputStyle} />
        </FormField>
        <FormField label="VDR URL">
          <input value={vdrUrl} onChange={(e) => setVdrUrl(e.target.value)} placeholder="https://…" style={inputStyle} />
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

function TargetOverview({ target, stage, pipeline }) {
  const ev = estimatedEV(target);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <Tile label="Est. Revenue" value={`$${shortDollar(Number(target.est_revenue) || 0)}`} />
        <Tile label="Est. EBITDA" value={`$${shortDollar(Number(target.est_ebitda) || 0)}`} />
        <Tile label="Bid Multiple" value={target.bid_multiple ? `${target.bid_multiple}×` : '—'} />
        <Tile label="Estimated EV" value={`$${shortDollar(ev)}`} highlight />
      </div>

      <Section title="Pipeline Progress">
        {pipeline ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {pipeline.stages.map((s) => {
              const active = s.id === target.stage_id;
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
    </div>
  );
}

function TargetNotes({ target }) {
  const [notes, setNotes] = useState(target.notes_md || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateTarget(target.id, { notes_md: notes });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Markdown notes — thesis, owner dynamics, financial drivers, deal structure, risks…"
        style={{ width: '100%', minHeight: 260, padding: 12, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: COLORS.card, color: COLORS.text }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <button onClick={save} disabled={saving || notes === (target.notes_md || '')}
          style={{ padding: '8px 14px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: saving || notes === (target.notes_md || '') ? 0.5 : 1 }}>
          {saving ? 'Saving…' : '💾 Save notes'}
        </button>
        {saved && <span style={{ fontSize: 12, color: COLORS.success }}>✓ Saved</span>}
      </div>
    </div>
  );
}

function DiligenceChecklist({ target }) {
  const { data: allTasks } = useCollection('tasks');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set(DILIGENCE_CATEGORIES));

  const tasks = useMemo(() => {
    return (allTasks || [])
      .filter((t) => t.related_target_id === target.id && t.source === 'diligence_template')
      .sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.title || '').localeCompare(b.title || ''));
  }, [allTasks, target.id]);

  const grouped = useMemo(() => {
    const g = {};
    for (const t of tasks) {
      const cat = t.category || 'Other';
      if (!g[cat]) g[cat] = [];
      g[cat].push(t);
    }
    return g;
  }, [tasks]);

  const handleGenerate = async () => {
    if (tasks.length > 0) {
      if (!window.confirm(`This target already has ${tasks.length} diligence tasks. Add another ${DILIGENCE_TASK_COUNT}?`)) return;
    } else {
      if (!window.confirm(`Create ${DILIGENCE_TASK_COUNT} diligence tasks for this target?`)) return;
    }
    setGenerating(true); setError(null);
    try {
      await generateDiligenceTasks(target.id);
    } catch (err) {
      setError(err.message || 'Failed to generate tasks');
    } finally {
      setGenerating(false);
    }
  };

  const toggle = async (task) => {
    const next = task.status === 'Done' ? 'Open' : 'Done';
    await updateTask(task.id, { status: next });
  };

  const toggleSection = (cat) => {
    const next = new Set(expanded);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    setExpanded(next);
  };

  const doneCount = tasks.filter((t) => t.status === 'Done').length;
  const pct = tasks.length === 0 ? 0 : Math.round((doneCount / tasks.length) * 100);

  if (tasks.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Diligence checklist</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 16, maxWidth: 420, margin: '0 auto 16px' }}>
          Generate a {DILIGENCE_TASK_COUNT}-task M&amp;A diligence template covering financial, ops, legal, tech, commercial, HR, tax, and integration workstreams. Each task links back to this target.
        </div>
        <button onClick={handleGenerate} disabled={generating}
          style={{ padding: '10px 22px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: generating ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
          {generating ? 'Generating…' : `Generate diligence checklist (${DILIGENCE_TASK_COUNT} tasks)`}
        </button>
        {error && <div style={{ marginTop: 10, color: COLORS.danger, fontSize: 12 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: 14, background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
            {doneCount} / {tasks.length} complete <span style={{ color: COLORS.textMuted, fontWeight: 400, fontSize: 12 }}>· {pct}%</span>
          </div>
          <div style={{ marginTop: 6, height: 6, background: COLORS.border, borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: COLORS.primary, transition: 'width 0.2s' }} />
          </div>
        </div>
        <button onClick={handleGenerate} disabled={generating}
          style={{ padding: '7px 12px', background: 'none', color: COLORS.primary, border: `1px solid ${COLORS.primary}`, borderRadius: 5, cursor: generating ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>
          {generating ? '…' : '+ Add another set'}
        </button>
      </div>

      {error && <div style={{ marginBottom: 10, color: COLORS.danger, fontSize: 12 }}>{error}</div>}

      {Object.entries(grouped).map(([cat, items]) => {
        const catDone = items.filter((t) => t.status === 'Done').length;
        const open = expanded.has(cat);
        return (
          <div key={cat} style={{ marginBottom: 10, border: `1px solid ${COLORS.border}`, borderRadius: 6, overflow: 'hidden' }}>
            <button onClick={() => toggleSection(cat)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 12px', background: COLORS.cardAlt, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: COLORS.text, textAlign: 'left' }}>
              <span>{open ? '▾' : '▸'} {cat}</span>
              <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 400 }}>{catDone} / {items.length}</span>
            </button>
            {open && (
              <div>
                {items.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderTop: `1px solid ${COLORS.border}`, background: COLORS.card }}>
                    <input type="checkbox" checked={t.status === 'Done'} onChange={() => toggle(t)}
                      style={{ marginTop: 3, cursor: 'pointer' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 500, textDecoration: t.status === 'Done' ? 'line-through' : 'none', opacity: t.status === 'Done' ? 0.6 : 1 }}>
                        {t.title}
                      </div>
                      {t.description_md && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2, lineHeight: 1.4 }}>{t.description_md}</div>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: t.priority === 'P1' ? COLORS.danger : COLORS.textMuted, padding: '2px 6px', background: t.priority === 'P1' ? '#FEE2E2' : COLORS.cardAlt, borderRadius: 4, flexShrink: 0 }}>
                      {t.priority || 'P2'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TargetRightPanel({ target, company, owner, people }) {
  return (
    <>
      <RightCard title="🏢 Firm">
        {company ? (
          <Link to={companyPath(company)}
            style={{ display: 'block', padding: 10, border: `1px solid ${COLORS.border}`, borderRadius: 6, textDecoration: 'none', background: COLORS.cardAlt }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{company.name || '(unnamed)'}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
              {company.industry || '—'}{company.revenue_band ? ` · ${company.revenue_band}` : ''}{company.state ? ` · ${company.state}` : ''}
            </div>
          </Link>
        ) : (
          <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic' }}>No company linked.</div>
        )}
      </RightCard>

      <RightCard title="👤 Owner / Principal">
        {owner ? (
          <Link to={personPath(owner)}
            style={{ display: 'block', padding: 10, border: `1px solid ${COLORS.border}`, borderRadius: 6, textDecoration: 'none', background: COLORS.cardAlt }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{owner.name || '(unnamed)'}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
              {owner.role || ''}{owner.email ? ` · ${owner.email}` : ''}
            </div>
          </Link>
        ) : (
          <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic' }}>No owner linked.</div>
        )}
      </RightCard>

      <IntroductionPaths target={target} people={people} />
    </>
  );
}

function IntroductionPaths({ target, people }) {
  const paths = target.introduction_paths || [];
  const [adding, setAdding] = useState(false);
  const [personId, setPersonId] = useState('');
  const [strength, setStrength] = useState('moderate');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const peopleById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p])), [people]);
  const availablePeople = useMemo(() => {
    const existing = new Set(paths.map((p) => p.person_id));
    return people.filter((p) => !existing.has(p.id));
  }, [people, paths]);

  const addPath = async () => {
    if (!personId || saving) return;
    setSaving(true);
    try {
      const next = [...paths, { person_id: personId, strength, note: note.trim() }];
      await updateTarget(target.id, { introduction_paths: next });
      setPersonId('');
      setStrength('moderate');
      setNote('');
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const removePath = async (idx) => {
    const next = paths.filter((_, i) => i !== idx);
    await updateTarget(target.id, { introduction_paths: next });
  };

  const strengthColor = (s) => s === 'strong' ? COLORS.success : s === 'moderate' ? COLORS.primary : COLORS.textMuted;

  return (
    <RightCard title={`🤝 Introduction Paths (${paths.length})`}>
      {paths.length === 0 ? (
        <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic', marginBottom: 8 }}>No paths yet. Who can introduce you?</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {paths.map((p, idx) => {
            const person = peopleById[p.person_id];
            return (
              <div key={idx} style={{ padding: 8, border: `1px solid ${COLORS.border}`, borderRadius: 5, background: COLORS.cardAlt }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <Link to={person ? personPath(person) : '#'}
                    style={{ flex: 1, fontSize: 12, color: COLORS.text, textDecoration: 'none', fontWeight: 600 }}>
                    {person?.name || '(unknown)'}
                  </Link>
                  <span style={{ fontSize: 10, fontWeight: 700, color: strengthColor(p.strength), textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {p.strength}
                  </span>
                  <button onClick={() => removePath(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textDim, fontSize: 12 }}>✕</button>
                </div>
                {p.note && <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{p.note}</div>}
              </div>
            );
          })}
        </div>
      )}

      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 5 }}>
          <select value={personId} onChange={(e) => setPersonId(e.target.value)} style={inputStyle}>
            <option value="">— Pick a person —</option>
            {availablePeople.map((p) => <option key={p.id} value={p.id}>{p.name}{p.company ? ` · ${p.company}` : ''}</option>)}
          </select>
          <select value={strength} onChange={(e) => setStrength(e.target.value)} style={inputStyle}>
            {INTRO_PATH_STRENGTHS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context (e.g. worked together at KPMG 2018-2022)"
            style={{ ...inputStyle, minHeight: 50, fontFamily: 'inherit', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={addPath} disabled={!personId || saving}
              style={{ flex: 1, padding: '6px 8px', background: personId ? COLORS.primary : COLORS.border, color: '#fff', border: 'none', borderRadius: 4, cursor: personId && !saving ? 'pointer' : 'not-allowed', fontSize: 11, fontWeight: 600 }}>
              {saving ? 'Adding…' : 'Add path'}
            </button>
            <button onClick={() => { setAdding(false); setPersonId(''); setNote(''); }}
              style={{ flex: 1, padding: '6px 8px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{ width: '100%', padding: '6px 8px', background: 'transparent', color: COLORS.primary, border: `1px dashed ${COLORS.primary}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
          + Add introduction path
        </button>
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

function Field({ label, value, highlight }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 13, color: highlight ? COLORS.primary : COLORS.text, fontWeight: highlight ? 700 : 400 }}>{value}</div>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  );
}

function Tile({ label, value, highlight }) {
  return (
    <div style={{ padding: 12, background: highlight ? COLORS.primaryLight : COLORS.cardAlt, border: `1px solid ${highlight ? COLORS.primary : COLORS.border}`, borderRadius: 6 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: highlight ? COLORS.primary : COLORS.text, marginTop: 4 }}>{value}</div>
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
