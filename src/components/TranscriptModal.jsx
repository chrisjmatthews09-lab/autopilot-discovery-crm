// Sprint 7 — Modal that shows an interview's transcript or summary inline
// so the user can read it without leaving the Contact detail page.

import React, { useEffect } from 'react';
import { COLORS } from '../config/design-tokens';
import {
  getInterviewTranscript,
  getInterviewSummary,
  getInterviewTranscriptUrl,
  getInterviewSummaryUrl,
  getInterviewHeadline,
  formatInterviewDate,
} from '../lib/interviewFields.js';

export default function TranscriptModal({ interview, mode = 'transcript', onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!interview) return null;

  const title = mode === 'summary' ? 'Summary' : 'Transcript';
  const text = mode === 'summary' ? getInterviewSummary(interview) : getInterviewTranscript(interview);
  const url = mode === 'summary' ? getInterviewSummaryUrl(interview) : getInterviewTranscriptUrl(interview);
  const name = getInterviewHeadline(interview) || 'Interview';
  const dateLabel = formatInterviewDate(interview);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, borderRadius: 10, width: '100%', maxWidth: 820,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              {mode === 'summary' ? '📄 Summary' : '🎙️ Transcript'}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginTop: 2 }}>
              {name}{dateLabel ? ` · ${dateLabel}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: COLORS.textMuted, cursor: 'pointer', fontSize: 22, padding: 4, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {text ? (
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, margin: 0, color: COLORS.text }}>
              {text}
            </pre>
          ) : url ? (
            <div style={{ fontSize: 13, color: COLORS.textMuted }}>
              No cached {title.toLowerCase()} yet. <a href={url} target="_blank" rel="noreferrer" style={{ color: COLORS.primary }}>Open source ↗</a>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' }}>
              No {title.toLowerCase()} available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
