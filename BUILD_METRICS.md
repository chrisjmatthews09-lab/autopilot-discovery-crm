# Build metrics

Bundle sizes after each round of perf work, captured from `npm run build`.

## 2026-04-20 — Sprint 2 (route splitting + manualChunks)

| Metric | Value |
|---|---|
| Build time | 2.57 s |
| Total chunks | 20 (js) + 1 (html) |
| Initial main chunk (`index.js`) | 320.46 KB raw / **88.84 KB gzipped** |
| Largest chunk (`firebase-vendor`) | 473.73 KB raw / **111.75 KB gzipped** |
| Initial paint payload sum (index + react-vendor + firebase-vendor) | ~974 KB raw / **~260 KB gzipped** |

### Per-chunk breakdown (gzipped)

- index.js — 88.84 KB *(app shell + routing)*
- react-vendor — 58.92 KB
- firebase-vendor — 111.75 KB
- charts-vendor — 105.10 KB *(loaded only on Dashboard / Insights)*
- markdown-vendor — 47.73 KB *(loaded only on pages using ReactMarkdown)*
- dnd-vendor — 14.17 KB *(loaded only on DealsList / TargetsList)*
- Each route page — 1.0 to 8.0 KB

### Baseline (before Sprint 2)

Single bundle: 1,673.85 KB raw / **461.99 KB gzipped**.

### Wins

- Initial JS payload to first paint: **462 KB → 260 KB gzipped** (~44% reduction)
- Single-bundle main script: **462 KB → 88.84 KB gzipped** (~80% reduction in the chunk we always need)
- Recharts (105 KB gzipped) deferred unless a charts page is opened
- ReactMarkdown (47 KB gzipped) deferred to interview / scripts views
- @dnd-kit (14 KB gzipped) deferred unless DealsList / TargetsList opened

### Known follow-ups

- Firebase vendor chunk (112 KB gzipped) is now the largest blocker. Consider tree-shaking unused Firestore APIs or deferring `firebase/functions` until first AI call.
- `chunkSizeWarningLimit` is 300 KB raw — three chunks (index, charts-vendor, firebase-vendor) still exceed this. Vite warning is informational, not blocking.
