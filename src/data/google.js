// Google OAuth + Gmail + Calendar integration.
// Uses Firebase's GoogleAuthProvider to request additional scopes via signInWithPopup,
// extracts the OAuth access token, and calls Google APIs directly.

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../config/firebase';

const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_KEY = 'autopilot-google-token-v1';

// { access_token, scopes: [...], expires_at: number (ms), email }
function loadStoredToken() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const t = JSON.parse(raw);
    if (!t.access_token) return null;
    return t;
  } catch { return null; }
}

function saveStoredToken(token) {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(token)); } catch {}
}

export function clearStoredToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

export function getGoogleConnectionStatus() {
  const t = loadStoredToken();
  if (!t) return { connected: false };
  const expired = !t.expires_at || Date.now() >= t.expires_at - 30_000;
  return {
    connected: !expired,
    expired,
    email: t.email || null,
    scopes: t.scopes || [],
    hasGmail: (t.scopes || []).includes(GMAIL_SCOPE),
    hasCalendar: (t.scopes || []).includes(CALENDAR_SCOPE),
  };
}

// Connect Gmail / Calendar (additively). Opens a popup asking the user to grant the requested scopes.
// Returns the merged token info. Token lifetime is ~1 hour — no refresh without a server.
export async function connectGoogleScopes(scopes) {
  const provider = new GoogleAuthProvider();
  for (const s of scopes) provider.addScope(s);
  provider.setCustomParameters({ prompt: 'consent', include_granted_scopes: 'true' });
  const result = await signInWithPopup(auth, provider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  if (!cred || !cred.accessToken) throw new Error('No OAuth access token returned');

  // Firebase doesn't tell us which scopes Google *actually* granted, so ask
  // Google directly. Prevents us from storing `hasGmail: true` when the user
  // skipped the checkbox at the consent screen.
  const granted = await fetchGrantedScopes(cred.accessToken);
  const missing = scopes.filter((s) => !granted.scopes.includes(s));
  if (missing.length > 0) {
    throw new GoogleAuthError(
      'scope_denied',
      `Google did not grant the requested scope(s): ${missing.join(', ')}. At the consent screen, make sure every checkbox stays ticked (Gmail read-only for email sync, Calendar read-only for event sync).`,
    );
  }

  const existing = loadStoredToken();
  const mergedScopes = Array.from(new Set([...(existing?.scopes || []), ...granted.scopes]));
  const expiresInMs = (granted.expiresIn || 3500) * 1000;
  const token = {
    access_token: cred.accessToken,
    scopes: mergedScopes,
    expires_at: Date.now() + expiresInMs,
    email: result.user?.email || null,
  };
  saveStoredToken(token);
  return token;
}

// Query Google's tokeninfo endpoint to learn which scopes the access token
// was actually issued for (Firebase doesn't surface this on the credential).
async function fetchGrantedScopes(accessToken) {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) return { scopes: [], expiresIn: null };
    const info = await res.json();
    return {
      scopes: typeof info.scope === 'string' ? info.scope.split(/\s+/).filter(Boolean) : [],
      expiresIn: info.expires_in ? Number(info.expires_in) : null,
    };
  } catch {
    return { scopes: [], expiresIn: null };
  }
}

export const connectGmail = () => connectGoogleScopes([GMAIL_SCOPE]);
export const connectCalendar = () => connectGoogleScopes([CALENDAR_SCOPE]);
export const connectBoth = () => connectGoogleScopes([GMAIL_SCOPE, CALENDAR_SCOPE]);

