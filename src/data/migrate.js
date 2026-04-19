import { APPS_SCRIPT_URL } from '../config/appsScript';
import { listDocs, batchWrite } from './firestore';

const MIGRATION_KEY = 'autopilot-firestore-migrated';

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
// Preserves existing IDs (prac-###, biz-###, t-###) as Firestore doc IDs so the existing UI
// stays unchanged. Safe to re-run: only writes if the target collection is empty.
export async function migrateSheetsToFirestore({ force = false } = {}) {
  if (!force && hasMigrated()) return { skipped: true, reason: 'already migrated' };

  const existingPractitioners = await listDocs('practitioners');
  const existingBusinesses = await listDocs('businesses');
  const existingTranscripts = await listDocs('transcripts');

  if (!force && (existingPractitioners.length || existingBusinesses.length || existingTranscripts.length)) {
    markMigrated();
    return { skipped: true, reason: 'firestore not empty' };
  }

  const sheetData = await fetchSheetData();
  const practitioners = sheetData.practitioners || [];
  const businesses = sheetData.businesses || [];
  const transcripts = sheetData.transcripts || [];

  const ops = [];
  for (const row of practitioners) {
    if (!row.id) continue;
    ops.push({ type: 'set', collection: 'practitioners', id: row.id, data: row });
  }
  for (const row of businesses) {
    if (!row.id) continue;
    ops.push({ type: 'set', collection: 'businesses', id: row.id, data: row });
  }
  for (const row of transcripts) {
    if (!row.id) continue;
    ops.push({ type: 'set', collection: 'transcripts', id: row.id, data: row });
  }

  const chunkSize = 400;
  for (let i = 0; i < ops.length; i += chunkSize) {
    await batchWrite(ops.slice(i, i + chunkSize));
  }

  markMigrated();
  return {
    skipped: false,
    counts: {
      practitioners: practitioners.length,
      businesses: businesses.length,
      transcripts: transcripts.length,
    },
  };
}
