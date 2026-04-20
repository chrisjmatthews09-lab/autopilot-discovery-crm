// Sprint 7 — Unified contact Timeline.
//
// Merges three event sources into a single chronological feed for one
// contact (person or company):
//   - Interviews (Firestore `interviews` collection, linked by
//     linkedContactId/linkedType or by the dedup engine's
//     dedupResolution.matched*Id)
//   - Calls (interactions with kind='call')
//   - Notes (interactions with kind='note')
//
// Renders the appropriate card per kind. Shows 20 items at first; the user
// can click "Load more" to reveal more. Entry points at the top:
// + Add note and + Log call (both compose via a lightweight inline form).

import React, { useMemo, useState } from 'react';
import { COLORS } from '../config/design-tokens';
import { useCollection } from '../hooks/useCollection';
import { logInteraction } from '../data/interactions';
import InterviewCard from './InterviewCard.jsx';
import CallCard from './CallCard.jsx';
import NoteCard from './NoteCard.jsx';
import { getInterviewDate } from '../lib/interviewFields.js';

const PAGE_SIZE = 20;

function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'object' && v.seconds) return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Decide whether an interview belongs to this contact. Covers both the
 * legacy manual-link path (linkedContactId/linkedType) and the Sprint 4-6
 * dedup pipeline (dedupResolution.matchedContactId / matchedBusinessId).
 */
function interviewBelongsTo(interview, entityType, entityId) {
  if (!interview || !entityId) return false;
  if (interview.linkedType === entityType && interview.linkedContactId === entityId) return true;
  const r = interview.dedupResolution;
  if (!r) return false;
  if (entityType === 'person' && r.matchedContactId === entityId) return true;
  if (entityType === 'company' && r.matchedBusinessId === entityId) return true;
  return false;
}

/**
 * Return the person id associated with an interview, if any — used when
 * the timeline is combined across multiple contacts at a business so each
 * card can be labelled with whom the interview was.
 */
function personIdForInterview(interview) {
  if (interview.linkedType === 'person' && interview.linkedContactId) return interview.linkedContactId;
  if (interview.dedupResolution?.matchedContactId) return interview.dedupResolution.matchedContactId;
  return null;
}

/**
 * @param {object} props
 * @param {'person'|'company'} props.entityType
 * @param {string} props.entityId
 * @param {string[]} [props.contactIds]   When entityType='company', roll up
 *                                        interactions from these person ids
 *                                        into the same feed (combined view).
 * @param {Record<string, {name?:string}>} [props.peopleById]  Lookup for
 *                                        rendering "with John Smith" labels.
 */
