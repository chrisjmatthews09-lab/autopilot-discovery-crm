export function normalizeEmail(email) {
  if (!email) return null;
  return String(email).toLowerCase().trim();
}

export function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits || null;
}

export function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

const BUSINESS_SUFFIX_RE = /\s+(llc|inc|incorporated|corporation|corp|ltd|limited|pllc|pc|pa|company|co)$/i;

export function normalizeBusinessName(name) {
  if (!name) return '';
  let normalized = String(name)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
  let previous;
  do {
    previous = normalized;
    normalized = normalized.replace(BUSINESS_SUFFIX_RE, '').trim();
  } while (normalized !== previous);
  return normalized;
}

export function buildFullName(firstName, lastName) {
  const first = firstName ? String(firstName).trim() : '';
  const last = lastName ? String(lastName).trim() : '';
  return normalizeName(`${first} ${last}`.trim());
}
