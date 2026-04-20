// Anthropic Claude API client — used by the interview-ingestion dedup pipeline.
//
// SECURITY NOTE: this module can run in both Node (test harness) and the browser
// (Sprint 4+ ingestion). When called from the browser the API key ships in the
// client bundle, which is only acceptable if the Anthropic key is domain-restricted.
// A Cloud Function proxy is the right long-term answer; tracked for Sprint 4+.

import {
  buildClassificationPrompt,
  CLASSIFICATION_RESPONSE_REQUIRED,
  CLASSIFICATION_APP_TYPES,
  CLASSIFICATION_BUSINESS_TYPES,
} from '../prompts/classification.js';
import {
  buildEnrichmentPrompt,
  ARRAY_FIELDS as ENRICHMENT_ARRAY_FIELDS,
} from '../prompts/enrichment.js';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 2000;

function resolveApiKey(explicit) {
  if (explicit) return explicit;
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
    if (process.env.VITE_CLAUDE_API_KEY) return process.env.VITE_CLAUDE_API_KEY;
  }
  try {
    if (import.meta?.env?.VITE_CLAUDE_API_KEY) return import.meta.env.VITE_CLAUDE_API_KEY;
  } catch { /* import.meta not available in CJS/Node contexts */ }
  return null;
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

/**
 * Low-level Claude API call. Returns the first text block's content.
 * @param {string} prompt
 * @param {object} [options]
 * @param {string} [options.model]        Defaults to claude-sonnet-4-6.
 * @param {number} [options.maxTokens]    Defaults to 2000.
 * @param {string} [options.system]       Optional system prompt.
 * @param {number} [options.temperature]  0..1. Defaults to API default.
 * @param {string} [options.apiKey]       Override key lookup.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ text: string, stopReason: string, raw: object }>}
 */
export async function callClaude(prompt, options = {}) {
  const key = resolveApiKey(options.apiKey);
  if (!key) {
    throw new Error(
      'Claude API key not found. Set ANTHROPIC_API_KEY (Node) or VITE_CLAUDE_API_KEY (.env.local for Vite).',
    );
  }
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('callClaude: prompt is required and must be a string.');
  }

  const body = {
    model: options.model || DEFAULT_MODEL,
    max_tokens: options.maxTokens || DEFAULT_MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  };
  if (options.system) body.system = options.system;
  if (typeof options.temperature === 'number') body.temperature = options.temperature;

  const headers = {
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': ANTHROPIC_VERSION,
  };
  if (isBrowser()) {
    // Required when the SDK / fetch call originates from a browser.
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`Claude API ${res.status} ${res.statusText}: ${detail.slice(0, 500)}`);
  }

  const raw = await res.json();
  const text = Array.isArray(raw.content)
    ? raw.content.filter((c) => c.type === 'text').map((c) => c.text).join('')
    : '';
  return { text, stopReason: raw.stop_reason, raw };
}

/**
 * Strip ```json fences or stray backtick blocks Claude sometimes emits.
 * Returns the inner JSON string — does NOT parse.
 */
export function stripJsonFences(text) {
  if (!text) return '';
  let t = text.trim();
  const fenceMatch = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fenceMatch) t = fenceMatch[1].trim();
  // Sometimes only a leading fence without a matching close:
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  return t;
}

export function parseJsonStrict(text) {
  const body = stripJsonFences(text);
  return JSON.parse(body);
}

function validateClassification(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('Classification response is not a JSON object.');
  }
  for (const key of CLASSIFICATION_RESPONSE_REQUIRED) {
    if (!(key in obj)) {
      throw new Error(`Classification response missing required field: ${key}`);
    }
  }
  if (!CLASSIFICATION_APP_TYPES.includes(obj.appType)) {
    throw new Error(`Invalid appType "${obj.appType}". Expected one of ${CLASSIFICATION_APP_TYPES.join(', ')}.`);
  }
  if (!CLASSIFICATION_BUSINESS_TYPES.includes(obj.businessType)) {
    throw new Error(`Invalid businessType "${obj.businessType}". Expected one of ${CLASSIFICATION_BUSINESS_TYPES.join(', ')}.`);
  }
  if (typeof obj.firstName !== 'string' && obj.firstName !== null) {
    throw new Error('firstName must be a string or null.');
  }
  if (typeof obj.lastName !== 'string' && obj.lastName !== null) {
    throw new Error('lastName must be a string or null.');
  }
  if (typeof obj.businessName !== 'string' && obj.businessName !== null) {
    throw new Error('businessName must be a string or null.');
  }
  if (obj.email !== null && typeof obj.email !== 'string') {
    throw new Error('email must be a string or null.');
  }
  if (obj.phone !== null && typeof obj.phone !== 'string') {
    throw new Error('phone must be a string or null.');
  }
  if (!obj.confidence || typeof obj.confidence !== 'object') {
    throw new Error('confidence must be an object with { classification, name, business }.');
  }
  for (const k of ['classification', 'name', 'business']) {
    if (typeof obj.confidence[k] !== 'number') {
      throw new Error(`confidence.${k} must be a number.`);
    }
  }
  return obj;
}

