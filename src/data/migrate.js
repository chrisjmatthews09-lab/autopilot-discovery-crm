import { APPS_SCRIPT_URL } from '../config/appsScript';
import { LEGACY_STATUS_TO_LIFECYCLE } from '../config/enums';
import { listDocs, batchWrite } from './firestore';
import { DEFAULT_SCRIPTS } from './defaultScripts';
import { DEFAULT_PIPELINES, DEFAULT_TARGET_PIPELINES } from './defaultPipelines';
import { normalizeEmail, normalizePhone, normalizeName, normalizeBusinessName, buildFullName } from '../lib/dedup';

const MIGRATION_KEY = 'autopilot-firestore-migrated';
const RENAME_KEY = 'autopilot-renamed-v2';
const LIFECYCLE_KEY = 'autopilot-lifecycle-v3';
const SCRIPTS_SEED_KEY = 'autopilot-scripts-seeded-v1';
const PIPELINES_SEED_KEY = 'autopilot-pipelines-seeded-v1';
const TARGET_PIPELINES_SEED_KEY = 'autopilot-target-pipelines-seeded-v1';
const WORKSPACE_BACKFILL_KEY = 'autopilot-workspace-backfill-v1';
const DEDUP_BACKFILL_KEY = 'autopilot-dedup-backfill-v1';

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

