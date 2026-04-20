import {
  normalizeEmail,
  normalizePhone,
  normalizeName,
  normalizeBusinessName,
  buildFullName,
} from './normalize.js';
import { similarityPercent } from './levenshtein.js';

const NAME_WEIGHT = 0.6;
const BUSINESS_WEIGHT = 0.4;

function contactFullName(contact) {
  if (!contact) return '';
  if (contact.firstName || contact.lastName) {
    return buildFullName(contact.firstName, contact.lastName);
  }
  return normalizeName(contact.name || contact.fullName || '');
}

function contactBusinessName(contact) {
  if (!contact) return '';
  return normalizeBusinessName(
    contact.businessName || contact.business || contact.company || '',
  );
}

export function scoreMatch(candidate, existing) {
  if (!candidate || !existing) {
    return { tier: 'new', confidence: 0, nameMatch: 0, businessMatch: 0, reason: 'missing_input' };
  }

  const candidateEmail = normalizeEmail(candidate.email);
  const existingEmail = normalizeEmail(existing.email);
  if (candidateEmail && existingEmail && candidateEmail === existingEmail) {
    return {
      tier: 'tier1_email',
      confidence: 100,
      nameMatch: 100,
      businessMatch: 100,
      reason: 'exact_email_match',
    };
  }

  const candidatePhone = normalizePhone(candidate.phone);
  const existingPhone = normalizePhone(existing.phone);
  const phoneMatch = Boolean(candidatePhone && existingPhone && candidatePhone === existingPhone);

  const candidateName = contactFullName(candidate);
  const existingName = contactFullName(existing);
  const candidateBiz = contactBusinessName(candidate);
  const existingBiz = contactBusinessName(existing);

  const nameMatch = candidateName && existingName
    ? similarityPercent(candidateName, existingName)
    : 0;
  const businessMatch = candidateBiz && existingBiz
    ? similarityPercent(candidateBiz, existingBiz)
    : 0;

  const confidence = Math.round(nameMatch * NAME_WEIGHT + businessMatch * BUSINESS_WEIGHT);

  if (nameMatch >= 90 && businessMatch >= 85) {
    return {
      tier: 'tier2_name_business',
      confidence,
      nameMatch,
      businessMatch,
      phoneMatch,
      reason: 'strong_name_and_business_match',
    };
  }

  if (nameMatch >= 80 && businessMatch >= 70) {
    return {
      tier: 'tier3_review',
      confidence,
      nameMatch,
      businessMatch,
      phoneMatch,
      reason: 'possible_match_needs_review',
    };
  }

  return {
    tier: 'new',
    confidence,
    nameMatch,
    businessMatch,
    phoneMatch,
    reason: 'below_threshold',
  };
}

export function findBestMatch(candidate, existingContacts, options = {}) {
  const list = Array.isArray(existingContacts) ? existingContacts : [];
  const appType = options.appType || candidate?.appType || null;

  const filtered = appType
    ? list.filter((c) => !c?.appType || c.appType === appType)
    : list;

  let best = null;
  for (const existing of filtered) {
    const result = scoreMatch(candidate, existing);
    if (!best || result.confidence > best.result.confidence) {
      best = { existing, result };
    }
    if (result.tier === 'tier1_email') break;
  }

  if (!best) {
    return { tier: 'new', confidence: 0, match: null, result: null };
  }

  return {
    tier: best.result.tier,
    confidence: best.result.confidence,
    match: best.result.tier === 'new' ? null : best.existing,
    result: best.result,
  };
}
