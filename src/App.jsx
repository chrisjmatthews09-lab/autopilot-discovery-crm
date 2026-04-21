import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useCollection } from './hooks/useCollection';
import { useWindowWidth } from './hooks/useWindowWidth';
import { createDoc, updateDoc, deleteDoc } from './data/firestore';
import { migrateSheetsToFirestore, hasMigrated, renameCollectionsV2, hasRenamed, migrateLifecycleStages, hasLifecycleMigrated, seedScripts, hasScriptsSeeded, seedPipelines, hasPipelinesSeeded, seedTargetPipelines, hasTargetPipelinesSeeded, migrateWorkspaceBackfill, hasWorkspaceBackfilled } from './data/migrate';
import { useWorkspace } from './hooks/useWorkspace';
import { useIngestionProcessor } from './hooks/useIngestionProcessor.js';
import CommandPalette from './components/ui/CommandPalette';
import { useToast } from './components/ui/Toast';
import { logInteraction } from './data/interactions';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import MobileNav from './components/layout/MobileNav';
import { COLORS, FONT, DISPLAY, MOBILE_NAV_HEIGHT } from './config/design-tokens';
import PageSkeleton from './components/ui/PageSkeleton';
import { LegacyRecordRedirect, LegacyPrefixRedirect } from './router/redirects';
import PageErrorBoundary from './components/ui/PageErrorBoundary';

// Page-level code splitting — every route below is fetched on demand so the
// initial bundle only carries the shell, sidebar, and shared UI primitives.
const ReferralPartnersList = lazy(() => import('./pages/ReferralPartners'));
const ReferralPipeline = lazy(() => import('./pages/ReferralPipeline'));
const Tasks = lazy(() => import('./pages/Tasks'));
const DealsList = lazy(() => import('./pages/DealsList'));
const DealDetail = lazy(() => import('./pages/DealDetail'));
const TargetsList = lazy(() => import('./pages/TargetsList'));
const TargetDetail = lazy(() => import('./pages/TargetDetail'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const SettingsPageNew = lazy(() => import('./pages/Settings'));
const ScriptsWrapper = lazy(() => import('./pages/Scripts'));
const DedupReviewQueue = lazy(() => import('./pages/DedupReviewQueue'));
const V2ContactPage = lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.V2ContactPage })));
const ContactDetailRoute = lazy(() => import('./pages/ContactPage').then((m) => ({ default: m.ContactDetailRoute })));
const InterviewsListPage = lazy(() => import('./pages/InterviewsPage'));
const InterviewDetailRoute = lazy(() => import('./pages/InterviewsPage').then((m) => ({ default: m.InterviewDetailRoute })));
const PipelinePage = lazy(() => import('./pages/PipelinePage'));
const ScriptPage = lazy(() => import('./pages/ScriptPage'));
const ThemesPage = lazy(() => import('./pages/ThemesPage'));

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz89C4C15E1Cxmux8bWUWw04pghxiGlqkfb2Ulr_8FMZdnIZ9vcNEakdrGo3zNLhAZV/exec';

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
  const toast = useToast();

  // Always read the *current* workspaceId inside async handlers. Closing over
  // the value at render time meant a user who started a form in one workspace
  // and submitted after switching would land the record in the wrong place.
  const workspaceIdRef = useRef(workspaceId);
  useEffect(() => { workspaceIdRef.current = workspaceId; }, [workspaceId]);

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
    try {
      if (prev) {
        await updateDoc('people', id, data);
        if (prev.lifecycle_stage !== data.lifecycle_stage && data.lifecycle_stage) {
          logInteraction({ kind: 'stage_change', entity_type: 'person', entity_id: id, title: 'Lifecycle stage changed', from_stage: prev.lifecycle_stage || null, to_stage: data.lifecycle_stage })
            .catch((err) => console.error('logInteraction (person stage_change) failed', err));
        }
      } else {
        const newId = id || `person-${Date.now()}`;
        await createDoc('people', { workspace: data.workspace || workspaceIdRef.current, ...data }, newId);
      }
      return true;
    } catch (err) {
      console.error('handleUpsertPerson failed', err);
      toast.error('Failed to save contact — please try again');
      return false;
    }
  };

  const handleDeletePerson = async (id) => {
    await deleteDoc('people', id);
  };

  const handleUpsertCompany = async (row) => {
    const { id, ...data } = row;
    const prev = id && companies.find((c) => c.id === id);
    try {
      if (prev) {
        await updateDoc('companies', id, data);
        if (prev.lifecycle_stage !== data.lifecycle_stage && data.lifecycle_stage) {
          logInteraction({ kind: 'stage_change', entity_type: 'company', entity_id: id, title: 'Lifecycle stage changed', from_stage: prev.lifecycle_stage || null, to_stage: data.lifecycle_stage })
            .catch((err) => console.error('logInteraction (company stage_change) failed', err));
        }
      } else {
        const newId = id || `company-${Date.now()}`;
        await createDoc('companies', { workspace: data.workspace || workspaceIdRef.current, ...data }, newId);
      }
      return true;
    } catch (err) {
      console.error('handleUpsertCompany failed', err);
      toast.error('Failed to save record — please try again');
      return false;
    }
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

  const handleUpdateInterview = async (id, patch) => {
    await updateDoc('interviews', id, patch);
  };

  const combinedContacts = useMemo(() => ([
    ...people.map((p) => ({ ...p, type: 'pro' })),
    ...companies.map((c) => ({ ...c, type: 'biz' })),
  ]), [people, companies]);

  // Workspace-scoped subsets. Records missing the `workspace` field fall back to a
  // heuristic (people default to deal_flow, companies to crm) — matches migration logic.
  const { peopleCrm, peopleDf, companiesCrm, firms, interviewsCrm, interviewsDf } = useMemo(() => {
    const wsOf = (row, fallback) => row.workspace || fallback;
    return {
      peopleCrm: people.filter((p) => wsOf(p, 'deal_flow') === 'crm'),
      peopleDf: people.filter((p) => wsOf(p, 'deal_flow') === 'deal_flow'),
      companiesCrm: companies.filter((c) => wsOf(c, 'crm') === 'crm'),
      firms: companies.filter((c) => wsOf(c, 'crm') === 'deal_flow'),
      interviewsCrm: interviews.filter((iv) => wsOf(iv, 'deal_flow') === 'crm'),
      interviewsDf: interviews.filter((iv) => wsOf(iv, 'deal_flow') === 'deal_flow'),
    };
  }, [people, companies, interviews]);

  const routes = (
    <Suspense fallback={<PageSkeleton />}>
    <PageErrorBoundary>
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
    </PageErrorBoundary>
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

export default App;