async function googleFetch(url, options = {}) {
  const t = loadStoredToken();
  if (!t || !t.access_token) throw new GoogleAuthError('not_connected', 'Google account not connected.');
  if (t.expires_at && Date.now() >= t.expires_at) throw new GoogleAuthError('expired', 'Google OAuth token expired. Reconnect in Settings → Integrations.');
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${t.access_token}`,
    },
  });
  if (!res.ok) {
    let parsed = null;
    let body = '';
    try {
      body = await res.text();
      parsed = body ? JSON.parse(body) : null;
    } catch {}
    const googleMsg = parsed?.error?.message || body || res.statusText;
    const googleStatus = parsed?.error?.status || '';
    if (res.status === 401) {
      throw new GoogleAuthError('expired', `Google token expired or revoked. Reconnect in Settings → Integrations. (${googleMsg})`);
    }
    if (res.status === 403) {
      const lowered = `${googleMsg} ${googleStatus}`.toLowerCase();
      let hint;
      if (lowered.includes('has not been used') || lowered.includes('is disabled')) {
        hint = 'Gmail API is not enabled on the Firebase project\'s GCP console. Enable it once at console.cloud.google.com → APIs & Services → Library → Gmail API.';
      } else if (lowered.includes('insufficient authentication scopes') || lowered.includes('insufficient_scope')) {
        hint = 'Gmail scope was not granted at the consent screen. Reconnect and make sure the Gmail read-only checkbox stays ticked.';
      } else if (lowered.includes('access_denied') || lowered.includes('has not completed') || lowered.includes('test')) {
        hint = 'OAuth consent screen is in Testing mode or your account isn\'t on the test-user list. Add your email under GCP → OAuth consent screen → Test users, or publish the app.';
      } else {
        hint = 'Gmail API returned 403. Check the Firebase project\'s GCP console (API enablement, OAuth consent screen, test users).';
      }
      throw new GoogleAuthError('forbidden', `${hint} (Google: ${googleMsg})`);
    }
    throw new Error(`Google API error ${res.status}: ${googleMsg}`);
  }
  return res.json();
}

export class GoogleAuthError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; this.name = 'GoogleAuthError'; }
}

// Gmail: list recent messages to/from a given email address. Returns [{ id, threadId, subject, from, to, date, snippet }]
export async function fetchEmailsForAddress(emailAddress, { maxResults = 20 } = {}) {
  if (!emailAddress) return [];
  const q = encodeURIComponent(`from:${emailAddress} OR to:${emailAddress}`);
  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${q}`;
  const listRes = await googleFetch(listUrl);
  const ids = (listRes.messages || []).map((m) => m.id);
  if (ids.length === 0) return [];
  const messages = await Promise.all(ids.map((id) =>
    googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
      .catch(() => null)
  ));
  return messages.filter(Boolean).map((m) => {
    const headers = Object.fromEntries((m.payload?.headers || []).map((h) => [h.name.toLowerCase(), h.value]));
    return {
      id: m.id,
      threadId: m.threadId,
      subject: headers.subject || '(no subject)',
      from: headers.from || '',
      to: headers.to || '',
      date: headers.date || '',
      snippet: m.snippet || '',
      internalDate: Number(m.internalDate) || 0,
    };
  }).sort((a, b) => b.internalDate - a.internalDate);
}

// Calendar: fetch next 14 days of primary calendar events.
export async function fetchUpcomingCalendarEvents({ daysAhead = 14 } = {}) {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=100`;
  const res = await googleFetch(url);
  return (res.items || []).map((e) => ({
    id: e.id,
    summary: e.summary || '(no title)',
    description: e.description || '',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    location: e.location || '',
    hangoutLink: e.hangoutLink || '',
    htmlLink: e.htmlLink || '',
    attendees: (e.attendees || []).map((a) => ({ email: a.email, name: a.displayName || '', organizer: !!a.organizer, self: !!a.self })),
  }));
}

const INTERVIEW_PATTERN = /\b(interview|discovery|coffee|intro|chat)\b/i;
export function isLikelyInterviewEvent(event) {
  if (!event) return false;
  const text = `${event.summary || ''} ${event.description || ''}`;
  return INTERVIEW_PATTERN.test(text);
}

export function filterInterviewEvents(events) {
  return (events || []).filter(isLikelyInterviewEvent);
}
