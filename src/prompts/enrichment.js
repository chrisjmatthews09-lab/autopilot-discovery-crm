// Prompt B — Structured Enrichment
// Stage-2 prompt that runs after dedup resolution. Extracts structured business
// + person data from the interview so we can merge it into the CRM record.
// Two variants: one for business_owner interviews, one for practitioners.

/**
 * @typedef {object} EnrichmentContact
 * @property {string|null} firstName
 * @property {string|null} lastName
 * @property {string|null} email
 * @property {string|null} role
 */

/**
 * @typedef {object} EnrichmentBusiness
 * @property {string|null} name
 * @property {'business_owner'|'practitioner'} type
 */

/**
 * Build the Prompt-B enrichment prompt.
 *
 * @param {object} input
 * @param {string}  input.transcript             Full interview transcript (required).
 * @param {string}  [input.summary]              Optional pre-existing summary.
 * @param {EnrichmentContact} [input.contact]    Contact context (for tone/framing; may be blank).
 * @param {EnrichmentBusiness} input.business    Business context; `type` picks the schema.
 * @param {number}  [input.interviewNumber]      Nth interview with this contact; helps Claude judge freshness.
 * @param {object}  [input.existingEnrichedData] Whatever we already have on the record — Claude is told to treat this as "prior context".
 * @returns {string} The full prompt text.
 */
export function buildEnrichmentPrompt({
  transcript,
  summary,
  contact,
  business,
  interviewNumber,
  existingEnrichedData,
}) {
  if (!transcript || typeof transcript !== 'string') {
    throw new Error('buildEnrichmentPrompt: transcript is required and must be a string.');
  }
  if (!business || !business.type) {
    throw new Error('buildEnrichmentPrompt: business.type is required.');
  }
  if (business.type !== 'practitioner' && business.type !== 'business_owner') {
    throw new Error(`buildEnrichmentPrompt: unknown business.type "${business.type}"`);
  }

  const schemaBlock = business.type === 'practitioner'
    ? PRACTITIONER_SCHEMA
    : BUSINESS_OWNER_SCHEMA;

  const contactBlock = contact
    ? `Name: ${[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '(unknown)'}${contact.role ? ` · ${contact.role}` : ''}${contact.email ? ` · ${contact.email}` : ''}`
    : '(no contact context provided)';

  const priorBlock = existingEnrichedData && Object.keys(existingEnrichedData).length > 0
    ? JSON.stringify(existingEnrichedData, null, 2)
    : '(no prior enrichment on file)';

  const header = business.type === 'practitioner'
    ? 'You are enriching a CRM record for an accounting / bookkeeping practitioner.'
    : 'You are enriching a CRM record for a small-business owner or operator.';

  return `${header}

<context>
Contact: ${contactBlock}
Business: ${business.name || '(unknown business)'}
Interview number: ${interviewNumber ?? 1} (1 = first touch, higher = follow-ups)
</context>

<prior_enrichment>
${priorBlock}
</prior_enrichment>

<transcript>
${transcript}
</transcript>

<summary>
${typeof summary === 'string' ? summary : ''}
</summary>

Extract the structured data described below.

Rules:
- Only include a value if it is clearly stated or clearly implied in THIS transcript. Don't copy values from <prior_enrichment> — that's shown only so you know what's already on file.
- For any field you're unsure about, set the value to null. It's much better to say "null" than to guess.
- For array fields (painPoints, techStack, goals, etc.), only include items the interviewee actually mentioned. Drop filler. No duplicates.
- For every field that has a \`*Confidence\` counterpart in the schema, return a confidence in 0-100 reflecting how clearly the interviewee stated the value:
    100 = explicitly stated and unambiguous
    70-99 = stated once, clear
    40-69 = inferred from context
    0-39 = weak guess (in this case, strongly prefer returning null for the field and a low confidence)
- Report an \`overallConfidence\` (0-100) reflecting how good this transcript was for enrichment overall.
- All monetary values: include the currency symbol and period. Example: "$3M/yr", "$400K ARR", "$180/month".
- All counts (employees, clients, years) as integers.

Return ONLY valid JSON matching this exact schema — no prose, no markdown fences, no comments:

${schemaBlock}

Return ONLY the JSON object.`;
}

