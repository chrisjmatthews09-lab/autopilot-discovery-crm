// Prompt C — Dedup Review Summary
// Purpose: when a tier-3 (70-89%) match lands in the review queue, this prompt
// asks Claude to compare the incoming interview against the existing record and
// recommend merge-vs-create. Output is free-form prose (2-3 sentences + a
// one-line recommendation) so the card can render it as-is.

/**
 * @param {object} input
 * @param {object} input.incoming          — extractedEntity from the pending review
 *                                           { firstName, lastName, email, phone, businessName, ... }
 * @param {string} [input.incomingSummary] — first 400 chars of the source interview summary/transcript
 * @param {object} input.existing          — the candidate record we might merge into
 *                                           contact: { name, email, phone, company, interviewIds, ... }
 *                                           business: { name, contactIds, ... }
 * @param {string} [input.existingContext] — short blurb: "2 past interviews; last on 2026-03-15. Summary: ..."
 * @param {object} input.matchDetails      — { entityType, nameMatch, businessMatch, confidence, triggerReason }
 * @returns {string}
 */
export function buildReviewSummaryPrompt({ incoming, incomingSummary, existing, existingContext, matchDetails }) {
  if (!incoming || typeof incoming !== 'object') {
    throw new Error('buildReviewSummaryPrompt: incoming entity is required');
  }
  if (!existing || typeof existing !== 'object') {
    throw new Error('buildReviewSummaryPrompt: existing record is required');
  }
  if (!matchDetails || typeof matchDetails !== 'object') {
    throw new Error('buildReviewSummaryPrompt: matchDetails required');
  }

  const entityType = matchDetails.entityType === 'business' ? 'business' : 'contact';
  const incomingName = [incoming.firstName, incoming.lastName].filter(Boolean).join(' ') || '(name unclear)';
  const incomingBiz = incoming.businessName || '(no business)';
  const existingLabel = entityType === 'business'
    ? (existing.name || '(unnamed company)')
    : (existing.name || [existing.firstName, existing.lastName].filter(Boolean).join(' ') || '(unnamed contact)');

  return `You are helping a CRM user decide whether two records refer to the same ${entityType}. Read both sides and give a short, decisive take.

<incoming>
Name: ${incomingName}
Email: ${incoming.email || '(none)'}
Phone: ${incoming.phone || '(none)'}
Business: ${incomingBiz}
${incomingSummary ? `Interview excerpt: ${incomingSummary}` : ''}
</incoming>

<existing>
${entityType === 'contact' ? `Name: ${existingLabel}
Email: ${existing.email || '(none)'}
Phone: ${existing.phone || '(none)'}
Company: ${existing.company || '(none)'}` : `Business: ${existingLabel}`}
${existingContext ? `History: ${existingContext}` : ''}
</existing>

<match_signals>
Name similarity: ${matchDetails.nameMatch ?? 'n/a'}%
Business similarity: ${matchDetails.businessMatch ?? 'n/a'}%
Overall confidence: ${matchDetails.confidence ?? 'n/a'}%
Trigger: ${matchDetails.triggerReason || 'tier3_review'}
</match_signals>

Write 2-3 sentences of plain prose analysis — compare the two records, note the strongest signal (matching business? similar name spelling? shared contact info?), and call out anything that looks suspicious (e.g. different email domains, different cities, same name but common first name). No headers, no bullet points.

End with a single final line in this exact format:
Recommendation: MERGE — [6-10 word reason]
or
Recommendation: CREATE NEW — [6-10 word reason]

Do not hedge. Pick one.`;
}
