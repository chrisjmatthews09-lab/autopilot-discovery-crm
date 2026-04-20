// Sprint 7 — Timeline card for an interview. Shows the interview's
// number-in-sequence, date, 2-line summary preview, buttons to open the
// transcript / summary modals, and an auto-match badge when dedup attached
// the interview automatically.

import React, { useState } from 'react';
import { COLORS } from '../config/design-tokens';
import TranscriptModal from './TranscriptModal.jsx';
import ContactPickerModal from './ContactPickerModal.jsx';
import { useCollection } from '../hooks/useCollection';
import { moveInterview } from '../data/merges';

function shortDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fullTimestamp(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function previewText(text, maxChars = 180) {
  if (!text || typeof text !== 'string') return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars)}…` : cleaned;
}

export default function InterviewCard({ interview, ordinal, contactLabel }) {
  const [modalMode, setModalMode] = useState(null); // 'transcript' | 'summary' | null
  const [menuOpen, setMenuOpen] = useState(false);
  const [movePickerKind, setMovePickerKind] = useState(null); // 'person' | 'company' | null
  const [moveBusy, setMoveBusy] = useState(false);
  const { data: people } = useCollection('people', { enabled: movePickerKind === 'person' });
  const { data: companies } = useCollection('companies', { enabled: movePickerKind === 'company' });

  const dateValue = interview.interviewDate || interview.createdAt;
  const auto = interview.dedupResolution?.method === 'auto_merged';
  const autoConfidence = typeof interview.dedupResolution?.confidenceScore === 'number'
    ? Math.round(interview.dedupResolution.confidenceScore)
    : null;

  const summarySnippet = previewText(interview.summaryText || interview.summary || '');
  const topic = interview.intervieweeName || interview.intervieweeBusinessName || 'Interview';
  const heading = contactLabel
    ? `Interview #${ordinal || 1} · with ${contactLabel}`
    : `Interview #${ordinal || 1}`;

  return (
    <div style={{
      padding: 14,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      background: COLORS.card,
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16 }}>🎙️</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
            {heading}
          </span>
          <span title={fullTimestamp(dateValue)} style={{ fontSize: 12, color: COLORS.textMuted }}>
            {shortDate(dateValue)}
          </span>
          {interview.duration && (
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>· {interview.duration}</span>
          )}
          {auto && (
            <span
              title="Attached automatically by the dedup engine"
              style={{
                padding: '2px 8px',
                borderRadius: 10,
                background: '#E8F5EE',
                color: '#1A5C3A',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.3,
              }}
            >
              Auto-matched{autoConfidence != null ? ` (${autoConfidence}%)` : ''}
            </span>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            title="More actions"
            style={{ padding: '2px 8px', background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 14, color: COLORS.textMuted, lineHeight: 1 }}
          >⋯</button>
          {menuOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 26, zIndex: 50,
              background: COLORS.card, border: `1px solid ${COLORS.border}`,
              borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              minWidth: 220, padding: 4,
            }}>
              <button onClick={() => { setMenuOpen(false); setMovePickerKind('person'); }} style={menuBtn}>
                ↗ Move to different person
              </button>
              <button onClick={() => { setMenuOpen(false); setMovePickerKind('company'); }} style={menuBtn}>
                ↗ Move to different company
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginTop: 8 }}>{topic}</div>
      {summarySnippet && (
        <div style={{
          fontSize: 12,
          color: COLORS.textMuted,
          marginTop: 4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {summarySnippet}
        </div>
      )}

      <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setModalMode('transcript')}
          disabled={!interview.transcriptText && !interview.transcriptUrl}
          style={cardBtnStyle(!interview.transcriptText && !interview.transcriptUrl)}>
          📄 View transcript
        </button>
        <button
          onClick={() => setModalMode('summary')}
          disabled={!interview.summaryText && !interview.summaryUrl}
          style={cardBtnStyle(!interview.summaryText && !interview.summaryUrl)}>
          📝 View summary
        </button>
      </div>

      {modalMode && (
        <TranscriptModal
          interview={interview}
          mode={modalMode}
          onClose={() => setModalMode(null)}
        />
      )}

      {movePickerKind && (
        <ContactPickerModal
          title={movePickerKind === 'person'
            ? 'Move interview to a different person'
            : 'Move interview to a different company'}
          contacts={(movePickerKind === 'person' ? people : companies) || []}
          disabled={(c) => c.id === interview.linkedContactId
            || c.id === interview.dedupResolution?.matchedContactId
            || c.id === interview.dedupResolution?.matchedBusinessId}
          onClose={() => setMovePickerKind(null)}
          confirmLabel={moveBusy ? 'Moving…' : 'Move here'}
          onSelect={async (target) => {
            if (moveBusy) return;
            setMoveBusy(true);
            try {
              await moveInterview({ interviewId: interview.id, toContactId: target.id, toKind: movePickerKind });
              setMovePickerKind(null);
            } catch (err) {
              console.error(err);
              alert(`Move failed: ${err.message}`);
            } finally {
              setMoveBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

const menuBtn = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '6px 10px', background: 'transparent', border: 'none',
  borderRadius: 4, cursor: 'pointer', fontSize: 12, color: COLORS.text,
};

function cardBtnStyle(disabled) {
  return {
    padding: '6px 12px',
    border: `1px solid ${COLORS.border}`,
    background: disabled ? COLORS.cardAlt : COLORS.card,
    color: disabled ? COLORS.textDim : COLORS.text,
    borderRadius: 5,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
    fontWeight: 600,
  };
}
