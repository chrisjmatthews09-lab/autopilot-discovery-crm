import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { COLORS, DISPLAY, FONT } from '../config/design-tokens';
import { retryInterview, enrichAndMergeInterview } from '../services/ingestionService.js';
import { personPath, companyPath, interviewPath, interviewsListPath } from '../config/workspaces';
import {
  getIntervieweeName,
  getIntervieweeBusinessName,
  getInterviewHeadline,
  getInterviewDate,
  getInterviewTranscript,
  getInterviewSummary,
  getInterviewTranscriptUrl,
  getInterviewSummaryUrl,
  formatInterviewDate,
} from '../lib/interviewFields.js';
import { useCollection } from '../hooks/useCollection';
import { useToast } from '../components/ui/Toast';
import { parseFilters, readFilter, encodeFiltersToSearch } from '../data/views';
import SaveViewModal from '../components/ui/SaveViewModal';
import ExportCSVButton from '../components/ui/ExportCSVButton';
import EmptyState from '../components/ui/EmptyState';
import SuggestedInterviews from '../components/ui/SuggestedInterviews';
import Timeline from '../components/ui/Timeline';
import TasksCard from '../components/ui/TasksCard';

function DedupStatusPill({ status }) {
  if (!status || status === 'resolved') return null;
  const config = {
    pending:    { bg: '#FBF6E8', fg: '#9A7B2C', label: 'Pending' },
    processing: { bg: '#EBF3FC', fg: '#2563A0', label: 'Processing' },
    review:     { bg: '#FFEDD5', fg: '#C2410C', label: 'Needs review' },
    error:      { bg: '#FCE8E8', fg: '#DC2626', label: 'Error' },
  }[status];
  if (!config) return null;
  return (
    <span
      title={`Dedup: ${status}`}
      style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, backgroundColor: config.bg, color: config.fg, marginLeft: 6 }}
    >
      {config.label}
    </span>
  );
}

