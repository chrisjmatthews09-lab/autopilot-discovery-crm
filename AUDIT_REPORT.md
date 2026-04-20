# Autopilot CRM — Full-Stack Audit Report

**Date:** 2026-04-19
**Auditor:** Claude Code
**Scope:** Full-stack regression audit — read-only. No code modified.

## Executive Summary

The app ships working features (dedup pipeline, merge/split tools, review queue, 91/91 unit tests passing, clean build) but is carrying three first-order problems that will compound as you keep building: **(1) the codebase has two parallel design systems with conflicting palettes — `src/App.jsx` defines a warm inline `COLORS` object matching your intent, while `src/config/design-tokens.js` defines a purple one that every other file imports from, so the app renders in two palettes at once; (2) the bundle is a single 1.6 MB chunk with zero code-splitting, which will make mobile first-paint painful; (3) `src/App.jsx` is 2,533 lines and holds most of the app's stateful logic, which is the single biggest maintainability risk on the project.** Strengths worth protecting: the dedup pipeline is well-factored, Firestore rules are correctly scoped to `users/{uid}/**`, the test harness is real (vitest + two Node matrix scripts), and the `docs/dedup-calibration.md` runbook is exactly the kind of artifact that prevents knowledge loss.

## Severity Legend

- 🔴 **CRITICAL** — blocks core use, data-loss risk, security issue
- 🟠 **HIGH** — significant UX or reliability problem
- 🟡 **MEDIUM** — noticeable issue, should fix soon
- 🔵 **LOW** — polish, nice-to-have
- ⚪ **INFO** — observation, not necessarily an issue

## Codebase Map

- **Framework**: React 18.3 + Vite 5.4, ES modules, no TypeScript.
- **Router**: `react-router-dom` v7. Single routing block in [src/App.jsx:2378-2480](src/App.jsx:2378). Routes are dual-namespaced `/crm/*` and `/deal-flow/*` plus legacy redirects.
- **State**: no Redux/Zustand/Context. All state lives in components and URL. Small context for `Toast` ([src/components/ui/Toast.jsx](src/components/ui/Toast.jsx)).
- **Data**: Firebase v12 modular SDK. Firestore client in [src/config/firebase.js](src/config/firebase.js). CRUD wrappers in [src/data/firestore.js](src/data/firestore.js). Per-user path scoping (`users/{uid}/{collection}`).
- **Hooks**: `useAuth`, `useCollection` (realtime `onSnapshot`), `useWorkspace`, `useWindowWidth`, `useIngestionProcessor`.
- **Styling**: inline `style={{}}` everywhere. No Tailwind / CSS modules / styled-components. Tokens in [src/config/design-tokens.js](src/config/design-tokens.js) plus a duplicate inline `COLORS` in [src/App.jsx:58-81](src/App.jsx:58).
- **Pages** (11): `Dashboard`, `Settings`, `DealsList`, `DealDetail`, `TargetsList`, `TargetDetail`, `Tasks`, `Scripts`, `ScriptEditor`, `DedupReviewQueue`, `ReferralPartners`, `ReferralPipeline`. Plus list/detail views rendered inline from `App.jsx` for people/companies/interviews.
- **Backend**: Firebase Hosting + Firestore + Cloud Functions (Node 22 at [functions/src/index.js](functions/src/index.js)) for Zapier ingestion. Also a Google Apps Script endpoint hardcoded at [src/App.jsx:87](src/App.jsx:87) for Gmail integration.
- **External AI**: Anthropic Claude API called directly from the browser in [src/services/claudeService.js](src/services/claudeService.js), using `anthropic-dangerous-direct-browser-access: true`. Key ships in client bundle via `VITE_CLAUDE_API_KEY`.
- **Tests**: vitest (6 files, 91 passing) + two Node scripts (`scripts/test-dedup-matrix.js` 21/21, `scripts/run-transcript-fixtures.js` 10/10). All green at audit time.
- **Deploy targets**: Firebase Hosting (default) and GitHub Pages (via `DEPLOY_TARGET=gh-pages`). Both configured in [vite.config.js](vite.config.js) and [firebase.json](firebase.json).

---

## Issues by Area

### Code Quality

