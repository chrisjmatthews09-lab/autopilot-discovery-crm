# Dedup pipeline test fixtures

Ten fixtures covering the regression scenarios from PRD §9.4. Each file is a
JSON snapshot of what Prompt A (extraction) would produce from a transcript,
plus the set of existing people/companies the matcher should run against, and
the expected decision.

Stub format (so the runner doesn't need Claude API credits):

```json
{
  "id": "01-firstTimeOwner",
  "description": "...",
  "extractedEntity": { ... },
  "existing": { "people": [...], "companies": [...] },
  "expectedDecision": "create_both"
}
```

Run via `node scripts/run-transcript-fixtures.js`.