function DedupResolutionPanel({ interview, people, companies }) {
  const navigate = useNavigate();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState(null);
  const status = interview?.dedupStatus;
  if (!status) return null;
  if (status === 'resolved' && !interview.dedupResolution) return null;

  const resolution = interview.dedupResolution || null;
  const matchedContact = resolution?.matchedContactId ? people.find((p) => p.id === resolution.matchedContactId) : null;
  const matchedCompany = resolution?.matchedBusinessId ? companies.find((c) => c.id === resolution.matchedBusinessId) : null;

  const handleRetry = async () => {
    setRetrying(true);
    setRetryError(null);
    try {
      await retryInterview(interview.id);
    } catch (err) {
      setRetryError(err?.message || String(err));
    } finally {
      setRetrying(false);
    }
  };

  const handleReEnrich = async () => {
    setEnriching(true);
    setEnrichStatus(null);
    try {
      const out = await enrichAndMergeInterview(interview);
      if (out?.error) {
        setEnrichStatus({ ok: false, msg: `Enrichment failed: ${out.error}` });
      } else if (out?.skipped) {
        setEnrichStatus({ ok: false, msg: `Skipped: ${out.skipped}` });
      } else {
        const personN = out?.changed?.person?.length || 0;
        const companyN = out?.changed?.company?.length || 0;
        setEnrichStatus({ ok: true, msg: `✓ Enrichment complete — person ${personN}, company ${companyN} field${personN + companyN === 1 ? '' : 's'} updated` });
      }
    } catch (err) {
      setEnrichStatus({ ok: false, msg: `Enrichment failed: ${err?.message || String(err)}` });
    } finally {
      setEnriching(false);
    }
  };

  const tone =
    status === 'error' ? { bg: '#FCE8E8', border: '#FCA5A5', fg: COLORS.danger }
    : status === 'review' ? { bg: '#FFEDD5', border: '#FDBA74', fg: '#9A3412' }
    : status === 'resolved' ? { bg: '#E8F5EE', border: '#A7F3D0', fg: '#1A5C3A' }
    : { bg: COLORS.cardAlt, border: COLORS.border, fg: COLORS.textMuted };

  return (
    <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: tone.bg, border: `1px solid ${tone.border}`, fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: tone.fg }}>Dedup: {status === 'resolved' ? 'Resolved' : status === 'review' ? 'Awaiting review' : status === 'error' ? 'Processing error' : status === 'processing' ? 'Processing…' : 'Pending'}</span>
        {status === 'resolved' && resolution && (
          <>
            <span style={{ color: COLORS.textMuted }}>
              {resolution.method === 'auto_merged' ? 'auto-merged'
                : resolution.method === 'created_new' ? 'created new'
                : resolution.method === 'user_resolved' ? 'user-resolved'
                : resolution.method === 'no_match' ? 'no entity detected — triage below' : resolution.method}
              {typeof resolution.confidenceScore === 'number' ? ` · ${Math.round(resolution.confidenceScore)}% confidence` : ''}
            </span>
            {matchedContact && (
              <button onClick={() => navigate(personPath(matchedContact))}
                style={{ background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 600, textDecoration: 'underline' }}>
                → {matchedContact.name || '(person)'}
              </button>
            )}
            {matchedCompany && (
              <button onClick={() => navigate(companyPath(matchedCompany))}
                style={{ background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 600, textDecoration: 'underline' }}>
                → {matchedCompany.name || '(company)'}
              </button>
            )}
            {resolution.matchedContactId && (
              <button onClick={handleReEnrich} disabled={enriching}
                style={{ marginLeft: 'auto', padding: '4px 10px', background: enriching ? COLORS.border : COLORS.primary, color: '#fff', border: 'none', borderRadius: 4, cursor: enriching ? 'default' : 'pointer', fontSize: 11, fontWeight: 700 }}>
                {enriching ? 'Enriching…' : '✨ Re-run enrichment'}
              </button>
            )}
          </>
        )}
        {status === 'review' && (
          <button onClick={() => navigate('/review')}
            style={{ marginLeft: 'auto', padding: '4px 10px', background: COLORS.warning, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
            Open review queue
          </button>
        )}
        {status === 'error' && (
          <button onClick={handleRetry} disabled={retrying}
            style={{ marginLeft: 'auto', padding: '4px 10px', background: retrying ? COLORS.border : COLORS.danger, color: '#fff', border: 'none', borderRadius: 4, cursor: retrying ? 'default' : 'pointer', fontSize: 11, fontWeight: 700 }}>
            {retrying ? 'Retrying…' : '↻ Retry ingestion'}
          </button>
        )}
        {(status === 'resolved' || status === 'review') && (
          <button onClick={() => { if (window.confirm('Force-reprocess this interview from scratch? Existing auto-created person/company records will not be deleted.')) handleRetry(); }} disabled={retrying}
            title="Re-run extraction + dedup against the latest logic. Use this if a record failed to create or linked incorrectly."
            style={{ marginLeft: status === 'resolved' ? 0 : 'auto', padding: '4px 10px', background: retrying ? COLORS.border : COLORS.textMuted, color: '#fff', border: 'none', borderRadius: 4, cursor: retrying ? 'default' : 'pointer', fontSize: 11, fontWeight: 700 }}>
            {retrying ? 'Reprocessing…' : '↻ Force reprocess'}
          </button>
        )}
      </div>
      {status === 'error' && interview.processingError && (
        <div style={{ marginTop: 6, color: COLORS.danger, fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
          {interview.processingError}
        </div>
      )}
      {retryError && <div style={{ marginTop: 6, color: COLORS.danger, fontSize: 12 }}>Retry failed: {retryError}</div>}
      {enrichStatus && <div style={{ marginTop: 6, color: enrichStatus.ok ? COLORS.success : COLORS.danger, fontSize: 12 }}>{enrichStatus.msg}</div>}
    </div>
  );
}

function InterviewTriage({ interview, people, companies, linkPick, setLinkPick, busy, onLinkExisting, onCreateAndLink }) {
  const [expanded, setExpanded] = useState(false);
  const options = linkPick.type === 'company' ? companies : people;
  const sorted = [...options].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const intervieweeName = getIntervieweeName(interview);
  const intervieweeBusiness = getIntervieweeBusinessName(interview);

  if (!expanded) {
    return (
      <div style={{ marginTop: 10, fontSize: 12, color: COLORS.textMuted }}>
        Not linked.{' '}
        <button onClick={() => setExpanded(true)}
          style={{ background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', padding: 0, fontSize: 12, textDecoration: 'underline' }}>
          Triage manually
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, padding: 14, background: COLORS.cardAlt, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
          🔗 Manual triage
        </div>
        <button onClick={() => setExpanded(false)} disabled={busy}
          style={{ background: 'none', border: 'none', color: COLORS.textMuted, cursor: 'pointer', padding: 0, fontSize: 11 }}>
          Hide
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button onClick={() => setLinkPick({ type: 'person', id: '' })} disabled={busy}
          style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${linkPick.type === 'person' ? COLORS.primary : COLORS.border}`, background: linkPick.type === 'person' ? COLORS.primary : 'transparent', color: linkPick.type === 'person' ? '#fff' : COLORS.text, cursor: 'pointer', fontSize: 12 }}>
          👤 Person
        </button>
        <button onClick={() => setLinkPick({ type: 'company', id: '' })} disabled={busy}
          style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${linkPick.type === 'company' ? COLORS.primary : COLORS.border}`, background: linkPick.type === 'company' ? COLORS.primary : 'transparent', color: linkPick.type === 'company' ? '#fff' : COLORS.text, cursor: 'pointer', fontSize: 12 }}>
          🏢 Company
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <select value={linkPick.id} onChange={(e) => setLinkPick({ ...linkPick, id: e.target.value })} disabled={busy}
          style={{ flex: 1, padding: '6px 8px', borderRadius: 4, border: `1px solid ${COLORS.border}`, fontSize: 13, background: '#fff' }}>
          <option value="">— Select an existing {linkPick.type} —</option>
          {sorted.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.name || '(unnamed)'}</option>
          ))}
        </select>
        <button onClick={onLinkExisting} disabled={busy || !linkPick.id}
          style={{ padding: '6px 14px', borderRadius: 4, border: 'none', background: linkPick.id ? COLORS.primary : COLORS.border, color: '#fff', cursor: linkPick.id ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600 }}>
          {busy ? '…' : 'Link'}
        </button>
      </div>

      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 6 }}>Or create a new record from this interview:</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onCreateAndLink('person')} disabled={busy || !intervieweeName}
          style={{ padding: '6px 10px', borderRadius: 4, border: `1px solid ${COLORS.border}`, background: '#fff', cursor: busy || !intervieweeName ? 'not-allowed' : 'pointer', fontSize: 12, color: COLORS.text }}>
          ＋ New Person{intervieweeName ? ` "${intervieweeName}"` : ' (no name)'}
        </button>
        <button onClick={() => onCreateAndLink('company')} disabled={busy || !(intervieweeBusiness || intervieweeName)}
          style={{ padding: '6px 10px', borderRadius: 4, border: `1px solid ${COLORS.border}`, background: '#fff', cursor: busy ? 'not-allowed' : 'pointer', fontSize: 12, color: COLORS.text }}>
          ＋ New Company{intervieweeBusiness ? ` "${intervieweeBusiness}"` : ''}
        </button>
      </div>
    </div>
  );
}