**🔴 [src/App.jsx](src/App.jsx) is 2,533 lines.** This is the single biggest maintainability liability. It holds the route table, every list/detail view for people/companies/interviews, the legacy redirect helpers, inline COLORS, and most mutation handlers. Any change touches this file.
*Fix approach:* extract `/crm/*` and `/deal-flow/*` list/detail views into `src/pages/PeopleList.jsx`, `CompanyDetail.jsx`, etc. (the pattern already exists for Tasks/Deals/Targets).

**🔴 Two COLOR palettes in use simultaneously.** [src/App.jsx:58-81](src/App.jsx:58) defines the warm palette (`#F8F6F1` / `#1A5C3A` / `#C4552D`) that matches your stated design intent. [src/config/design-tokens.js:1-24](src/config/design-tokens.js:1) defines a completely different cool/purple palette (`#F9FAFB` / `#7C3AED`). **47 files import from `design-tokens`**, and only `App.jsx` uses its own local COLORS. The app therefore renders in two palettes at once — the shell/nav/pages are purple, and the inline views inside App.jsx are green/terracotta.
*Fix approach:* overwrite `design-tokens.js` with the warm palette, delete the inline COLORS in App.jsx, and re-import.

**🔴 Font family set at root overrides the loaded fonts.** [src/App.jsx:2493](src/App.jsx:2493) sets `fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'` on the top-level app container. That cascade overrides Karla/Fraunces for everything underneath unless a child explicitly re-sets `fontFamily`. The `<link>` for Google Fonts is present at [src/App.jsx:2494](src/App.jsx:2494) (so fonts *do* load — a contrary claim earlier in my audit pass was wrong), but putting it inside the React tree instead of `<head>` guarantees a flash of system fonts on first paint.
*Fix approach:* move the `<link rel="stylesheet">` and `<link rel="preconnect">` into [index.html](index.html) `<head>`, remove the system-font `fontFamily` from the root div, and use the shared `FONT` token so the cascade flows.

**🔴 [src/pages/Settings.jsx](src/pages/Settings.jsx) = 844 lines, [TargetDetail.jsx](src/pages/TargetDetail.jsx) = 599, [DealDetail.jsx](src/pages/DealDetail.jsx) = 545, [TargetsList.jsx](src/pages/TargetsList.jsx) = 401, [Dashboard.jsx](src/pages/Dashboard.jsx) = 381.** All candidates for splitting.
*Fix approach:* extract each page's sub-sections into their own files; Settings alone has 8 sub-sections that could live side-by-side.

**🟠 Two `Timeline` components with the same name.** [src/components/Timeline.jsx](src/components/Timeline.jsx) (278 lines) is the contact-enrichment timeline imported as `ContactTimeline` in [src/App.jsx:23](src/App.jsx:23); [src/components/ui/Timeline.jsx](src/components/ui/Timeline.jsx) (140 lines) is the interaction timeline used by DealDetail/TargetDetail. Both used, confusingly named.
*Fix approach:* rename one — `ContactEnrichmentTimeline.jsx` vs `InteractionTimeline.jsx` — and update the four import sites.

**🟠 ~20 distinct inline button styles.** No shared `<Button>` component. Grep any page and you'll find primary-solid, secondary-outline, danger, icon-only, text-link, and mini variants all hand-rolled with different padding/radius/border combos.
*Fix approach:* extract a `Button` component with `variant` and `size` props; migrate incrementally.

**🟠 Inline object/function props inside `.map()` loops.** [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx) and many places in App.jsx create style objects per row. Not a perf crisis at current data volume, but they're a drag on React.memo if you ever add it.
*Fix approach:* hoist stable style objects into module-level consts.

**🟠 `console.error` / `console.warn` left in production paths** across ~27 call sites (e.g. [src/pages/Tasks.jsx:92](src/pages/Tasks.jsx:92), [src/components/InterviewCard.jsx:171](src/components/InterviewCard.jsx:171), [src/data/merges.js:288](src/data/merges.js:288)). Most are in catch blocks and acceptable; a handful are debug-level and should be culled.
*Fix approach:* grep `console\.(log|debug|info)` and remove debug output; keep `console.error` in catch blocks.

**🟡 Missing page-level `ErrorBoundary` wrappers.** The root boundary in [src/main.jsx:16](src/main.jsx:16) catches everything, but a crash in `DealDetail` blanks the whole app.
*Fix approach:* wrap each `<Route element={...}>` with an ErrorBoundary that shows a page-scoped fallback.

**🟡 Missing `error` from `useCollection` is never surfaced.** The hook exposes `{ data, loading, error }` but nearly every caller destructures `{ data, loading }` only. Firestore permission errors or network errors are silently invisible.
*Fix approach:* add a default error banner to pages, or log to toast on error.

