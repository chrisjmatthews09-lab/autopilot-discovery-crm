/**
 * JSDoc typedefs for dedup-related fields added to existing collections.
 * These are documentation-only (Firestore is schemaless). New fields are
 * backfilled by `migrateDedupFields` and written by ingestion in Sprint 4+.
 */

/**
 * @typedef {Object} FieldChange
 * @property {string} field          Field path on the target doc (e.g. "email").
 * @property {*}      oldValue       Previous value (or null).
 * @property {*}      newValue       New value written.
 */

/**
 * @typedef {Object} EnrichmentEvent
 * @property {*}             timestamp          Firestore Timestamp | ISO string.
 * @property {string|null}   sourceInterviewId  Interview that drove the enrichment (or null for manual).
 * @property {FieldChange[]} fieldsUpdated
 */

/**
 * New fields added to every `people` doc by `migrateDedupFields`.
 * @typedef {Object} PersonDedupFields
 * @property {string|null}      emailNormalized        Lowercased + trimmed email, or null.
 * @property {string}           fullNameNormalized     Lowercased + punctuation-stripped full name.
 * @property {string|null}      phoneNormalized        Digits-only phone, or null.
 * @property {"manual"|"interview_ingestion"} sourceType
 * @property {string[]}         mergedFromContactIds   IDs of records merged into this one.
 * @property {"none"|"flagged"|"confirmed_new"|"resolved"} dedupReviewStatus
 * @property {string[]}         interviewIds           Linked interview IDs.
 * @property {string[]}         callIds                Linked call IDs (future).
 * @property {string[]}         noteIds                Linked note IDs (future).
 * @property {EnrichmentEvent[]} enrichmentHistory
 */

/**
 * New fields added to every `companies` doc.
 * @typedef {Object} CompanyDedupFields
 * @property {string}           nameNormalized          Lowercased, suffix-stripped business name.
 * @property {"manual"|"interview_ingestion"} sourceType
 * @property {string[]}         mergedFromBusinessIds
 * @property {string[]}         contactIds              IDs of linked people (denormalized).
 * @property {string|null}      primaryContactId        Set in Sprint 5+.
 * @property {EnrichmentEvent[]} enrichmentHistory
 */

/**
 * Fields present on an interview created by the Plaud → Zapier ingestion pipeline.
 * Existing manual interviews get these as null defaults.
 * @typedef {Object} InterviewDedupFields
 * @property {Object|null}  extractedEntity
 * @property {string|null}  extractedEntity.firstName
 * @property {string|null}  extractedEntity.lastName
 * @property {string|null}  extractedEntity.email
 * @property {string|null}  extractedEntity.phone
 * @property {string|null}  extractedEntity.businessName
 * @property {string|null}  extractedEntity.businessType
 * @property {Object|null}  dedupResolution
 * @property {"auto_merged"|"created_new"|"user_resolved"|null} dedupResolution.method
 * @property {number|null}  dedupResolution.confidenceScore
 * @property {string|null}  dedupResolution.matchedContactId
 * @property {string|null}  dedupResolution.matchedBusinessId
 * @property {string|null}  dedupResolution.reviewItemId
 * @property {string|null}  sourceIngestionJobId   Idempotency key from Zapier.
 */

/**
 * A row in the `dedupReviewQueue` collection. Populated in Sprint 5.
 * @typedef {Object} DedupReviewItem
 * @property {"contact"|"business"}                entityType
 * @property {"tier3_review"|"low_confidence"}     triggerReason
 * @property {number}                              confidenceScore
 * @property {Object}                              candidateData     The newly-extracted entity.
 * @property {string|null}                         matchedEntityId   Best existing candidate (if any).
 * @property {"pending"|"resolved_merge"|"resolved_new"|"resolved_skip"} status
 * @property {string|null}                         resolvedBy
 * @property {*}                                   resolvedAt
 * @property {string}                              sourceInterviewId
 * @property {*}                                   createdAt
 */

export const DEDUP_SOURCE_TYPES = Object.freeze(['manual', 'interview_ingestion']);
export const DEDUP_REVIEW_STATUSES = Object.freeze(['none', 'flagged', 'confirmed_new', 'resolved']);
export const DEDUP_REVIEW_QUEUE_STATUSES = Object.freeze(['pending', 'resolved_merge', 'resolved_new', 'resolved_skip']);