const BUSINESS_OWNER_SCHEMA = `{
  "summary": string | null,
  "industry": string | null,
  "industryConfidence": number,
  "location": string | null,
  "revenue": string | null,
  "revenueConfidence": number,
  "employees": number | null,
  "employeesConfidence": number,
  "yearsInBusiness": number | null,
  "yearsInBusinessConfidence": number,
  "currentAccounting": string | null,
  "monthsBehind": number | null,
  "currentSpend": string | null,
  "painPoints": string[],
  "techStack": string[],
  "goals": string[],
  "constraints": string[],
  "quotableLines": string[],
  "overallConfidence": number
}`;

const PRACTITIONER_SCHEMA = `{
  "summary": string | null,
  "role": string | null,
  "roleConfidence": number,
  "firmSize": string | null,
  "firmSizeConfidence": number,
  "yearsInPractice": number | null,
  "yearsInPracticeConfidence": number,
  "clientCount": number | null,
  "clientCountConfidence": number,
  "clientTypes": string[],
  "avgClientRevenue": string | null,
  "avgClientRevenueConfidence": number,
  "specialties": string[],
  "softwareStack": string[],
  "painPoints": string[],
  "goals": string[],
  "constraints": string[],
  "quotableLines": string[],
  "overallConfidence": number
}`;

/**
 * Fields tracked on the COMPANY doc after enrichment. Includes all
 * business_owner fields + corresponding *Confidence shadows.
 */
export const BUSINESS_OWNER_FIELDS = Object.freeze([
  'summary',
  'industry', 'industryConfidence',
  'location',
  'revenue', 'revenueConfidence',
  'employees', 'employeesConfidence',
  'yearsInBusiness', 'yearsInBusinessConfidence',
  'currentAccounting', 'monthsBehind', 'currentSpend',
  'painPoints', 'techStack', 'goals', 'constraints', 'quotableLines',
  'overallConfidence',
]);

/**
 * Fields tracked on the PERSON doc after practitioner enrichment.
 */
export const PRACTITIONER_FIELDS = Object.freeze([
  'summary',
  'role', 'roleConfidence',
  'firmSize', 'firmSizeConfidence',
  'yearsInPractice', 'yearsInPracticeConfidence',
  'clientCount', 'clientCountConfidence',
  'clientTypes',
  'avgClientRevenue', 'avgClientRevenueConfidence',
  'specialties', 'softwareStack',
  'painPoints', 'goals', 'constraints', 'quotableLines',
  'overallConfidence',
]);

/**
 * Fields the practitioner enrichment writes onto the *person* record,
 * regardless of whether a firm (company) exists.
 * The remaining practitioner fields (firmSize, specialties, softwareStack,
 * yearsInPractice, clientCount, clientTypes, avgClientRevenue) describe the
 * firm and go on the company record when one exists.
 */
export const PRACTITIONER_PERSON_FIELDS = Object.freeze([
  'role', 'roleConfidence',
  'painPoints', 'goals', 'constraints', 'quotableLines',
  'summary',
]);

/**
 * Fields the practitioner enrichment writes onto the *company* record.
 */
export const PRACTITIONER_COMPANY_FIELDS = Object.freeze([
  'firmSize', 'firmSizeConfidence',
  'yearsInPractice', 'yearsInPracticeConfidence',
  'clientCount', 'clientCountConfidence',
  'clientTypes',
  'avgClientRevenue', 'avgClientRevenueConfidence',
  'specialties', 'softwareStack',
]);

/**
 * Fields that are arrays and should accumulate (union) across interviews.
 */
export const ARRAY_FIELDS = Object.freeze([
  'painPoints',
  'techStack',
  'goals',
  'constraints',
  'quotableLines',
  'clientTypes',
  'specialties',
  'softwareStack',
]);
