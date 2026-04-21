import { APPS_SCRIPT_URL } from '../config/appsScript';
import { LEGACY_STATUS_TO_LIFECYCLE } from '../config/enums';
import { listDocs, batchWrite } from './firestore';
import { DEFAULT_SCRIPTS } from './defaultScripts';
import { DEFAULT_PIPELINES, DEFAULT_TARGET_PIPELINES } from './defaultPipelines';
import { normalizeEmail, normalizePhone, normalizeName, normalizeBusinessName, buildFullName } from '../lib/dedup';
import {
  doc,
  runTransaction,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';

// Each one-time migration has a stable ID. The authoritative completion
// record lives in Firestore at `users/{uid}/_system/migrations/{id}` — that's
// what prevents duplicate runs under two-tab races, incognito sessions,
// cleared browser storage, or replaced devices. The paired localStorage key
// is a legacy signal, used only to backfill the Firestore doc for users who
// already completed the migration before the lock moved to Firestore.
const MIGRATION_KEY = 'autopilot-firestore-migrated';
const RENAME_KEY = 'autopilot-renamed-v2';
const LIFECYCLE_KEY = 'autopilot-lifecycle-v3';
const SCRIPTS_SEED_KEY = 'autopilot-scripts-seeded-v1';
const PIPELINES_SEED_KEY = 'autopilot-pipelines-seeded-v2';
const TARGET_PIPELINES_SEED_KEY = 'autopilot-target-pipelines-seeded-v2';
const WORKSPACE_BACKFILL_KEY = 'autopilot-workspace-backfill-v1';
const DEDUP_BACKFILL_KEY = 'autopilot-dedup-backfill-v1';

const MIGRATION_ID = {
  sheetsToFirestore: 'sheets-to-firestore',
  renameV2: 'rename-collections-v2',
  lifecycle: 'lifecycle-stages-v3',
  seedScripts: 'seed-scripts-v1',
  seedPipelines: 'seed-pipelines-v2',
  seedTargetPipelines: 'seed-target-pipelines-v2',
  workspaceBackfill: 'workspace-backfill-v1',
  dedupBackfill: 'dedup-backfill-v1',
};

const COLLECTION_RENAMES = [
  { from: 'practitioners', to: 'people' },
  { from: 'businesses', to: 'companies' },
  { from: 'transcripts', to: 'interviews' },
];

const LINKED_TYPE_RENAMES = { practitioner: 'person', business: 'company' };

async function fetchSheetData() {
  const url = `${APPS_SCRIPT_URL}?action=getData`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`getData failed: HTTP ${res.status}`);
  return res.json();
}

function migrationDocRef(migrationId) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('runMigration requires authentication');
  return doc(db, `users/${uid}/_system/migrations/${migrationId}`);
}

function readLocalFlag(key) {
  try { return localStorage.getItem(key) === 'true'; } catch { return false; }
}

function writeLocalFlag(key, value) {
  try {
    if (value) localStorage.setItem(key, 'true');
    else localStorage.removeItem(key);
  } catch { /* ignore */ }
}

// Transactional claim on `users/{uid}/_system/migrations/{migrationId}`.
// Returns one of three outcomes. The caller only runs the work when
// `outcome === 'claimed'`.
//
//   'already-completed' — another run (this tab, another tab, a previous
//                         session) finished this migration. Skip.
//   'in-progress'       — another tab is running this migration right now.
//                         Skip to avoid duplicate writes.
//   'claimed'           — we now own the lock; caller must run the work and
//                         then resolve it via completeMigration/failMigration.
//
// Backfill: if the Firestore doc does not exist but the legacy
// `localStorageKey` is set, we treat the migration as already completed and
// write a completed doc retroactively. Existing users who finished migrations
// before the Firestore lock existed therefore never re-run them.
async function claimMigration(migrationId, { localStorageKey, force }) {
  const ref = migrationDocRef(migrationId);
  const localCompleted = Boolean(localStorageKey) && readLocalFlag(localStorageKey);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      const data = snap.data();
      if (!force && data.status === 'completed') {
        return { outcome: 'already-completed' };
      }
      if (!force && data.status === 'in_progress') {
        return { outcome: 'in-progress' };
      }
      // `failed` status falls through — we retry.
    } else if (!force && localCompleted) {
      tx.set(ref, {
        status: 'completed',
        completedAt: serverTimestamp(),
        backfilledFromLocalStorage: true,
      });
      return { outcome: 'already-completed' };
    }
    tx.set(ref, {
      status: 'in_progress',
      startedAt: serverTimestamp(),
    });
    return { outcome: 'claimed' };
  });
}

