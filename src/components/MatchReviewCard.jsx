// Sprint 5 — MatchReviewCard
// One card per dedupReviewQueue item. Shows incoming vs. existing side-by-side,
// the match signals, Claude's assessment (fetched async), and merge/create actions.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { COLORS, DISPLAY, FONT } from '../config/design-tokens';
import { callClaude } from '../services/claudeService.js';
import { buildReviewSummaryPrompt } from '../prompts/reviewSummary.js';
import { resolveReview } from '../services/ingestionService.js';
import { getDoc } from '../data/firestore.js';
import { useToast } from './ui/Toast.jsx';

function formatPercent(n) {
  if (typeof n !== 'number') return '—';
  return `${Math.round(n)}%`;
}

function pillStyle(bg, fg) {
  return {
    padding: '3px 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    background: bg,
    color: fg,
    display: 'inline-block',
  };
}

export default function MatchReviewCard({ item, interview, existingContact, existingCompany }) {
  const toast = useToast();
  const [claudeText, setClaudeText] = useState('');
  const [claudeLoading, setClaudeLoading] = useState(true);
  const [claudeError, setClaudeError] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(null); // 'merge' | 'create_new' | null
  const [submitting, setSubmitting] = useState(false);
  const fetchedRef = useRef(false);

  const isContact = item.entityType === 'contact';
  const existing = isContact ? existingContact : existingCompany;
  const existingLabel = isContact
    ? (existing?.name || [existing?.firstName, existing?.lastName].filter(Boolean).join(' ') || '(unknown contact)')
    : (existing?.name || '(unknown business)');

  const candidate = item.candidateData || {};
  const incomingName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || '(name unclear)';

  const incomingSnippet = useMemo(() => {
    const src = interview?.summary || interview?.transcript || '';
    return src.slice(0, 200) + (src.length > 200 ? '…' : '');
  }, [interview]);

  const existingContext = useMemo(() => {
    if (!existing) return '';
    if (isContact) {
      const count = existing.interviewIds?.length || 0;
      const parts = [];
      if (count > 0) parts.push(`${count} past interview${count === 1 ? '' : 's'}`);
      if (existing.company) parts.push(`at ${existing.company}`);
      return parts.join(', ');
    }
    const count = existing.contactIds?.length || 0;
    return count > 0 ? `${count} linked contact${count === 1 ? '' : 's'}` : 'No linked contacts yet';
  }, [existing, isContact]);

  useEffect(() => {
    if (fetchedRef.current || !existing) return;
    fetchedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const prompt = buildReviewSummaryPrompt({
          incoming: candidate,
          incomingSummary: incomingSnippet,
          existing,
          existingContext,
          matchDetails: {
            entityType: item.entityType,
            nameMatch: item.nameMatch,
            businessMatch: item.businessMatch,
            confidence: item.confidenceScore,
            triggerReason: item.triggerReason,
          },
        });
        const { text } = await callClaude(prompt, { temperature: 0.2, maxTokens: 400 });
        if (!cancelled) setClaudeText(text.trim());
      } catch (err) {
        if (!cancelled) setClaudeError(err?.message || String(err));
      } finally {
        if (!cancelled) setClaudeLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [existing, candidate, incomingSnippet, existingContext, item]);

  const handleResolve = async (choice) => {
    setSubmitting(true);
    try {
      await resolveReview(item, choice);
      toast.success(choice === 'merge' ? `Merged with ${existingLabel}` : 'New record created');
      // Item leaves the pending list automatically via onSnapshot; no further work here.
    } catch (err) {
      toast.error(`Resolution failed: ${err?.message || String(err)}`);
      setSubmitting(false);
      setConfirmOpen(null);
    }
    // Intentionally do not reset submitting on success — the card will unmount.
  };

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: 18,
        marginBottom: 14,
        fontFamily: FONT,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 700, color: COLORS.text }}>
            {isContact ? 'Contact match' : 'Business match'} — review needed
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
            Trigger: {item.triggerReason} · Confidence {formatPercent(item.confidenceScore)}
          </div>
        </div>
        <div style={pillStyle(COLORS.goldLight, COLORS.gold)}>
          {formatPercent(item.confidenceScore)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <Section title="Incoming (from interview)">
          <KV label="Name" value={incomingName} />
          {candidate.email && <KV label="Email" value={candidate.email} />}
          {candidate.phone && <KV label="Phone" value={candidate.phone} />}
          {candidate.businessName && <KV label="Business" value={candidate.businessName} />}
          {incomingSnippet && (
            <div style={{ marginTop: 8, fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic', lineHeight: 1.5 }}>
              “{incomingSnippet}”
            </div>
          )}
        </Section>

        <Section title={isContact ? 'Existing contact' : 'Existing business'}>
          {existing ? (
            <>
              <KV label="Name" value={existingLabel} />
              {isContact && existing.email && <KV label="Email" value={existing.email} />}
              {isContact && existing.phone && <KV label="Phone" value={existing.phone} />}
              {isContact && existing.company && <KV label="Company" value={existing.company} />}
              {existingContext && (
                <div style={{ marginTop: 8, fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
                  {existingContext}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic' }}>
              Matched record no longer exists (may have been deleted).
            </div>
          )}
        </Section>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14, fontSize: 12, color: COLORS.textMuted }}>
        <Signal label="Name" value={formatPercent(item.nameMatch)} />
        <Signal label="Business" value={formatPercent(item.businessMatch)} />
        <Signal label="Overall" value={formatPercent(item.confidenceScore)} />
      </div>

      <div
        style={{
          background: COLORS.cardAlt,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
          Claude&apos;s take
        </div>
        {claudeLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: COLORS.textMuted }}>
            <Spinner /> Analyzing…
          </div>
        ) : claudeError ? (
          <div style={{ fontSize: 13, color: COLORS.danger }}>Analysis failed: {claudeError}</div>
        ) : (
          <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {claudeText || '(No response)'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          onClick={() => setConfirmOpen('create_new')}
          disabled={submitting}
          style={{
            padding: '9px 16px',
            background: 'none',
            border: `1px solid ${COLORS.border}`,
            color: COLORS.text,
            borderRadius: 6,
            cursor: submitting ? 'default' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            opacity: submitting ? 0.6 : 1,
          }}
        >
          Create new
        </button>
        <button
          onClick={() => setConfirmOpen('merge')}
          disabled={submitting || !existing}
          style={{
            padding: '9px 16px',
            background: existing ? COLORS.primary : COLORS.border,
            border: 'none',
            color: '#fff',
            borderRadius: 6,
            cursor: submitting || !existing ? 'default' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            opacity: submitting ? 0.6 : 1,
          }}
        >
          Merge with {existingLabel}
        </button>
      </div>

      {confirmOpen && (
        <ConfirmDialog
          choice={confirmOpen}
          existingLabel={existingLabel}
          isContact={isContact}
          submitting={submitting}
          onCancel={() => setConfirmOpen(null)}
          onConfirm={() => handleResolve(confirmOpen)}
        />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div style={{ fontSize: 13, color: COLORS.text, marginBottom: 4 }}>
      <span style={{ color: COLORS.textMuted, marginRight: 6 }}>{label}:</span>
      {value}
    </div>
  );
}

function Signal({ label, value }) {
  return (
    <span>
      <span style={{ color: COLORS.textMuted, fontWeight: 500 }}>{label}:</span>{' '}
      <span style={{ color: COLORS.text, fontWeight: 700 }}>{value}</span>
    </span>
  );
}

function Spinner() {
  return (
    <>
      <span
        aria-hidden
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          border: `2px solid ${COLORS.border}`,
          borderTopColor: COLORS.primary,
          display: 'inline-block',
          animation: 'mrc-spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes mrc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function ConfirmDialog({ choice, existingLabel, isContact, submitting, onCancel, onConfirm }) {
  const title = choice === 'merge' ? 'Merge records?' : 'Create new record?';
  const body = choice === 'merge'
    ? (isContact
        ? `This interview will be attached to "${existingLabel}". No new contact or business will be created.`
        : `A new contact will be created and linked to "${existingLabel}". No new business will be created.`)
    : (isContact
        ? `A new contact (plus a new business, if present) will be created from this interview. The match with "${existingLabel}" will be rejected.`
        : `A new business and contact will be created from this interview. The match with "${existingLabel}" will be rejected.`);

  return (
    <div
      onClick={submitting ? undefined : onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.card, borderRadius: 10, padding: 20, maxWidth: 460, width: '100%', fontFamily: FONT }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16, lineHeight: 1.55 }}>{body}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={submitting}
            style={{ padding: '8px 14px', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: submitting ? 'default' : 'pointer', fontSize: 13, color: COLORS.text, opacity: submitting ? 0.6 : 1 }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            style={{ padding: '8px 14px', background: COLORS.primary, border: 'none', borderRadius: 6, cursor: submitting ? 'default' : 'pointer', fontSize: 13, color: '#fff', fontWeight: 600, opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper for pages that need to hydrate an existing record by id.
export async function fetchExistingForItem(item) {
  if (!item?.matchedEntityId) return null;
  const collection = item.entityType === 'business' ? 'companies' : 'people';
  return getDoc(collection, item.matchedEntityId);
}