**🔵 `@dnd-kit/sortable` is installed but not imported anywhere.** `@dnd-kit/core` is used.
*Fix approach:* `npm uninstall @dnd-kit/sortable`.

**🔵 Acknowledged TODO.** [src/services/claudeService.js:4-6](src/services/claudeService.js:4) flags the browser-key issue. One acknowledged TODO across the whole codebase — impressive discipline.

**⚪ `package.json` homepage drifts from actual repo.** Homepage field says `https://chrisjmatthews09.github.io/autopilot-discovery-crm` but the git remote is `chrisjmatthews09-lab`. Only matters if you invoke `gh-pages` deploy.

### UX & Design

**🔴 Palette split (restated from Code Quality — this is the single UX-visible bug users will notice most).** Pages that import from `design-tokens` render in purple; views rendered from inside `App.jsx` render in terracotta/green. Same app, two brands.

**🟠 No success-toast feedback for most mutations.** The `ToastProvider` exists and is wrapped at [src/main.jsx:18](src/main.jsx:18), but most create/update/delete paths (add contact, edit, delete, merge, split, undo-merge) rely on list-refresh as the only feedback. User action → silence → new state. This is the most common UX complaint users have with "feels broken" apps.
*Fix approach:* add a `toast.success(...)` call after every successful mutation in `src/data/*.js` or in the calling handlers.

**🟠 Ingestion processing is invisible to the user.** [src/hooks/useIngestionProcessor.js](src/hooks/useIngestionProcessor.js) runs in the background. [TopBar.jsx](src/components/layout/TopBar.jsx) receives `isProcessing` and `pendingCount` props (App.jsx:2507-2509), but on mobile the TopBar isn't visible at all — MobileNav doesn't surface ingestion state. A transcript can spend a minute in Claude with no feedback.
*Fix approach:* add a subtle badge to MobileNav when `pendingCount > 0`; toast on completion.

**🟠 `window.confirm(...)` dialogs lack "permanent" / undo language.** [src/App.jsx:411](src/App.jsx:411) = `confirm('Delete ${r.name}?')`. That's not enough stakes. Sprint 9 introduced soft-delete, so "delete" is actually reversible from Settings → Recently merged — but the confirm text doesn't say so.
*Fix approach:* standardize on `"Delete {name}? You can undo this from Settings → Recently merged for 30 days."` for soft-delete paths; keep stark language for hard-delete paths.

**🟠 Sidebar pinned-view unpin button is hover-only.** [src/components/layout/Sidebar.jsx:243](src/components/layout/Sidebar.jsx:243) reveals the `✕` on `onMouseEnter`. Touch users can't see it. On a mobile device the feature effectively doesn't exist.
*Fix approach:* show the unpin button always on mobile; use hover reveal only on desktop (`@media (hover: hover)` logic or a JS touch detection).

**🟡 No designed loading skeletons in use.** A `SkeletonTable` exists in [src/components/ui/Skeleton.jsx](src/components/ui/Skeleton.jsx) but I couldn't find a usage site. Most pages show "Loading…" text or nothing.
*Fix approach:* wire `SkeletonTable` into DataTable when `loading === true`; audit pages for missing loading states.

**🟡 Muted text contrast is borderline.** `#78716C` on `#F8F6F1` measures ~4.1:1 — passes WCAG AA for 14px+ (threshold 4.5:1 for normal text; 3:1 for large). Large-text OK, body-text borderline.
*Fix approach:* darken `textMuted` to `#635E55` (≈5.4:1).

**🟡 Heading hierarchy is inconsistent.** Some pages use `<h1>` and then jump straight to styled `<div>`s as section heads instead of `<h2>`/`<h3>`. Screen readers can't navigate the page structure.
*Fix approach:* audit each page for `<h1>` → `<h2>` → `<h3>` nesting and replace styled divs that act as headings.

**🟡 Inconsistent border-radius values.** 4, 5, 6, 8, 10 all appear across cards/buttons/inputs.
*Fix approach:* add a `RADII = { sm: 6, md: 8, lg: 10 }` scale to `design-tokens.js`.

**🔵 Empty states only partially designed.** Dashboard has text-based empty messages; DedupReviewQueue uses the `<EmptyState />` component; several list pages render zero rows with no guidance at all.
*Fix approach:* pass `EmptyState` into every list page and pair with a primary CTA.