async function completeMigration(migrationId, { localStorageKey, result } = {}) {
  const ref = migrationDocRef(migrationId);
  await setDoc(ref, {
    status: 'completed',
    completedAt: serverTimestamp(),
    ...(result ? { result } : {}),
  });
  if (localStorageKey) writeLocalFlag(localStorageKey, true);
}

async function failMigration(migrationId, err) {
  try {
    const ref = migrationDocRef(migrationId);
    await setDoc(ref, {
      status: 'failed',
      failedAt: serverTimestamp(),
      error: String(err && err.message ? err.message : err),
    });
  } catch {
    // Best-effort — the original error is more important than the telemetry
    // write failing.
  }
}

// High-level wrapper: claim → run → complete/fail. `worker` receives no args
// and may return a result object; that object is stored alongside the
// completion record for diagnostics.
async function runMigration(migrationId, { localStorageKey, force = false } = {}, worker) {
  const { outcome } = await claimMigration(migrationId, { localStorageKey, force });
  if (outcome === 'already-completed') return { skipped: true, reason: 'already completed' };
  if (outcome === 'in-progress') return { skipped: true, reason: 'another tab is running this migration' };

  try {
    const result = await worker();
    await completeMigration(migrationId, { localStorageKey, result: result && result.counts ? { counts: result.counts } : undefined });
    return result ?? { skipped: false };
  } catch (err) {
    await failMigration(migrationId, err);
    throw err;
  }
}

// ── Legacy synchronous has*() helpers ───────────────────────────────────────
// Kept because App.jsx / Settings.jsx still import them for fast-path UI
// decisions before the async migration check completes. They reflect the
// localStorage hint only — the authoritative state is the Firestore lock.
export function hasMigrated() { return readLocalFlag(MIGRATION_KEY); }
export function markMigrated() { writeLocalFlag(MIGRATION_KEY, true); }
export function clearMigrationFlag() { writeLocalFlag(MIGRATION_KEY, false); }

export function hasRenamed() { return readLocalFlag(RENAME_KEY); }
export function markRenamed() { writeLocalFlag(RENAME_KEY, true); }

export function hasLifecycleMigrated() { return readLocalFlag(LIFECYCLE_KEY); }
export function markLifecycleMigrated() { writeLocalFlag(LIFECYCLE_KEY, true); }

export function hasScriptsSeeded() { return readLocalFlag(SCRIPTS_SEED_KEY); }
export function markScriptsSeeded() { writeLocalFlag(SCRIPTS_SEED_KEY, true); }

export function hasPipelinesSeeded() { return readLocalFlag(PIPELINES_SEED_KEY); }
export function markPipelinesSeeded() { writeLocalFlag(PIPELINES_SEED_KEY, true); }

export function hasTargetPipelinesSeeded() { return readLocalFlag(TARGET_PIPELINES_SEED_KEY); }
export function markTargetPipelinesSeeded() { writeLocalFlag(TARGET_PIPELINES_SEED_KEY, true); }

export function hasWorkspaceBackfilled() { return readLocalFlag(WORKSPACE_BACKFILL_KEY); }
export function markWorkspaceBackfilled() { writeLocalFlag(WORKSPACE_BACKFILL_KEY, true); }
export function clearWorkspaceBackfillFlag() { writeLocalFlag(WORKSPACE_BACKFILL_KEY, false); }

export function hasDedupBackfilled() { return readLocalFlag(DEDUP_BACKFILL_KEY); }
export function markDedupBackfilled() { writeLocalFlag(DEDUP_BACKFILL_KEY, true); }
export function clearDedupBackfillFlag() { writeLocalFlag(DEDUP_BACKFILL_KEY, false); }

// ── Migrations ──────────────────────────────────────────────────────────────

