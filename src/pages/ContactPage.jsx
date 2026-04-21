import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LIFECYCLE_STAGES, INDUSTRIES, REVENUE_BANDS, ENTITY_TYPES, US_STATES, isValidTransition } from '../config/enums';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { historyForField } from '../lib/dedup/enrichmentMerge.js';
import { useCollection } from '../hooks/useCollection';
import { useToast } from '../components/ui/Toast';
import { parseFilters, readFilter, encodeFiltersToSearch } from '../data/views';
import { logInteraction } from '../data/interactions';
import { companyPath } from '../config/workspaces';

import LifecycleStagePill from '../components/ui/LifecycleStagePill';
import { TagChips, TagPicker, RoleChips, RolePicker } from '../components/ui/TagChips';
import DedupeModal, { findDuplicatePerson, findDuplicateCompany } from '../components/ui/DedupeModal';
import LifecycleChangeModal from '../components/ui/LifecycleChangeModal';
import SaveViewModal from '../components/ui/SaveViewModal';
import ExportCSVButton from '../components/ui/ExportCSVButton';
import ImportCSVModal from '../components/ui/ImportCSVModal';
import DataTable from '../components/table/DataTable';
import FilterBar from '../components/table/FilterBar';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import GmailInbox from '../components/ui/GmailInbox';
import ContactTimeline from '../components/Timeline.jsx';
import CompanyContactsSection from '../components/CompanyContactsSection.jsx';
import MergeContactModal from '../components/MergeContactModal.jsx';
import TasksCard from '../components/ui/TasksCard';
import DealsCard from '../components/ui/DealsCard';
import TargetsCard from '../components/ui/TargetsCard';
import ConvertWizard from '../components/ui/ConvertWizard';
import { useConfirm } from '../components/ui/ConfirmDialog';

const inputStyle = {
  width: '100%',
  padding: '10px',
  backgroundColor: COLORS.card,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '4px',
  boxSizing: 'border-box',
  fontSize: '14px',
};

const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontSize: 14, color: COLORS.textMuted };

export const V2_SCHEMA = {
  person: {
    label: 'People',
    singular: 'Person',
    icon: '👥',
    idPrefix: 'person',
    nameField: 'name',
    orgField: 'company',
    orgLabel: 'Firm Name',
    coreFields: [
      { key: 'name', label: 'Full Name', required: true },
      { key: 'company', label: 'Firm Name', required: true },
      { key: 'role', label: 'Role' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'location', label: 'Location (City, State)' },
    ],
    firmFields: [
      { key: 'industry', label: 'Industry' },
      { key: 'firmSize', label: 'Firm Size' },
      { key: 'clientCount', label: 'Client Count' },
      { key: 'avgClientRevenue', label: 'Avg Client Revenue' },
      { key: 'yearsInPractice', label: 'Years in Practice' },
      { key: 'leadScore', label: 'Lead Score (1-10)' },
    ],
    richFields: ['softwareStack', 'painPoints', 'wtpSignals', 'quotableLines', 'known_pains'],
    statusOptions: ['new', 'contacted', 'interested', 'declined'],
    lifecycleStages: LIFECYCLE_STAGES,
  },
  company: {
    label: 'Companies',
    singular: 'Company',
    icon: '🏢',
    idPrefix: 'company',
    nameField: 'name',
    orgField: 'company',
    orgLabel: 'Company',
    coreFields: [
      { key: 'name', label: 'Owner Name', required: true },
      { key: 'company', label: 'Company', required: true },
      { key: 'role', label: 'Role' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'location', label: 'Location (City, State)' },
    ],
    firmFields: [
      { key: 'industry', label: 'Industry', type: 'select', options: INDUSTRIES },
      { key: 'sub_vertical', label: 'Sub-vertical' },
      { key: 'revenue_band', label: 'Revenue band', type: 'select', options: REVENUE_BANDS },
      { key: 'revenue', label: 'Revenue (specific)' },
      { key: 'employee_count', label: 'Employees' },
      { key: 'entity_type', label: 'Entity type', type: 'select', options: ENTITY_TYPES },
      { key: 'state', label: 'State', type: 'select', options: US_STATES },
      { key: 'yearsInBusiness', label: 'Years in Business' },
      { key: 'currentAccounting', label: 'Current Accounting Setup' },
      { key: 'monthsBehind', label: 'Months Behind on Books' },
      { key: 'currentSpend', label: 'Current Annual Accounting Spend' },
      { key: 'leadScore', label: 'Lead Score (1-10)' },
      { key: 'parent_company_id', label: 'Parent Company ID' },
    ],
    richFields: ['painPoints', 'wtpSignals', 'quotableLines', 'known_pricing_signals'],
    statusOptions: ['new', 'contacted', 'interested', 'hired', 'declined'],
    lifecycleStages: LIFECYCLE_STAGES,
  },
};