export default function Timeline({ entityType, entityId, contactIds, peopleById }) {
  const { data: interviews, loading: loadingInterviews } = useCollection('interviews');
  const { data: interactions, loading: loadingInteractions } = useCollection('interactions');

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [composing, setComposing] = useState(null); // 'note' | 'call' | null

  const rollUpIds = useMemo(() => (Array.isArray(contactIds) ? contactIds.filter(Boolean) : []), [contactIds]);
  const combinedMode = entityType === 'company' && rollUpIds.length > 0;

  // Interviews for this entity (plus any rolled-up contacts for combined view),
  // with an ordinal position (oldest = #1) so the card can show "Interview #3"
  // correctly even when the list is sorted newest-first.
  const contactInterviews = useMemo(() => {
    const mine = (interviews || []).filter((iv) => {
      if (interviewBelongsTo(iv, entityType, entityId)) return true;
      if (!combinedMode) return false;
      const pid = personIdForInterview(iv);
      return !!pid && rollUpIds.includes(pid);
    });
    const sortedOldFirst = [...mine].sort((a, b) => toMs(getInterviewDate(a)) - toMs(getInterviewDate(b)));
    const ordinalById = new Map();
    sortedOldFirst.forEach((iv, i) => ordinalById.set(iv.id, i + 1));
    return mine.map((iv) => ({ ...iv, _ordinal: ordinalById.get(iv.id) || 1 }));
  }, [interviews, entityType, entityId, combinedMode, rollUpIds]);

  const contactInteractions = useMemo(() => {
    return (interactions || []).filter((it) => {
      if (it.kind !== 'call' && it.kind !== 'note') return false;
      if (it.entity_type === entityType && it.entity_id === entityId) return true;
      if (combinedMode && it.entity_type === 'person' && rollUpIds.includes(it.entity_id)) return true;
      return false;
    });
  }, [interactions, entityType, entityId, combinedMode, rollUpIds]);

  const merged = useMemo(() => {
    const labelFor = (personId) => {
      if (!personId || !peopleById) return null;
      const p = peopleById[personId];
      if (!p) return null;
      return p.name || p.fullName || [p.firstName, p.lastName].filter(Boolean).join(' ') || null;
    };

    const rows = [
      ...contactInterviews.map((iv) => {
        const pid = combinedMode ? personIdForInterview(iv) : null;
        return {
          key: `iv-${iv.id}`,
          kind: 'interview',
          ts: toMs(getInterviewDate(iv)),
          data: iv,
          contactLabel: combinedMode ? labelFor(pid) : null,
        };
      }),
      ...contactInteractions.map((it) => {
        const pid = it.entity_type === 'person' ? it.entity_id : null;
        return {
          key: `int-${it.id}`,
          kind: it.kind,
          ts: toMs(it.occurred_at || it.createdAt),
          data: it,
          contactLabel: combinedMode ? labelFor(pid) : null,
        };
      }),
    ];
    rows.sort((a, b) => b.ts - a.ts);
    return rows;
  }, [contactInterviews, contactInteractions, combinedMode, peopleById]);

  const loading = loadingInterviews || loadingInteractions;
  const visible = merged.slice(0, visibleCount);
  const canLoadMore = merged.length > visibleCount;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>🕑 Timeline</div>
        {!composing && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setComposing('note')} style={btnPrimary}>+ Add note</button>
            <button onClick={() => setComposing('call')} style={btnSecondary}>+ Log call</button>
          </div>
        )}
      </div>

      {composing && (
        <ComposeForm
          kind={composing}
          entityType={entityType}
          entityId={entityId}
          onDone={() => setComposing(null)}
        />
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: COLORS.textDim, padding: '8px 0' }}>Loading timeline…</div>
      ) : merged.length === 0 ? (
        <div style={{
          fontSize: 13,
          color: COLORS.textDim,
          fontStyle: 'italic',
          padding: '24px 16px',
          textAlign: 'center',
          background: COLORS.cardAlt,
          border: `1px dashed ${COLORS.border}`,
          borderRadius: 8,
        }}>
          No interactions yet. The first interview will appear here automatically.
        </div>
      ) : (
        <>
          {visible.map((row) => {
            if (row.kind === 'interview') return <InterviewCard key={row.key} interview={row.data} ordinal={row.data._ordinal} contactLabel={row.contactLabel} />;
            if (row.kind === 'call') return <CallCard key={row.key} interaction={row.data} contactLabel={row.contactLabel} />;
            if (row.kind === 'note') return <NoteCard key={row.key} interaction={row.data} contactLabel={row.contactLabel} />;
            return null;
          })}
          {canLoadMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                style={{
                  padding: '8px 16px',
                  background: COLORS.cardAlt,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  color: COLORS.text,
                }}
              >
                Load more ({merged.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ComposeForm({ kind, entityType, entityId, onDone }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [duration, setDuration] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() && !body.trim()) { onDone(); return; }
    setSaving(true);
    try {
      await logInteraction({
        kind,
        entity_type: entityType,
        entity_id: entityId,
        title: title.trim(),
        body: body.trim(),
        meta: kind === 'call' && duration.trim() ? { duration: duration.trim() } : {},
      });
      onDone();
    } catch (err) {
      console.error('Failed to log interaction', err);
      alert('Failed to save — check console.');
      setSaving(false);
    }
  };

  return (
    <div style={{ background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>
        {kind === 'call' ? '📞 Log call' : '📝 Add note'}
      </div>
      {kind === 'note' && (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 8 }}
        />
      )}
      {kind === 'call' && (
        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="Duration (e.g. 30m)"
          style={{ ...inputStyle, width: 180, marginBottom: 8 }}
        />
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={kind === 'call' ? 'Call notes…' : 'Note…'}
        autoFocus
        style={{ ...inputStyle, width: '100%', minHeight: 80, boxSizing: 'border-box', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={save} disabled={saving} style={btnSuccess(saving)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onDone} style={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

const btnPrimary = { padding: '6px 12px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const btnSecondary = { padding: '6px 12px', background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const btnSuccess = (saving) => ({ padding: '6px 14px', background: saving ? COLORS.border : COLORS.success, color: '#fff', border: 'none', borderRadius: 5, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 });
const btnGhost = { padding: '6px 14px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 12 };
const inputStyle = { padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 13, background: COLORS.card, color: COLORS.text };
