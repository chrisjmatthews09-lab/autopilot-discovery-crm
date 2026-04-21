# Autopilot Discovery CRM

A Firebase-backed discovery CRM for research, outreach, and deal flow. Built
on React + Vite, authenticated with Firebase Auth (Google Sign-In), storing
all user data in Firestore under `users/{uid}/…`. A small set of Cloud
Functions handle ingestion from Plaud→Zapier and proxy calls to the Anthropic
API so the `sk-ant-…` key never leaves the server.

---

## Architecture

```
iPhone / Desktop Browser
         ↓
React app on Firebase Hosting    ← primary prod surface
   (mirrored to GH Pages)        ← secondary / fallback
         ↓
 Firebase Auth  ──→  user identity (uid)
         ↓
 Firestore (users/{uid}/…)       ← all records scoped per-user
         ↓
 Cloud Functions (v2, us-central1)
    • ingestInterview  ← Plaud → Zapier → Firestore
    • callClaude       ← proxies Anthropic API (key in Secret Manager)
```

All persistent state lives under `users/{uid}/…` in a single Firestore
database; Firestore rules enforce that only the signed-in owner reads/writes
that subtree, and an explicit deny-all rule closes everything outside it.

The legacy Google Apps Script backend is archived at
[`archive/legacy-apps-script/`](archive/legacy-apps-script/). Two residual
call sites still use it — see that directory's README for details.

---

## Local development

### Prerequisites

- Node 20+
- A Firebase project with Firestore, Auth, Hosting, and (for ingestion /
  Claude calls) Functions + Secret Manager enabled.
- `firebase` CLI installed globally: `npm i -g firebase-tools`.

### First-time setup

```bash
# 1. Install dependencies
npm install
cd functions && npm install && cd ..

# 2. Copy the env template and fill in values from the Firebase console
cp .env.example .env.local
# → Firebase console → Project settings → General → Your apps → SDK setup
#   Then populate VITE_FIREBASE_* in .env.local.

# 3. Point firebase-tools at your project
firebase login
firebase use --add                 # select the project, alias it as `default`

# 4. Set Cloud Function secrets (only needed if you deploy functions)
firebase functions:secrets:set ANTHROPIC_API_KEY      # for callClaude
firebase functions:secrets:set INGESTION_SECRET       # shared with Zapier
firebase functions:secrets:set OWNER_UID              # your Firebase Auth UID

# 5. Run the dev server
npm run dev
```

### Scripts

| command              | what it does                                           |
|----------------------|--------------------------------------------------------|
| `npm run dev`        | Vite dev server (hot reload)                           |
| `npm test`           | Run vitest suite once                                  |
| `npm run test:watch` | Vitest in watch mode                                   |
| `npm run build`      | Production build → `dist/`                             |
| `npm run preview`    | Serve the production build locally                     |
| `npm run deploy`     | Build + push `dist/` to `gh-pages` branch (GH Pages)   |

Firestore rules and indexes live in `firestore.rules` and
`firestore.indexes.json`. Functions live under `functions/src/`.

---

## Data model

Every collection is scoped under `users/{uid}/`. Rules deny everything outside
that path.

| collection             | what it holds                                                              |
|------------------------|----------------------------------------------------------------------------|
| `people`               | Individual contacts (practitioners, deal-flow people, CRM contacts)        |
| `companies`            | Firms, businesses, prospects                                               |
| `interviews`           | Transcript + summary docs (from Plaud ingestion or manual entry)           |
| `interactions`         | Timeline events (calls, notes, stage changes, emails)                      |
| `deals`                | Deals on sales/acquisition pipelines                                       |
| `targets`              | M&A targets                                                                |
| `pipelines`            | Pipeline + stage definitions for deals and targets                         |
| `tasks`                | To-dos linked to a contact, deal, or target                                |
| `tags`                 | User-defined tags                                                          |
| `views`                | Saved filter/sort views                                                    |
| `scripts`              | Interview-script templates                                                 |
| `syntheses`            | Cross-interview synthesis output                                           |
| `merges`               | Audit trail of merges (for undo)                                           |
| `dedupReviewQueue`     | Pending dedup decisions from ingested interviews                           |
| `_system/migrations/*` | Per-migration lock docs (see “Migrations” below)                           |

Every record carries a `workspace` field (`crm` or `deal_flow`) so the
sidebar can split the same object types between the two workflow surfaces.

---

## Migrations & seed data

Historical data shape has changed over time; the app ships several one-time
migrations that run on first load for any signed-in user. The authoritative
lock is a doc in Firestore at `users/{uid}/_system/migrations/{migrationId}`
with `status: 'completed' | 'in_progress' | 'failed'`. The claim step is a
transaction, so two tabs cannot both run the same migration.