function StatusPill({ status }) {
  const s = status || 'new';
  const colors = {
    new: { bg: '#EBF3FC', fg: '#2563A0' },
    contacted: { bg: '#FBF6E8', fg: '#9A7B2C' },
    interested: { bg: '#E8F5EE', fg: '#1A5C3A' },
    hired: { bg: '#F3EFFE', fg: '#6B4FA0' },
    declined: { bg: '#FCE8E8', fg: '#DC2626' },
    enriched: { bg: '#E8F5EE', fg: '#1A5C3A' },
  };
  const c = colors[s] || colors.new;
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: c.bg, color: c.fg, textTransform: 'capitalize' }}>{s}</span>;
}

function V2Form({ cfg, formData, setFormData, onSave, onCancel, saveStatus, isEditing, tags = [], kind, workspace = 'crm' }) {
  const isSaving = saveStatus === 'saving';
  const isSuccess = saveStatus === 'success';
  const isError = saveStatus === 'error';
  const btnLabel = isSaving ? 'Saving…' : isSuccess ? `✓ ${cfg.singular} ${isEditing ? 'Updated' : 'Created'}!` : isError ? '✗ Retry' : 'Save';
  const allFields = [...cfg.coreFields, ...cfg.firmFields];
  const updateField = (k, v) => setFormData((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {allFields.map((f) => (
          <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {f.label}{f.required && <span style={{ color: COLORS.danger }}> *</span>}
            </label>
            {f.type === 'select' ? (
              <select value={formData[f.key] || ''} onChange={(e) => updateField(f.key, e.target.value)} style={inputStyle}>
                {f.options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            ) : (
              <input type={f.type || 'text'} value={formData[f.key] || ''} onChange={(e) => updateField(f.key, e.target.value)} style={inputStyle} />
            )}
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3 }}>Lifecycle Stage</label>
          <select value={formData.lifecycle_stage || 'Research-Contact'} onChange={(e) => updateField('lifecycle_stage', e.target.value)} style={inputStyle}>
            {(cfg.lifecycleStages || LIFECYCLE_STAGES).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3 }}>Status (legacy)</label>
          <select value={formData.status || 'new'} onChange={(e) => updateField('status', e.target.value)} style={inputStyle}>
            {cfg.statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3 }}>Interview Date</label>
          <input type="date" value={formData.interviewDate || ''} onChange={(e) => updateField('interviewDate', e.target.value)} style={inputStyle} />
        </div>
      </div>
      {kind === 'company' && workspace === 'deal_flow' && (
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 6 }}>Roles</label>
          <RolePicker selected={formData.roles || []} onChange={(roles) => updateField('roles', roles)} />
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3, display: 'block', marginBottom: 6 }}>Tags</label>
        <TagPicker tags={tags} selectedIds={formData.tag_ids || []} onChange={(ids) => updateField('tag_ids', ids)} scope={kind} />
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3 }}>Notes</label>
        <textarea value={formData.notes || ''} onChange={(e) => updateField('notes', e.target.value)} style={{ ...inputStyle, width: '100%', minHeight: 80, marginTop: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: '10px 16px', backgroundColor: COLORS.border, color: COLORS.text, border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
        <button onClick={onSave} disabled={isSaving || isSuccess}
          style={{ padding: '10px 18px', minWidth: 160, backgroundColor: isError ? COLORS.danger : COLORS.success, color: '#fff', border: 'none', borderRadius: 6, cursor: isSaving || isSuccess ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {isSaving && <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'autopilot-spin 0.7s linear infinite' }} />}
          {btnLabel}
        </button>
      </div>
      <style>{`@keyframes autopilot-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function formatActionLabel(action) {
  switch (action) {
    case 'filled': return 'filled';
    case 'overwrote': return 'overwrote';
    case 'unioned': return 'merged items';
    case 'suppressed_low_confidence': return 'suppressed (low confidence)';
    case 'suppressed_existing_higher': return 'suppressed (existing higher)';
    default: return action;
  }
}

function formatMergeValue(v) {
  if (v == null) return '—';
  if (Array.isArray(v)) return v.length > 0 ? `[${v.slice(0, 5).join(', ')}${v.length > 5 ? `, +${v.length - 5}` : ''}]` : '[]';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
  const s = String(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

function EnrichmentFieldClock({ history, field }) {
  const [open, setOpen] = useState(false);
  const entries = historyForField(history, field);
  if (!entries.length) return null;
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 6 }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={`${entries.length} enrichment event${entries.length === 1 ? '' : 's'} for ${field}`}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, color: COLORS.textMuted }}>
        🕑
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50, minWidth: 280, maxWidth: 420, padding: 10, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', fontSize: 11, color: COLORS.text }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>History · {field}</div>
          {entries.slice().reverse().map((e, i) => (
            <div key={i} style={{ padding: '6px 0', borderTop: i === 0 ? 'none' : `1px solid ${COLORS.border}` }}>
              <div style={{ color: COLORS.textMuted, fontSize: 10 }}>{e.at ? new Date(e.at).toLocaleString() : '—'}</div>
              <div><strong>{formatActionLabel(e.action)}</strong>{typeof e.incomingConfidence === 'number' ? ` · conf ${e.incomingConfidence}` : ''}{typeof e.existingConfidence === 'number' ? ` / existing ${e.existingConfidence}` : ''}</div>
              <div style={{ color: COLORS.textMuted }}>from {formatMergeValue(e.from)}</div>
              <div style={{ color: COLORS.text }}>to {formatMergeValue(e.to)}</div>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

function EnrichmentHistorySection({ history }) {
  const [open, setOpen] = useState(false);
  if (!Array.isArray(history) || history.length === 0) return null;
  const events = history.slice().reverse();
  return (
    <Section title={`✨ Enrichment History (${history.length})`}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: `1px solid ${COLORS.border}`, color: COLORS.textMuted, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginBottom: 8 }}>
        {open ? 'Hide events' : 'Show events'}
      </button>
      {open && events.map((evt, i) => (
        <div key={i} style={{ padding: 10, marginBottom: 8, border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 12, background: COLORS.cardAlt }}>
          <div style={{ color: COLORS.textMuted, fontSize: 11, marginBottom: 6 }}>
            {evt.at ? new Date(evt.at).toLocaleString() : '—'}
            {typeof evt.overallConfidence === 'number' ? ` · overall ${evt.overallConfidence}%` : ''}
            {evt.sourceInterviewId || evt.interviewId ? ` · interview ${(evt.sourceInterviewId || evt.interviewId).slice(0, 8)}…` : ''}
          </div>
          {(evt.changes || []).map((ch, j) => (
            <div key={j} style={{ padding: '4px 0', borderTop: j === 0 ? 'none' : `1px solid ${COLORS.border}` }}>
              <div><strong>{ch.field}</strong> · {formatActionLabel(ch.action)}
                {typeof ch.incomingConfidence === 'number' ? ` · conf ${ch.incomingConfidence}` : ''}
                {typeof ch.existingConfidence === 'number' ? ` / existing ${ch.existingConfidence}` : ''}
              </div>
              <div style={{ color: COLORS.textMuted }}>from {formatMergeValue(ch.from)}</div>
              <div style={{ color: COLORS.text }}>to {formatMergeValue(ch.to)}</div>
            </div>
          ))}
        </div>
      ))}
    </Section>
  );
}

function Tile({ label, value, history, fieldName }) {
  return (
    <div style={{ padding: 14, backgroundColor: COLORS.cardAlt, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
        {history && fieldName && <EnrichmentFieldClock history={history} field={fieldName} />}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{value || <span style={{ color: COLORS.textDim, fontWeight: 400 }}>—</span>}</div>
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, color: COLORS.text, margin: '0 0 10px', fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );
}
function ChipList({ items, color }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((it, i) => (
        <span key={i} style={{ padding: '5px 12px', borderRadius: 14, fontSize: 12, backgroundColor: color + '15', color, border: `1px solid ${color}30` }}>{String(it)}</span>
      ))}
    </div>
  );
}
function KVList({ obj }) {
  const entries = Object.entries(obj).filter(([, v]) => v);
  if (!entries.length) return <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic' }}>No data extracted.</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6, fontSize: 13 }}>
      {entries.map(([k, v]) => (
        <React.Fragment key={k}>
          <div style={{ color: COLORS.textDim, fontWeight: 600 }}>{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</div>
          <div style={{ color: COLORS.text }}>{String(v)}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

function RelatedPanel({ row, kind, allPeople, allCompanies }) {
  const navigate = useNavigate();
  const norm = (s) => (s || '').trim().toLowerCase();

  const linkStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: `1px solid ${COLORS.border}`, borderRadius: 6, marginBottom: 6, cursor: 'pointer', fontSize: 13, background: COLORS.cardAlt };

  if (kind === 'person') {
    const company = allCompanies.find((c) => c.id === row.company_id) || allCompanies.find((c) => norm(c.name) === norm(row.company) || norm(c.company) === norm(row.company));
    if (!company) return null;
    return (
      <Section title="🏢 Related Company">
        <div style={linkStyle} onClick={() => navigate(companyPath(company))}>
          <div>
            <div style={{ fontWeight: 600 }}>{company.name || company.company}</div>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
              {company.industry && <>{company.industry}</>}
              {company.revenue_band && <> · {company.revenue_band}</>}
              {company.lifecycle_stage && <> · {company.lifecycle_stage}</>}
            </div>
          </div>
          <div style={{ color: COLORS.textDim, fontSize: 16 }}>›</div>
        </div>
      </Section>
    );
  }

  const parent = row.parent_company_id ? allCompanies.find((c) => c.id === row.parent_company_id) : null;
  const subsidiaries = allCompanies.filter((c) => c.parent_company_id === row.id);

  return (
    <>
      {parent && (
        <Section title="⬆️ Parent Company">
          <div style={linkStyle} onClick={() => navigate(companyPath(parent))}>
            <div style={{ fontWeight: 600 }}>{parent.name || parent.company}</div>
            <div style={{ color: COLORS.textDim, fontSize: 16 }}>›</div>
          </div>
        </Section>
      )}
      {subsidiaries.length > 0 && (
        <Section title={`🏬 Subsidiaries (${subsidiaries.length})`}>
          {subsidiaries.map((s) => (
            <div key={s.id} style={linkStyle} onClick={() => navigate(companyPath(s))}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.name || s.company}</div>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{s.industry || ''}{s.revenue_band && ` · ${s.revenue_band}`}</div>
              </div>
              <div style={{ color: COLORS.textDim, fontSize: 16 }}>›</div>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}

function ContactDetail({ row, kind, onClose, onEdit, onDelete, allPeople = [], allCompanies = [] }) {
  const cfg = V2_SCHEMA[kind];
  const navigate = useNavigate();
  const [convertOpen, setConvertOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const parse = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };

  const CONVERTIBLE = new Set(['Research-Contact', 'Subscriber', 'Lead']);
  const canConvert = kind === 'person' && CONVERTIBLE.has(row.lifecycle_stage || 'Research-Contact');

  const pains = parse(row.painPoints);
  const wtp = parse(row.wtpSignals);
  const quotes = parse(row.quotableLines);
  const softwareStack = parse(row.softwareStack);

  const norm = (s) => (s || '').trim().toLowerCase();
  const companyContacts = useMemo(() => {
    if (kind !== 'company') return [];
    const ws = row.workspace || 'crm';
    return allPeople
      .filter((p) => (p.workspace || 'deal_flow') === ws)
      .filter((p) => (p.company_id && p.company_id === row.id)
        || (row.name && norm(p.company) === norm(row.name))
        || (row.company && norm(p.company) === norm(row.company)));
  }, [kind, row, allPeople]);
  const companyContactIds = useMemo(() => companyContacts.map((p) => p.id), [companyContacts]);

  const mergeCandidates = useMemo(() => {
    const pool = kind === 'person' ? allPeople : allCompanies;
    const ws = row.workspace || 'deal_flow';
    return pool.filter((c) => c.id !== row.id && (c.workspace || 'deal_flow') === ws);
  }, [kind, allPeople, allCompanies, row.id, row.workspace]);
  const peopleById = useMemo(() => {
    const map = {};
    companyContacts.forEach((p) => { map[p.id] = p; });
    return map;
  }, [companyContacts]);

  const scopedIds = useMemo(
    () => (kind === 'company' ? [row.id, ...companyContactIds].slice(0, 30) : []),
    [kind, row.id, companyContactIds],
  );
  const { data: scopedInterviews } = useCollection('interviews', {
    filters: scopedIds.length ? [['linkedContactId', 'in', scopedIds]] : [],
    enabled: kind === 'company' && scopedIds.length > 0,
  });
  const { data: scopedInteractions } = useCollection('interactions', {
    filters: scopedIds.length ? [['entity_id', 'in', scopedIds]] : [],
    enabled: kind === 'company' && scopedIds.length > 0,
  });

  const companyCounts = useMemo(() => {
    if (kind !== 'company') return null;
    const idSet = new Set([row.id, ...companyContactIds]);
    const interviewCount = (scopedInterviews || []).reduce((n, iv) => {
      const matchesCompany = iv.linkedType === 'company' && iv.linkedContactId === row.id;
      const matchesPerson = iv.linkedType === 'person' && companyContactIds.includes(iv.linkedContactId);
      return n + (matchesCompany || matchesPerson ? 1 : 0);
    }, 0);
    let callCount = 0;
    let noteCount = 0;
    (scopedInteractions || []).forEach((it) => {
      if (it.kind !== 'call' && it.kind !== 'note') return;
      const inScope = (it.entity_type === 'company' && it.entity_id === row.id)
        || (it.entity_type === 'person' && idSet.has(it.entity_id));
      if (!inScope) return;
      if (it.kind === 'call') callCount += 1;
      else noteCount += 1;
    });
    return { contacts: companyContacts.length, interviews: interviewCount, calls: callCount, notes: noteCount };
  }, [kind, row.id, companyContactIds, companyContacts.length, scopedInterviews, scopedInteractions]);

  return (
    <div style={{ padding: 20 }}>
      <button onClick={onClose} style={{ marginBottom: 12, background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
        ← Back to {cfg.label}
      </button>
      <div style={{ backgroundColor: COLORS.card, borderRadius: 12, padding: 28, border: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', color: COLORS.text, fontFamily: DISPLAY, fontSize: 32 }}>
              {row.name || '(Unnamed)'}
              {row.enrichedAt && <span title={`Enriched ${row.enrichedAt}`} style={{ fontSize: 18, marginLeft: 10 }}>✨</span>}
            </h1>
            <div style={{ color: COLORS.textMuted, fontSize: 15 }}>
              {row[cfg.orgField] || '—'}
              {row.role && <> · {row.role}</>}
              {row.location && <> · 📍 {row.location}</>}
            </div>
            <div style={{ marginTop: 8 }}>{row.lifecycle_stage ? <LifecycleStagePill stage={row.lifecycle_stage} size="lg" /> : <StatusPill status={row.status} />}</div>
            {kind === 'company' && companyCounts && (
              <div style={{ marginTop: 10, fontSize: 12, color: COLORS.textMuted }}>
                {companyCounts.contacts} contact{companyCounts.contacts === 1 ? '' : 's'}
                {' · '}
                {companyCounts.interviews} interview{companyCounts.interviews === 1 ? '' : 's'}
                {companyCounts.calls > 0 && <> · {companyCounts.calls} call{companyCounts.calls === 1 ? '' : 's'}</>}
                {companyCounts.notes > 0 && <> · {companyCounts.notes} note{companyCounts.notes === 1 ? '' : 's'}</>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {canConvert && (
              <button onClick={() => setConvertOpen(true)} style={{ padding: '8px 14px', backgroundColor: COLORS.success, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                🚀 Convert
              </button>
            )}
            <button onClick={onEdit} style={{ padding: '8px 14px', backgroundColor: COLORS.blueLight, color: COLORS.blue, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>✎ Edit</button>
            <button onClick={() => setMergeOpen(true)} style={{ padding: '8px 14px', backgroundColor: COLORS.cardAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontWeight: 600 }} title="Merge into another contact">⇉ Merge</button>
            <button onClick={onDelete} style={{ padding: '8px 14px', backgroundColor: '#FEF2F2', color: COLORS.danger, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>🗑 Delete</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {kind === 'company' ? (
            <>
              <Tile label="Industry" value={row.industry} history={row.enrichmentHistory} fieldName="industry" />
              <Tile label="Revenue" value={row.revenue} history={row.enrichmentHistory} fieldName="revenue" />
              <Tile label="Employees" value={row.employees} history={row.enrichmentHistory} fieldName="employees" />
              <Tile label="Years" value={row.yearsInBusiness} history={row.enrichmentHistory} fieldName="yearsInBusiness" />
              <Tile label="Lead Score" value={row.leadScore ? `${row.leadScore}/10` : null} />
            </>
          ) : (
            <>
              <Tile label="Firm Size" value={row.firmSize} history={row.enrichmentHistory} fieldName="firmSize" />
              <Tile label="Clients" value={row.clientCount} history={row.enrichmentHistory} fieldName="clientCount" />
              <Tile label="Avg Client Rev" value={row.avgClientRevenue} history={row.enrichmentHistory} fieldName="avgClientRevenue" />
              <Tile label="Years" value={row.yearsInPractice} history={row.enrichmentHistory} fieldName="yearsInPractice" />
              <Tile label="Lead Score" value={row.leadScore ? `${row.leadScore}/10` : null} />
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24, fontSize: 13 }}>
          {row.email && <div><strong>Email:</strong> {row.email}</div>}
          {row.phone && <div><strong>Phone:</strong> {row.phone}</div>}
          {row.interviewDate && <div><strong>Interviewed:</strong> {row.interviewDate}</div>}
          {kind === 'company' && row.currentAccounting && <div><strong>Accounting:</strong> {row.currentAccounting}</div>}
          {kind === 'company' && row.monthsBehind && <div><strong>Months Behind:</strong> {row.monthsBehind}</div>}
          {kind === 'company' && row.currentSpend && <div><strong>Current Spend:</strong> {row.currentSpend}</div>}
        </div>

        {Array.isArray(pains) && pains.length > 0 && (
          <Section title="😤 Pain Points"><ChipList items={pains} color={COLORS.danger} /></Section>
        )}
        {Array.isArray(softwareStack) && softwareStack.length > 0 && (
          <Section title="🛠 Software Stack"><ChipList items={softwareStack} color={COLORS.blue} /></Section>
        )}
        {wtp && typeof wtp === 'object' && (
          <Section title="💰 Willingness-to-Pay Signals"><KVList obj={wtp} /></Section>
        )}
        {Array.isArray(quotes) && quotes.length > 0 && (
          <Section title="💬 Quotable Lines">
            {quotes.map((q, i) => (
              <div key={i} style={{ padding: '10px 14px', backgroundColor: COLORS.cardAlt, borderLeft: `3px solid ${COLORS.accent}`, borderRadius: 4, marginBottom: 8, fontStyle: 'italic', fontSize: 13 }}>"{q}"</div>
            ))}
          </Section>
        )}
        {row.notes && (
          <Section title="📝 Notes">
            <div style={{ fontSize: 13, lineHeight: 1.7, color: COLORS.text, whiteSpace: 'pre-wrap' }}>{row.notes}</div>
          </Section>
        )}

        <RelatedPanel row={row} kind={kind} allPeople={allPeople} allCompanies={allCompanies} />

        {kind === 'company' && (
          <CompanyContactsSection
            company={row}
            contacts={companyContacts}
            interviews={scopedInterviews || []}
            interactions={scopedInteractions || []}
            workspaceId={row.workspace || 'crm'}
          />
        )}

        <DealsCard entityType={kind} entityId={row.id} />

        <TargetsCard entityType={kind} entityId={row.id} />

        <TasksCard entityType={kind} entityId={row.id} recordLabel={kind} />

        {kind === 'person' && row.email && <GmailInbox email={row.email} />}

        <EnrichmentHistorySection history={row.enrichmentHistory} />

        <ContactTimeline
          entityType={kind}
          entityId={row.id}
          contactIds={kind === 'company' ? companyContactIds : undefined}
          peopleById={kind === 'company' ? peopleById : undefined}
        />
      </div>

      {convertOpen && kind === 'person' && (
        <ConvertWizard
          person={row}
          companies={allCompanies}
          onClose={() => setConvertOpen(false)}
          onDone={() => setConvertOpen(false)}
        />
      )}
      {mergeOpen && (
        <MergeContactModal
          sourceContact={row}
          kind={kind}
          candidates={mergeCandidates}
          onClose={() => setMergeOpen(false)}
          onMerged={(target) => {
            setMergeOpen(false);
            const base = kind === 'person'
              ? ((target.workspace || 'deal_flow') === 'crm' ? '/crm/people' : '/deal-flow/practitioners')
              : ((target.workspace || 'deal_flow') === 'crm' ? '/crm/companies' : '/deal-flow/firms');
            navigate(`${base}/${target.id}`);
          }}
        />
      )}
    </div>
  );
}

export function V2ContactPage({ kind, basePath, rows, transcripts, onUpsert, onDelete, onLinkTranscript, onEnrich, loading, workspace = 'crm' }) {
  const cfg = V2_SCHEMA[kind];
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const editParam = searchParams.get('edit');
  const viewParam = searchParams.get('view');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState(() => readFilter(searchParams, 'q') || '');
  const [stageFilter, setStageFilter] = useState(() => readFilter(searchParams, 'stages', { asArray: true }) || []);
  const [tagFilter, setTagFilter] = useState(() => readFilter(searchParams, 'tags', { asArray: true }) || []);
  const [showArchived, setShowArchived] = useState(() => !!readFilter(searchParams, 'archived', { asBool: true }));
  const [saveStatus, setSaveStatus] = useState('idle');
  const [dedupe, setDedupe] = useState(null);
  const [lifecycleGate, setLifecycleGate] = useState(null);
  const emptyForm = { status: 'new', lifecycle_stage: 'Research-Contact', tag_ids: [] };
  const [formData, setFormData] = useState(emptyForm);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: tags } = useCollection('tags');
  const { data: savedViews } = useCollection('views');
  const toast = useToast();
  const kindObjectType = kind;

  useEffect(() => {
    if (!viewParam || !savedViews || savedViews.length === 0) return;
    const v = savedViews.find((sv) => sv.id === viewParam);
    if (!v || v.object_type !== kindObjectType) return;
    const f = parseFilters(v);
    setFilter(f.q || '');
    setStageFilter(f.stages || []);
    setTagFilter(f.tags || []);
    setShowArchived(!!f.archived);
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    setSearchParams(next, { replace: true });
  }, [viewParam, savedViews, kindObjectType]);

  useEffect(() => {
    const filters = { q: filter, stages: stageFilter, tags: tagFilter, archived: showArchived };
    const qs = encodeFiltersToSearch(filters);
    const next = new URLSearchParams(qs);
    const edit = searchParams.get('edit');
    if (edit) next.set('edit', edit);
    setSearchParams(next, { replace: true });
  }, [filter, stageFilter, tagFilter, showArchived]);

  useEffect(() => {
    if (!editParam) return;
    const row = rows.find((r) => r.id === editParam);
    if (row) {
      setFormData(row);
      setEditingId(row.id);
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }
  }, [editParam, rows]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormData(emptyForm);
      setEditingId(null);
      setShowForm(true);
      const next = new URLSearchParams(searchParams); next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (!showArchived && r.is_archived) return false;
    if (stageFilter.length > 0 && !stageFilter.includes(r.lifecycle_stage || 'Research-Contact')) return false;
    if (tagFilter.length > 0) {
      const rowTags = r.tag_ids || [];
      if (!tagFilter.some((t) => rowTags.includes(t))) return false;
    }
    if (filter) {
      const q = filter.toLowerCase();
      const matched = [r.name, r.company, r.email, r.industry, r.location]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      if (!matched) return false;
    }
    return true;
  }), [rows, showArchived, stageFilter, tagFilter, filter]);

  const openNew = () => { setFormData(emptyForm); setEditingId(null); setShowForm(true); };
  const openEdit = (row) => { setFormData({ ...emptyForm, ...row }); setEditingId(row.id); setShowForm(true); };
  const resetForm = () => { setFormData(emptyForm); setEditingId(null); setShowForm(false); setSaveStatus('idle'); };

  const doSave = async (override) => {
    setSaveStatus('saving');
    const payload = { ...(override || formData), id: editingId || `${cfg.idPrefix}-${Date.now()}` };
    const ok = await onUpsert(payload);
    if (ok) { setSaveStatus('success'); setTimeout(() => { resetForm(); }, 1000); }
    else { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 2500); }
  };

  const handleSave = async () => {
    if (saveStatus === 'saving') return;
    const missing = cfg.coreFields.filter((f) => f.required && !formData[f.key]).map((f) => f.label);
    if (missing.length) { toast.error('Required: ' + missing.join(', ')); return; }

    if (!editingId) {
      const dup = kind === 'person'
        ? findDuplicatePerson(rows, { email: formData.email, name: formData.name, company: formData.company })
        : findDuplicateCompany(rows, { domain: formData.domain || formData.website, name: formData.name });
      if (dup) { setDedupe(dup); return; }
    }

    if (editingId) {
      const prev = rows.find((r) => r.id === editingId);
      const from = prev?.lifecycle_stage;
      const to = formData.lifecycle_stage;
      if (from && to && from !== to && !isValidTransition(from, to)) {
        setLifecycleGate({ from, to });
        return;
      }
    }

    doSave();
  };

  const columns = [
    { key: 'name', header: 'Name', width: '1.4fr', render: (r) => (
      <span style={{ fontWeight: 600, color: COLORS.text }}>
        {r.name || <span style={{ color: COLORS.textDim, fontStyle: 'italic', fontWeight: 400 }}>(no name)</span>}
      </span>
    )},
    { key: cfg.orgField, header: cfg.orgLabel, width: '1.4fr', render: (r) => <span style={{ color: COLORS.textMuted }}>{r[cfg.orgField] || '—'}</span> },
    { key: 'industry', header: 'Industry', width: '1fr', render: (r) => <span style={{ color: COLORS.textMuted }}>{r.industry || '—'}</span> },
    { key: 'revenue', header: kind === 'person' ? 'Firm size' : 'Revenue', width: '0.9fr', render: (r) => <span style={{ color: COLORS.textMuted }}>{kind === 'person' ? (r.firmSize || '—') : (r.revenue_band || r.revenue || '—')}</span> },
    { key: 'lifecycle_stage', header: 'Stage', width: '0.9fr', render: (r) => r.lifecycle_stage ? <LifecycleStagePill stage={r.lifecycle_stage} /> : <StatusPill status={r.status} /> },
    ...(kind === 'company' && workspace === 'deal_flow' ? [
      { key: 'roles', header: 'Roles', width: '1.1fr', render: (r) => <RoleChips roles={r.roles} /> },
    ] : []),
    { key: 'tags', header: 'Tags', width: '1fr', render: (r) => <TagChips ids={r.tag_ids} tags={tags} /> },
    { key: 'actions', header: '', width: '0.6fr', align: 'right', render: (r) => (
      <span onClick={(e) => e.stopPropagation()}>
        <button onClick={() => openEdit(r)} style={iconBtn}>✎</button>
        <button onClick={async () => {
          const ok = await confirm({ title: `Delete ${r.name}?`, confirmLabel: 'Delete', destructive: true });
          if (ok) onDelete(r.id);
        }} style={{ ...iconBtn, color: COLORS.danger }}>🗑</button>
      </span>
    )},
  ];

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ color: COLORS.text, margin: 0 }}>
          {cfg.icon} {cfg.label} <span style={{ color: COLORS.textDim, fontSize: 16, fontWeight: 400 }}>({filtered.length}{filtered.length !== rows.length && ` of ${rows.length}`})</span>
        </h2>
        <button onClick={() => (showForm ? resetForm() : openNew())}
          style={{ padding: '8px 16px', backgroundColor: showForm ? COLORS.border : COLORS.primary, color: showForm ? COLORS.text : '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          {showForm ? 'Cancel' : `+ New ${cfg.singular}`}
        </button>
      </div>

      <FilterBar
        search={filter}
        onSearchChange={setFilter}
        searchPlaceholder={`Search ${cfg.label.toLowerCase()}…`}
        multiSelects={[
          { key: 'stage', label: 'Lifecycle', options: LIFECYCLE_STAGES, value: stageFilter, onChange: setStageFilter },
          { key: 'tags', label: 'Tags', options: tags.map((t) => ({ value: t.id, label: t.label, color: t.color })), value: tagFilter, onChange: setTagFilter,
            renderOption: (opt) => <span style={{ background: opt.color, color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600 }}>{opt.label}</span> },
        ]}
        toggles={[
          { key: 'archived', label: 'Show archived', value: showArchived, onChange: setShowArchived },
        ]}
        rightSlot={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setSaveViewOpen(true)}
              style={{ padding: '7px 12px', background: COLORS.cardAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              💾 Save view
            </button>
            <ExportCSVButton rows={filtered} columns={columns} filename={`${cfg.label.toLowerCase()}-export`} />
            <button onClick={() => setImportOpen(true)}
              style={{ padding: '7px 12px', background: COLORS.cardAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              ⬆ Import CSV
            </button>
          </div>
        }
      />

      {showForm && (
        <div style={{ backgroundColor: COLORS.card, padding: 20, borderRadius: 8, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ marginTop: 0, color: COLORS.text }}>{editingId ? `Edit ${cfg.singular}` : `New ${cfg.singular}`}</h3>
          <V2Form cfg={cfg} formData={formData} setFormData={setFormData} onSave={handleSave} onCancel={resetForm} saveStatus={saveStatus} isEditing={!!editingId} tags={tags} kind={kind} workspace={workspace} />
        </div>
      )}

      {loading && rows.length === 0 ? (
        <SkeletonTable rows={8} cols={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={cfg.icon}
          title={`No ${cfg.label.toLowerCase()} yet`}
          body={`Create your first ${cfg.singular.toLowerCase()} or import a CSV to get started.`}
          primaryAction={{ label: `+ New ${cfg.singular}`, onClick: () => openNew() }}
          secondaryAction={{ label: '⬆ Import CSV', onClick: () => setImportOpen(true) }}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          onRowClick={(r) => navigate(`${basePath}/${r.id}`)}
          emptyMessage={`No ${cfg.label.toLowerCase()} match the current filters.`}
        />
      )}

      <DedupeModal
        open={!!dedupe}
        existing={dedupe && dedupe.existing}
        match={dedupe && dedupe.match}
        onCancel={() => setDedupe(null)}
        onCreateAnyway={() => { const d = dedupe; setDedupe(null); doSave(); }}
        onViewExisting={() => { const id = dedupe.existing.id; setDedupe(null); resetForm(); navigate(`${basePath}/${id}`); }}
      />

      {lifecycleGate && (
        <LifecycleChangeModal
          fromStage={lifecycleGate.from}
          toStage={lifecycleGate.to}
          onCancel={() => setLifecycleGate(null)}
          onConfirm={async (reason) => {
            const override = { ...formData, lifecycle_change_reason: reason };
            setLifecycleGate(null);
            logInteraction({
              kind: 'stage_change',
              entity_type: kind,
              entity_id: editingId,
              title: `Backward move — ${lifecycleGate.from} → ${lifecycleGate.to}`,
              body: reason,
              from_stage: lifecycleGate.from,
              to_stage: lifecycleGate.to,
              meta: { backward: true },
            }).catch((err) => console.error('logInteraction (backward stage_change) failed', err));
            doSave(override);
          }}
        />
      )}

      <SaveViewModal
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        objectType={kindObjectType}
        filters={{ q: filter, stages: stageFilter, tags: tagFilter, archived: showArchived }}
        onSaved={() => toast && toast.success && toast.success('View pinned to sidebar.')}
      />

      <ImportCSVModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        kind={kind}
        collectionName={kind === 'person' ? 'people' : 'companies'}
        targetFields={cfg.importFields || [...cfg.coreFields, ...cfg.firmFields]}
        existingRows={rows}
        dedupeFn={kind === 'person' ? findDuplicatePerson : findDuplicateCompany}
        idPrefix={cfg.idPrefix}
        defaultValues={{ status: 'new', lifecycle_stage: 'Research-Contact' }}
        onDone={(r) => { toast && toast.success && toast.success(`Imported ${r.inserted} ${cfg.label.toLowerCase()} (skipped ${r.skipped}).`); }}
      />
    </div>
  );
}

export function ContactDetailRoute({ kind, basePath, rows, transcripts, onDelete, onEnrich, allPeople, allCompanies }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const row = rows.find((r) => r.id === id);

  if (!row) {
    return (
      <div style={{ padding: 20 }}>
        <button onClick={() => navigate(basePath)} style={{ marginBottom: 12, background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ← Back
        </button>
        <div style={{ padding: 40, textAlign: 'center', color: COLORS.textDim }}>Record not found.</div>
      </div>
    );
  }

  return (
    <ContactDetail
      row={row}
      kind={kind}
      transcripts={transcripts.filter((t) => t.linkedContactId === row.id)}
      onClose={() => navigate(basePath)}
      onEdit={() => navigate(`${basePath}?edit=${row.id}`)}
      onDelete={async () => {
        const ok = await confirm({ title: `Delete ${row.name}?`, confirmLabel: 'Delete', destructive: true });
        if (ok) {
          await onDelete(row.id);
          navigate(basePath);
        }
      }}
      onEnrich={(transcriptId) => onEnrich(kind, row.id, transcriptId)}
      allPeople={allPeople}
      allCompanies={allCompanies}
    />
  );
}

