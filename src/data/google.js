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
  const existing = loadStoredToken();
  const mergedScopes = Array.from(new Set([...(existing?.scopes || []), ...scopes]));
  const token = {
    access_token: cred.accessToken,
    scopes: mergedScopes,
    // Google access tokens expire in 3600s. No expires_in exposed by Firebase, assume 55 min window.
    expires_at: Date.now() + 55 * 60 * 1000,
    email: result.user?.email || null,
  };
  saveStoredToken(token);
  return token;
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
  if (res.status === 401 || res.status === 403) {
    throw new GoogleAuthError('auth', `Google API auth failed (${res.status}). Reconnect in Settings → Integrations.`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google API error ${res.status}: ${text || res.statusText}`);
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
