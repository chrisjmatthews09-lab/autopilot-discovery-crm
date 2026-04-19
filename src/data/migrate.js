import { APPS_SCRIPT_URL } from '../config/appsScript';
import { listDocs, batchWrite } from './firestore';

const MIGRATION_KEY = 'autopilot-firestore-migrated';
const RENAME_KEY = 'autopilot-renamed-v2';

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
