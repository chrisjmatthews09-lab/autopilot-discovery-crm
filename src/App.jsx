import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from './hooks/useAuth';
import { useCollection } from './hooks/useCollection';
import { useWindowWidth } from './hooks/useWindowWidth';
import { createDoc, updateDoc, deleteDoc } from './data/firestore';
import { migrateSheetsToFirestore, hasMigrated, renameCollectionsV2, hasRenamed, migrateLifecycleStages, hasLifecycleMigrated, seedScripts, hasScriptsSeeded, seedPipelines, hasPipelinesSeeded, seedTargetPipelines, hasTargetPipelinesSeeded, migrateWorkspaceBackfill, hasWorkspaceBackfilled } from './data/migrate';
import { useWorkspace } from './hooks/useWorkspace';
import { useIngestionProcessor } from './hooks/useIngestionProcessor.js';
import { retryInterview, enrichAndMergeInterview } from './services/ingestionService.js';
import { analyzeThemes } from './services/themesService.js';
import { historyForField } from './lib/dedup/enrichmentMerge.js';
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
} from './lib/interviewFields.js';
import { FIRM_ROLES, personPath, companyPath, interviewPath, interviewsListPath } from './config/workspaces';
// Page-level code splitting — every route below is fetched on demand so the
// initial bundle only carries the shell, sidebar, and shared UI primitives.
// React.lazy is paired with the <Suspense fallback={<PageSkeleton />}> wrap
// around <Routes /> below.
const ReferralPartnersList = lazy(() => import('./pages/ReferralPartners'));
const ReferralPipeline = lazy(() => import('./pages/ReferralPipeline'));
import { LIFECYCLE_STAGES, INDUSTRIES, REVENUE_BANDS, ENTITY_TYPES, US_STATES } from './config/enums';
import LifecycleStagePill from './components/ui/LifecycleStagePill';
import { TagChips, TagPicker, RoleChips, RolePicker } from './components/ui/TagChips';
import DedupeModal, { findDuplicatePerson, findDuplicateCompany } from './components/ui/DedupeModal';
import CommandPalette from './components/ui/CommandPalette';
import Timeline from './components/ui/Timeline';
import ContactTimeline from './components/Timeline.jsx';
import CompanyContactsSection from './components/CompanyContactsSection.jsx';
import MergeContactModal from './components/MergeContactModal.jsx';
import TasksCard from './components/ui/TasksCard';
import DealsCard from './components/ui/DealsCard';
import TargetsCard from './components/ui/TargetsCard';
import ConvertWizard from './components/ui/ConvertWizard';
import LifecycleChangeModal from './components/ui/LifecycleChangeModal';
import SaveViewModal from './components/ui/SaveViewModal';
import ExportCSVButton from './components/ui/ExportCSVButton';
import ImportCSVModal from './components/ui/ImportCSVModal';
import GmailInbox from './components/ui/GmailInbox';
import SuggestedInterviews from './components/ui/SuggestedInterviews';
import { SkeletonTable } from './components/ui/Skeleton';
import EmptyState from './components/ui/EmptyState';
import { parseFilters, readFilter, encodeFiltersToSearch } from './data/views';
import { useToast } from './components/ui/Toast';
import { logInteraction } from './data/interactions';
import { isValidTransition } from './config/enums';
const Tasks = lazy(() => import('./pages/Tasks'));
const DealsList = lazy(() => import('./pages/DealsList'));
const DealDetail = lazy(() => import('./pages/DealDetail'));
const TargetsList = lazy(() => import('./pages/TargetsList'));
const TargetDetail = lazy(() => import('./pages/TargetDetail'));
import DataTable from './components/table/DataTable';
import FilterBar from './components/table/FilterBar';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import MobileNav from './components/layout/MobileNav';
import { COLORS, FONT, DISPLAY, MOBILE_NAV_HEIGHT } from './config/design-tokens';
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const SettingsPageNew = lazy(() => import('./pages/Settings'));
const ScriptsWrapper = lazy(() => import('./pages/Scripts'));
const DedupReviewQueue = lazy(() => import('./pages/DedupReviewQueue'));
import PageSkeleton from './components/ui/PageSkeleton';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz89C4C15E1Cxmux8bWUWw04pghxiGlqkfb2Ulr_8FMZdnIZ9vcNEakdrGo3zNLhAZV/exec';