// One-time migration: reads the current Sheets via Apps Script getData, writes to Firestore.
// Writes directly to v2 collection names (people / companies / interviews) and normalizes
// linkedType on interviews. Safe to re-run: only writes if all target collections are empty.
export async function migrateSheetsToFirestore({ force = false } = {}) {
  return runMigration(MIGRATION_ID.sheetsToFirestore, { localStorageKey: MIGRATION_KEY, force }, async () => {
    const existingPeople = await listDocs('people');
    const existingCompanies = await listDocs('companies');
    const existingInterviews = await listDocs('interviews');

    if (existingPeople.length || existingCompanies.length || existingInterviews.length) {
      return { skipped: false, counts: { people: 0, companies: 0, interviews: 0 }, reason: 'firestore not empty' };
    }

    const sheetData = await fetchSheetData();
    const people = sheetData.practitioners || [];
    const companies = sheetData.businesses || [];
    const interviews = sheetData.transcripts || [];

    const ops = [];
    for (const row of people) {
      if (!row.id) continue;
      ops.push({ type: 'set', collection: 'people', id: row.id, data: row });
    }
    for (const row of companies) {
      if (!row.id) continue;
      ops.push({ type: 'set', collection: 'companies', id: row.id, data: row });
    }
    for (const row of interviews) {
      if (!row.id) continue;
      const normalized = { ...row };
      if (LINKED_TYPE_RENAMES[normalized.linkedType]) {
        normalized.linkedType = LINKED_TYPE_RENAMES[normalized.linkedType];
      }
      ops.push({ type: 'set', collection: 'interviews', id: row.id, data: normalized });
    }

    const chunkSize = 400;
    for (let i = 0; i < ops.length; i += chunkSize) {
      await batchWrite(ops.slice(i, i + chunkSize));
    }

    return { skipped: false, counts: { people: people.length, companies: companies.length, interviews: interviews.length } };
  });
}

// One-time rename: copies docs from old collection names (practitioners/businesses/transcripts)
// into new ones (people/companies/interviews), preserving IDs and normalizing transcript.linkedType.
// Old collections are left in place; delete them manually in the Firebase console once verified.
export async function renameCollectionsV2({ force = false } = {}) {
  return runMigration(MIGRATION_ID.renameV2, { localStorageKey: RENAME_KEY, force }, async () => {
    const counts = {};
    const ops = [];
    for (const { from, to } of COLLECTION_RENAMES) {
      const oldDocs = await listDocs(from);
      counts[to] = oldDocs.length;
      for (const row of oldDocs) {
        const { id, ...data } = row;
        if (from === 'transcripts' && LINKED_TYPE_RENAMES[data.linkedType]) {
          data.linkedType = LINKED_TYPE_RENAMES[data.linkedType];
        }
        ops.push({ type: 'set', collection: to, id, data });
      }
    }

    const chunkSize = 400;
    for (let i = 0; i < ops.length; i += chunkSize) {
      await batchWrite(ops.slice(i, i + chunkSize));
    }

    return { skipped: false, counts };
  });
}

// One-time: map legacy `status` → `lifecycle_stage` on people and companies.
// Leaves `status` intact for backward compatibility. `declined` → archived flag.
export async function migrateLifecycleStages({ force = false } = {}) {
  return runMigration(MIGRATION_ID.lifecycle, { localStorageKey: LIFECYCLE_KEY, force }, async () => {
    const counts = { people: 0, companies: 0 };
    const ops = [];

    for (const coll of ['people', 'companies']) {
      const rows = await listDocs(coll);
      for (const row of rows) {
        if (row.lifecycle_stage) continue;
        const mapped = LEGACY_STATUS_TO_LIFECYCLE[row.status] || 'Research-Contact';
        const patch = { lifecycle_stage: mapped };
        if (row.status === 'declined') patch.is_archived = true;
        ops.push({ type: 'update', collection: coll, id: row.id, data: patch });
        counts[coll] += 1;
      }
    }

    const chunkSize = 400;
    for (let i = 0; i < ops.length; i += chunkSize) {
      await batchWrite(ops.slice(i, i + chunkSize));
    }

    return { skipped: false, counts };
  });
}

// One-time: seed `scripts` collection with PRO + BIZ defaults if empty.
export async function seedScripts({ force = false } = {}) {
  return runMigration(MIGRATION_ID.seedScripts, { localStorageKey: SCRIPTS_SEED_KEY, force }, async () => {
    const existing = await listDocs('scripts');
    if (existing.length > 0) {
      return { skipped: false, counts: { scripts: 0 }, reason: 'scripts not empty' };
    }
    const ops = DEFAULT_SCRIPTS.map((s) => ({ type: 'set', collection: 'scripts', id: s.id, data: s }));
    await batchWrite(ops);
    return { skipped: false, counts: { scripts: ops.length } };
  });
}