| migration id                     | what it does                                                         |
|----------------------------------|----------------------------------------------------------------------|
| `sheets-to-firestore`            | Imports the legacy Google Sheet via the archived Apps Script URL     |
| `rename-collections-v2`          | `practitioners→people`, `businesses→companies`, `transcripts→interviews` |
| `lifecycle-stages-v3`            | Maps legacy `status` → `lifecycle_stage`                             |
| `seed-scripts-v1`                | Installs default PRO + BIZ interview scripts                         |
| `seed-pipelines-v2`              | Installs default deal pipelines                                      |
| `seed-target-pipelines-v2`       | Installs default M&A target pipelines                                |
| `workspace-backfill-v1`          | Stamps `workspace` on every record that lacks one                    |
| `dedup-backfill-v1`              | Backfills normalized email/phone/name fields + dedup scaffolding     |

Existing users who ran migrations before the Firestore lock existed have the
old `autopilot-*-*` localStorage flags; on first load after the upgrade the
`claimMigration` transaction detects those flags and writes a completed lock
doc retroactively so the migration does not re-run.

---

## Cloud Functions

Source in `functions/src/`, deployed via `firebase deploy --only functions`.

### `ingestInterview` (HTTPS, POST)

Zapier posts interview payloads here after Plaud uploads a recording. The
function validates a shared-secret header, sanitizes the doc id, enforces a
payload cap (<1 MB), and writes the interview to
`users/{OWNER_UID}/interviews/{sourceIngestionJobId}` with
`dedupStatus: 'pending'`. Idempotent: a repeated POST with the same job id is
a no-op.

### `callClaude` (callable)

Client-side proxy to the Anthropic API. The API key is held in Secret Manager
as `ANTHROPIC_API_KEY` and is never shipped to the browser. The client passes
a message payload; the function forwards it to Claude and returns the
response.

---

## Deployment

The app is published to two hosts for redundancy:

```bash
# 1. Firebase Hosting (primary)
npm run build
firebase deploy --only hosting

# 2. GitHub Pages (secondary)
npm run deploy            # wraps build + gh-pages -d dist
```

Rules and indexes:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Functions:

```bash
firebase deploy --only functions
```

Deploy parity on both hosting surfaces for every push to `main` — a single
stale copy is more confusing than either surface being down.

---

## Environment variables

All VITE_* vars are read at build time and baked into the client bundle. They
are **not secrets** (Firebase config is public by design — rules enforce
access control). See `.env.example` for the full list.

The Anthropic API key, ingestion secret, and OWNER_UID are **not** in env
files. They live in Firebase Secret Manager and are read by Cloud Functions
only.

---

## Troubleshooting

**"Migration failed" in the console on first load.** Check the Firestore doc
at `users/{uid}/_system/migrations/{id}` — if `status: 'failed'`, the `error`
field contains the reason. Resolving the underlying issue and reloading will
retry the claim (a failed status is treated as retryable).

**Firestore "missing or insufficient permissions" on a new collection.**
`firestore.rules` only allows access under `users/{uid}/…`. Either scope the
new collection to that tree, or add an explicit rule and deploy with
`firebase deploy --only firestore:rules`.

**"The query requires an index" error at runtime.** A multi-field query needs
a composite index in `firestore.indexes.json`. Add it, then
`firebase deploy --only firestore:indexes`. The error message in the console
includes a direct link that pre-populates the right index definition.

**Two tabs opened during initial sign-in and both want to migrate.** The
`claimMigration` transaction serializes them — only one tab runs the work;
the other sees `status: 'in_progress'` and skips. Reload the skipping tab
once the first finishes.

**Plaud ingestion "unauthorized".** The `x-ingestion-secret` header from
Zapier did not match `INGESTION_SECRET` in Secret Manager. Rotate the secret
with `firebase functions:secrets:set INGESTION_SECRET` and update the Zap.

---

## Repository layout

```
src/
  App.jsx                  routing + migration orchestration shell
  pages/                   route-level pages (code-split)
  components/              shared UI primitives
  hooks/                   useAuth, useCollection, useWorkspace, …
  data/                    Firestore wrappers, migrations, merges, dedup
  services/                ingestion pipeline, Claude calls
  config/                  design tokens, enums, Firebase init
functions/
  src/index.js             ingestInterview + callClaude
firestore.rules            per-user scoping + deny-all default
firestore.indexes.json     composite-query index declarations
archive/legacy-apps-script/ legacy Code.gs, preserved for reference
docs/security.md           threat model + secret handling checklist
```