// Custom hook for API calls
const useAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const call = useCallback(
    async (action, data = null) => {

      setLoading(true);
      setError(null);

      try {
        // Always use GET — POST→redirect loses the body on all browsers (302 converts POST to GET).
        // Pass data as a base64-encoded query param so Apps Script doGet can read it.
        const url = new URL(APPS_SCRIPT_URL);
        url.searchParams.set('action', action);
        if (data && Object.keys(data).length > 0) {
          url.searchParams.set('d', btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
        }
        const response = await fetch(url.toString(), { redirect: 'follow' });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        return result;
      } catch (err) {
        const msg = err.message || 'API call failed';
        setError(msg);
        console.error(`API ${action} error:`, err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { call, loading, error, setError };
};

// ==================== SETTINGS PAGE (LEGACY — kept for Apps Script URL; superseded by pages/Settings) ====================
function SettingsPage({ sheetsUrl, setSheetsUrl, apiKey, setApiKey }) {
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState(null);

  const handleTest = async () => {
    setTestLoading(true);
    setTestStatus(null);
    try {
      const response = await fetch(`${sheetsUrl}?action=getSettings`);
      if (response.ok) {
        setTestStatus({ success: true, msg: 'Connected to Apps Script!' });
      } else {
        setTestStatus({ success: false, msg: `HTTP ${response.status}. Check the URL.` });
      }
    } catch (err) {
      setTestStatus({ success: false, msg: `Connection failed: ${err.message}` });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h2 style={{ color: COLORS.text, marginBottom: '20px' }}>Settings</h2>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', color: COLORS.textDim, fontSize: '14px', marginBottom: '8px' }}>
          Apps Script Web App URL
        </label>
        <input type="text" value={sheetsUrl} onChange={(e) => setSheetsUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/..."
          style={{ width: '100%', padding: '10px', backgroundColor: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '4px', boxSizing: 'border-box', marginBottom: '10px' }} />
        <p style={{ color: COLORS.textDim, fontSize: '12px', margin: '0' }}>
          Get this from Extensions → Apps Script → Deploy → Manage deployments
        </p>
      </div>
      <button onClick={handleTest} disabled={testLoading || !sheetsUrl}
        style={{ padding: '10px 16px', backgroundColor: testLoading ? COLORS.border : COLORS.accent, color: '#fff', border: 'none', borderRadius: '4px', cursor: testLoading ? 'not-allowed' : 'pointer', marginBottom: '10px' }}>
        {testLoading ? 'Testing...' : 'Test Connection'}
      </button>
      {testStatus && (
        <div style={{ padding: '10px', backgroundColor: testStatus.success ? '#1b5e20' : '#b71c1c', color: '#fff', borderRadius: '4px', marginBottom: '20px', fontSize: '14px' }}>
          {testStatus.msg}
        </div>
      )}
      <div style={{ backgroundColor: COLORS.card, padding: '15px', borderRadius: '4px', color: COLORS.textDim, fontSize: '13px', lineHeight: '1.6' }}>
        <strong style={{ color: COLORS.text }}>Setup Instructions:</strong>
        <ol style={{ marginTop: '10px', paddingLeft: '20px' }}>
          <li>Open your Google Sheet → Extensions → Apps Script</li>
          <li>Replace all code with the provided Code.gs</li>
          <li>Deploy → Manage deployments → Edit → New version → Save</li>
          <li>Copy the web app URL and paste it above</li>
          <li>Set <code>anthropicApiKey</code> in the Settings sheet tab</li>
        </ol>
      </div>
    </div>
  );
}

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

// ==================== V2 SCHEMA CONFIG ====================
const V2_SCHEMA = {
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

// ==================== V2 CONTACT PAGE ====================
function V2ContactPage({ kind, basePath, rows, transcripts, onUpsert, onDelete, onLinkTranscript, onEnrich, loading, workspace = 'crm' }) {
  const cfg = V2_SCHEMA[kind];
  const navigate = useNavigate();
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
  const kindObjectType = kind; // 'person' or 'company'

  // Hydrate filters when a saved view is selected via ?view=id
  useEffect(() => {
    if (!viewParam || !savedViews || savedViews.length === 0) return;
    const v = savedViews.find((sv) => sv.id === viewParam);
    if (!v || v.object_type !== kindObjectType) return;
    const f = parseFilters(v);
    setFilter(f.q || '');
    setStageFilter(f.stages || []);
    setTagFilter(f.tags || []);
    setShowArchived(!!f.archived);
    // Strip the view param so subsequent filter edits write clean URLs.
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    setSearchParams(next, { replace: true });
  }, [viewParam, savedViews, kindObjectType]);

  // Sync filters back to the URL so saved views round-trip cleanly.
  useEffect(() => {
    const filters = { q: filter, stages: stageFilter, tags: tagFilter, archived: showArchived };
    const qs = encodeFiltersToSearch(filters);
    const next = new URLSearchParams(qs);
    // Preserve non-filter params (edit, etc.)
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

  // ⌘-N shortcut lands here with ?new=1 — open the create form.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormData(emptyForm);
      setEditingId(null);
      setShowForm(true);
      const next = new URLSearchParams(searchParams); next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams]);

  const filtered = rows.filter((r) => {
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
  });

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
    if (missing.length) { alert('Required: ' + missing.join(', ')); return; }

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
        <button onClick={() => window.confirm(`Delete ${r.name}?`) && onDelete(r.id)} style={{ ...iconBtn, color: COLORS.danger }}>🗑</button>
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
            }).catch(() => {});
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

const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontSize: 14, color: COLORS.textMuted };

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

// ==================== CONTACT DETAIL VIEW ====================
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

  // Sprint 8 — For companies, gather linked contacts so the timeline can roll
  // up interviews/calls/notes across everyone at the business.
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

  // Sprint 9 — Candidates for the merge target picker. Same kind, same
  // workspace, and not the current record itself. Soft-deleted rows are
  // already filtered out one level up in ContactDetailRoute.
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

  // Sprint-2 perf fix — was previously two unconstrained subscriptions to the
  // entire `interviews` and `interactions` collections every time a company
  // detail opened. Now we use Firestore `in` queries scoped to this company +
  // its contacts, so the query payload is bounded by the size of the related
  // set instead of growing with the workspace.
  //
  // Firestore caps `in` at 30 values; we slice to stay safe. The dedup-
  // resolution fallback path was dropped — once mergeContacts/processInterview
  // run, refs are normalized into linkedContactId / entity_id.
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
            workspaceId={row.workspace || workspace}
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

  // kind === 'company' — contacts list is handled by CompanyContactsSection,
  // so we only surface parent/subsidiary relationships here.
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

function InterviewsListPage({ interviews, people, companies }) {
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

  const peopleById = Object.fromEntries(people.map((p) => [p.id, p]));
  const companiesById = Object.fromEntries(companies.map((c) => [c.id, c]));

  const enriched = interviews.map((iv) => {
    const linkedRecord = iv.linkedType === 'person' ? peopleById[iv.linkedContactId]
      : iv.linkedType === 'company' ? companiesById[iv.linkedContactId]
      : null;
    return { ...iv, linkedRecord };
  });

  const filtered = enriched.filter((iv) => {
    if (filter === 'unlinked' && iv.linkedRecord) return false;
    if (filter === 'linked' && !iv.linkedRecord) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return [getIntervieweeName(iv), getIntervieweeBusinessName(iv), iv.linkedRecord?.name]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  const sorted = [...filtered].sort((a, b) =>
    String(getInterviewDate(b) || '').localeCompare(String(getInterviewDate(a) || ''))
  );

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

function PipelinePage({ people, companies, onUpdateStatus }) {
  const navigate = useNavigate();
  const [kind, setKind] = useState('person');
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);

  const cfg = V2_SCHEMA[kind];
  const rows = kind === 'company' ? companies : people;
  const basePath = kind === 'company' ? '/crm/companies' : '/crm/people';

  const columns = cfg.statusOptions;
  const grouped = columns.reduce((acc, s) => {
    acc[s] = rows.filter((r) => (r.status || 'new') === s);
    return acc;
  }, {});

  const onDrop = async (status) => {
    const id = dragId;
    setDragId(null);
    setOverCol(null);
    if (!id) return;
    const row = rows.find((r) => r.id === id);
    if (!row || (row.status || 'new') === status) return;
    await onUpdateStatus(kind, id, status);
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0, color: COLORS.text, fontFamily: DISPLAY, fontSize: 24 }}>
          📊 Pipeline
        </h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setKind('person')}
            style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${kind === 'person' ? COLORS.primary : COLORS.border}`, background: kind === 'person' ? COLORS.primary : 'transparent', color: kind === 'person' ? '#fff' : COLORS.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            👥 People
          </button>
          <button onClick={() => setKind('company')}
            style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${kind === 'company' ? COLORS.primary : COLORS.border}`, background: kind === 'company' ? COLORS.primary : 'transparent', color: kind === 'company' ? '#fff' : COLORS.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            🏢 Companies
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))`, gap: 12, overflowX: 'auto' }}>
        {columns.map((status) => (
          <div key={status}
            onDragOver={(e) => { e.preventDefault(); setOverCol(status); }}
            onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
            onDrop={() => onDrop(status)}
            style={{ background: overCol === status ? COLORS.cardAlt : COLORS.card, borderRadius: 10, border: `1px solid ${overCol === status ? COLORS.primary : COLORS.border}`, padding: 10, minHeight: 200, transition: 'background 0.1s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
              <div style={{ textTransform: 'capitalize', fontSize: 12, fontWeight: 700, color: COLORS.text }}>{status}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, background: COLORS.cardAlt, padding: '2px 8px', borderRadius: 10 }}>{grouped[status].length}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grouped[status].map((r) => (
                <div key={r.id}
                  draggable
                  onDragStart={() => setDragId(r.id)}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  onClick={() => navigate(`${basePath}/${r.id}`)}
                  style={{ background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 10, cursor: 'grab', opacity: dragId === r.id ? 0.5 : 1, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>{r.name || '(unnamed)'}</div>
                  {r.company && <div style={{ fontSize: 11, color: COLORS.textMuted }}>{r.company}</div>}
                  {r.role && <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{r.role}</div>}
                </div>
              ))}
              {grouped[status].length === 0 && (
                <div style={{ color: COLORS.textDim, fontSize: 11, fontStyle: 'italic', textAlign: 'center', padding: 12 }}>Drop here</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InterviewTriage({ interview, people, companies, linkPick, setLinkPick, busy, onLinkExisting, onCreateAndLink }) {
  const [expanded, setExpanded] = useState(false);
  const options = linkPick.type === 'company' ? companies : people;
  const sorted = [...options].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const intervieweeName = getIntervieweeName(interview);
  const intervieweeBusiness = getIntervieweeBusinessName(interview);

  // Collapsed second-tier UI: auto-ingestion is the primary path, so hide
  // manual triage behind a disclosure. Only expand by explicit user action.
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

function InterviewDetailRoute({ interviews, people, companies, scripts, onUpdate, onLink, onCreatePerson, onCreateCompany, onEnrich }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('questions');
  const [linkPick, setLinkPick] = useState({ type: 'person', id: '' });
  const [linkBusy, setLinkBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStatus, setAnalyzeStatus] = useState(null);

  const interview = interviews.find((i) => i.id === id);

  if (!interview) {
    return (
      <div style={{ padding: 20 }}>
        <button onClick={() => navigate(interviewsListPath(interview?.workspace || 'deal_flow'))} style={{ marginBottom: 12, background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ← Back to Interviews
        </button>
        <div style={{ padding: 40, textAlign: 'center', color: COLORS.textDim }}>Interview not found.</div>
      </div>
    );
  }

  // Self-heal: if ingestion wrote a match to dedupResolution but the legacy
  // linkedType/linkedContactId fields are empty, derive them from the resolution
  // so the triage card doesn't show alongside a successful auto-resolution.
  const resolvedType = interview.linkedType
    || (interview.dedupResolution?.matchedContactId ? 'person'
      : interview.dedupResolution?.matchedBusinessId ? 'company' : null);
  const resolvedId = interview.linkedContactId
    || interview.dedupResolution?.matchedContactId
    || interview.dedupResolution?.matchedBusinessId
    || null;
  const linkedRecord = resolvedType === 'person'
    ? people.find((p) => p.id === resolvedId)
    : resolvedType === 'company'
    ? companies.find((c) => c.id === resolvedId)
    : null;

  // Backfill legacy fields once so list/filter code that reads linkedType/linkedContactId
  // catches up with ingestion output.
  useEffect(() => {
    if (!interview) return;
    if (interview.linkedType && interview.linkedContactId) return;
    if (!resolvedType || !resolvedId) return;
    if (!linkedRecord) return;
    onUpdate(interview.id, { linkedType: resolvedType, linkedContactId: resolvedId }).catch(() => {});
  }, [interview?.id, resolvedType, resolvedId, linkedRecord?.id]);

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

function ContactDetailRoute({ kind, basePath, rows, transcripts, onDelete, onEnrich, allPeople, allCompanies }) {
  const { id } = useParams();
  const navigate = useNavigate();
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
        if (window.confirm(`Delete ${row.name}?`)) {
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

// ==================== SCRIPT PAGE ====================
function ScriptPage({ contacts, scriptType, script }) {
  if (!script) return null;
  const resolveColor = (k) => COLORS[k] || k || COLORS.primary;
  const [checkedQs, setCheckedQs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('autopilot-checklist') || '{}'); } catch { return {}; }
  });

  const toggleCheck = (key) => {
    const newChecked = { ...checkedQs, [key]: !checkedQs[key] };
    setCheckedQs(newChecked);
    localStorage.setItem('autopilot-checklist', JSON.stringify(newChecked));
  };

  const clearProgress = () => {
    if (window.confirm('Clear all checklist progress?')) {
      setCheckedQs({});
      localStorage.removeItem('autopilot-checklist');
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: COLORS.text, margin: 0 }}>{scriptType === 'pro' ? 'Professional' : 'Business'} Script</h2>
        <button onClick={clearProgress} style={{ padding: '8px 12px', backgroundColor: COLORS.danger, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Clear Progress</button>
      </div>
      <div style={{ backgroundColor: COLORS.card, padding: 20, borderRadius: 4, border: `1px solid ${COLORS.border}` }}>
        {script.sections.map((section, sectionIdx) => (
          <div key={section.id || sectionIdx} style={{ marginBottom: 28 }}>
            <h3 style={{ color: resolveColor(section.color), fontWeight: 700, marginBottom: 12, fontSize: 17 }}>{section.name}</h3>
            {section.questions.map((question, qIdx) => {
              const key = `${scriptType}-${sectionIdx}-${qIdx}`;
              const isChecked = checkedQs[key];
              return (
                <label key={qIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', color: COLORS.text, fontSize: 15, lineHeight: 1.6, marginBottom: 12, padding: 10, backgroundColor: isChecked ? COLORS.bg : 'transparent', borderRadius: 4, textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1, border: `1px solid ${COLORS.border}` }}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(key)} style={{ marginTop: 4, cursor: 'pointer', accentColor: COLORS.accent }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{question.q}</div>
                    <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>{question.why}</div>
                  </div>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== THEMES PAGE ====================
function ThemesPage({ businesses, practitioners }) {
  const { call } = useAPI();
  const [bizThemes, setBizThemes] = useState(null);
  const [pracThemes, setPracThemes] = useState(null);
  const [bizLoading, setBizLoading] = useState(false);
  const [pracLoading, setPracLoading] = useState(false);
  const [bizError, setBizError] = useState(null);
  const [pracError, setPracError] = useState(null);
  const [saveStatus, setSaveStatus] = useState({});
  const { data: syntheses } = useCollection('syntheses');

  const saveSynthesis = async (kind, themes) => {
    if (!themes) return;
    const baseCount = kind === 'business' ? businesses.filter((b) => b.enrichedAt || b.painPoints).length : practitioners.filter((p) => p.enrichedAt || p.painPoints).length;
    const id = `synth-${Date.now()}`;
    const name = (window.prompt('Name this synthesis:', `${kind === 'business' ? 'Business' : 'Practitioner'} themes · ${new Date().toLocaleDateString()}`) || '').trim();
    if (!name) return;
    setSaveStatus((s) => ({ ...s, [kind]: 'saving' }));
    try {
      await createDoc('syntheses', { name, kind, themes, interview_count: baseCount, createdAt: new Date().toISOString() }, id);
      setSaveStatus((s) => ({ ...s, [kind]: 'saved' }));
      setTimeout(() => setSaveStatus((s) => ({ ...s, [kind]: null })), 1800);
    } catch (err) {
      console.error('Save synthesis failed', err);
      setSaveStatus((s) => ({ ...s, [kind]: 'error' }));
    }
  };

  const deleteSynthesis = async (id) => {
    if (!window.confirm('Delete this synthesis?')) return;
    await deleteDoc('syntheses', id);
  };

  const analyzeBusinesses = async () => {
    setBizLoading(true);
    setBizError(null);
    try {
      const records = businesses.filter((b) => b.enrichedAt || b.painPoints);
      const result = await analyzeThemes({ type: 'business', records });
      if (result && result.themes) setBizThemes(result.themes);
      else setBizError('Analysis returned no themes.');
    } catch (e) {
      setBizError(e.message || String(e));
    }
    setBizLoading(false);
  };

  const analyzePractitioners = async () => {
    setPracLoading(true);
    setPracError(null);
    try {
      const records = practitioners.filter((p) => p.enrichedAt || p.painPoints);
      const result = await analyzeThemes({ type: 'practitioner', records });
      if (result && result.themes) setPracThemes(result.themes);
      else setPracError('Analysis returned no themes.');
    } catch (e) {
      setPracError(e.message || String(e));
    }
    setPracLoading(false);
  };

  const enrichedBiz = businesses.filter(b => b.enrichedAt || b.painPoints);
  const enrichedPrac = practitioners.filter(p => p.enrichedAt || p.painPoints);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h2 style={{ color: COLORS.text, margin: '0 0 6px', fontFamily: DISPLAY, fontSize: 28 }}>🧠 Themes</h2>
      <p style={{ color: COLORS.textMuted, fontSize: 14, marginBottom: 36 }}>
        Cross-interview synthesis. Claude analyzes all enriched records and extracts strategic patterns across your interview set.
      </p>

      <ThemeSection
        title="Business Owner Themes"
        icon="🏢"
        color={COLORS.accent}
        count={enrichedBiz.length}
        total={businesses.length}
        themes={bizThemes}
        loading={bizLoading}
        error={bizError}
        onAnalyze={analyzeBusinesses}
        onSave={() => saveSynthesis('business', bizThemes)}
        saveStatus={saveStatus.business}
      />

      <ThemeSection
        title="Practitioner Themes"
        icon="👥"
        color={COLORS.primary}
        count={enrichedPrac.length}
        total={practitioners.length}
        themes={pracThemes}
        loading={pracLoading}
        error={pracError}
        onAnalyze={analyzePractitioners}
        onSave={() => saveSynthesis('practitioner', pracThemes)}
        saveStatus={saveStatus.practitioner}
      />

      {syntheses.length > 0 && (
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: COLORS.text, margin: '0 0 12px', fontSize: 18 }}>💾 Saved Syntheses ({syntheses.length})</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {[...syntheses].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                    {s.kind} · {s.interview_count || 0} records · {s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}
                  </div>
                </div>
                <button onClick={() => deleteSynthesis(s.id)} style={{ background: 'none', border: 'none', color: COLORS.danger, cursor: 'pointer', fontSize: 14 }}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeSection({ title, icon, color, count, total, themes, loading, error, onAnalyze, onSave, saveStatus }) {
  return (
    <div style={{ marginBottom: 56 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: COLORS.text, fontSize: 20 }}>
          {icon} {title}
          <span style={{ color: COLORS.textDim, fontSize: 14, fontWeight: 400, marginLeft: 8 }}>
            ({count} enriched{total !== count ? ` of ${total}` : ''})
          </span>
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
        {themes && onSave && (
          <button onClick={onSave} disabled={saveStatus === 'saving'}
            style={{ padding: '10px 16px', backgroundColor: saveStatus === 'saved' ? COLORS.success : 'transparent', border: `1px solid ${saveStatus === 'saved' ? COLORS.success : COLORS.border}`, color: saveStatus === 'saved' ? '#fff' : COLORS.text, borderRadius: 8, cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12 }}>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? '✗ Retry' : '💾 Save as synthesis'}
          </button>
        )}
        <button onClick={onAnalyze} disabled={loading || count === 0}
          style={{ padding: '10px 22px', backgroundColor: loading || count === 0 ? COLORS.border : color, color: loading || count === 0 ? COLORS.textMuted : '#fff', border: 'none', borderRadius: 8, cursor: loading || count === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading ? (
            <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'autopilot-spin 0.7s linear infinite' }} /> Analyzing…</>
          ) : '🔍 Analyze Themes'}
        </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8, color: COLORS.danger, fontSize: 13, marginBottom: 16, border: '1px solid #FCA5A5' }}>
          ✗ {error}
        </div>
      )}

      {count === 0 && !themes && (
        <div style={{ padding: 32, textAlign: 'center', backgroundColor: COLORS.card, borderRadius: 8, border: `1px dashed ${COLORS.border}`, color: COLORS.textDim, fontSize: 14 }}>
          No enriched records yet. Trigger Zapier with an interview to populate data.
        </div>
      )}

      {themes && <ThemesDashboard themes={themes} color={color} />}
    </div>
  );
}

function ThemesDashboard({ themes, color }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {themes.executiveSummary && (
        <div style={{ padding: 20, backgroundColor: color + '10', borderRadius: 10, border: `1px solid ${color}25` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Executive Summary</div>
          <div style={{ fontSize: 15, lineHeight: 1.7, color: COLORS.text }}>{themes.executiveSummary}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {themes.topPainPoints && themes.topPainPoints.length > 0 && (
          <ThemeCard title="😤 Top Pain Points" color={COLORS.danger}>
            {themes.topPainPoints.map((p, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < themes.topPainPoints.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{p.theme}</div>
                  {p.frequency && <span style={{ fontSize: 11, color: COLORS.textDim, backgroundColor: COLORS.bg, padding: '2px 8px', borderRadius: 10, border: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap', marginLeft: 8 }}>{p.frequency}</span>}
                </div>
                {p.evidence && <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>{p.evidence}</div>}
              </div>
            ))}
          </ThemeCard>
        )}

        {themes.wtpProfile && (
          <ThemeCard title="💰 Willingness-to-Pay Profile" color={COLORS.gold}>
            {themes.wtpProfile.priceRange && <KVRow label="Price Range" value={themes.wtpProfile.priceRange} />}
            {themes.wtpProfile.sensitivity && <KVRow label="Price Sensitivity" value={themes.wtpProfile.sensitivity} />}
            {themes.wtpProfile.keyInsight && (
              <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: COLORS.goldLight, borderRadius: 6, fontSize: 12, color: COLORS.gold, lineHeight: 1.5 }}>
                💡 {themes.wtpProfile.keyInsight}
              </div>
            )}
            {themes.wtpProfile.primaryDrivers && themes.wtpProfile.primaryDrivers.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Primary Drivers</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {themes.wtpProfile.primaryDrivers.map((d, i) => (
                    <span key={i} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, backgroundColor: COLORS.goldLight, color: COLORS.gold, border: `1px solid ${COLORS.gold}30` }}>{d}</span>
                  ))}
                </div>
              </div>
            )}
          </ThemeCard>
        )}

        {themes.idealCustomerProfile && (
          <ThemeCard title="🎯 Ideal Customer Profile" color={COLORS.primary}>
            {Object.entries(themes.idealCustomerProfile)
              .filter(([, v]) => v && !(Array.isArray(v) && v.length === 0))
              .map(([k, v]) => (
                <KVRow key={k} label={k.replace(/([A-Z])/g, ' $1').trim()} value={Array.isArray(v) ? v.join(', ') : String(v)} />
              ))}
          </ThemeCard>
        )}

        {themes.competitiveLandscape && themes.competitiveLandscape.length > 0 && (
          <ThemeCard title="⚔️ Competitive Landscape" color={COLORS.blue}>
            {themes.competitiveLandscape.map((item, i) => (
              <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < themes.competitiveLandscape.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{item.name || item}</div>
                {item.insight && <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2, lineHeight: 1.5 }}>{item.insight}</div>}
              </div>
            ))}
          </ThemeCard>
        )}
      </div>

      {/* Practitioner-specific */}
      {themes.firmLandscape && (
        <ThemeCard title="🏢 Firm Landscape" color={COLORS.blue}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: themes.firmLandscape.insight ? 12 : 0 }}>
            {themes.firmLandscape.dominantSize && (
              <div style={{ padding: 12, backgroundColor: COLORS.bg, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>{themes.firmLandscape.dominantSize}</div>
                <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: 'uppercase', marginTop: 2 }}>Dominant Size</div>
              </div>
            )}
            {themes.firmLandscape.avgClientCount && (
              <div style={{ padding: 12, backgroundColor: COLORS.bg, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>{themes.firmLandscape.avgClientCount}</div>
                <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: 'uppercase', marginTop: 2 }}>Avg Client Count</div>
              </div>
            )}
          </div>
          {themes.firmLandscape.primaryServiceMix && <KVRow label="Service Mix" value={themes.firmLandscape.primaryServiceMix} />}
          {themes.firmLandscape.insight && (
            <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: COLORS.blueLight, borderRadius: 6, fontSize: 12, color: COLORS.blue, lineHeight: 1.5 }}>
              💡 {themes.firmLandscape.insight}
            </div>
          )}
        </ThemeCard>
      )}

      {themes.aiReceptivity && (
        <ThemeCard title="🤖 AI Receptivity" color={COLORS.purple}>
          {themes.aiReceptivity.overall && <KVRow label="Overall Sentiment" value={themes.aiReceptivity.overall} />}
          {themes.aiReceptivity.keyInsight && (
            <div style={{ margin: '10px 0', padding: '8px 12px', backgroundColor: COLORS.purpleLight, borderRadius: 6, fontSize: 12, color: COLORS.purple, lineHeight: 1.5 }}>
              💡 {themes.aiReceptivity.keyInsight}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
            {themes.aiReceptivity.concerns && themes.aiReceptivity.concerns.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: COLORS.danger, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Concerns</div>
                {themes.aiReceptivity.concerns.map((c, i) => <div key={i} style={{ fontSize: 12, color: COLORS.text, padding: '3px 0' }}>• {c}</div>)}
              </div>
            )}
            {themes.aiReceptivity.opportunities && themes.aiReceptivity.opportunities.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: COLORS.success, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Opportunities</div>
                {themes.aiReceptivity.opportunities.map((o, i) => <div key={i} style={{ fontSize: 12, color: COLORS.text, padding: '3px 0' }}>• {o}</div>)}
              </div>
            )}
          </div>
        </ThemeCard>
      )}

      {themes.techStackInsights && (
        <ThemeCard title="🛠 Tech Stack Insights" color={COLORS.blue}>
          {themes.techStackInsights.dominant && themes.techStackInsights.dominant.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Dominant Tools</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {themes.techStackInsights.dominant.map((t, i) => (
                  <span key={i} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, backgroundColor: COLORS.blueLight, color: COLORS.blue, border: `1px solid ${COLORS.blue}30` }}>{t}</span>
                ))}
              </div>
            </div>
          )}
          {themes.techStackInsights.gaps && themes.techStackInsights.gaps.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Gaps / Opportunities</div>
              {themes.techStackInsights.gaps.map((g, i) => <div key={i} style={{ fontSize: 12, color: COLORS.text, padding: '3px 0' }}>• {g}</div>)}
            </div>
          )}
          {themes.techStackInsights.switchingBarriers && <KVRow label="Switching Barriers" value={themes.techStackInsights.switchingBarriers} />}
        </ThemeCard>
      )}

      {themes.pricingBenchmarks && (
        <ThemeCard title="💵 Pricing Benchmarks" color={COLORS.gold}>
          {themes.pricingBenchmarks.typicalMonthlyRange && <KVRow label="Typical Range" value={themes.pricingBenchmarks.typicalMonthlyRange} />}
          {themes.pricingBenchmarks.profitableSegments && themes.pricingBenchmarks.profitableSegments.length > 0 && (
            <KVRow label="Most Profitable" value={themes.pricingBenchmarks.profitableSegments.join(', ')} />
          )}
          {themes.pricingBenchmarks.keyInsight && (
            <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: COLORS.goldLight, borderRadius: 6, fontSize: 12, color: COLORS.gold, lineHeight: 1.5 }}>
              💡 {themes.pricingBenchmarks.keyInsight}
            </div>
          )}
        </ThemeCard>
      )}

      {themes.partnershipSignals && themes.partnershipSignals.length > 0 && (
        <ThemeCard title="🤝 Partnership Signals" color={COLORS.primary}>
          {themes.partnershipSignals.map((s, i) => (
            <div key={i} style={{ fontSize: 13, color: COLORS.text, padding: '5px 0', borderBottom: i < themes.partnershipSignals.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>• {s}</div>
          ))}
        </ThemeCard>
      )}

      {themes.keyQuotes && themes.keyQuotes.length > 0 && (
        <ThemeCard title="💬 Voice of Customer" color={COLORS.accent}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            {themes.keyQuotes.map((q, i) => (
              <div key={i} style={{ padding: '12px 14px', backgroundColor: COLORS.bg, borderLeft: `3px solid ${COLORS.accent}`, borderRadius: 4 }}>
                <div style={{ fontStyle: 'italic', fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>"{typeof q === 'string' ? q : q.quote}"</div>
                {(q.speaker || q.significance) && (
                  <div style={{ marginTop: 6, fontSize: 11, color: COLORS.textDim }}>
                    {q.speaker && <span>— {q.speaker}</span>}
                    {q.significance && <span style={{ marginLeft: 6, fontStyle: 'normal' }}>· {q.significance}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ThemeCard>
      )}

      {themes.strategicRecommendations && themes.strategicRecommendations.length > 0 && (
        <ThemeCard title="🚀 Strategic Recommendations" color={COLORS.success}>
          {themes.strategicRecommendations.map((rec, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: COLORS.success, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{rec.title || rec}</div>
                {rec.rationale && <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 3, lineHeight: 1.5 }}>{rec.rationale}</div>}
              </div>
            </div>
          ))}
        </ThemeCard>
      )}

      {themes.riskFlags && themes.riskFlags.length > 0 && (
        <ThemeCard title="⚠️ Risk Flags" color={COLORS.warning}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {themes.riskFlags.map((flag, i) => (
              <span key={i} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                {typeof flag === 'string' ? flag : flag.flag}
              </span>
            ))}
          </div>
        </ThemeCard>
      )}
    </div>
  );
}

function ThemeCard({ title, color, children }) {
  return (
    <div style={{ backgroundColor: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', backgroundColor: color + '12', borderBottom: `1px solid ${color}20` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function KVRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13, gap: 12 }}>
      <span style={{ color: COLORS.textMuted, fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ color: COLORS.text, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ==================== MAIN APP ====================
function SignInScreen({ onSignIn, authError }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: FONT }}>
      <link href="https://fonts.googleapis.com/css2?family=Karla:wght@400;500;600;700;800&family=Fraunces:wght@700;800;900&display=swap" rel="stylesheet" />
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 32, width: 360, textAlign: 'center' }}>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 28, margin: '0 0 8px', color: COLORS.accent }}>Autopilot</h1>
        <p style={{ margin: '0 0 24px', color: COLORS.textMuted, fontSize: 14 }}>Discovery CRM</p>
        <button
          onClick={onSignIn}
          style={{ width: '100%', padding: '12px 16px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          Sign in with Google
        </button>
        {authError && <div style={{ marginTop: 16, color: COLORS.danger, fontSize: 13 }}>{authError}</div>}
      </div>
    </div>
  );
}

function App() {
  const { user, loading: authLoading, authError, signIn, signOut } = useAuth();

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: COLORS.bg, color: COLORS.text }}>
        Loading…
      </div>
    );
  }

  if (!user) return <SignInScreen onSignIn={signIn} authError={authError} />;

  return <MainApp user={user} onSignOut={signOut} />;
}

// Translates the new normalized kind to the legacy contactType the Apps Script
// enrichContact handler expects. Drop this once Code.gs is updated.
const KIND_TO_LEGACY_CONTACT_TYPE = { person: 'practitioner', company: 'business' };

function MainApp({ user, onSignOut }) {
  const [migrating, setMigrating] = useState(!hasMigrated() || !hasRenamed() || !hasLifecycleMigrated() || !hasScriptsSeeded() || !hasPipelinesSeeded() || !hasTargetPipelinesSeeded() || !hasWorkspaceBackfilled());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigateRoot = useNavigate();
  const { id: workspaceId } = useWorkspace();

  // Map pathname → where ⌘-N should land to create a new record.
  const NEW_RECORD_ROUTES = {
    '/crm/people': '/crm/people?new=1',
    '/crm/companies': '/crm/companies?new=1',
    '/crm/interviews': '/crm/interviews',
    '/crm/tasks': '/crm/tasks?new=1',
    '/crm/deals': '/crm/deals?new=1',
    '/deal-flow/practitioners': '/deal-flow/practitioners?new=1',
    '/deal-flow/firms': '/deal-flow/firms?new=1',
    '/deal-flow/interviews': '/deal-flow/interviews',
    '/deal-flow/tasks': '/deal-flow/tasks?new=1',
    '/deal-flow/targets': '/deal-flow/targets?new=1',
    '/deal-flow/referrals': '/deal-flow/referrals?new=1',
  };

  useEffect(() => {
    const handler = (e) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (isMeta && e.key === '/') {
        e.preventDefault();
        navigateRoot('/settings#shortcuts');
        return;
      }
      if (isMeta && (e.key === 'n' || e.key === 'N')) {
        // Don't hijack the browser's own ⌘-N for "new window" inside form fields.
        if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
        e.preventDefault();
        const path = window.location.pathname.replace(/^\/autopilot-discovery-crm/, '') || '/';
        const parts = path.split('/').filter(Boolean);
        const base = parts.length >= 2 ? `/${parts[0]}/${parts[1]}` : `/${parts[0] || ''}`;
        const target = NEW_RECORD_ROUTES[base];
        if (target) navigateRoot(target);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigateRoot]);

  const { call, loading: apiLoading } = useAPI();
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  const { data: peopleRaw, loading: peopleLoading } = useCollection('people', { enabled: !migrating });
  const { data: companiesRaw, loading: companiesLoading } = useCollection('companies', { enabled: !migrating });
  // Sprint 9 — Soft-deleted contacts stay in Firestore for undo but never
  // render in the UI. Filter once at the top and pass the clean list down.
  const people = useMemo(() => (peopleRaw || []).filter((p) => !p.deletedAt), [peopleRaw]);
  const companies = useMemo(() => (companiesRaw || []).filter((c) => !c.deletedAt), [companiesRaw]);
  const { data: interviews, loading: interviewsLoading } = useCollection('interviews', { enabled: !migrating });
  const { data: scripts } = useCollection('scripts', { enabled: !migrating });

  // Sprint 4: subscribe to pending-ingestion interviews and process them.
  const ingestion = useIngestionProcessor({ enabled: !migrating });

  const loading = apiLoading || peopleLoading || companiesLoading || interviewsLoading;

  useEffect(() => {
    if (hasMigrated() && hasRenamed() && hasLifecycleMigrated() && hasScriptsSeeded() && hasPipelinesSeeded() && hasTargetPipelinesSeeded() && hasWorkspaceBackfilled()) return;
    (async () => {
      try {
        if (!hasMigrated()) await migrateSheetsToFirestore();
        if (!hasRenamed()) await renameCollectionsV2();
        if (!hasLifecycleMigrated()) await migrateLifecycleStages();
        if (!hasScriptsSeeded()) await seedScripts();
        if (!hasPipelinesSeeded()) await seedPipelines();
        if (!hasTargetPipelinesSeeded()) await seedTargetPipelines();
        if (!hasWorkspaceBackfilled()) await migrateWorkspaceBackfill();
      } catch (err) {
        console.error('Migration/rename failed', err);
      } finally {
        setMigrating(false);
      }
    })();
  }, []);

  const handleUpsertPerson = async (row) => {
    const { id, ...data } = row;
    const prev = id && people.find((p) => p.id === id);
    if (prev) {
      await updateDoc('people', id, data);
      if (prev.lifecycle_stage !== data.lifecycle_stage && data.lifecycle_stage) {
        logInteraction({ kind: 'stage_change', entity_type: 'person', entity_id: id, title: 'Lifecycle stage changed', from_stage: prev.lifecycle_stage || null, to_stage: data.lifecycle_stage }).catch(() => {});
      }
    } else {
      const newId = id || `person-${Date.now()}`;
      await createDoc('people', { workspace: data.workspace || workspaceId, ...data }, newId);
    }
    return true;
  };

  const handleDeletePerson = async (id) => {
    await deleteDoc('people', id);
  };

  const handleUpsertCompany = async (row) => {
    const { id, ...data } = row;
    const prev = id && companies.find((c) => c.id === id);
    if (prev) {
      await updateDoc('companies', id, data);
      if (prev.lifecycle_stage !== data.lifecycle_stage && data.lifecycle_stage) {
        logInteraction({ kind: 'stage_change', entity_type: 'company', entity_id: id, title: 'Lifecycle stage changed', from_stage: prev.lifecycle_stage || null, to_stage: data.lifecycle_stage }).catch(() => {});
      }
    } else {
      const newId = id || `company-${Date.now()}`;
      await createDoc('companies', { workspace: data.workspace || workspaceId, ...data }, newId);
    }
    return true;
  };

  const handleUpdateCompany = async (id, patch) => {
    await updateDoc('companies', id, patch);
  };

  const handleDeleteCompany = async (id) => {
    await deleteDoc('companies', id);
  };

  const handleUpdateStatus = async (kind, id, status) => {
    const collectionName = kind === 'company' ? 'companies' : 'people';
    await updateDoc(collectionName, id, { status });
  };

  const handleLinkInterview = async (interviewId, linkedType, linkedContactId) => {
    await updateDoc('interviews', interviewId, { linkedType, linkedContactId });
    return true;
  };

  const handleEnrichContact = async (kind, contactId, interviewId) => {
    const legacyContactType = KIND_TO_LEGACY_CONTACT_TYPE[kind];
    const result = await call('enrichContact', {
      contactType: legacyContactType,
      contactId,
      transcriptId: interviewId,
    });
    if (result && result.row) {
      const collectionName = kind === 'company' ? 'companies' : 'people';
      const { id, ...data } = result.row;
      await updateDoc(collectionName, contactId, data);
      return true;
    }
    return false;
  };

  const handleDeleteInterview = async (id) => {
    await deleteDoc('interviews', id);
  };

  const handleUpdateInterview = async (id, patch) => {
    await updateDoc('interviews', id, patch);
  };

  const combinedContacts = [
    ...people.map((p) => ({ ...p, type: 'pro' })),
    ...companies.map((c) => ({ ...c, type: 'biz' })),
  ];

  // Workspace-scoped subsets. Records missing the `workspace` field fall back to a
  // heuristic (people default to deal_flow, companies to crm) — matches migration logic.
  const wsOf = (row, fallback) => row.workspace || fallback;
  const peopleCrm = people.filter((p) => wsOf(p, 'deal_flow') === 'crm');
  const peopleDf = people.filter((p) => wsOf(p, 'deal_flow') === 'deal_flow');
  const companiesCrm = companies.filter((c) => wsOf(c, 'crm') === 'crm');
  const firms = companies.filter((c) => wsOf(c, 'crm') === 'deal_flow');
  const interviewsCrm = interviews.filter((iv) => wsOf(iv, 'deal_flow') === 'crm');
  const interviewsDf = interviews.filter((iv) => wsOf(iv, 'deal_flow') === 'deal_flow');

  const routes = (
    <Suspense fallback={<PageSkeleton />}>
    <Routes>
      {/* ───── Root + legacy redirects ───── */}
      <Route path="/" element={<Navigate to="/crm" replace />} />
      <Route path="/people" element={<Navigate to="/crm/people" replace />} />
      <Route path="/people/:id" element={<LegacyRecordRedirect rows={people} fallback="crm" crmPath="/crm/people" dealFlowPath="/deal-flow/practitioners" />} />
      <Route path="/companies" element={<Navigate to="/crm/companies" replace />} />
      <Route path="/companies/:id" element={<LegacyRecordRedirect rows={companies} fallback="crm" crmPath="/crm/companies" dealFlowPath="/deal-flow/firms" />} />
      {/* Research + Tasks + Review are platform-level (see Sidebar). */}
      <Route path="/interviews" element={
        <InterviewsListPage interviews={interviews} people={people} companies={companies} />
      } />
      <Route path="/interviews/:id" element={
        <InterviewDetailRoute interviews={interviews} people={people} companies={companies} scripts={scripts} onUpdate={handleUpdateInterview} onLink={handleLinkInterview} onCreatePerson={handleUpsertPerson} onCreateCompany={handleUpsertCompany} onEnrich={handleEnrichContact} />
      } />
      <Route path="/insights" element={<ThemesPage businesses={companies} practitioners={people} />} />
      <Route path="/scripts" element={<ScriptsWrapper ScriptPage={ScriptPage} contacts={combinedContacts} />} />
      <Route path="/tasks" element={<Tasks />} />
      {/* Legacy workspace-scoped research paths → canonical. */}
      <Route path="/crm/interviews" element={<Navigate to="/interviews" replace />} />
      <Route path="/crm/interviews/:id" element={<LegacyPrefixRedirect prefix="/interviews" />} />
      <Route path="/deal-flow/interviews" element={<Navigate to="/interviews" replace />} />
      <Route path="/deal-flow/interviews/:id" element={<LegacyPrefixRedirect prefix="/interviews" />} />
      <Route path="/crm/tasks" element={<Navigate to="/tasks" replace />} />
      <Route path="/deal-flow/tasks" element={<Navigate to="/tasks" replace />} />
      <Route path="/crm/scripts" element={<Navigate to="/scripts" replace />} />
      <Route path="/deal-flow/scripts" element={<Navigate to="/scripts" replace />} />
      <Route path="/deal-flow/insights" element={<Navigate to="/insights" replace />} />
      <Route path="/themes" element={<Navigate to="/insights" replace />} />
      <Route path="/scripts/pro" element={<Navigate to="/scripts?type=pro" replace />} />
      <Route path="/scripts/biz" element={<Navigate to="/scripts?type=biz" replace />} />
      <Route path="/deals" element={<Navigate to="/crm/deals" replace />} />
      <Route path="/deals/:id" element={<LegacyPrefixRedirect prefix="/crm/deals" />} />
      <Route path="/targets" element={<Navigate to="/deal-flow/targets" replace />} />
      <Route path="/targets/:id" element={<LegacyPrefixRedirect prefix="/deal-flow/targets" />} />
      <Route path="/board" element={<Navigate to="/crm/board" replace />} />
      <Route path="/pipeline" element={<Navigate to="/crm/board" replace />} />

      {/* ───── CRM workspace ───── */}
      <Route path="/crm" element={
        <DashboardPage people={peopleCrm} companies={companiesCrm} interviews={interviewsCrm} workspace="crm" />
      } />
      <Route path="/crm/people" element={
        <V2ContactPage kind="person" workspace="crm" basePath="/crm/people" rows={peopleCrm} transcripts={interviewsCrm}
          onUpsert={handleUpsertPerson} onDelete={handleDeletePerson}
          onLinkTranscript={handleLinkInterview} onEnrich={handleEnrichContact} loading={loading} />
      } />
      <Route path="/crm/people/:id" element={
        <ContactDetailRoute kind="person" basePath="/crm/people" rows={people}
          transcripts={interviews} onDelete={handleDeletePerson} onEnrich={handleEnrichContact}
          allPeople={people} allCompanies={companies} />
      } />
      <Route path="/crm/companies" element={
        <V2ContactPage kind="company" workspace="crm" basePath="/crm/companies" rows={companiesCrm} transcripts={interviewsCrm}
          onUpsert={handleUpsertCompany} onDelete={handleDeleteCompany}
          onLinkTranscript={handleLinkInterview} onEnrich={handleEnrichContact} loading={loading} />
      } />
      <Route path="/crm/companies/:id" element={
        <ContactDetailRoute kind="company" basePath="/crm/companies" rows={companies}
          transcripts={interviews} onDelete={handleDeleteCompany} onEnrich={handleEnrichContact}
          allPeople={people} allCompanies={companies} />
      } />
      <Route path="/crm/deals" element={<DealsList workspace="crm" />} />
      <Route path="/crm/deals/:id" element={<DealDetail />} />
      <Route path="/crm/board" element={
        <PipelinePage people={peopleCrm} companies={companiesCrm} onUpdateStatus={handleUpdateStatus} />
      } />

      {/* ───── Deal Flow workspace ───── */}
      <Route path="/deal-flow" element={
        <DashboardPage people={peopleDf} companies={firms} interviews={interviewsDf} workspace="deal_flow" />
      } />
      <Route path="/deal-flow/practitioners" element={
        <V2ContactPage kind="person" workspace="deal_flow" basePath="/deal-flow/practitioners" rows={peopleDf} transcripts={interviewsDf}
          onUpsert={handleUpsertPerson} onDelete={handleDeletePerson}
          onLinkTranscript={handleLinkInterview} onEnrich={handleEnrichContact} loading={loading} />
      } />
      <Route path="/deal-flow/practitioners/:id" element={
        <ContactDetailRoute kind="person" basePath="/deal-flow/practitioners" rows={people}
          transcripts={interviews} onDelete={handleDeletePerson} onEnrich={handleEnrichContact}
          allPeople={people} allCompanies={companies} />
      } />
      <Route path="/deal-flow/firms" element={
        <V2ContactPage kind="company" workspace="deal_flow" basePath="/deal-flow/firms" rows={firms} transcripts={interviewsDf}
          onUpsert={handleUpsertCompany} onDelete={handleDeleteCompany}
          onLinkTranscript={handleLinkInterview} onEnrich={handleEnrichContact} loading={loading} />
      } />
      <Route path="/deal-flow/firms/:id" element={
        <ContactDetailRoute kind="company" basePath="/deal-flow/firms" rows={companies}
          transcripts={interviews} onDelete={handleDeleteCompany} onEnrich={handleEnrichContact}
          allPeople={people} allCompanies={companies} />
      } />
      <Route path="/deal-flow/targets" element={<TargetsList />} />
      <Route path="/deal-flow/targets/:id" element={<TargetDetail />} />
      <Route path="/deal-flow/referrals" element={
        <ReferralPartnersList firms={firms} loading={loading} onUpsertCompany={handleUpsertCompany} />
      } />
      <Route path="/deal-flow/referrals/pipeline" element={
        <ReferralPipeline firms={firms} loading={loading} onUpdateCompany={handleUpdateCompany} />
      } />

      {/* ───── Global ───── */}
      <Route path="/review" element={<DedupReviewQueue />} />
      <Route path="/settings" element={<SettingsPageNew user={user} onSignOut={onSignOut} />} />
      <Route path="*" element={<Navigate to="/crm" replace />} />
    </Routes>
    </Suspense>
  );

  if (migrating) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: COLORS.bg, color: COLORS.text }}>
        Migrating data to Firestore…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Karla:wght@400;500;600;700;800&family=Fraunces:wght@700;800;900&display=swap" rel="stylesheet" />

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
          {/* +8px buffer above MobileNav so the last row / CTA on every page
              isn't flush against the nav (focus rings + box shadows on tap
              targets extend slightly past their layout box). */}
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: MOBILE_NAV_HEIGHT + 8 }}>{routes}</div>
          <MobileNav user={user} onSignOut={onSignOut} />
        </div>
      ) : (
        <div style={{ display: 'flex', width: '100%' }}>
          <Sidebar user={user} onSignOut={onSignOut} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TopBar
              onOpenSearch={() => setPaletteOpen(true)}
              isProcessing={ingestion.isProcessing}
              pendingCount={ingestion.pendingCount}
              reviewCount={ingestion.reviewCount}
            />
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: COLORS.bg }}>{routes}</div>
          </div>
        </div>
      )}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} people={people} companies={companies} interviews={interviews} />
    </div>
  );
}

function LegacyRecordRedirect({ rows, fallback, crmPath, dealFlowPath }) {
  const { id } = useParams();
  const row = rows.find((r) => r.id === id);
  const ws = row?.workspace || fallback;
  const base = ws === 'deal_flow' ? dealFlowPath : crmPath;
  return <Navigate to={`${base}/${id}`} replace />;
}

function LegacyPrefixRedirect({ prefix }) {
  const { id } = useParams();
  return <Navigate to={`${prefix}/${id}`} replace />;
}

export default App;
