// Sprint 6 — Intelligent merge of stage-2 enrichment data into an existing
// Contact/Company record. Pure — no Firestore, no async — so it's easy to
// reason about and unit-test.
//
// Rules per field (see sprint spec):
//   - existing is empty          → fill with incoming; log "filled"
//   - existing === incoming      → no change
//   - incomingConfidence < 60    → keep existing; log "suppressed_low_confidence"
//   - existingConfidence > incomingConfidence → keep existing; log "suppressed_existing_higher"
//   - otherwise                  → overwrite (latest wins); log "overwrote"
//
// Array fields (painPoints, techStack, etc.) are unioned and de-duplicated.
// Nested objects recurse. `*Confidence` shadow fields are carried alongside
// their primary without generating separate history rows.

import { ARRAY_FIELDS } from '../../prompts/enrichment.js';

const ARRAY_FIELD_SET = new Set(ARRAY_FIELDS);
const LOW_CONFIDENCE_FLOOR = 60;

const isEmpty = (v) =>
  v === null
  || v === undefined
  || v === ''
  || (Array.isArray(v) && v.length === 0)
  || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

const isPlainObject = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

function arrayUnion(a = [], b = []) {
  const out = [];
  const seenKeys = new Set();
  const keyOf = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : JSON.stringify(v));
  for (const item of [...(a || []), ...(b || [])]) {
    if (item == null || item === '') continue;
    const k = keyOf(item);
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    out.push(item);
  }
  return out;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  if (typeof a === 'object') {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}

/**
 * @typedef {object} MergeChange
 * @property {string} field
 * @property {*} from
 * @property {*} to
 * @property {'filled'|'overwrote'|'unioned'|'suppressed_low_confidence'|'suppressed_existing_higher'} action
 * @property {number} [incomingConfidence]
 * @property {number} [existingConfidence]
 */

/**
 * @typedef {object} EnrichmentEvent
 * @property {string|null} interviewId
 * @property {string|null} [sourceInterviewId] alias for display
 * @property {string} at              ISO timestamp (client-assigned; server writes would use serverTimestamp outside of this pure helper).
 * @property {number} [overallConfidence]
 * @property {MergeChange[]} changes
 */

/**
 * Merge incoming enrichment into an existing record.
 *
 * @param {object} existing                  Current person/company doc. Safe to pass undefined/null.
 * @param {object} incoming                  Enrichment payload from Claude (validated).
 * @param {string|null} sourceInterviewId    Interview id producing this payload (logged on the event).
 * @param {object} [options]
 * @param {string[]} [options.fields]        Optional allow-list of field names to merge. Default: all keys in `incoming`.
 * @param {number}  [options.lowConfidenceFloor]
 * @param {string}  [options.at]             Override timestamp (tests).
 * @returns {{ merged: object, changedFields: string[], enrichmentEvent: EnrichmentEvent | null }}
 *          `enrichmentEvent` is null iff nothing actually changed.
 */