export function hasMigrated() {
  try {
    return localStorage.getItem(MIGRATION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markMigrated() {
  try {
    localStorage.setItem(MIGRATION_KEY, 'true');
  } catch { /* ignore */ }
}

export function clearMigrationFlag() {
  try {
    localStorage.removeItem(MIGRATION_KEY);
  } catch { /* ignore */ }
}

// One-time migration: reads the current Sheets via Apps Script getData, writes to Firestore.
// Writes directly to v2 collection names (people / companies / interviews) and normalizes
// linkedType on interviews. Safe to re-run: only writes if all target collections are empty.
export async function migrateSheetsToFirestore({ force = false } = {}) {
  if (!force && hasMigrated()) return { skipped: true, reason: 'already migrated' };

  const existingPeople = await listDocs('people');
  const existingCompanies = await listDocs('companies');
  const existingInterviews = await listDocs('interviews');

  if (!force && (existingPeople.length || existingCompanies.length || existingInterviews.length)) {
    markMigrated();
    return { skipped: true, reason: 'firestore not empty' };
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

  markMigrated();
  markRenamed();
  return {
    skipped: false,
    counts: { people: people.length, companies: companies.length, interviews: interviews.length },
  };
}

export function hasRenamed() {
  try { return localStorage.getItem(RENAME_KEY) === 'true'; } catch { return false; }
}

export function markRenamed() {
  try { localStorage.setItem(RENAME_KEY, 'true'); } catch { /* ignore */ }
}

// One-time rename: copies docs from old collection names (practitioners/businesses/transcripts)
// into new ones (people/companies/interviews), preserving IDs and normalizing transcript.linkedType.
// Old collections are left in place; delete them manually in the Firebase console once verified.
export async function renameCollectionsV2() {
  if (hasRenamed()) return { skipped: true, reason: 'already renamed' };

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

  markRenamed();
  return { skipped: false, counts };
}

export function hasLifecycleMigrated() {
  try { return localStorage.getItem(LIFECYCLE_KEY) === 'true'; } catch { return false; }
}

export function markLifecycleMigrated() {
  try { localStorage.setItem(LIFECYCLE_KEY, 'true'); } catch { /* ignore */ }
}

// One-time: map legacy `status` → `lifecycle_stage` on people and companies.
// Leaves `status` intact for backward compatibility. `declined` → archived flag.
export async function migrateLifecycleStages() {
  if (hasLifecycleMigrated()) return { skipped: true, reason: 'already migrated' };

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

  markLifecycleMigrated();
  return { skipped: false, counts };
}

export function hasScriptsSeeded() {
  try { return localStorage.getItem(SCRIPTS_SEED_KEY) === 'true'; } catch { return false; }
}

export function markScriptsSeeded() {
  try { localStorage.setItem(SCRIPTS_SEED_KEY, 'true'); } catch { /* ignore */ }
}

// One-time: seed `scripts` collection with PRO + BIZ defaults if empty.
export async function seedScripts() {
  if (hasScriptsSeeded()) return { skipped: true, reason: 'already seeded' };

  const existing = await listDocs('scripts');
  if (existing.length > 0) {
    markScriptsSeeded();
    return { skipped: true, reason: 'scripts not empty' };
  }

  const ops = DEFAULT_SCRIPTS.map((s) => ({ type: 'set', collection: 'scripts', id: s.id, data: s }));
  await batchWrite(ops);
  markScriptsSeeded();
  return { skipped: false, counts: { scripts: ops.length } };
}

export function hasPipelinesSeeded() {
  try { return localStorage.getItem(PIPELINES_SEED_KEY) === 'true'; } catch { return false; }
}

export function markPipelinesSeeded() {
  try { localStorage.setItem(PIPELINES_SEED_KEY, 'true'); } catch { /* ignore */ }
}

// One-time: seed default deal pipelines ('New Client', 'Service Upgrade') if empty.
export async function seedPipelines() {
  if (hasPipelinesSeeded()) return { skipped: true, reason: 'already seeded' };

  const existing = await listDocs('pipelines');
  if (existing.length > 0) {
    markPipelinesSeeded();
    return { skipped: true, reason: 'pipelines not empty' };
  }

  const ops = DEFAULT_PIPELINES.map((p) => ({ type: 'set', collection: 'pipelines', id: p.id, data: p }));
  await batchWrite(ops);
  markPipelinesSeeded();
  return { skipped: false, counts: { pipelines: ops.length } };
}

export function hasTargetPipelinesSeeded() {
  try { return localStorage.getItem(TARGET_PIPELINES_SEED_KEY) === 'true'; } catch { return false; }
}

export function markTargetPipelinesSeeded() {
  try { localStorage.setItem(TARGET_PIPELINES_SEED_KEY, 'true'); } catch { /* ignore */ }
}

export function hasWorkspaceBackfilled() {
  try { return localStorage.getItem(WORKSPACE_BACKFILL_KEY) === 'true'; } catch { return false; }
}

export function markWorkspaceBackfilled() {
  try { localStorage.setItem(WORKSPACE_BACKFILL_KEY, 'true'); } catch { /* ignore */ }
}

export function clearWorkspaceBackfillFlag() {
  try { localStorage.removeItem(WORKSPACE_BACKFILL_KEY); } catch { /* ignore */ }
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
  if (!force && hasWorkspaceBackfilled()) return { skipped: true, reason: 'already backfilled' };

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

  markWorkspaceBackfilled();
  return { skipped: false, counts };
}

export function hasDedupBackfilled() {
  try { return localStorage.getItem(DEDUP_BACKFILL_KEY) === 'true'; } catch { return false; }
}

export function markDedupBackfilled() {
  try { localStorage.setItem(DEDUP_BACKFILL_KEY, 'true'); } catch { /* ignore */ }
}

export function clearDedupBackfillFlag() {
  try { localStorage.removeItem(DEDUP_BACKFILL_KEY); } catch { /* ignore */ }
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
  if (!force && hasDedupBackfilled()) return { skipped: true, reason: 'already backfilled' };

  const log = (msg) => { try { console.log(`[dedup-migration] ${msg}`); } catch { /* ignore */ } };
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

  markDedupBackfilled();
  log(`Done. Updated — people: ${counts.people}, companies: ${counts.companies}, interviews: ${counts.interviews}.`);
  return {
    skipped: false,
    counts,
    totals: { people: people.length, companies: companies.length, interviews: interviews.length },
  };
}

// One-time: seed default target (M&A) pipelines if none present.
export async function seedTargetPipelines() {
  if (hasTargetPipelinesSeeded()) return { skipped: true, reason: 'already seeded' };

  const existing = await listDocs('pipelines');
  const hasTargetType = existing.some((p) => p.object_type === 'target');
  if (hasTargetType) {
    markTargetPipelinesSeeded();
    return { skipped: true, reason: 'target pipeline exists' };
  }

  const ops = DEFAULT_TARGET_PIPELINES.map((p) => ({ type: 'set', collection: 'pipelines', id: p.id, data: p }));
  await batchWrite(ops);
  markTargetPipelinesSeeded();
  return { skipped: false, counts: { pipelines: ops.length } };
}
