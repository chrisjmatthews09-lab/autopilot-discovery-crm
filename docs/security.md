# Security

Threat model, secret handling, and operational checklist for the Autopilot
Discovery CRM. Updated 2026-04-21.

## Trust boundaries

```
 Browser (user)                      ↔   Public — treat as untrusted
 Firebase Auth + Firestore (per-user) ↔  Semi-trusted — rules enforce scoping
 Cloud Functions (ingestInterview,
   callClaude)                        ↔  Trusted — runs server-side only
 Firebase Secret Manager              ↔  Trusted — Cloud Functions only
 Legacy Apps Script (Code.gs)         ↔  Semi-trusted — anonymous web app
 Anthropic API                        ↔  External — key never leaves server
```

Everything persisted lives under `users/{uid}/…` in Firestore. The rule file
at [`firestore.rules`](../firestore.rules) allows read/write there only for
the signed-in owner, and includes an explicit deny-all for any other path so
accidental new root-level collections fail closed.

## Secrets inventory

| secret                       | storage                                     | consumer                     |
|------------------------------|---------------------------------------------|------------------------------|
| `VITE_FIREBASE_*`            | `.env.local` (gitignored) → baked into build | browser Firebase SDK         |
| `ANTHROPIC_API_KEY`          | Firebase Secret Manager                      | `callClaude` Cloud Function  |
| `INGESTION_SECRET`           | Firebase Secret Manager                      | `ingestInterview` Cloud Fn   |
| `OWNER_UID`                  | Firebase Secret Manager                      | `ingestInterview` Cloud Fn   |
| Google OAuth tokens (Cal/Gmail) | `localStorage` on the user's device       | browser-only integrations    |

**Firebase config values (`VITE_FIREBASE_*`) are not secrets.** They're
public identifiers that let the browser SDK talk to the project; rules are
what enforce access control. Ship them in the client bundle without worry.

**Anything `sk-…` / bearer token-ish must NEVER** live in an env file consumed
by Vite. If it did, it would be baked into `dist/` and served over HTTPS to
every visitor. Only the three secrets above — held by Secret Manager and
read by Cloud Functions — are allowed near third-party API keys.

## Rotation

```bash
# Claude API key
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions:callClaude

# Zapier ingestion secret (rotate Zap side first, then Firebase)
firebase functions:secrets:set INGESTION_SECRET
firebase deploy --only functions:ingestInterview

# Firebase config (rotate in Firebase console → re-generate web app config)
# then regenerate .env.local and redeploy hosting.
```

`firebase functions:secrets:destroy <NAME>@<VERSION>` removes old secret
versions — do this after a successful rotation so leaked history cannot be
reused.

## Attack surfaces

### Browser → Firestore

- **Per-user scoping.** Rules confine every read/write to
  `users/{request.auth.uid}/…`. A compromised browser token only leaks that
  one user's data.
- **Deny-all default.** Any future collection that doesn't live under the
  user tree is inaccessible until an explicit rule is added.
- **No custom claims.** Authorization is identity-only; there are no roles.
  Treat every signed-in user as having full read/write over their own data.

### Zapier → `ingestInterview`

- POSTs include an `x-ingestion-secret` header. The function compares it
  constant-time-ish (node's `===`) against the Secret Manager value and
  rejects with 401 on mismatch.
- Body is validated (required fields, sizes, sanitized doc id) before any
  Firestore write; validation failures land in
  `users/{uid}/ingestionDeadLetter/` so they're visible in Settings rather
  than silently dropped. Unauthorized requests do NOT produce a dead-letter
  record (denial-of-storage defense).
- Writes are keyed by the sanitized `sourceIngestionJobId`; repeated POSTs
  with the same id are a no-op (idempotent).

### Browser → `callClaude`

- Callable function authed via Firebase Auth — anonymous callers are rejected
  by Firebase before our code runs.
- The Anthropic key is held in Secret Manager and loaded via
  `defineSecret`. The key never transits to the client and is never logged.
- **Prompt injection.** Interview transcripts are user-supplied text.
  Entity-extraction prompts wrap transcripts inside explicit delimiters and
  ignore any instruction-like content the transcript contains; the prompt
  source lives in [`src/prompts/`](../src/prompts). Treat extracted fields as
  untrusted — they're validated/normalized before persistence.

### Legacy Apps Script web app (`Code.gs`)

Archived at [`archive/legacy-apps-script/Code.gs`](../archive/legacy-apps-script/).
The deployed web app is still reachable by two residual flows
(`migrateSheetsToFirestore`, `enrichContact`). It accepts anonymous requests
and returns the source Sheet's data on `?action=getData`.

- **Anyone with the URL can read the backing Sheet.** The URL is treated as
  a bearer secret. Do not publish it, screenshot it, or paste it into issue
  trackers.
- Retirement path: move enrichment onto `callClaude`, then unpublish the
  Apps Script web app and delete `archive/legacy-apps-script/` +
  `src/config/appsScript.js`.

## Migration locks

Migrations and seed jobs once used `localStorage` for their "already ran"
flag. That was vulnerable to two failure modes:

1. Two tabs opening simultaneously would both see the flag unset, both run
   the migration, and double-write the same records.
2. Clearing browser storage or switching devices would re-run the migration,
   potentially corrupting records that had since been hand-edited.

Both are now closed. The authoritative lock is a Firestore doc at
`users/{uid}/_system/migrations/{migrationId}` written inside a transaction;
the localStorage flag is kept only as a backfill signal so existing users
who ran migrations before the lock moved are not re-run.

## Operational checklist

When making security-relevant changes:

- [ ] Changes to `firestore.rules` are accompanied by `firebase deploy --only firestore:rules`.
- [ ] New collections live under `users/{uid}/…` — if not, explicit rule added.
- [ ] New Cloud Functions read secrets via `defineSecret`, never from the
      deployment environment variables.
- [ ] No third-party API keys in `.env*`. Secret Manager only.
- [ ] Rotation of any live secret is followed by `firebase deploy --only functions:<name>`.
- [ ] `docs/security.md` (this file) updated when the threat model or
      secrets inventory changes.