export default function InterviewsListPage({ interviews, people, companies }) {
  const navigate = useNavigate();
  const peoplePath = '/crm/people';
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get('view');
  const [filter, setFilter] = useState(() => readFilter(searchParams, 'filter') || 'all');
  const [search, setSearch] = useState(() => readFilter(searchParams, 'q') || '');
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const { data: savedViews } = useCollection('views');
  const toast = useToast();

  useEffect(() => {
    if (!viewParam || !savedViews) return;
    const v = savedViews.find((sv) => sv.id === viewParam);
    if (!v || v.object_type !== 'interview') return;
    const f = parseFilters(v);
    if (f.filter) setFilter(f.filter);
    if (f.q) setSearch(f.q);
    const next = new URLSearchParams(searchParams); next.delete('view');
    setSearchParams(next, { replace: true });
  }, [viewParam, savedViews]);

  useEffect(() => {
    const next = new URLSearchParams(encodeFiltersToSearch({ q: search, filter: filter === 'all' ? '' : filter }));
    setSearchParams(next, { replace: true });
  }, [search, filter]);

  const enriched = useMemo(() => {
    const peopleById = Object.fromEntries(people.map((p) => [p.id, p]));
    const companiesById = Object.fromEntries(companies.map((c) => [c.id, c]));
    return interviews.map((iv) => {
      const linkedRecord = iv.linkedType === 'person' ? peopleById[iv.linkedContactId]
        : iv.linkedType === 'company' ? companiesById[iv.linkedContactId]
        : null;
      return { ...iv, linkedRecord };
    });
  }, [interviews, people, companies]);

  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = enriched.filter((iv) => {
      if (filter === 'unlinked' && iv.linkedRecord) return false;
      if (filter === 'linked' && !iv.linkedRecord) return false;
      if (!search) return true;
      return [getIntervieweeName(iv), getIntervieweeBusinessName(iv), iv.linkedRecord?.name]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
    return [...filtered].sort((a, b) =>
      String(getInterviewDate(b) || '').localeCompare(String(getInterviewDate(a) || ''))
    );
  }, [enriched, filter, search]);

  const FilterChip = ({ value, label, count }) => (
    <button onClick={() => setFilter(value)}
      style={{ padding: '6px 12px', fontSize: 12, borderRadius: 999, border: `1px solid ${filter === value ? COLORS.accent : COLORS.border}`, background: filter === value ? COLORS.accent : COLORS.card, color: filter === value ? '#fff' : COLORS.text, cursor: 'pointer', fontWeight: filter === value ? 600 : 400 }}>
      {label} <span style={{ opacity: 0.7 }}>({count})</span>
    </button>
  );

  const counts = {
    all: enriched.length,
    unlinked: enriched.filter((iv) => !iv.linkedRecord).length,
    linked: enriched.filter((iv) => iv.linkedRecord).length,
  };

  const exportColumns = [
    { header: 'Interviewee', accessor: (r) => getIntervieweeName(r) || getIntervieweeBusinessName(r) || '' },
    { header: 'Business', accessor: (r) => getIntervieweeBusinessName(r) || '' },
    { header: 'Date', accessor: (r) => getInterviewDate(r) || '' },
    { header: 'Dedup', accessor: (r) => r.dedupStatus || '' },
    { header: 'Linked Type', accessor: (r) => r.linkedType || '' },
    { header: 'Linked Name', accessor: (r) => r.linkedRecord?.name || '' },
  ];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: COLORS.text, margin: 0 }}>
          🎙️ Interviews <span style={{ color: COLORS.textDim, fontSize: 16, fontWeight: 400 }}>({interviews.length})</span>
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="text" placeholder="Search interviews…" value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 12px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, minWidth: 220 }} />
          <button onClick={() => setSaveViewOpen(true)}
            style={{ padding: '7px 12px', background: COLORS.cardAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            💾 Save view
          </button>
          <ExportCSVButton rows={sorted} columns={exportColumns} filename="interviews-export" />
        </div>
      </div>

      <SuggestedInterviews people={people} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <FilterChip value="all" label="All" count={counts.all} />
        <FilterChip value="unlinked" label="Unlinked" count={counts.unlinked} />
        <FilterChip value="linked" label="Linked" count={counts.linked} />
      </div>

      {sorted.length === 0 && interviews.length === 0 ? (
        <EmptyState
          icon="🎙️"
          title="No interviews yet"
          body="Record discovery interviews and link them to the matching person or company."
          primaryAction={{ label: 'Schedule your first', onClick: () => navigate(peoplePath) }}
        />
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: COLORS.textDim, backgroundColor: COLORS.card, borderRadius: 8, border: `1px dashed ${COLORS.border}` }}>
          No interviews match.
        </div>
      ) : (
        <div style={{ backgroundColor: COLORS.card, borderRadius: 8, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.4fr', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: 'uppercase', borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.cardAlt }}>
            <div>Interviewee</div><div>Date</div><div>Linked To</div>
          </div>
          {sorted.map((iv) => {
            const displayName = getIntervieweeName(iv) || getIntervieweeBusinessName(iv);
            return (
              <div key={iv.id} onClick={() => navigate(interviewPath(iv))}
                style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.4fr', padding: '12px 16px', fontSize: 13, borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer', alignItems: 'center' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.primaryLight; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
                <div style={{ fontWeight: 600 }}>
                  {displayName || <span style={{ color: COLORS.textDim, fontStyle: 'italic' }}>(unnamed)</span>}
                  <DedupStatusPill status={iv.dedupStatus} />
                </div>
                <div style={{ color: COLORS.textMuted }}>{formatInterviewDate(iv) || '—'}</div>
                <div style={{ color: COLORS.textMuted }}>
                  {iv.linkedRecord ? (
                    <span><span style={{ fontSize: 11, color: COLORS.textDim }}>{iv.linkedType === 'company' ? '🏢' : '👤'}</span> {iv.linkedRecord.name}</span>
                  ) : (
                    <span style={{ color: COLORS.warning, fontStyle: 'italic' }}>Unlinked</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SaveViewModal
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        objectType="interview"
        filters={{ q: search, filter }}
        onSaved={() => toast && toast.success && toast.success('View pinned to sidebar.')}
      />
    </div>
  );
}

export function InterviewDetailRoute({ interviews, people, companies, scripts, onUpdate, onLink, onCreatePerson, onCreateCompany, onEnrich }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('questions');
  const [linkPick, setLinkPick] = useState({ type: 'person', id: '' });
  const [linkBusy, setLinkBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState(null);

  const interview = interviews.find((i) => i.id === id);

  const resolvedType = interview?.linkedType
    || (interview?.dedupResolution?.matchedContactId ? 'person'
      : interview?.dedupResolution?.matchedBusinessId ? 'company' : null);
  const resolvedId = interview?.linkedContactId
    || interview?.dedupResolution?.matchedContactId
    || interview?.dedupResolution?.matchedBusinessId
    || null;
  const linkedRecord = resolvedType === 'person'
    ? people.find((p) => p.id === resolvedId)
    : resolvedType === 'company'
    ? companies.find((c) => c.id === resolvedId)
    : null;

  useEffect(() => {
    if (!interview) return;
    if (interview.linkedType && interview.linkedContactId) return;
    if (!resolvedType || !resolvedId) return;
    if (!linkedRecord) return;
    onUpdate(interview.id, { linkedType: resolvedType, linkedContactId: resolvedId }).catch((err) => console.error('auto-link interview failed', err));
  }, [interview?.id, resolvedType, resolvedId, linkedRecord?.id]);

  if (!interview) {
    return (
      <div style={{ padding: 20 }}>
        <button onClick={() => navigate(interviewsListPath('deal_flow'))} style={{ marginBottom: 12, background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ← Back to Interviews
        </button>
        <div style={{ padding: 40, textAlign: 'center', color: COLORS.textDim }}>Interview not found.</div>
      </div>
    );
  }

  const summaryText = getInterviewSummary(interview);
  const transcriptText = getInterviewTranscript(interview);
  const activeText = tab === 'summary' ? summaryText : transcriptText;
  const activeUrl = tab === 'summary' ? getInterviewSummaryUrl(interview) : getInterviewTranscriptUrl(interview);

  const inferredScriptType = interview.script_type || (resolvedType === 'person' ? 'pro' : 'biz');
  const activeScript = scripts.find((s) => s.type === inferredScriptType || s.id === inferredScriptType);
  const totalQuestions = activeScript ? activeScript.sections.reduce((acc, s) => acc + s.questions.length, 0) : 0;
  const askedIds = new Set(interview.questions_asked || []);
  const askedCount = askedIds.size;
  const progressPct = totalQuestions > 0 ? Math.round((askedCount / totalQuestions) * 100) : 0;
  const resolveColor = (k) => COLORS[k] || k || COLORS.primary;

  const toggleQuestion = async (qid) => {
    const next = new Set(askedIds);
    if (next.has(qid)) next.delete(qid); else next.add(qid);
    await onUpdate(interview.id, { questions_asked: Array.from(next) });
  };

  const setScriptType = async (t) => { await onUpdate(interview.id, { script_type: t }); };

  const handleAnalyze = async () => {
    if (!linkedRecord) { setAnalyzeStatus({ ok: false, msg: 'Link this interview to a person or company first.' }); return; }
    setAnalyzing(true);
    setAnalyzeStatus(null);
    const ok = await onEnrich(resolvedType, linkedRecord.id, interview.id);
    setAnalyzing(false);
    setAnalyzeStatus(ok ? { ok: true, msg: '✓ Analysis written to ' + (resolvedType === 'company' ? 'company' : 'person') + '.' } : { ok: false, msg: 'Analysis failed — check Settings / Drive permissions.' });
    if (ok) setTimeout(() => setAnalyzeStatus(null), 3500);
  };

  const TabBtn = ({ value, label, hasContent, badge }) => (
    <button onClick={() => setTab(value)}
      style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: `2px solid ${tab === value ? COLORS.accent : 'transparent'}`, color: tab === value ? COLORS.text : COLORS.textMuted, cursor: 'pointer', fontSize: 14, fontWeight: tab === value ? 600 : 400 }}>
      {label} {hasContent && <span style={{ fontSize: 10, color: COLORS.success }}>●</span>}
      {typeof badge === 'string' && badge && <span style={{ fontSize: 10, color: COLORS.textDim, marginLeft: 4 }}>{badge}</span>}
    </button>
  );

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => navigate(interviewsListPath(interview?.workspace || 'deal_flow'))} style={{ marginBottom: 12, background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
        ← Back to Interviews
      </button>

      <div style={{ backgroundColor: COLORS.card, borderRadius: 12, padding: 28, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <h1 style={{ margin: '0 0 4px', color: COLORS.text, fontFamily: DISPLAY, fontSize: 28 }}>
          {getInterviewHeadline(interview) || 'Untitled Interview'}
        </h1>
        {linkedRecord && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button onClick={handleAnalyze} disabled={analyzing || !transcriptText}
              title={!transcriptText ? 'Load transcript first' : ''}
              style={{ padding: '8px 14px', backgroundColor: transcriptText ? COLORS.accent : COLORS.border, color: '#fff', border: 'none', borderRadius: 6, cursor: analyzing || !transcriptText ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}>
              {analyzing ? 'Analyzing…' : '✨ Analyze & write-back'}
            </button>
            {analyzeStatus && <div style={{ fontSize: 11, color: analyzeStatus.ok ? COLORS.success : COLORS.danger }}>{analyzeStatus.msg}</div>}
          </div>
        )}
        </div>
        <div style={{ color: COLORS.textMuted, fontSize: 14, marginBottom: 12 }}>
          {formatInterviewDate(interview) || 'No date'}
          {interview.dedupStatus ? <> · <DedupStatusPill status={interview.dedupStatus} /></> : null}
        </div>
        <DedupResolutionPanel interview={interview} people={people} companies={companies} />
        <div style={{ fontSize: 13, color: COLORS.textMuted }}>
          {linkedRecord ? (
            <>
              Linked to{' '}
              <button onClick={() => navigate(resolvedType === 'company' ? companyPath(linkedRecord) : personPath(linkedRecord))}
                style={{ background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', padding: 0, fontSize: 13, fontWeight: 600, textDecoration: 'underline' }}>
                {resolvedType === 'company' ? '🏢' : '👤'} {linkedRecord.name || '(unnamed)'}
              </button>
              {' · '}
              <button onClick={async () => { if (window.confirm('Unlink this interview?')) { await onLink(interview.id, '', ''); } }}
                style={{ background: 'none', border: 'none', color: COLORS.textMuted, cursor: 'pointer', padding: 0, fontSize: 12, textDecoration: 'underline' }}>
                Unlink
              </button>
            </>
          ) : (
            <InterviewTriage
              interview={interview}
              people={people}
              companies={companies}
              linkPick={linkPick}
              setLinkPick={setLinkPick}
              busy={linkBusy}
              onLinkExisting={async () => {
                if (!linkPick.id) return;
                setLinkBusy(true);
                await onLink(interview.id, linkPick.type, linkPick.id);
                setLinkBusy(false);
                const row = linkPick.type === 'company' ? companies.find((c) => c.id === linkPick.id) : people.find((p) => p.id === linkPick.id);
                if (row) navigate(linkPick.type === 'company' ? companyPath(row) : personPath(row));
              }}
              onCreateAndLink={async (kind) => {
                setLinkBusy(true);
                const ws = interview?.workspace || 'deal_flow';
                const seedName = getIntervieweeName(interview);
                const seedBusiness = getIntervieweeBusinessName(interview);
                const seed = kind === 'company'
                  ? { name: seedName || seedBusiness || '', company: seedBusiness || '', status: 'new', workspace: ws }
                  : { name: seedName || '', company: seedBusiness || '', status: 'new', workspace: ws };
                const newId = `${kind}-${Date.now()}`;
                if (kind === 'company') await onCreateCompany({ ...seed, id: newId });
                else await onCreatePerson({ ...seed, id: newId });
                await onLink(interview.id, kind, newId);
                setLinkBusy(false);
                const fresh = { id: newId, workspace: ws };
                navigate(kind === 'company' ? companyPath(fresh) : personPath(fresh));
              }}
            />
          )}
        </div>
      </div>

      <div style={{ backgroundColor: COLORS.card, borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.cardAlt }}>
          <TabBtn value="questions" label="✅ Questions" badge={totalQuestions ? `${askedCount}/${totalQuestions}` : ''} />
          <TabBtn value="summary" label="📝 Summary" hasContent={!!summaryText} />
          <TabBtn value="transcript" label="📄 Transcript" hasContent={!!transcriptText} />
          <TabBtn value="timeline" label="🕑 Timeline" />
        </div>
        <div style={{ padding: 24 }}>
          {tab === 'timeline' ? (
            <Timeline entityType="interview" entityId={interview.id} />
          ) : tab === 'questions' ? (
            !activeScript ? (
              <div style={{ color: COLORS.textDim, fontStyle: 'italic' }}>No script available. Seed scripts from migrations or create in Scripts → Edit.</div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, color: COLORS.textDim, fontWeight: 600 }}>Script:</span>
                  <select value={inferredScriptType} onChange={(e) => setScriptType(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: 4, border: `1px solid ${COLORS.border}`, fontSize: 12 }}>
                    <option value="pro">PRO (practitioner)</option>
                    <option value="biz">BIZ (business owner)</option>
                  </select>
                  <div style={{ flex: 1, height: 8, background: COLORS.border, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${progressPct}%`, height: '100%', background: COLORS.success, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, minWidth: 72, textAlign: 'right' }}>{askedCount} / {totalQuestions} ({progressPct}%)</span>
                </div>
                {activeScript.sections.map((section) => (
                  <div key={section.id} style={{ marginBottom: 20 }}>
                    <div style={{ color: resolveColor(section.color), fontWeight: 700, fontSize: 14, marginBottom: 8, borderLeft: `4px solid ${resolveColor(section.color)}`, paddingLeft: 10 }}>{section.name}</div>
                    {section.questions.map((q) => {
                      const checked = askedIds.has(q.id);
                      return (
                        <label key={q.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 10, marginBottom: 6, background: checked ? COLORS.primaryLight : 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', opacity: checked ? 0.75 : 1 }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleQuestion(q.id)} style={{ marginTop: 3, accentColor: COLORS.success, cursor: 'pointer' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: 14, color: COLORS.text, textDecoration: checked ? 'line-through' : 'none' }}>{q.q}</div>
                            {q.why && <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 3 }}>{q.why}</div>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            )
          ) : activeText ? (
            <>
              <div className="markdown-body" style={{ fontFamily: FONT, fontSize: 14, lineHeight: 1.6, color: COLORS.text }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeText}</ReactMarkdown>
              </div>
              {activeUrl && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.textDim }}>
                  <a href={activeUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.primary }}>Open original in Drive ↗</a>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              {activeUrl ? (
                <>
                  <p style={{ color: COLORS.textMuted, marginBottom: 12, fontSize: 14 }}>
                    No cached {tab === 'summary' ? 'summary' : 'transcript'} on this interview yet.
                  </p>
                  <a href={activeUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.primary, fontSize: 13 }}>
                    Open original in Drive ↗
                  </a>
                </>
              ) : (
                <div style={{ color: COLORS.textDim, fontStyle: 'italic' }}>
                  No {tab === 'summary' ? 'summary' : 'transcript'} on this interview.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <TasksCard entityType="interview" entityId={interview.id} recordLabel="interview" />
    </div>
  );
}
