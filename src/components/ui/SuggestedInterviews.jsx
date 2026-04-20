import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { COLORS } from '../../config/design-tokens';
import { fetchUpcomingCalendarEvents, filterInterviewEvents, getGoogleConnectionStatus, GoogleAuthError } from '../../data/google';
import { createDoc } from '../../data/firestore';
import { useWorkspace } from '../../hooks/useWorkspace';

export default function SuggestedInterviews({ people = [], onCreated }) {
  const [status, setStatus] = useState(() => getGoogleConnectionStatus());
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [createdIds, setCreatedIds] = useState(() => new Set(loadCreatedIds()));
  const navigate = useNavigate();
  const { id: workspaceId } = useWorkspace();

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const all = await fetchUpcomingCalendarEvents({ daysAhead: 14 });
      setEvents(filterInterviewEvents(all));
    } catch (err) {
      if (err instanceof GoogleAuthError) {
        setError(err.message);
        setStatus(getGoogleConnectionStatus());
      } else {
        setError(err.message || 'Failed to fetch calendar events');
      }
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setStatus(getGoogleConnectionStatus());
  }, []);

  useEffect(() => {
    if (status.connected && status.hasCalendar && events === null) refresh();
  }, [status, events, refresh]);

  if (!status.connected || !status.hasCalendar) {
    return (
      <div style={{ marginBottom: 16, padding: 12, background: COLORS.card, border: `1px dashed ${COLORS.border}`, borderRadius: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>📅 Suggested interviews</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>
          Connect Google Calendar in <Link to="/settings" style={{ color: COLORS.primary, textDecoration: 'none', fontWeight: 600 }}>Settings → Integrations</Link> to auto-surface upcoming interview-like events.
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    if (loading) return <div style={{ marginBottom: 16, padding: 12, color: COLORS.textMuted, fontSize: 12 }}>Scanning your next 14 days…</div>;
    if (error) return <div style={{ marginBottom: 16, padding: 12, color: COLORS.danger, fontSize: 12 }}>{error}</div>;
    return null;
  }

  const visible = events.filter((e) => !createdIds.has(e.id));
  if (visible.length === 0) return null;

  const handleCreate = async (event) => {
    setBusyId(event.id);
    try {
      const attendee = (event.attendees || []).find((a) => !a.self && !a.organizer) || (event.attendees || [])[0];
      const match = attendee?.email ? people.find((p) => (p.email || '').toLowerCase() === attendee.email.toLowerCase()) : null;
      const id = `interview-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const title = event.summary || attendee?.name || attendee?.email || '';
      await createDoc('interviews', {
        title,
        recordedAt: event.start || null,
        endAt: event.end || null,
        transcript: null,
        summary: null,
        transcriptDriveUrl: null,
        summaryDriveUrl: null,
        scheduled: true,
        linkedType: match ? 'person' : null,
        linkedContactId: match ? match.id : null,
        source: 'google_calendar',
        sourceEventId: event.id,
        sourceEventLink: event.htmlLink,
        notes: event.description || '',
        workspace: workspaceId,
        ingestedAt: new Date().toISOString(),
      }, id);
      const next = new Set(createdIds); next.add(event.id);
      setCreatedIds(next);
      saveCreatedIds(next);
      onCreated && onCreated(id);
      navigate(workspaceId === 'deal_flow' ? `/deal-flow/interviews/${id}` : `/crm/interviews/${id}`);
    } catch (err) {
      setError(err.message || 'Failed to create interview record');
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = (event) => {
    const next = new Set(createdIds); next.add(event.id);
    setCreatedIds(next);
    saveCreatedIds(next);
  };

  return (
    <div style={{ marginBottom: 16, padding: 14, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
          📅 Suggested interviews <span style={{ color: COLORS.textMuted, fontWeight: 400, fontSize: 12 }}>({visible.length} in next 14 days)</span>
        </div>
        <button onClick={refresh} disabled={loading}
          style={{ padding: '4px 10px', background: COLORS.cardAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 11 }}>
          {loading ? '…' : '↻'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visible.map((e) => {
          const attendee = (e.attendees || []).find((a) => !a.self && !a.organizer);
          const match = attendee?.email && people.find((p) => (p.email || '').toLowerCase() === attendee.email.toLowerCase());
          return (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1.2fr auto', gap: 10, alignItems: 'center', padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 5, background: COLORS.cardAlt, fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.summary}</div>
              <div style={{ color: COLORS.textMuted, fontSize: 11 }}>{formatDT(e.start)}</div>
              <div style={{ color: COLORS.textMuted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {attendee ? (
                  <>
                    {attendee.name || attendee.email}
                    {match && <span style={{ marginLeft: 6, color: COLORS.primary, fontWeight: 600 }}>· matched</span>}
                  </>
                ) : <span style={{ fontStyle: 'italic' }}>No attendees</span>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => handleCreate(e)} disabled={busyId === e.id}
                  style={{ padding: '4px 10px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  {busyId === e.id ? '…' : 'Create'}
                </button>
                <button onClick={() => dismiss(e)}
                  style={{ padding: '4px 8px', background: 'none', color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DISMISS_KEY = 'autopilot-suggested-events-dismissed-v1';
function loadCreatedIds() {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]'); } catch { return []; }
}
function saveCreatedIds(set) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(set))); } catch {}
}

function formatDT(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