/**
 * Extract the minimum entity needed for dedup from a transcript.
 * Retries parsing once with a stricter reminder if Claude emits prose.
 *
 * @param {{ transcript: string, summary?: string }} input
 * @param {object} [options]  Passed through to callClaude (+ ignoreValidation: bool).
 * @returns {Promise<object>} Classification object (validated).
 */
/**
 * Structured enrichment (Prompt B). Called after dedup resolution.
 *
 * @param {object} input
 * @param {string} input.transcript           Full transcript (required).
 * @param {string} [input.summary]
 * @param {{firstName?:string,lastName?:string,email?:string,role?:string}} [input.contact]
 * @param {{name?:string,type:'business_owner'|'practitioner'}} input.business
 * @param {number} [input.interviewNumber]
 * @param {object} [input.existingEnrichedData]
 * @param {object} [options] Passed through to callClaude.
 * @returns {Promise<object>} Structured enrichment — shape depends on business.type.
 */
export async function enrichEntity(
  { transcript, summary, contact, business, interviewNumber, existingEnrichedData },
  options = {},
) {
  const prompt = buildEnrichmentPrompt({
    transcript,
    summary,
    contact,
    business,
    interviewNumber,
    existingEnrichedData,
  });

  const first = await callClaude(prompt, {
    ...options,
    temperature: options.temperature ?? 0.1,
    maxTokens: options.maxTokens ?? 3000,
  });
  try {
    return validateEnrichment(parseJsonStrict(first.text));
  } catch (firstErr) {
    const retryPrompt = `${prompt}\n\nReturn ONLY valid JSON matching the schema. No prose. No code fences.`;
    let secondText = '';
    try {
      const second = await callClaude(retryPrompt, { ...options, temperature: 0 });
      secondText = second.text;
      return validateEnrichment(parseJsonStrict(secondText));
    } catch (secondErr) {
      const err = new Error(
        `Claude enrichment failed after one retry.\n`
        + `First error: ${firstErr.message}\n`
        + `Second error: ${secondErr.message}`,
      );
      err.firstResponse = first.text;
      err.secondResponse = secondText;
      throw err;
    }
  }
}

function validateEnrichment(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('Enrichment response is not a JSON object.');
  }
  if (typeof obj.overallConfidence !== 'number') {
    throw new Error('Enrichment response missing numeric overallConfidence.');
  }
  for (const key of ENRICHMENT_ARRAY_FIELDS) {
    if (key in obj && obj[key] != null && !Array.isArray(obj[key])) {
      throw new Error(`Enrichment response field "${key}" must be an array.`);
    }
  }
  return obj;
}

export async function extractEntity({ transcript, summary }, options = {}) {
  const basePrompt = buildClassificationPrompt({ transcript, summary });

  const first = await callClaude(basePrompt, { ...options, temperature: options.temperature ?? 0 });
  try {
    const parsed = parseJsonStrict(first.text);
    return validateClassification(parsed);
  } catch (firstErr) {
    const retryPrompt = `${basePrompt}\n\nReturn ONLY valid JSON, no prose.`;
    let secondText = '';
    try {
      const second = await callClaude(retryPrompt, { ...options, temperature: 0 });
      secondText = second.text;
      const parsed = parseJsonStrict(secondText);
      return validateClassification(parsed);
    } catch (secondErr) {
      const err = new Error(
        `Claude entity extraction failed after one retry.\n`
        + `First error: ${firstErr.message}\n`
        + `Second error: ${secondErr.message}`,
      );
      err.firstResponse = first.text;
      err.secondResponse = secondText;
      throw err;
    }
  }
}