// One-time: seed default deal pipelines ('New Client', 'Service Upgrade') if empty.
export async function seedPipelines({ force = false } = {}) {
  return runMigration(MIGRATION_ID.seedPipelines, { localStorageKey: PIPELINES_SEED_KEY, force }, async () => {
    const existing = await listDocs('pipelines');
    if (existing.length > 0) {
      return { skipped: false, counts: { pipelines: 0 }, reason: 'pipelines not empty' };
    }
    const ops = DEFAULT_PIPELINES.map((p) => ({ type: 'set', collection: 'pipelines', id: p.id, data: p }));
    await batchWrite(ops);
    return { skipped: false, counts: { pipelines: ops.length } };
  });
}

// One-time: seed default target (M&A) pipelines if none present.
export async function seedTargetPipelines({ force = false } = {}) {
  return runMigration(MIGRATION_ID.seedTargetPipelines, { localStorageKey: TARGET_PIPELINES_SEED_KEY, force }, async () => {
    const existing = await listDocs('pipelines');
    const hasTargetType = existing.some((p) => p.object_type === 'target');
    if (hasTargetType) {
      return { skipped: false, counts: { pipelines: 0 }, reason: 'target pipeline exists' };
    }
    const ops = DEFAULT_TARGET_PIPELINES.map((p) => ({ type: 'set', collection: 'pipelines', id: p.id, data: p }));
    await batchWrite(ops);
    return { skipped: false, counts: { pipelines: ops.length } };
  });
}

// Heuristic: classify an existing record into a workspace.
// Safe defaults per current schema semantics:
//   - people        → deal_flow (historical: all People were practitioners)
//   - companies     → crm       (historical: all Companies were businesses)
//   - interviews    → deal_flow (historical: practitioner research)
//   - tasks         → deal_flow if linked to a target, else crm
//   - deals         → crm
//   - targets       → deal_flow
export function classifyWorkspace(collectionName, row) {
  if (row && row.workspace) return row.workspace;
  switch (collectionName) {
    case 'people':
      return 'deal_flow';
    case 'companies':
      return 'crm';
    case 'interviews':
      return 'deal_flow';
    case 'tasks':
      return row?.related_target_id ? 'deal_flow' : 'crm';
    case 'deals':
      return 'crm';
    case 'targets':
      return 'deal_flow';
    default:
      return 'crm';
  }
}

// One-time: stamp `workspace` on every existing record across the workspace-scoped
// collections. Idempotent: skips rows that already have `workspace` set.
export async function migrateWorkspaceBackfill({ force = false } = {}) {
  return runMigration(MIGRATION_ID.workspaceBackfill, { localStorageKey: WORKSPACE_BACKFILL_KEY, force }, async () => {
    const collections = ['people', 'companies', 'interviews', 'tasks', 'deals', 'targets'];
    const counts = {};
    const ops = [];

    for (const coll of collections) {
      const rows = await listDocs(coll);
      counts[coll] = 0;
      for (const row of rows) {
        if (row.workspace) continue;
        const ws = classifyWorkspace(coll, row);
        ops.push({ type: 'update', collection: coll, id: row.id, data: { workspace: ws } });
        counts[coll] += 1;
      }
    }

    const chunkSize = 400;
    for (let i = 0; i < ops.length; i += chunkSize) {
      await batchWrite(ops.slice(i, i + chunkSize));
    }

    return { skipped: false, counts };
  });
}

function personFullName(row) {
  if (row.firstName || row.lastName) return buildFullName(row.firstName, row.lastName);
  return normalizeName(row.name || row.fullName || '');
}

function personDedupPatch(row) {
  return {
    emailNormalized: normalizeEmail(row.email),
    fullNameNormalized: personFullName(row),
    phoneNormalized: normalizePhone(row.phone),
    sourceType: row.sourceType || 'manual',
    mergedFromContactIds: Array.isArray(row.mergedFromContactIds) ? row.mergedFromContactIds : [],
    dedupReviewStatus: row.dedupReviewStatus || 'none',
    interviewIds: Array.isArray(row.interviewIds) ? row.interviewIds : [],
    callIds: Array.isArray(row.callIds) ? row.callIds : [],
    noteIds: Array.isArray(row.noteIds) ? row.noteIds : [],
    enrichmentHistory: Array.isArray(row.enrichmentHistory) ? row.enrichmentHistory : [],
  };
}

function companyDedupPatch(row, contactIdsFromPeople) {
  return {
    nameNormalized: normalizeBusinessName(row.company || row.name || ''),
    sourceType: row.sourceType || 'manual',
    mergedFromBusinessIds: Array.isArray(row.mergedFromBusinessIds) ? row.mergedFromBusinessIds : [],
    contactIds: contactIdsFromPeople,
    primaryContactId: row.primaryContactId ?? null,
    enrichmentHistory: Array.isArray(row.enrichmentHistory) ? row.enrichmentHistory : [],
  };
}

