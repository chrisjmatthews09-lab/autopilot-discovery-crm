// Apps Script web-app endpoint. Two residual flows still use it:
//
//   1. `migrateSheetsToFirestore` — one-time Sheets→Firestore import. Guarded
//      by a Firestore migration lock so it only runs once per user.
//   2. `handleEnrichContact` in App.jsx — POSTs `?action=enrichContact` to
//      pull fresh enrichment via Claude. This call site is a candidate to
//      migrate to the `callClaude` Cloud Function; once it does, delete this
//      file and the archived `archive/legacy-apps-script/` directory.
//
// The Apps Script source itself is archived at
// `archive/legacy-apps-script/Code.gs` — edits must be made in the Apps
// Script editor and mirrored back, since the editor is the deployment
// surface.
export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbz89C4C15E1Cxmux8bWUWw04pghxiGlqkfb2Ulr_8FMZdnIZ9vcNEakdrGo3zNLhAZV/exec';