**⚪ Markdown-body styling lives in [index.html:22-43](index.html:22).** Works, but fragmented from the rest of the styling system. Low priority.

### Mobile Responsiveness

**🟠 [src/components/layout/TopBar.jsx:76](src/components/layout/TopBar.jsx:76) search button has `minWidth: 220`.** On the desktop TopBar the search button never appears at <768px (TopBar is only rendered when `!isMobile`), so this isn't a crash — but if anyone reuses TopBar on tablet or narrow desktop, the 220px is brittle. Verify with real 768px iPad portrait.
*Fix approach:* drop to icon-only below ~900px or use `minWidth: 'min(220px, 40%)'`.

**🟠 [src/components/table/DataTable.jsx:70](src/components/table/DataTable.jsx:70) has fixed `height: 600`.** On a 375×667 iPhone SE, after TopBar (0 on mobile), bottom MobileNav (60), and page padding, this forces nested scroll — table scrolls inside a scrolling page, both at max height. Disorienting on touch.
*Fix approach:* use `height: 'calc(100dvh - 140px)'` or a CSS variable tied to viewport.

**🟠 [src/components/TranscriptModal.jsx:35](src/components/TranscriptModal.jsx:35) has `maxWidth: 820` with no explicit mobile `width`.** Browsers will clamp to 100% so functionally this works, but the `90vh` height combined with iOS keyboard (when searching transcripts) pushes the close button off-screen.
*Fix approach:* add `width: '95vw'` and switch height to `'min(90vh, 100dvh - 80px)'`.

**🟠 `.target.checked` / hover reveals on mobile.** Sidebar unpin (already flagged), DataTable row-hover highlights, and any CSS `:hover` state do nothing on touch. A touch user can't predict which rows are interactive.
*Fix approach:* add `touch: manipulation` CSS where applicable; replace hover-only reveals with always-visible affordances on mobile.

**🟡 Sidebar nav item height ~32px at [Sidebar.jsx:142](src/components/layout/Sidebar.jsx:142).** Desktop-only — not hit on mobile — but at iPad 768px the sidebar IS shown and 32px is under the 44px touch guideline.
*Fix approach:* bump padding to `12px 14px` when `isMobile || isTablet`.

**🟡 Font sizes 10–11px in nav/chrome** ([Sidebar.jsx:126](src/components/layout/Sidebar.jsx:126), [TopBar.jsx:81](src/components/layout/TopBar.jsx:81), [MobileNav.jsx:76](src/components/layout/MobileNav.jsx:76)). Chrome labels, but borderline at 375px.
*Fix approach:* raise to 12px on mobile.

**🟡 `body { overflow: hidden }` in [index.html:24](index.html:24).** Earlier agent flagged this as "breaks mobile scroll" — that's overstated because the app wraps content in `<div style={{ flex: 1, overflowY: 'auto' }}>` ([App.jsx:2498](src/App.jsx:2498)) and content DOES scroll. But the rule disables pinch-zoom on iOS for the body, which is a real accessibility regression for users who rely on zoom.
*Fix approach:* remove; rely on the root `div { overflow: hidden }` at App.jsx:2504 instead.

**🟡 Tablet (768px) forced into desktop mode.** [src/App.jsx:2249](src/App.jsx:2249) uses `windowWidth < 768` as the cutover. iPad portrait at exactly 768px gets the desktop shell (Sidebar + TopBar) — which technically fits but is cramped.
*Fix approach:* either raise to 900px (iPad gets mobile layout) or design a tablet-specific layout.

**🔵 MobileNav "More" menu can nested-scroll.** [MobileNav.jsx:51](src/components/layout/MobileNav.jsx:51) has `maxHeight: '60vh'` on the drawer, which can clip on small heights. Not broken — just clunky.

**⚪ No `100dvh` usage.** All height math uses `100vh`, which on mobile includes the URL bar. Switch to `100dvh` when you can (Safari iOS 15.4+).

### Workflows & Features

Walked through each of the 10 flows the user specified. Click counts assume the user is already inside the app.

