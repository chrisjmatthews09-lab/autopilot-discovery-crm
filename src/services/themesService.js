// Cross-interview synthesis for the Insights / Themes page.
// Replaces the legacy Apps Script `analyzeThemes` endpoint so the whole
// Claude flow goes through VITE_CLAUDE_API_KEY.

import { callClaude, parseJsonStrict } from './claudeService.js';

const BIZ_FIELDS = [
  'name', 'industry', 'location', 'revenue', 'employees', 'yearsInBusiness',
  'currentAccounting', 'monthsBehind', 'currentSpend',
  'painPoints', 'techStack', 'goals', 'constraints', 'quotableLines', 'summary',
];

const PRAC_FIELDS = [
  'name', 'company', 'role', 'firmSize', 'yearsInPractice', 'clientCount',
  'clientTypes', 'avgClientRevenue', 'specialties', 'softwareStack',
  'painPoints', 'goals', 'constraints', 'quotableLines', 'summary',
];

function slimRecord(rec, fields) {
  const out = {};
  for (const f of fields) {
    const v = rec?.[f];
    if (v == null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'string' && !v.trim()) continue;
    out[f] = v;
  }
  return out;
}

function buildBusinessPrompt(records) {
  return `You are synthesizing qualitative research from ${records.length} business-owner discovery interviews. Each record below captures pain points, willingness-to-pay signals, tech stack, and goals extracted from a single interview.

Return ONE JSON object with this exact shape (omit fields you can't support; never invent numbers). No prose, no code fences.

{
  "executiveSummary": "3-5 sentences summarizing the most important cross-interview patterns.",
  "topPainPoints": [
    { "theme": "Short name", "frequency": "N of ${records.length}", "evidence": "One-sentence explanation with a paraphrased quote if possible." }
  ],
  "wtpProfile": {
    "priceRange": "e.g. $500-$2,500/mo",
    "sensitivity": "low | medium | high",
    "keyInsight": "One sentence about what drives willingness to pay.",
    "primaryDrivers": ["driver 1", "driver 2"]
  },
  "idealCustomerProfile": {
    "revenueRange": "...",
    "industries": ["..."],
    "painSignals": ["..."],
    "readiness": "..."
  },
  "competitiveLandscape": [
    { "name": "Competitor / alternative", "insight": "How it's positioned in interviewees' minds." }
  ]
}

RECORDS:
${JSON.stringify(records, null, 2)}`;
}

function buildPractitionerPrompt(records) {
  return `You are synthesizing qualitative research from ${records.length} accounting-practitioner discovery interviews. Each record captures role, firm size, client mix, software stack, and pain points.

Return ONE JSON object with this exact shape (omit fields you can't support; never invent numbers). No prose, no code fences.

{
  "executiveSummary": "3-5 sentences summarizing cross-interview patterns.",
  "topPainPoints": [
    { "theme": "Short name", "frequency": "N of ${records.length}", "evidence": "One sentence with a paraphrased quote if possible." }
  ],
  "firmLandscape": {
    "dominantSize": "e.g. 2-10 staff",
    "avgClientCount": "e.g. ~80",
    "primaryServiceMix": "e.g. Tax 60% / Bookkeeping 40%",
    "insight": "One sentence about the shape of the firm segment."
  },
  "aiReceptivity": {
    "overall": "skeptical | curious | enthusiastic",
    "keyInsight": "One sentence.",
    "concerns": ["..."],
    "opportunities": ["..."]
  },
  "competitiveLandscape": [
    { "name": "Software / firm", "insight": "How it's positioned." }
  ]
}

RECORDS:
${JSON.stringify(records, null, 2)}`;
}

/**
 * Analyze enriched records and return a themes object shaped for ThemesDashboard.
 * @param {{ type: 'business' | 'practitioner', records: object[] }} input
 * @returns {Promise<{ themes: object }>}
 */
export async function analyzeThemes({ type, records }) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('No enriched records to analyze.');
  }
  const fields = type === 'practitioner' ? PRAC_FIELDS : BIZ_FIELDS;
  const slim = records.map((r) => slimRecord(r, fields));
  const prompt = type === 'practitioner' ? buildPractitionerPrompt(slim) : buildBusinessPrompt(slim);

  const first = await callClaude(prompt, { temperature: 0.2, maxTokens: 3000 });
  try {
    return { themes: parseJsonStrict(first.text) };
  } catch (firstErr) {
    const retry = await callClaude(`${prompt}\n\nReturn ONLY valid JSON, no prose.`, { temperature: 0, maxTokens: 3000 });
    return { themes: parseJsonStrict(retry.text) };
  }
}
