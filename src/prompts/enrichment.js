// Prompt B — Structured Enrichment
// Stage-2 prompt that runs after dedup resolution. Extracts structured business
// + person data from the interview so we can merge it into the CRM record.
// Two variants: one for business_owner interviews, one for practitioners.

import {
  INDUSTRIES,
  VERTICALS_BY_INDUSTRY,
  canonicalIndustry,
  filterVerticalsForIndustry,
} from '../config/industryTaxonomy.js';

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

  // For business_owner interviews we inject the Industry/Vertical taxonomy so
  // Claude picks values from the approved picklist (never free-typed).
  const taxonomyBlock = business.type === 'business_owner'
    ? renderTaxonomyBlock()
    : '';

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
- For array fields (painPoints, softwareStack, goals, etc.), only include items the interviewee actually mentioned. Drop filler. No duplicates.
- For every field that has a \`*Confidence\` counterpart in the schema, return a confidence in 0-100 reflecting how clearly the interviewee stated the value:
    100 = explicitly stated and unambiguous
    70-99 = stated once, clear
    40-69 = inferred from context
    0-39 = weak guess (in this case, strongly prefer returning null for the field and a low confidence)
- Report an \`overallConfidence\` (0-100) reflecting how good this transcript was for enrichment overall.
- All monetary values: include the currency symbol and period. Example: "$3M/yr", "$400K ARR", "$180/month".
- All counts (employees, clients, years) as integers.
${taxonomyBlock}
Return ONLY valid JSON matching this exact schema — no prose, no markdown fences, no comments:

${schemaBlock}

Return ONLY the JSON object.`;
}

// Serialize the Industry/Vertical taxonomy into the prompt. Claude must pick
// `industry` from this fixed list and any `vertical` values from the children
// of the chosen industry — no free-typing.
function renderTaxonomyBlock() {
  const lines = ['', '- INDUSTRY + VERTICAL (picklist — MUST pick from this taxonomy only):'];
  lines.push('    Industries (pick exactly one, copy the string verbatim):');
  for (const ind of INDUSTRIES) lines.push(`      - ${ind}`);
  lines.push('    Verticals by industry (pick zero or more from ONLY the chosen industry\'s list, copy strings verbatim):');
  for (const ind of INDUSTRIES) {
    lines.push(`      ${ind}:`);
    for (const v of VERTICALS_BY_INDUSTRY[ind]) lines.push(`        - ${v}`);
  }
  lines.push('    Rules:');
  lines.push('      - \`industry\` is REQUIRED for business_owner interviews. Never return null — make your best guess from the list above based on the transcript. Lean on explicit mentions first, fall back to inferred context (products sold, services delivered, clientele).');
  lines.push('      - \`vertical\` is an ARRAY of zero or more verticals drawn ONLY from the chosen industry\'s list. Pick multiple when the business clearly operates across more than one vertical (e.g. a dealership selling both new and used cars → both "New Car Dealers" AND "Used Car Dealers").');
  lines.push('      - If the transcript gives no signal to narrow down a vertical, return \`[]\` and leave industry filled.');
  lines.push('      - Do NOT invent industry or vertical names. If a candidate looks close but isn\'t on the list, pick the best match that IS on the list.');
  return lines.join('\n') + '\n';
}

const BUSINESS_OWNER_SCHEMA = `{
  "summary": string | null,
  "industry": string | null,
  "industryConfidence": number,
  "vertical": string[],
  "location": string | null,
  "email": string | null,
  "phone": string | null,
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
  "softwareStack": string[],
  "goals": string[],
  "constraints": string[],
  "quotableLines": string[],
  "overallConfidence": number
}`;

const PRACTITIONER_SCHEMA = `{
  "summary": string | null,
  "email": string | null,
  "phone": string | null,
  "role": string | null,
  "roleConfidence": number,
  "firmSize": string | null,
  "firmSizeConfidence": number,
  "revenue": string | null,
  "revenueConfidence": number,
  "employees": number | null,
  "employeesConfidence": number,
  "yearsInBusiness": number | null,
  "yearsInBusinessConfidence": number,
  "yearsInPractice": number | null,
  "yearsInPracticeConfidence": number,
  "clientCount": number | null,
  "clientCountConfidence": number,
  "clientTypes": string[],
  "avgClientRevenue": string | null,
  "avgClientRevenueConfidence": number,
  "specialties": string[],
  "serviceLines": string[],
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
  'vertical',
  'location',
  'email', 'phone',
  'revenue', 'revenueConfidence',
  'employees', 'employeesConfidence',
  'yearsInBusiness', 'yearsInBusinessConfidence',
  'currentAccounting', 'monthsBehind', 'currentSpend',
  'painPoints', 'softwareStack', 'goals', 'constraints', 'quotableLines',
  'overallConfidence',
]);

/**
 * Fields tracked on the PERSON doc after practitioner enrichment.
 */
export const PRACTITIONER_FIELDS = Object.freeze([
  'summary',
  'email', 'phone',
  'role', 'roleConfidence',
  'firmSize', 'firmSizeConfidence',
  'revenue', 'revenueConfidence',
  'employees', 'employeesConfidence',
  'yearsInBusiness', 'yearsInBusinessConfidence',
  'yearsInPractice', 'yearsInPracticeConfidence',
  'clientCount', 'clientCountConfidence',
  'clientTypes',
  'avgClientRevenue', 'avgClientRevenueConfidence',
  'specialties', 'serviceLines', 'softwareStack',
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
  'email', 'phone',
  'role', 'roleConfidence',
  'painPoints', 'goals', 'constraints', 'quotableLines',
  'summary',
]);

/**
 * Fields the practitioner enrichment writes onto the *company* record.
 */
export const PRACTITIONER_COMPANY_FIELDS = Object.freeze([
  'firmSize', 'firmSizeConfidence',
  'revenue', 'revenueConfidence',
  'employees', 'employeesConfidence',
  'yearsInBusiness', 'yearsInBusinessConfidence',
  'yearsInPractice', 'yearsInPracticeConfidence',
  'clientCount', 'clientCountConfidence',
  'clientTypes',
  'avgClientRevenue', 'avgClientRevenueConfidence',
  'specialties', 'serviceLines', 'softwareStack',
]);

/**
 * Fields that are arrays and should accumulate (union) across interviews.
 */
export const ARRAY_FIELDS = Object.freeze([
  'painPoints',
  'goals',
  'constraints',
  'quotableLines',
  'clientTypes',
  'specialties',
  'serviceLines',
  'softwareStack',
  'vertical',
]);

/**
 * Coerce a business_owner enrichment payload to valid taxonomy values.
 *
 * Claude is instructed to pick industry/vertical from the hard-coded taxonomy,
 * but we validate rather than trust — any industry that doesn't match a
 * canonical name is dropped (defensive, though the prompt should prevent this)
 * and verticals are filtered to only those that belong to the canonical
 * industry. The returned object is a shallow copy; the original is not mutated.
 *
 * @param {object} enriched
 * @returns {object}
 */
export function normalizeBusinessOwnerEnrichment(enriched) {
  if (!enriched || typeof enriched !== 'object') return enriched;
  const out = { ...enriched };
  const canonInd = canonicalIndustry(out.industry);
  out.industry = canonInd; // null if Claude gave something off-list; UI/prompt will surface it on next run
  out.vertical = canonInd && Array.isArray(out.vertical)
    ? filterVerticalsForIndustry(canonInd, out.vertical)
    : [];
  return out;
}