| Flow | Clicks | Friction |
|---|---|---|
| Add contact (CRM) | 2-3 | No success toast. |
| Add company | 2-3 | No success toast. |
| Add practitioner (Deal Flow) | 2-3 | No success toast; identical form to CRM contact. |
| View contact detail | 1 | Good. |
| Edit contact | 2-3 | Silent save. |
| Delete contact | 2 | `window.confirm` doesn't mention undo is possible via Settings. |
| Toggle CRM ↔ Deal Flow | 1 | Handled by route prefix. Smooth. |
| Review dedup queue item | 1-2 | Card updates silently; no "resolved" feedback. |
| View transcript | 1 | Modal renders correctly; see mobile caveat above. |
| Search / filter | 1-2 | Live filter; good. |
| Merge contacts (Sprint 9) | 2-3 + confirm | Preview step good; success is silent. |
| Move interview (Sprint 9) | 2 | Works; no feedback. |
| Undo merge (Sprint 9) | 2 + confirm | Works; no feedback. |

**🟠 Every mutation is silent on success.** Already flagged in UX; restating because it's cross-cutting.

**🟠 First-run user has no onboarding.** A brand-new user lands on `/crm` and sees an empty people list. No hint of "add your first contact" or "connect Gmail to start ingesting" or "upload a CSV". The `Dashboard` default route is `/crm` which goes to the people list, not Dashboard.
*Fix approach:* make `/` → `/dashboard` for empty accounts; add an onboarding card to Dashboard when all counts are zero.

**🟠 Two tabs ingesting simultaneously can race.** [useIngestionProcessor.js:32-42](src/hooks/useIngestionProcessor.js:32) maintains an in-memory `inFlight` set per tab; Firestore updates `dedupStatus: 'processing'` but that happens *after* the claim, not conditionally.
*Fix approach:* convert the claim to a conditional transaction — read `dedupStatus === 'pending'` and write `'processing'` atomically.

**🟠 Merge/undo are multi-document, non-atomic.** [src/data/merges.js:121-166](src/data/merges.js:121) performs sequential `updateDoc`s (interviews, interactions, source doc, target doc, merge record). Failure mid-sequence leaves partially-merged state. Same concern for `undoMerge`.
*Fix approach:* wrap in a Firestore batch (`batchWrite` from [src/data/firestore.js:69-78](src/data/firestore.js:69)) so all writes land atomically.

