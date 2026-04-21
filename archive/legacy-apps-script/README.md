# Legacy Apps Script backend

This directory preserves the original Google Apps Script backend (`Code.gs`)
that powered the CRM before the Firestore migration. It is **not** deployed
from here — the live deployment lives in the Apps Script editor under the
project that serves
`https://script.google.com/macros/s/AKfycbz89C4C15E1Cxmux8bWUWw04pghxiGlqkfb2Ulr_8FMZdnIZ9vcNEakdrGo3zNLhAZV/exec`.

## What still calls this endpoint

Two touchpoints remain in the React app:

1. **`migrateSheetsToFirestore`** in `src/data/migrate.js` — a one-time,
   per-user migration that pulls the Sheet via `?action=getData`. It runs
   once and then a Firestore lock (see `users/{uid}/_system/migrations/`)
   prevents it from running again.
2. **`handleEnrichContact`** in `src/App.jsx` — the "Enrich from transcript"
   button posts to `?action=enrichContact`. If/when enrichment moves to the
   `callClaude` Cloud Function, this call site can be deleted along with the
   `APPS_SCRIPT_URL` constant in `src/config/appsScript.js`.

## Archival policy

Do not edit `Code.gs` in this directory — changes here do not deploy. If the
live Apps Script needs to change, edit it in the Apps Script editor and mirror
the result back into this file for reference. The canonical record of what's
deployed is whatever is pasted into the editor.

Once both call sites above are retired, this whole directory can be deleted.
