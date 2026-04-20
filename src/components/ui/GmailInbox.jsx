import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { COLORS } from '../../config/design-tokens';
import { fetchEmailsForAddress, getGoogleConnectionStatus, GoogleAuthError } from '../../data/google';

export default function GmailInbox({ email, autoFetch = false }) {
  const [status, setStatus] = useState(() => getGoogleConnectionStatus());
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!email) return;
    setLoading(true); setError(null);
    try {
      const list = await fetchEmailsForAddress(email, { maxResults: 15 });
      setMessages(list);
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        setError(err.message);
        setStatus(getGoogleConnectionStatus());
      } else {
        setError(err.message || 'Failed to fetch emails');
      }
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    setStatus(getGoogleConnectionStatus());
    setMessages(null);
  }, [email]);

  useEffect(() => {
    if (autoFetch && status.connected && status.hasGmail && email && messages === null) {
      refresh();
    }
  }, [autoFetch, status, email, messages, refresh]);

  if (!email) return null;

  if (!status.connected || !status.hasGmail) {
    return (
      <div style={{ marginTop: 20, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>📧 Emails</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
          Connect Gmail in <Link to="/settings" style={{ color: COLORS.primary, textDecoration: 'none', fontWeight: 600 }}>Settings → Integrations</Link> to see emails to/from this person.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
          📧 Emails {messages !== null && <span style={{ color: COLORS.textMuted, fontWeight: 400, fontSize: 12 }}>({messages.length})</span>}
        </div>
        <button onClick={refresh} disabled={loading}
          style={{ padding: '5px 10px', background: COLORS.cardAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 600 }}>
          {loading ? 'Loading…' : messages === null ? 'Pull emails' : '↻ Refresh'}
        </button>
      </div>

      {error && <div style={{ fontSize: 11, color: COLORS.danger, marginBottom: 8 }}>{error}</div>}

      {messages === null && !loading && !error && (
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>Click “Pull emails” to fetch recent messages to/from {email}.</div>
      )}

      {messages && messages.length === 0 && !loading && (
        <div style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: 'italic' }}>No emails found for {email}.</div>
      )}

      {messages && messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {messages.map((m) => (
            <a key={m.id} href={`https://mail.google.com/mail/u/0/#inbox/${m.id}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 5, background: COLORS.cardAlt, textDecoration: 'none', color: COLORS.text, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.subject}</div>
                <div style={{ color: COLORS.textMuted, fontSize: 11, flexShrink: 0 }}>{formatShortDate(m.internalDate)}</div>
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{m.from}</div>
              <div style={{ color: COLORS.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.snippet}</div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function formatShortDate(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: '2-digit' });
}
