// Sprint 7 — Timeline card for an interview. Shows the interview's
// number-in-sequence, date, 2-line summary preview, buttons to open the
// transcript / summary modals, and an auto-match badge when dedup attached
// the interview automatically.

import React, { useState } from 'react';
import { COLORS } from '../config/design-tokens';
import TranscriptModal from './TranscriptModal.jsx';

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

export default function InterviewCard({ interview, ordinal }) {
  const [modalMode, setModalMode] = useState(null); // 'transcript' | 'summary' | null

  const dateValue = interview.interviewDate || interview.createdAt;
  const auto = interview.dedupResolution?.method === 'auto_merged';
  const autoConfidence = typeof interview.dedupResolution?.confidenceScore === 'number'
    ? Math.round(interview.dedupResolution.confidenceScore)
    : null;

  const summarySnippet = previewText(interview.summaryText || interview.summary || '');
  const topic = interview.intervieweeName || interview.intervieweeBusinessName || 'Interview';

  return (
    <div style={{
      padding: 14,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 8,
      background: COLORS.card,
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16 }}>🎙️</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>
            Interview #{ordinal || 1}
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
    </div>
  );
}

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
