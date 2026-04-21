// Cloud Functions entry — Plaud → Zapier → Firestore ingestion.
//
// Deployed as a v2 HTTPS function. Zapier POSTs to it with a shared-secret
// header; we authenticate on that header, validate the body, and write the
// interview to users/{OWNER_UID}/interviews/{sourceIngestionJobId}. Writes are
// idempotent — a second POST with the same job ID is a no-op. Zapier supplies
// the Plaud "Create Time" UTC ISO8601 string as the job ID (stable per recording,
// stable across Zap retries).
//
// Secrets (set via `firebase functions:secrets:set <NAME>`):
//   INGESTION_SECRET — shared secret Zapier sends in the x-ingestion-secret header.
//   OWNER_UID        — Firebase Auth UID that owns the /users/{uid} workspace.

import { onRequest } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

setGlobalOptions({ region: 'us-central1', maxInstances: 5 });

initializeApp();
const db = getFirestore();

// Callable Claude proxy — keeps the Anthropic key out of the client bundle.
export { callClaude } from './claudeProxy.js';

const INGESTION_SECRET = defineSecret('INGESTION_SECRET');
const OWNER_UID = defineSecret('OWNER_UID');

const REQUIRED_STRING_FIELDS = ['sourceIngestionJobId', 'title', 'recordedAt', 'transcript'];
const OPTIONAL_STRING_FIELDS = [
  'summary',
  'transcriptDriveUrl',
  'transcriptDriveFileId',
  'summaryDriveUrl',
  'summaryDriveFileId',
];

const MAX_PAYLOAD_BYTES = 900_000; // soft cap below Firestore's 1MB doc limit
const DEAD_LETTER_PAYLOAD_SNIPPET_BYTES = 8_000;

function sanitizeDocId(raw) {
  // Firestore doc IDs cannot contain / . # $ [ ] and are capped at 1500 bytes.
  // We also disallow leading/trailing dots and double-dots.
  const cleaned = String(raw).trim().replace(/[/.#$\[\]]/g, '-');
  return cleaned.slice(0, 256);
}

// Write a dead-letter record so a failed ingestion is visible in the Settings
// → Stuck Ingestions UI instead of silently vanishing. Fire-and-forget: a
// failure to record the dead-letter must not mask the underlying error, so
// errors here are logged and swallowed.
async function recordDeadLetter({ uid, reason, detail = {}, body }) {
  try {
    const targetUid = uid || OWNER_UID.value();
    const candidateId = sanitizeDocId(
      (body && body.sourceIngestionJobId) || `dl-${Date.now()}`,
    );
    const docId = candidateId || `dl-${Date.now()}`;
    const ref = db.collection('users').doc(targetUid).collection('ingestionDeadLetter').doc(docId);
    let payloadSnippet = null;
    if (body !== undefined) {
      try {
        const serialized = typeof body === 'string' ? body : JSON.stringify(body);
        payloadSnippet = serialized.slice(0, DEAD_LETTER_PAYLOAD_SNIPPET_BYTES);
      } catch {
        payloadSnippet = null;
      }
    }
    await ref.set({
      reason,
      detail,
      payloadSnippet,
      sourceIngestionJobId: (body && body.sourceIngestionJobId) || null,
      title: (body && body.title) || null,
      recordedAt: (body && body.recordedAt) || null,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[ingestInterview] failed to record dead-letter', { reason, err: err?.message });
  }
}

export const ingestInterview = onRequest(
  {
    secrets: [INGESTION_SECRET, OWNER_UID],
    timeoutSeconds: 60,
    cors: false,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const provided = req.get('x-ingestion-secret');
    if (!provided || provided !== INGESTION_SECRET.value()) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      await recordDeadLetter({ reason: 'invalid_body', body });
      return res.status(400).json({ error: 'invalid_body' });
    }

    for (const field of REQUIRED_STRING_FIELDS) {
      const value = body[field];
      if (typeof value !== 'string' || !value.trim()) {
        await recordDeadLetter({ reason: 'missing_or_invalid_field', detail: { field }, body });
        return res.status(400).json({ error: 'missing_or_invalid_field', field });
      }
    }
    for (const field of OPTIONAL_STRING_FIELDS) {
      if (field in body && body[field] !== null && body[field] !== '' && typeof body[field] !== 'string') {
        await recordDeadLetter({ reason: 'invalid_field_type', detail: { field }, body });
        return res.status(400).json({ error: 'invalid_field_type', field });
      }
    }

    const serialized = JSON.stringify(body);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
      await recordDeadLetter({
        reason: 'payload_too_large',
        detail: { bytes: Buffer.byteLength(serialized, 'utf8'), maxBytes: MAX_PAYLOAD_BYTES },
        body,
      });
      return res.status(413).json({ error: 'payload_too_large', maxBytes: MAX_PAYLOAD_BYTES });
    }

    const docId = sanitizeDocId(body.sourceIngestionJobId);
    if (!docId) {
      await recordDeadLetter({ reason: 'invalid_job_id', body });
      return res.status(400).json({ error: 'invalid_job_id' });
    }

    const uid = OWNER_UID.value();
    const docRef = db.collection('users').doc(uid).collection('interviews').doc(docId);

    try {
      const existing = await docRef.get();
      if (existing.exists) {
        return res.status(200).json({ status: 'already_ingested', id: docId });
      }

      await docRef.set({
        sourceIngestionJobId: body.sourceIngestionJobId,
        title: body.title,
        recordedAt: body.recordedAt,
        transcript: body.transcript,
        summary: body.summary || null,
        transcriptDriveUrl: body.transcriptDriveUrl || null,
        transcriptDriveFileId: body.transcriptDriveFileId || null,
        summaryDriveUrl: body.summaryDriveUrl || null,
        summaryDriveFileId: body.summaryDriveFileId || null,
        sourceType: 'interview_ingestion',
        source: 'plaud',
        ingestedAt: FieldValue.serverTimestamp(),
        dedupResolution: null,
        dedupStatus: 'pending',
      });

      return res.status(201).json({ status: 'created', id: docId });
    } catch (err) {
      console.error('[ingestInterview] write failed', { docId, err: err?.message });
      await recordDeadLetter({
        uid,
        reason: 'write_failed',
        detail: { message: err?.message || String(err) },
        body,
      });
      return res.status(500).json({ error: 'write_failed' });
    }
  },
);
