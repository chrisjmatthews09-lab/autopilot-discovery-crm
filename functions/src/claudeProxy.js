// Callable Cloud Function that proxies Anthropic's /v1/messages API.
//
// Why this exists: the Anthropic API key must not live in the browser bundle.
// The client calls this function via httpsCallable; Firebase injects the caller's
// ID token, we verify request.auth, we apply a per-UID rate limit, and we forward
// the request using a key that lives in Secret Manager.
//
// Response shape: the raw Anthropic /v1/messages JSON is returned as-is. The
// client-side claudeService decodes `raw.content[...].text` into its own
// `{ text, stopReason, raw }` shape to keep existing call sites untouched.
//
// Secrets (set via `firebase functions:secrets:set <NAME>`):
//   ANTHROPIC_API_KEY — Anthropic console key used by the proxy.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 2000;

// 60 calls per rolling 5-minute bucket, keyed per UID.
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 5 * 60 * 1000;

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

export const callClaude = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    region: 'us-central1',
    maxInstances: 10,
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const {
      prompt,
      model = DEFAULT_MODEL,
      maxTokens = DEFAULT_MAX_TOKENS,
      system,
      temperature,
    } = request.data || {};

    if (!prompt || typeof prompt !== 'string') {
      throw new HttpsError('invalid-argument', 'prompt required');
    }

    const db = getFirestore();
    const bucket = Math.floor(Date.now() / RATE_WINDOW_MS);
    // Scope rate-limit doc under the user so Firestore rules can keep
    // `users/{uid}/**` as the sole writable path.
    const rateLimitRef = db.doc(`users/${request.auth.uid}/_rateLimits/claude-${bucket}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(rateLimitRef);
      const count = snap.exists ? (snap.data().count || 0) : 0;
      if (count >= RATE_LIMIT) {
        throw new HttpsError('resource-exhausted', 'Rate limit exceeded (60 calls / 5 min)');
      }
      tx.set(
        rateLimitRef,
        { count: count + 1, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    });

    const body = {
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    };
    if (system) body.system = system;
    if (typeof temperature === 'number') body.temperature = temperature;

    const response = await fetch(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY.value(),
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[callClaude] Anthropic error', response.status, errText.slice(0, 500));
      throw new HttpsError('internal', `Anthropic API error: ${response.status}`);
    }

    return await response.json();
  },
);