function interviewDedupPatch(row) {
  return {
    extractedEntity: row.extractedEntity ?? null,
    dedupResolution: row.dedupResolution ?? null,
    sourceIngestionJobId: row.sourceIngestionJobId ?? null,
  };
}

// Shallow equality — treats arrays of same length & ordered primitives as equal.
function patchMatchesRow(row, patch) {
  for (const key of Object.keys(patch)) {
    const a = row[key];
    const b = patch[key];
    if (Array.isArray(b)) {
      if (!Array.isArray(a) || a.length !== b.length) return false;
      for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) return false;
    } else if (a !== b) {
      return false;
    }
  }
  return true;
}

// One-time: backfill normalized + dedup scaffolding fields on people, companies, interviews.
// Purely additive — never overwrites existing non-null values (except recomputing
// normalized fields from the current source fields). Safe to re-run.
export async function migrateDedupFields({ force = false, onProgress } = {}) {
  return runMigration(MIGRATION_ID.dedupBackfill, { localStorageKey: DEDUP_BACKFILL_KEY, force }, async () => {
    const log = (msg) => {
      if (!import.meta.env.DEV) return;
      try { console.log(`[dedup-migration] ${msg}`); } catch { /* ignore */ }
    };
    const notify = (evt) => { if (typeof onProgress === 'function') { try { onProgress(evt); } catch { /* ignore */ } } };

    const [people, companies, interviews] = await Promise.all([
      listDocs('people'),
      listDocs('companies'),
      listDocs('interviews'),
    ]);

    log(`Loaded ${people.length} people, ${companies.length} companies, ${interviews.length} interviews.`);

    // Build company_id → [personId] map for Business.contactIds backfill.
    const contactIdsByCompany = new Map();
    for (const p of people) {
      const cid = p.company_id || p.companyId;
      if (!cid) continue;
      const list = contactIdsByCompany.get(cid) || [];
      list.push(p.id);
      contactIdsByCompany.set(cid, list);
    }

    const ops = [];
    const counts = { people: 0, companies: 0, interviews: 0 };

    for (let i = 0; i < people.length; i++) {
      const row = people[i];
      const patch = personDedupPatch(row);
      if (!patchMatchesRow(row, patch)) {
        ops.push({ type: 'update', collection: 'people', id: row.id, data: patch });
        counts.people += 1;
      }
      if ((i + 1) % 50 === 0) {
        log(`people: processed ${i + 1}/${people.length} (${counts.people} to update)`);
        notify({ collection: 'people', processed: i + 1, total: people.length });
      }
    }

    for (let i = 0; i < companies.length; i++) {
      const row = companies[i];
      const existing = Array.isArray(row.contactIds) ? row.contactIds : [];
      const derived = contactIdsByCompany.get(row.id) || [];
      const merged = Array.from(new Set([...existing, ...derived])).sort();
      const patch = companyDedupPatch(row, merged);
      if (!patchMatchesRow(row, patch)) {
        ops.push({ type: 'update', collection: 'companies', id: row.id, data: patch });
        counts.companies += 1;
      }
      if ((i + 1) % 50 === 0) {
        log(`companies: processed ${i + 1}/${companies.length} (${counts.companies} to update)`);
        notify({ collection: 'companies', processed: i + 1, total: companies.length });
      }
    }

    for (let i = 0; i < interviews.length; i++) {
      const row = interviews[i];
      const patch = interviewDedupPatch(row);
      if (!patchMatchesRow(row, patch)) {
        ops.push({ type: 'update', collection: 'interviews', id: row.id, data: patch });
        counts.interviews += 1;
      }
      if ((i + 1) % 50 === 0) {
        log(`interviews: processed ${i + 1}/${interviews.length} (${counts.interviews} to update)`);
        notify({ collection: 'interviews', processed: i + 1, total: interviews.length });
      }
    }

    const chunkSize = 400;
    for (let i = 0; i < ops.length; i += chunkSize) {
      await batchWrite(ops.slice(i, i + chunkSize));
      log(`Wrote batch ${Math.floor(i / chunkSize) + 1} (${Math.min(chunkSize, ops.length - i)} ops)`);
    }

    log(`Done. Updated — people: ${counts.people}, companies: ${counts.companies}, interviews: ${counts.interviews}.`);
    return {
      skipped: false,
      counts,
      totals: { people: people.length, companies: companies.length, interviews: interviews.length },
    };
  });
}