**🟡 Hard-delete paths don't clean references.** [src/App.jsx:2322-2324](src/App.jsx:2322) calls `deleteDoc('companies', id)` without unlinking `company.contactIds` from each person's `company_id`. [src/data/deals.js:36-37](src/data/deals.js:36) deletes a deal without checking `buying_committee` references. This creates orphans over time — invisible until someone queries them.
*Fix approach:* either cascade in the delete path or move to soft-delete (matches Sprint 9's contact pattern).

**🟡 Soft-delete filtering is repeated ad-hoc.** `.filter((x) => !x.deletedAt)` appears in [App.jsx:2255](src/App.jsx:2255), [Settings.jsx:334](src/pages/Settings.jsx:334), [ingestionService.js:94](src/services/ingestionService.js:94), and duplicateScan usage. If any future reader misses it, soft-deleted rows appear in UI.
*Fix approach:* add a `liveOnly: true` option to `useCollection` that applies the filter in one place.

### Data Integrity

**🟠 Ingestion race: two tabs, one interview.** See Workflows.

**🟠 Non-atomic merge.** See Workflows.

**🟡 Denormalized `person.company_id` ↔ `company.contactIds` drift risk.** [src/services/ingestionService.js:262-273](src/services/ingestionService.js:262) updates both in separate ops; [src/data/merges.js:265-272](src/data/merges.js:265) same. If one write fails, pair diverges.
*Fix approach:* put both updates in the same `batchWrite`.

**🟡 Orphan `dedupResolution.matchedContactId` after hard-delete.** If a soft-deleted contact ever gets hard-deleted, interview records still point to a ghost id.
*Fix approach:* when hard-deleting a person, scan `interviews` and clear any `dedupResolution.matchedContactId` matches.

**🟡 `interview.linkedContactId` not re-validated on render.** If the underlying contact is soft-deleted, the interview card can still render a link to it. App.jsx filters `peopleRaw` with `!deletedAt`, so it renders "Unknown" — acceptable — but nothing surfaces the broken link to the user.
*Fix approach:* at render, if `linkedContactId` doesn't resolve to a live contact, show a "contact deleted — relink or split" affordance.

**🔵 `firestore.indexes.json` is empty.** Current queries use single `where` + `orderBy`, which don't need composite indexes. If you add compound filters (e.g. `appType == X AND dedupStatus == Y ORDER BY createdAt`), you'll need to backfill.

### Security

**🔴 Claude API key shipped to the browser.** [src/services/claudeService.js:31](src/services/claudeService.js:31) reads `import.meta.env.VITE_CLAUDE_API_KEY` at build time and sends it in `x-api-key`. Anyone who views-source on your production bundle can grep it out and use your Anthropic account.
*Fix approach:* move the Claude call behind a Cloud Function (you already have `functions/` set up). Pass the user's Firebase auth token; have the function verify and call Anthropic server-side. The acknowledged TODO at [claudeService.js:4-6](src/services/claudeService.js:4) already names this as the right answer.

**🟡 Apps Script URL hardcoded in source.** [src/App.jsx:87](src/App.jsx:87) and [src/config/appsScript.js](src/config/appsScript.js) contain `https://script.google.com/macros/s/AKfycbz…/exec`. This URL itself is not a secret (Apps Script deployments are identified by this path), but embedding it in client source means rotation requires a rebuild.
*Fix approach:* move to `VITE_APPS_SCRIPT_URL` in `.env.local`.

**🟡 Google OAuth access token in `localStorage`.** [src/data/google.js](src/data/google.js) stores the access token under `autopilot-google-token-v1`. XSS would exfiltrate it. You have no user-generated HTML rendering paths currently, so XSS surface is low — but this is worth knowing.
*Fix approach:* long-term, move OAuth to a server-side session model; short-term, acceptable given no XSS surface.

**🟡 Cloud Function ingestion endpoint relies on shared `x-ingestion-secret` header.** [functions/src/index.js](functions/src/index.js) uses a shared secret. Fine if rotated and stored in Firebase Secret Manager; risky if posted to a Zapier instance that logs requests.
*Fix approach:* rotate periodically; consider HMAC-signed timestamps to prevent replay.

**🔵 Firestore rules are correct.** [firestore.rules:8-9](firestore.rules:8) is properly scoped to `users/{uid}/**` with `request.auth.uid == userId`. No wildcards, no read-public paths. This is good.

**🔵 No `dangerouslySetInnerHTML` misuse.** `react-markdown` is used with default safe renderers.

**🔵 `.env.local` is gitignored.** Only the 6 `VITE_FIREBASE_*` keys are in it; no accidental commits in history.

### Performance

**🔴 Single 1,656 KB JS bundle, 457 KB gzipped.** Zero code-splitting. Vite's own warning fires on the build. On a slow 3G connection, first-paint is multi-second.
*Fix approach:* add `React.lazy` for every page route and `manualChunks` in `vite.config.js` to split vendor (Firebase, Recharts, React, DnD-kit) from app code. Target: <200 KB gzipped for the initial chunk.

**🟠 Firebase is modular but you import all of it.** [firebase.js](src/config/firebase.js) uses modular `firebase/app`, `firebase/auth`, `firebase/firestore` imports (good), but the app also imports `@firebase/firestore` helpers broadly. Audit actual usage to trim.

**🟡 `recharts` is a large dep (several hundred KB).** Only used by Dashboard. Route-splitting Dashboard will also lazy-load recharts.

**🟡 No image assets to worry about.** `/public` contains only `404.html`.

**🟡 `DataTable` is virtualized** (`@tanstack/react-virtual`). Good. Timeline isn't virtualized — not a problem at current volumes but worth noting if a contact has 200+ events.

### Accessibility

**🟠 Icon-only buttons without `aria-label`.** Widespread: edit pencils, trash icons, hamburger menus. Example: [src/App.jsx:410-411](src/App.jsx:410).
*Fix approach:* add `aria-label="Edit contact"` / `"Delete contact"` to every emoji/icon button.

**🟠 Clickable `<div>` elements without keyboard support.** [src/components/table/DataTable.jsx:31-53](src/components/table/DataTable.jsx:31) has row `onClick` but no `onKeyDown`, no `role="button"`, no `tabIndex`. Keyboard users can't activate rows.
*Fix approach:* convert to `<button>` or add `role="button" tabIndex={0} onKeyDown={enterOrSpace}` .

**🟡 Modals lack focus trapping and `role="dialog"`.** ContactPickerModal, MergeContactModal, TranscriptModal, DedupeModal — all render as plain divs.
*Fix approach:* add `role="dialog" aria-modal="true"`, focus the first input on open, trap Tab.

**🟡 Muted text contrast ~4.1:1 — borderline AA for body.** See UX.

**🔵 `lang="en"` is set on `<html>`. Good.**

**🔵 No `<img>` tags means no missing alt text** — SVG favicon only.

### Integrations

**🔵 Zapier → Cloud Function ingestion is gated.** [functions/src/index.js](functions/src/index.js) validates the `x-ingestion-secret` header, has CORS disabled, and a 60s timeout. Appropriate for webhook use.

**🟠 Claude retry logic can duplicate API calls.** [src/services/ingestionService.js:401-412](src/services/ingestionService.js:401) wraps `extractEntity` in a try/catch that calls it again on failure. Inside `extractEntity` ([claudeService.js:237-263](src/services/claudeService.js:237)) there's ALSO a built-in retry. So a single interview can make up to 3 Claude calls before throwing.
*Fix approach:* pick one retry layer. Keep the inner retry and remove the outer try/catch.

**🟠 Enrichment errors swallowed silently.** [src/services/ingestionService.js:447-449](src/services/ingestionService.js:447) catches enrichment failure and logs to console. Interview is marked resolved but enrichment data is missing. User never knows.
*Fix approach:* add an `enrichmentError` field to the interview doc and surface a small "re-enrich" affordance on the card.

**🟡 Google OAuth status detection is `getGoogleConnectionStatus()` synchronous read from localStorage.** If the token expires the app doesn't know until a fetch 401s. No refresh logic.
*Fix approach:* on 401, clear the token and prompt reconnect via Settings.

### Testing

**✅ 91/91 vitest unit tests pass.** Tests cover the pure dedup layer (`matcher`, `levenshtein`, `normalize`, `enrichmentMerge`) and the ingestion exec paths (`ingestionService`, `ingestionExec`). This is a solid foundation.

**✅ Two Node matrix scripts pass.** `scripts/test-dedup-matrix.js` (21/21 with 6 documented skips) and `scripts/run-transcript-fixtures.js` (10/10). Added in Sprint 10 and runnable without Firestore/Claude.

**🟠 No UI/component tests, no e2e.** Nothing exercises rendering, routing, forms, or the actual merge/split UI. Every bug in this audit is a thing tests could have caught.
*Fix approach:* add `@testing-library/react` + a handful of integration tests for the merge flow, split flow, and the dedup review queue. Playwright for e2e on the ingestion happy-path.

**🟠 No tests for `src/data/merges.js`, `src/data/interactions.js`, `src/data/deals.js`, `src/data/targets.js`, `src/data/tasks.js`.** These all perform multi-step writes that are the highest-risk surface.
*Fix approach:* add vitest tests that mock `batchWrite` and verify the ops list for each mutation.

**⚪ Vite deprecation warnings on every test run.** `esbuild` option deprecated in favor of `oxc`. Not blocking.

### Build & Deploy

**🔴 Bundle size warning.** See Performance.

**🟡 Vite deprecation warnings.** `esbuild` and `optimizeDeps.esbuildOptions` options from `vite-plugin-react-babel` are deprecated. Will break on Vite 6.
*Fix approach:* upgrade `@vitejs/plugin-react` to the latest major.

**🔵 Firebase Hosting SPA rewrites are correct.** [firebase.json:14-16](firebase.json:14) rewrites everything to `/index.html`.

**🔵 GH Pages SPA fallback is present.** [index.html:13-20](index.html:13) decodes the `?/path` pattern, and `public/404.html` should contain the encoder. Verified [vite.config.js:8](vite.config.js:8) switches base path correctly via `DEPLOY_TARGET=gh-pages`.

**🔵 No source maps in `dist/`.** Good — not leaking to production.

### Documentation

**🔵 [README.md](README.md) is comprehensive.** ~260 lines covering setup, architecture, workflows, deploy, troubleshooting.

**🔵 [docs/dedup-calibration.md](docs/dedup-calibration.md) added in Sprint 10.** Good runbook.

**🟡 Only one acknowledged TODO across the codebase** ([claudeService.js:4-6](src/services/claudeService.js:4)). Unusually clean.

**⚪ No ESLint/Prettier config.** Code is uniform enough that this hasn't bitten — but any new contributor will drift.

---

## Top 10 Priority Fixes

Ranked across all categories. Effort: S (≤2h), M (half-day), L (≥1 day).

1. 🔴 **Unify the color palette** — one `design-tokens.js` with the warm palette; delete App.jsx's inline COLORS. **S**.
2. 🔴 **Proxy the Claude API through a Cloud Function** so the Anthropic key stops shipping to the browser. **M**.
3. 🔴 **Code-split by route** (`React.lazy` + `manualChunks`) to cut initial bundle from 1.6 MB to a navigable mobile experience. **M**.
4. 🔴 **Move Google Fonts `<link>` to `<head>` and drop the system-font override at [App.jsx:2493](src/App.jsx:2493).** Fonts load now but are overridden and late. **S**.
5. 🟠 **Break up App.jsx.** Extract people/company/interview list+detail views into `src/pages/`. Single biggest maintainability win. **L**.
6. 🟠 **Add success toasts to every mutation.** Makes the app feel alive; fixes the "did it work?" problem across add/edit/delete/merge/split/undo. **M**.
7. 🟠 **Make merges atomic.** Wrap `mergeContacts` and `undoMerge` in `batchWrite`. Prevents half-merged states. **S**.
8. 🟠 **Guard against double-ingestion.** Conditional write in `useIngestionProcessor` so two tabs can't claim the same interview. **S**.
9. 🟠 **Fix the hover-only affordances.** Sidebar unpin and any other hover-to-reveal must be touch-accessible. **S**.
10. 🟠 **Add `aria-label` to icon buttons and `role="button" tabIndex={0} onKeyDown` to clickable divs.** Unlocks keyboard/AT users. **M**.

---

## Strengths Worth Preserving

- **Dedup pipeline architecture.** `src/lib/dedup/` is small, pure, well-tested, and separated cleanly from Firestore. The test matrix scripts run without any cloud dependency. Keep this shape as the project grows.
- **Firestore rules scoping.** Per-user path (`users/{uid}/**`) is the right model. Don't introduce shared collections without a new rule pattern.
- **Sprint 9 merge/undo snapshot pattern.** Storing the full source doc + op manifests in the merge record is the correct way to power a full-rollback undo. Reuse this shape for other reversible bulk operations.
- **Documentation discipline.** `README.md` + `docs/dedup-calibration.md` + in-code comments explaining *why* (not *what*) are genuinely good. Don't regress this.
- **Soft-delete for contacts.** `deletedAt` + filter pattern is the right approach. Extend it to companies, deals, and targets rather than reverting to hard delete.
- **Explicit ingestion state machine.** `dedupStatus: pending → processing → resolved | review | error` is clear and debuggable.

---

## Recommended Next Steps

Ranked as a sequence of scoped sprints. Each should commit/deploy independently.

1. **Sprint A — Brand fidelity (1-2 days).** Unify palette, move fonts to `<head>`, extract shared `<Button>` component, normalize border-radius scale. This is the fastest way to make the app *feel* like the app you designed.
2. **Sprint B — Security (1-2 days).** Move Claude calls behind a Cloud Function. Rotate the ingestion secret. Done.
3. **Sprint C — Maintainability (2-3 days).** Break up `App.jsx` into page files. This is the refactor that makes every subsequent sprint faster.
4. **Sprint D — Feedback loop (1 day).** Success toasts everywhere. Ingestion progress visible on mobile. Success/fail UX for every mutation.
5. **Sprint E — Performance (1 day).** Route-level code splitting. Target sub-200 KB initial chunk.
6. **Sprint F — Data integrity (2 days).** Atomic merges, cascade or soft-delete for companies/deals/targets, conditional ingestion claim.
7. **Sprint G — Mobile polish (1-2 days).** DataTable dynamic height, TranscriptModal viewport, MobileNav ingestion badge, hover-only fixes.
8. **Sprint H — Accessibility (1 day).** Icon-button aria-labels, keyboard handlers on clickable divs, modal focus trap, muted-text contrast bump.
9. **Sprint I — Test coverage (2-3 days).** `@testing-library/react` for merge/split/undo flows. Playwright for ingestion e2e.

Total ≈ 3 weeks of focused work to get the app from "working and shipped" to "polished and hardened".

---

## Scope notes

- This was a static audit; I did not run the app in a browser or dev server. Runtime issues (focus loops, subscription leaks visible only under load, specific iOS Safari rendering bugs) would require manual testing.
- I did not audit `Code.gs` (Google Apps Script source) beyond confirming it exists. If it touches secrets or writes to Firestore indirectly, that deserves its own pass.
- I did not exercise the PWA install path.
- The ReferralPartners / ReferralPipeline / Scripts pages were only spot-checked.