export function mergeEnrichment(existing, incoming, sourceInterviewId, options = {}) {
  const base = existing && typeof existing === 'object' ? { ...existing } : {};
  const data = incoming && typeof incoming === 'object' ? incoming : {};
  const allowed = options.fields ? new Set(options.fields) : null;
  const floor = typeof options.lowConfidenceFloor === 'number' ? options.lowConfidenceFloor : LOW_CONFIDENCE_FLOOR;
  const at = options.at || new Date().toISOString();

  const merged = { ...base };
  const changes = [];

  const fieldKeys = Object.keys(data).filter((k) => !k.endsWith('Confidence'));

  for (const field of fieldKeys) {
    if (allowed && !allowed.has(field)) continue;
    if (field === 'overallConfidence') continue;

    const incomingVal = data[field];
    const existingVal = base[field];
    const confKey = `${field}Confidence`;
    const incomingConf = typeof data[confKey] === 'number' ? data[confKey] : null;
    const existingConf = typeof base[confKey] === 'number' ? base[confKey] : null;

    // Incoming missing/empty: ignore silently.
    if (isEmpty(incomingVal)) continue;

    // ── Array fields: union ────────────────────────────────────────────────
    if (ARRAY_FIELD_SET.has(field) || Array.isArray(incomingVal)) {
      const existingArr = Array.isArray(existingVal) ? existingVal : [];
      const unioned = arrayUnion(existingArr, incomingVal);
      if (!deepEqual(existingArr, unioned)) {
        merged[field] = unioned;
        changes.push({
          field,
          from: existingArr,
          to: unioned,
          action: isEmpty(existingVal) ? 'filled' : 'unioned',
        });
      }
      continue;
    }

    // ── Nested objects: recursive merge ────────────────────────────────────
    if (isPlainObject(incomingVal)) {
      const nested = mergeEnrichment(
        isPlainObject(existingVal) ? existingVal : {},
        incomingVal,
        sourceInterviewId,
        { lowConfidenceFloor: floor, at },
      );
      if (!deepEqual(existingVal, nested.merged)) {
        merged[field] = nested.merged;
        for (const c of nested.enrichmentEvent?.changes || []) {
          changes.push({ ...c, field: `${field}.${c.field}` });
        }
      }
      continue;
    }

    // ── Primitive fields ───────────────────────────────────────────────────
    if (isEmpty(existingVal)) {
      merged[field] = incomingVal;
      if (incomingConf != null) merged[confKey] = incomingConf;
      changes.push({
        field,
        from: null,
        to: incomingVal,
        action: 'filled',
        ...(incomingConf != null ? { incomingConfidence: incomingConf } : {}),
      });
      continue;
    }

    if (deepEqual(existingVal, incomingVal)) continue;

    // Values differ — apply the confidence gates.
    if (incomingConf != null && incomingConf < floor) {
      changes.push({
        field,
        from: existingVal,
        to: incomingVal,
        action: 'suppressed_low_confidence',
        incomingConfidence: incomingConf,
        ...(existingConf != null ? { existingConfidence: existingConf } : {}),
      });
      continue;
    }

    if (existingConf != null && incomingConf != null && existingConf > incomingConf) {
      changes.push({
        field,
        from: existingVal,
        to: incomingVal,
        action: 'suppressed_existing_higher',
        incomingConfidence: incomingConf,
        existingConfidence: existingConf,
      });
      continue;
    }

    merged[field] = incomingVal;
    if (incomingConf != null) merged[confKey] = incomingConf;
    changes.push({
      field,
      from: existingVal,
      to: incomingVal,
      action: 'overwrote',
      ...(incomingConf != null ? { incomingConfidence: incomingConf } : {}),
      ...(existingConf != null ? { existingConfidence: existingConf } : {}),
    });
  }

  const changedFields = Array.from(new Set(changes.map((c) => c.field)));

  const enrichmentEvent = changes.length === 0 ? null : {
    interviewId: sourceInterviewId || null,
    sourceInterviewId: sourceInterviewId || null,
    at,
    overallConfidence: typeof data.overallConfidence === 'number' ? data.overallConfidence : null,
    changes,
  };

  return { merged, changedFields, enrichmentEvent };
}

/**
 * Apply an enrichment event to the `enrichmentHistory` array on a record.
 * Keeps it bounded to 40 most-recent entries so doc size stays sensible.
 */
export function appendEnrichmentEvent(history, event, { max = 40 } = {}) {
  if (!event) return history || [];
  const out = Array.isArray(history) ? [...history, event] : [event];
  if (out.length > max) return out.slice(out.length - max);
  return out;
}

/**
 * Extract the enrichment-history entries relevant to a single field.
 * Handy for the ContactDetail per-field popover.
 */
export function historyForField(history, field) {
  if (!Array.isArray(history)) return [];
  const out = [];
  for (const evt of history) {
    for (const ch of evt.changes || []) {
      if (ch.field === field) {
        out.push({
          at: evt.at,
          interviewId: evt.interviewId || evt.sourceInterviewId || null,
          overallConfidence: evt.overallConfidence ?? null,
          ...ch,
        });
      }
    }
  }
  return out;
}
