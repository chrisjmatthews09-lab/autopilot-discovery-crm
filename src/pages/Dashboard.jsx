import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_COLORS } from '../config/enums';
import { useCollection } from '../hooks/useCollection';
import { isOverdue, isDueThisWeek } from '../data/tasks';
import { getDefaultPipeline } from '../data/deals';
import { estimatedEV, daysSinceLastTouch, isGoingCold, RELATIONSHIP_COLORS } from '../data/targets';
import { logInteraction } from '../data/interactions';
import { personPath, companyPath, interviewPath, interviewsListPath } from '../config/workspaces';
import { useWorkspace } from '../hooks/useWorkspace';

const DAY_MS = 24 * 60 * 60 * 1000;

function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'object' && v.seconds) return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function withinDays(v, days) {
  const ms = toMs(v);
  return ms > 0 && Date.now() - ms <= days * DAY_MS;
}

export default function Dashboard({ people, companies, interviews }) {
  const { data: tasks } = useCollection('tasks');
  const { data: deals } = useCollection('deals');
  const { data: pipelines } = useCollection('pipelines');
  const { data: targets } = useCollection('targets');
  const { id: workspaceId } = useWorkspace();
  const isDealFlow = workspaceId === 'deal_flow';
  const peopleListPath = isDealFlow ? '/deal-flow/practitioners' : '/crm/people';
  const companiesListPath = isDealFlow ? '/deal-flow/firms' : '/crm/companies';
  const interviewsPath = interviewsListPath(workspaceId);
  const tasksPath = isDealFlow ? '/deal-flow/tasks' : '/crm/tasks';

  const companiesById = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);

  const dealPipelines = useMemo(() => pipelines.filter((p) => !p.object_type || p.object_type === 'deal'), [pipelines]);
  const targetPipelines = useMemo(() => pipelines.filter((p) => p.object_type === 'target'), [pipelines]);
  const defaultPipeline = useMemo(() => getDefaultPipeline(dealPipelines), [dealPipelines]);
  const defaultTargetPipeline = useMemo(() => targetPipelines.find((p) => p.is_default) || targetPipelines[0], [targetPipelines]);

  const maPipeline = useMemo(() => {
    if (!defaultTargetPipeline) return null;
    const pipelineTargets = targets.filter((t) => t.pipeline_id === defaultTargetPipeline.id && t.status !== 'Won' && t.status !== 'Passed');
    const stageData = defaultTargetPipeline.stages
      .filter((s) => !s.is_won && !s.is_lost)
      .map((s) => {
        const stageTargets = pipelineTargets.filter((t) => t.stage_id === s.id);
        const ev = stageTargets.reduce((acc, t) => acc + estimatedEV(t), 0);
        return { stageId: s.id, label: s.label, count: stageTargets.length, ev };
      });
    const totalEV = stageData.reduce((s, d) => s + d.ev, 0);
    const maxEV = Math.max(...stageData.map((d) => d.ev), 1);
    return { pipeline: defaultTargetPipeline, stageData, totalEV, maxEV };
  }, [targets, defaultTargetPipeline]);

  const goingCold = useMemo(() => {
    const cold = targets.filter((t) => isGoingCold(t));
    return cold
      .map((t) => ({ ...t, _days: daysSinceLastTouch(t) ?? 9999 }))
      .sort((a, b) => b._days - a._days)
      .slice(0, 5);
  }, [targets]);

  const commercialPipeline = useMemo(() => {
    if (!defaultPipeline) return null;
    const pipelineDeals = deals.filter((d) => d.pipeline_id === defaultPipeline.id && d.status === 'Open');
    const stageData = defaultPipeline.stages
      .filter((s) => !s.is_won && !s.is_lost)
      .map((s) => {
        const stageDeals = pipelineDeals.filter((d) => d.stage_id === s.id);
        const mrr = stageDeals.reduce((acc, d) => acc + (Number(d.amount_mrr) || 0), 0);
        return { stageId: s.id, label: s.label, count: stageDeals.length, mrr, probability: s.probability };
      });
    const totalMRR = stageData.reduce((s, d) => s + d.mrr, 0);
    const weightedMRR = stageData.reduce((s, d) => s + d.mrr * (d.probability || 0), 0);
    const maxMrr = Math.max(...stageData.map((d) => d.mrr), 1);
    return { pipeline: defaultPipeline, stageData, totalMRR, weightedMRR, maxMrr };
  }, [deals, defaultPipeline]);

  const taskStats = useMemo(() => {
    const overdue = tasks.filter(isOverdue).length;
    const dueWeek = tasks.filter(isDueThisWeek).length;
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const dueToday = tasks.filter((t) => t.due_date && new Date(t.due_date).setHours(0, 0, 0, 0) === todayStart && t.status !== 'Done' && t.status !== 'Cancelled').length;
    return { overdue, dueWeek, dueToday };
  }, [tasks]);

  const funnelData = useMemo(() => {
    const all = [...people, ...companies];
    return LIFECYCLE_STAGES.map((stage) => ({
      stage,
      count: all.filter((r) => (r.lifecycle_stage || 'Research-Contact') === stage && !r.is_archived).length,
      color: LIFECYCLE_STAGE_COLORS[stage]?.fg || COLORS.primary,
    }));
  }, [people, companies]);

  const thisWeek = useMemo(() => {
    const interviewsThisWeek = interviews.filter((i) => withinDays(i.interviewDate || i.createdAt, 7)).length;
    const updatedPeople = people.filter((p) => withinDays(p.updatedAt, 7)).length;
    const updatedCompanies = companies.filter((c) => withinDays(c.updatedAt, 7)).length;
    const newlyAnalyzed = interviews.filter((i) => (i.painPoints || i.wtpSignals) && withinDays(i.updatedAt, 7)).length;
    return { interviewsThisWeek, updatedPeople, updatedCompanies, newlyAnalyzed };
  }, [people, companies, interviews]);

  const recentInsights = useMemo(() => {
    return [...interviews]
      .filter((i) => i.summaryText || i.painPoints || i.wtpSignals)
      .sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt))
      .slice(0, 5);
  }, [interviews]);

  const activity = useMemo(() => {
    const items = [
      ...people.map((p) => ({ kind: 'person', id: p.id, label: p.name || '(unnamed)', ts: toMs(p.updatedAt), path: personPath(p) })),
      ...companies.map((c) => ({ kind: 'company', id: c.id, label: c.name || c.company || '(unnamed)', ts: toMs(c.updatedAt), path: companyPath(c) })),
      ...interviews.map((i) => ({ kind: 'interview', id: i.id, label: i.intervieweeName || i.intervieweeBusinessName || 'Interview', ts: toMs(i.updatedAt), path: interviewPath(i) })),
    ];
    return items.filter((x) => x.ts > 0).sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [people, companies, interviews]);

  const unlinkedInterviews = interviews.filter((i) => !i.linkedContactId && !i.linkedId).length;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 4px', fontFamily: DISPLAY, fontSize: 28, color: COLORS.text }}>Dashboard</h1>
      <p style={{ margin: '0 0 20px', color: COLORS.textMuted, fontSize: 14 }}>
        Overview of your research and outreach pipeline.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Stat label={isDealFlow ? 'Practitioners' : 'People'} value={people.length} to={peopleListPath} color={COLORS.primary} />
        <Stat label={isDealFlow ? 'Firms' : 'Companies'} value={companies.length} to={companiesListPath} color={COLORS.blue} />
        <Stat label="Interviews" value={interviews.length} to={interviewsPath} color={COLORS.accent} />
        <Stat label="Unlinked interviews" value={unlinkedInterviews} to={interviewsPath} color={COLORS.warning} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 12 }}>
        <Card title="Research Funnel" subtitle="Records by lifecycle stage (active only)">
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={funnelData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
                <XAxis dataKey="stage" tick={{ fontSize: 10, fill: COLORS.textMuted }} interval={0} angle={-18} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.textMuted }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: `1px solid ${COLORS.border}` }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {funnelData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="This Week" subtitle="Tasks and pipeline activity">
          <LinkRow to={tasksPath} label="Overdue tasks" value={taskStats.overdue} highlight={taskStats.overdue > 0 ? COLORS.danger : null} />
          <LinkRow to={tasksPath} label="Due today" value={taskStats.dueToday} />
          <LinkRow to={tasksPath} label="Due this week" value={taskStats.dueWeek} />
          <Row label="Interviews (7d)" value={thisWeek.interviewsThisWeek} />
          <Row label="Analyses (7d)" value={thisWeek.newlyAnalyzed} />
        </Card>
      </div>

      {(maPipeline || goingCold.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 12 }}>
          {maPipeline && (
            <Card title="🎯 M&A Pipeline" subtitle={`${maPipeline.pipeline.name} · active targets by stage`}>
              {maPipeline.stageData.length === 0 ? (
                <div style={{ color: COLORS.textDim, fontSize: 12, fontStyle: 'italic' }}>No active targets yet.</div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {maPipeline.stageData.map((d) => (
                      <Link key={d.stageId} to="/deal-flow/targets"
                        style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '100px 1fr 90px 50px', gap: 10, alignItems: 'center', padding: '3px 0' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{d.label}</div>
                        <div style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 4, height: 20, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(6, Math.min(100, (d.ev / maPipeline.maxEV) * 100))}%`, height: '100%', background: COLORS.accent, transition: 'width 0.2s' }} />
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.text, fontWeight: 600, textAlign: 'right' }}>${shortDollarDash(d.ev)}</div>
                        <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: 'right' }}>{d.count}</div>
                      </Link>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.border}`, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: COLORS.textMuted }}>Total Pipeline EV</span>
                    <strong style={{ color: COLORS.accent }}>${shortDollarDash(maPipeline.totalEV)}</strong>
                  </div>
                </>
              )}
            </Card>
          )}

          <Card title="🧊 Targets going cold" subtitle="Last contact > 60 days (or never)">
            {goingCold.length === 0 ? (
              <div style={{ color: COLORS.textDim, fontSize: 12, fontStyle: 'italic' }}>All targets are warm. Nice work.</div>
            ) : (
              goingCold.map((t) => <ColdTargetRow key={t.id} target={t} company={companiesById[t.company_id]} />)
            )}
          </Card>
        </div>
      )}

      {commercialPipeline && (
        <div style={{ marginBottom: 12 }}>
          <Card title="💼 Commercial Pipeline" subtitle={`${commercialPipeline.pipeline.name} · open deals by stage`}>
            {commercialPipeline.stageData.length === 0 ? (
              <div style={{ color: COLORS.textDim, fontSize: 12, fontStyle: 'italic' }}>No deals in this pipeline yet.</div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {commercialPipeline.stageData.map((d) => (
                    <Link key={d.stageId} to="/crm/deals"
                      style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '120px 1fr 90px 60px', gap: 10, alignItems: 'center', padding: '4px 0' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{d.label}</div>
                      <div style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 4, height: 22, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(8, Math.min(100, (d.mrr / commercialPipeline.maxMrr) * 100))}%`, height: '100%', background: COLORS.primary, transition: 'width 0.2s' }} />
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.text, fontWeight: 600, textAlign: 'right' }}>${d.mrr.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: 'right' }}>{d.count} deal{d.count === 1 ? '' : 's'}</div>
                    </Link>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.border}`, fontSize: 12 }}>
                  <div style={{ color: COLORS.textMuted }}>
                    Total MRR: <strong style={{ color: COLORS.text }}>${commercialPipeline.totalMRR.toLocaleString()}</strong>
                  </div>
                  <div style={{ color: COLORS.textMuted }}>
                    Weighted: <strong style={{ color: COLORS.primary }}>${Math.round(commercialPipeline.weightedMRR).toLocaleString()}</strong>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <Card title="Recent Insights" subtitle="Latest analyzed interviews">
          {recentInsights.length === 0 ? (
            <div style={{ color: COLORS.textDim, fontSize: 12, fontStyle: 'italic' }}>No analyzed interviews yet. Open an interview and run ✨ Analyze.</div>
          ) : (
            recentInsights.map((iv) => (
              <Link key={iv.id} to={interviewPath(iv)} style={{ textDecoration: 'none', display: 'block', padding: '8px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                  {iv.intervieweeName || iv.intervieweeBusinessName || 'Interview'}
                  {iv.interviewDate && <span style={{ color: COLORS.textMuted, fontWeight: 400 }}> · {iv.interviewDate}</span>}
                </div>
                {iv.summaryText && (
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {iv.summaryText.slice(0, 180)}
                  </div>
                )}
              </Link>
            ))
          )}
        </Card>

        <Card title="Activity" subtitle="Recently updated records">
          {activity.length === 0 ? (
            <div style={{ color: COLORS.textDim, fontSize: 12, fontStyle: 'italic' }}>No activity yet.</div>
          ) : (
            activity.map((a) => (
              <Link key={`${a.kind}-${a.id}`} to={a.path} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <span style={{ fontSize: 13, color: COLORS.text }}>
                  <KindIcon kind={a.kind} /> {a.label}
                </span>
                <span style={{ fontSize: 11, color: COLORS.textMuted }}>{relativeTime(a.ts)}</span>
              </Link>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

function KindIcon({ kind }) {
  const icon = kind === 'person' ? '👤' : kind === 'company' ? '🏢' : '🎙';
  return <span style={{ marginRight: 6 }}>{icon}</span>;
}

function relativeTime(ms) {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function Stat({ label, value, to, color }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      </div>
    </Link>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{title}</div>
      {subtitle && <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: COLORS.text }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function ColdTargetRow({ target, company }) {
  const days = daysSinceLastTouch(target);
  const strength = RELATIONSHIP_COLORS[target.relationship_strength] || RELATIONSHIP_COLORS.Cold;
  const logTouch = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await logInteraction({
      kind: 'note',
      entity_type: 'target',
      entity_id: target.id,
      title: 'Quick touch logged from dashboard',
    });
  };
  return (
    <Link to={`/deal-flow/targets/${target.id}`}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `1px solid ${COLORS.border}`, textDecoration: 'none', color: COLORS.text }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {company?.name || '(target)'}
        </div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
          {days === null ? 'never contacted' : `${days}d ago`} · {target.stage_id}
        </div>
      </div>
      <span style={{ padding: '1px 7px', borderRadius: 10, background: strength.bg, color: strength.fg, fontSize: 10, fontWeight: 700 }}>
        {target.relationship_strength || 'Cold'}
      </span>
      <button onClick={logTouch}
        style={{ padding: '4px 8px', background: COLORS.primaryLight, color: COLORS.primary, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
        Log touch
      </button>
    </Link>
  );
}

function shortDollarDash(n) {
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function LinkRow({ to, label, value, highlight }) {
  return (
    <Link to={to} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: COLORS.text }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ fontWeight: 600, color: highlight || COLORS.text }}>{value}</span>
    </Link>
  );
}
