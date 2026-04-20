// Prompt A — Classification & Entity Extraction
// Verbatim from PRD Part 7.1 (Autopilot Deduplication & Interview Ingestion PRD v1.0).
// Purpose: pull out the minimum entity data needed to run dedup. Fast, deterministic,
// low-cost. Structured enrichment (revenue, headcount, etc.) is a separate prompt.

/**
 * @param {{ transcript: string, summary?: string }} input
 * @returns {string} The full prompt to send to Claude as a user message.
 */
export function buildClassificationPrompt({ transcript, summary }) {
  if (!transcript || typeof transcript !== 'string') {
    throw new Error('buildClassificationPrompt: transcript is required and must be a string.');
  }
  const safeSummary = typeof summary === 'string' ? summary : '';

  return `You are a data extraction assistant for a CRM system. You receive a transcript of a recorded interview and extract structured data about the person being interviewed and their business.

<transcript>
${transcript}
</transcript>

<summary>
${safeSummary}
</summary>

Extract the following fields. If a field is not clearly stated in the transcript, return null — do NOT guess.

Return ONLY valid JSON, no prose, no markdown fences, with this exact schema:
{
  "appType": "crm" | "deal_flow",
  "businessType": "practitioner" | "business_owner",
  "firstName": string,
  "lastName": string,
  "email": string | null,
  "phone": string | null,
  "businessName": string,
  "confidence": {
    "classification": number,
    "name": number,
    "business": number
  }
}

Classification rules:
- If the interviewee works at an accounting firm, bookkeeping firm, tax practice, or CPA firm in a professional capacity (owner, partner, staff), set businessType = "practitioner" and appType = "deal_flow"
- Otherwise (any other business owner or operator), set businessType = "business_owner" and appType = "crm"
- Edge case: if the interviewee is a CPA who is ALSO being interviewed about a separate non-accounting business they own, classify based on the primary subject of THIS interview

Name extraction rules:
- Extract the interviewee's first and last name as clearly stated
- If Chris asks "can you state your name for the record" or similar, use that answer
- If the name is introduced casually ("I'm John Smith from Acme"), use that
- Do not infer names from email addresses
- If unclear, set firstName or lastName to null

Email extraction rules:
- Only extract if the interviewee explicitly states their email
- Normalize to lowercase
- Ignore emails mentioned as examples or references to other people

Phone extraction rules:
- Only extract if explicitly stated
- Return in format "+1XXXXXXXXXX" if US, otherwise digits only

Business name rules:
- Extract the company the interviewee represents in THIS conversation
- If they mention past companies, only use the current one
- Include the full name as stated (keep "LLC", "Inc", etc. — normalization happens downstream)

Confidence scores:
- 0–100 for each field, reflecting how clearly the data was stated
- 100 = explicitly stated, repeated, unambiguous
- 70–99 = clearly stated once
- 40–69 = inferred from context
- 0–39 = unclear, likely wrong

Return ONLY the JSON object.`;
}

export const CLASSIFICATION_RESPONSE_REQUIRED = Object.freeze([
  'appType',
  'businessType',
  'firstName',
  'lastName',
  'businessName',
  'confidence',
]);

export const CLASSIFICATION_APP_TYPES = Object.freeze(['crm', 'deal_flow']);
export const CLASSIFICATION_BUSINESS_TYPES = Object.freeze(['practitioner', 'business_owner']);
