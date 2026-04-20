// Accessors for the modern interview document schema written by the Firebase
// ingestion Cloud Function (functions/src/index.js) and populated further by
// the ingestion processor (services/ingestionService.js).
//
// A fresh interview arrives from Zapier with { title, recordedAt, transcript,
// summary, transcriptDriveUrl, summaryDriveUrl, dedupStatus: 'pending' }. Once
// the processor claims it, `extractedEntity` lands on the doc holding
// { firstName, lastName, businessName, ... } from Claude. The display-layer
// name/business accessors prefer that extracted identity and fall back to the
// raw Zapier title so unprocessed interviews still render usefully.

function joinName(first, last) {
  const a = first ? String(first).trim() : '';
  const b = last ? String(last).trim() : '';
  return `${a} ${b}`.trim();
}

export function getIntervieweeName(interview) {
  const ent = interview?.extractedEntity;
  if (ent && (ent.firstName || ent.lastName)) {
    const joined = joinName(ent.firstName, ent.lastName);
    if (joined) return joined;
  }
  return interview?.title || null;
}

export function getIntervieweeBusinessName(interview) {
  const name = interview?.extractedEntity?.businessName;
  return name ? String(name).trim() || null : null;
}

export function getInterviewHeadline(interview) {
  return getIntervieweeName(interview)
    || getIntervieweeBusinessName(interview)
    || interview?.title
    || null;
}

export function getInterviewDate(interview) {
  return interview?.recordedAt || interview?.ingestedAt || null;
}

export function getInterviewTranscript(interview) {
  return interview?.transcript || null;
}

export function getInterviewSummary(interview) {
  return interview?.summary || null;
}

export function getInterviewTranscriptUrl(interview) {
  return interview?.transcriptDriveUrl || null;
}

export function getInterviewSummaryUrl(interview) {
  return interview?.summaryDriveUrl || null;
}

export function getInterviewUpdatedAt(interview) {
  // The modern schema doesn't carry a freeform `updatedAt`; the closest signals
  // are `enrichmentRanAt` (set after stage-2 enrichment) and `ingestedAt` (set
  // at creation). Callers use this purely for "most recent activity" sorting.
  return interview?.enrichmentRanAt || interview?.ingestedAt || interview?.recordedAt || null;
}

/**
 * Best-effort date formatter for raw interview timestamps.
 * Accepts an interview object OR a raw ISO string. Returns `null` when there's
 * nothing to display so callers can short-circuit.
 */
export function formatInterviewDate(input, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const raw = typeof input === 'string' ? input : getInterviewDate(input);
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString(undefined, options);
}

export function hasTranscript(interview) {
  return Boolean(getInterviewTranscript(interview) || getInterviewTranscriptUrl(interview));
}

export function hasSummary(interview) {
  return Boolean(getInterviewSummary(interview) || getInterviewSummaryUrl(interview));
}
