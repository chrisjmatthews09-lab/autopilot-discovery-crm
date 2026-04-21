// Sprint 9 — Manual merge/split tooling.
//
// Three operations:
//   - mergeContacts(sourceId, targetId, kind): moves every interview/call/note
//     from source→target, merges missing enrichment fields, soft-deletes the
//     source, and records a `merges` row containing a snapshot sufficient for
//     full rollback.
//   - undoMerge(mergeId): reverses the merge using the stored snapshot —
//     moves records back, clears source.deletedAt, drops source.id from
//     target.mergedFromContactIds.
//   - moveInterview(interviewId, toContactId, toKind): split an interview
//     off to a different contact; logs the event on both contacts'
//     enrichmentHistory.

import { getDoc, updateDoc, createDoc, listDocs, batchWrite, genId } from './firestore';
import { serverTimestamp } from 'firebase/firestore';
import { appendEnrichmentEvent } from '../lib/dedup/enrichmentMerge.js';

const MERGES_COLLECTION = 'merges';

function pickMergeableFields(source, target) {
  // Target wins on conflict; source fills gaps only. Keeps the merge simple
  // and predictable — the full source doc is snapshotted separately so undo
  // can restore it verbatim.
  const skipKeys = new Set([
    'id', 'createdAt', 'updatedAt', 'deletedAt',
    'mergedFromContactIds', 'primaryContactId',
    'enrichmentHistory',
  ]);
  const patch = {};
  for (const [key, value] of Object.entries(source || {})) {
    if (skipKeys.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    const current = target?.[key];
    if (current === undefined || current === null || current === '') {
      patch[key] = value;
    } else if (Array.isArray(current) && Array.isArray(value)) {
      // Union arrays case-insensitively.
      const seen = new Set(current.map((v) => (typeof v === 'string' ? v.toLowerCase() : JSON.stringify(v))));
      const merged = [...current];
      for (const v of value) {
        const key2 = typeof v === 'string' ? v.toLowerCase() : JSON.stringify(v);
        if (!seen.has(key2)) { merged.push(v); seen.add(key2); }
      }
      if (merged.length !== current.length) patch[key] = merged;
    }
  }
  return patch;
}

async function relatedInterviewsFor(kind, contactId) {
  const byLinked = await listDocs('interviews', [['linkedContactId', '==', contactId]]);
  const mine = byLinked.filter((iv) => iv.linkedType === kind);
  // Dedup-attached interviews: linked to something else but resolved to us.
  // Firestore doesn't let us OR easily, so fall back to a full scan; realistic
  // interview counts are small.
  const all = await listDocs('interviews');
  const viaDedup = all.filter((iv) => {
    const r = iv.dedupResolution;
    if (!r) return false;
    if (kind === 'person' && r.matchedContactId === contactId) return true;
    if (kind === 'company' && r.matchedBusinessId === contactId) return true;
    return false;
  });
  const byId = new Map();
  for (const iv of [...mine, ...viaDedup]) byId.set(iv.id, iv);
  return [...byId.values()];
}

async function relatedInteractionsFor(kind, contactId) {
  return listDocs('interactions', [
    ['entity_type', '==', kind],
    ['entity_id', '==', contactId],
  ]);
}

/**
 * Merge source into target. Both must be the same kind ('person'|'company').
 * Caller is responsible for ensuring appType/workspace agree.
 *
 * Returns the created merge record id so the UI can offer an undo affordance.
 */
export async function mergeContacts({ sourceId, targetId, kind }) {
  if (!sourceId || !targetId) throw new Error('sourceId and targetId required');
  if (sourceId === targetId) throw new Error('cannot merge a contact into itself');
  if (kind !== 'person' && kind !== 'company') throw new Error('kind must be person or company');

  const collectionName = kind === 'person' ? 'people' : 'companies';
  const [source, target] = await Promise.all([
    getDoc(collectionName, sourceId),
    getDoc(collectionName, targetId),
  ]);
  if (!source) throw new Error(`source ${kind} ${sourceId} not found`);
  if (!target) throw new Error(`target ${kind} ${targetId} not found`);
  if (source.deletedAt) throw new Error('source is already soft-deleted');

  const [interviews, interactions] = await Promise.all([
    relatedInterviewsFor(kind, sourceId),
    relatedInteractionsFor(kind, sourceId),
  ]);

  // Snapshot for undo — captures exactly what changed so we can reverse.
  const snapshot = {
    source,
    interviews: interviews.map((iv) => ({
      id: iv.id,
      linkedType: iv.linkedType,
      linkedContactId: iv.linkedContactId,
      dedupResolution: iv.dedupResolution || null,
    })),
    interactions: interactions.map((it) => ({
      id: it.id,
      entity_type: it.entity_type,
      entity_id: it.entity_id,
    })),
    prevTarget: {
      mergedFromContactIds: Array.isArray(target.mergedFromContactIds) ? [...target.mergedFromContactIds] : [],
    },
  };

  // All writes below commit atomically via a single Firestore batch. If any
  // one mutation fails (permissions, concurrent delete, offline), nothing lands
  // — previously these were sequential updateDoc() calls and a partial failure
  // could strand interviews on a soft-deleted source with no undo record.
  //
  // Firestore caps a batch at 500 ops. A merge of interviews + interactions +
  // 2 contact docs + 1 merges record realistically stays well under that; if
  // someone ever hits the limit we'd need to chunk.
  const ops = [];

  // 1. Move interviews: linkedContactId → target, dedupResolution → target too.
  for (const iv of interviews) {
    const patch = {};
    if (iv.linkedType === kind && iv.linkedContactId === sourceId) {
      patch.linkedContactId = targetId;
      patch.linkedType = kind;
    }
    const r = iv.dedupResolution;
    if (r && ((kind === 'person' && r.matchedContactId === sourceId)
          || (kind === 'company' && r.matchedBusinessId === sourceId))) {
      patch.dedupResolution = { ...r };
      if (kind === 'person') patch.dedupResolution.matchedContactId = targetId;
      if (kind === 'company') patch.dedupResolution.matchedBusinessId = targetId;
    }
    if (Object.keys(patch).length) {
      ops.push({ collection: 'interviews', id: iv.id, type: 'update', data: patch });
    }
  }

  // 2. Move interactions (calls/notes/stage_change/etc).
  for (const it of interactions) {
    ops.push({
      collection: 'interactions',
      id: it.id,
      type: 'update',
      data: { entity_id: targetId },
    });
  }

  // 3. Merge enrichment fields: target wins, source fills gaps.
  const enrichmentPatch = pickMergeableFields(source, target);
  const historyEvent = {
    source: 'manual_merge',
    mergedFromContactId: sourceId,
    mergedInterviewCount: interviews.length,
    mergedInteractionCount: interactions.length,
    fields: Object.keys(enrichmentPatch),
  };
  const nextHistory = appendEnrichmentEvent(target.enrichmentHistory, historyEvent);

  const mergedFromIds = Array.isArray(target.mergedFromContactIds) ? [...target.mergedFromContactIds] : [];
  if (!mergedFromIds.includes(sourceId)) mergedFromIds.push(sourceId);

  ops.push({
    collection: collectionName,
    id: targetId,
    type: 'update',
    data: {
      ...enrichmentPatch,
      mergedFromContactIds: mergedFromIds,
      enrichmentHistory: nextHistory,
    },
  });

  // 4. Soft-delete source.
  ops.push({
    collection: collectionName,
    id: sourceId,
    type: 'update',
    data: {
      deletedAt: new Date().toISOString(),
      mergedIntoContactId: targetId,
    },
  });

  // 5. Record the merge so it can be listed + undone. Pre-allocate the doc
  //    id so it can ride along in the same batch as the mutations it describes.
  const mergeId = genId(MERGES_COLLECTION);
  ops.push({
    collection: MERGES_COLLECTION,
    id: mergeId,
    type: 'set',
    data: {
      kind,
      sourceId,
      targetId,
      mergedAt: new Date().toISOString(),
      status: 'applied',
      snapshot,
      summary: {
        interviews: interviews.length,
        interactions: interactions.length,
        fields: Object.keys(enrichmentPatch).length,
      },
      createdAt: serverTimestamp(),
    },
  });

  await batchWrite(ops);

  return { mergeId, snapshot };
}

/**
 * Reverse a merge. Only `status === 'applied'` merges can be undone.
 */
export async function undoMerge(mergeId) {
  const record = await getDoc(MERGES_COLLECTION, mergeId);
  if (!record) throw new Error(`merge ${mergeId} not found`);
  if (record.status !== 'applied') throw new Error(`merge is ${record.status}, cannot undo`);

  const { kind, sourceId, targetId, snapshot } = record;
  if (!snapshot) throw new Error('merge has no snapshot — undo impossible');
  const collectionName = kind === 'person' ? 'people' : 'companies';

  // Read target first (needed to compute enrichmentHistory rollback), then
  // commit every reversal in one batch so a partial undo can't leave the
  // system half-restored.
  const target = await getDoc(collectionName, targetId);
  const ops = [];

  // 1. Interviews back.
  for (const iv of snapshot.interviews || []) {
    ops.push({
      collection: 'interviews',
      id: iv.id,
      type: 'update',
      data: {
        linkedType: iv.linkedType || null,
        linkedContactId: iv.linkedContactId || null,
        dedupResolution: iv.dedupResolution || null,
      },
    });
  }

  // 2. Interactions back.
  for (const it of snapshot.interactions || []) {
    ops.push({
      collection: 'interactions',
      id: it.id,
      type: 'update',
      data: {
        entity_type: it.entity_type,
        entity_id: it.entity_id,
      },
    });
  }

  // 3. Restore source document (un-delete, drop mergedIntoContactId).
  ops.push({
    collection: collectionName,
    id: sourceId,
    type: 'update',
    data: {
      deletedAt: null,
      mergedIntoContactId: null,
    },
  });

  // 4. Remove source from target.mergedFromContactIds + roll back the
  //    history event we added.
  if (target) {
    const restoredIds = (snapshot.prevTarget?.mergedFromContactIds) || [];
    const history = Array.isArray(target.enrichmentHistory) ? [...target.enrichmentHistory] : [];
    const idx = [...history].reverse().findIndex((e) => (
      e?.source === 'manual_merge' && e?.mergedFromContactId === sourceId
    ));
    if (idx !== -1) history.splice(history.length - 1 - idx, 1);
    ops.push({
      collection: collectionName,
      id: targetId,
      type: 'update',
      data: {
        mergedFromContactIds: restoredIds,
        enrichmentHistory: history,
      },
    });
  }

  // 5. Mark the merge record as undone (keeps the audit trail).
  ops.push({
    collection: MERGES_COLLECTION,
    id: mergeId,
    type: 'update',
    data: {
      status: 'undone',
      undoneAt: new Date().toISOString(),
    },
  });

  await batchWrite(ops);

  return { ok: true };
}

/**
 * Split an interview off to a different contact. Only touches the interview
 * doc — its interactions (calls/notes) remain on whichever entity logged
 * them, which in practice is already correct since those are per-person.
 */
export async function moveInterview({ interviewId, toContactId, toKind }) {
  if (!interviewId || !toContactId) throw new Error('interviewId and toContactId required');
  if (toKind !== 'person' && toKind !== 'company') throw new Error('toKind must be person or company');

  const interview = await getDoc('interviews', interviewId);
  if (!interview) throw new Error(`interview ${interviewId} not found`);

  const fromKind = interview.linkedType || (interview.dedupResolution?.matchedContactId ? 'person' : 'company');
  const fromId = interview.linkedContactId
    || interview.dedupResolution?.matchedContactId
    || interview.dedupResolution?.matchedBusinessId
    || null;

  await updateDoc('interviews', interviewId, {
    linkedType: toKind,
    linkedContactId: toContactId,
    dedupResolution: {
      ...(interview.dedupResolution || {}),
      method: 'manual_move',
      matchedContactId: toKind === 'person' ? toContactId : null,
      matchedBusinessId: toKind === 'company' ? toContactId : null,
      movedAt: new Date().toISOString(),
    },
  });

  const note = `Manually moved interview ${interviewId} from ${fromKind || '?'}:${fromId || '?'} to ${toKind}:${toContactId}`;
  const stamp = async (collection, contactId) => {
    if (!contactId) return;
    try {
      const doc = await getDoc(collection, contactId);
      if (!doc) return;
      const next = appendEnrichmentEvent(doc.enrichmentHistory, {
        source: 'manual_split',
        interviewId,
        from: { kind: fromKind, id: fromId },
        to: { kind: toKind, id: toContactId },
        note,
      });
      await updateDoc(collection, contactId, { enrichmentHistory: next });
    } catch (err) {
      // Non-fatal — history is useful but not load-bearing.
      console.warn('stamp history failed', err);
    }
  };

  if (fromId) await stamp(fromKind === 'person' ? 'people' : 'companies', fromId);
  await stamp(toKind === 'person' ? 'people' : 'companies', toContactId);

  return { ok: true };
}

/**
 * List merge records (newest first) for the Settings "Recently merged" view.
 */
export async function listMerges() {
  const rows = await listDocs(MERGES_COLLECTION);
  return rows.sort((a, b) => new Date(b.mergedAt || 0) - new Date(a.mergedAt || 0));
}
