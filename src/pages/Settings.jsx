import React, { useEffect, useMemo, useState } from 'react';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { TAG_COLORS } from '../config/enums';
import { useCollection } from '../hooks/useCollection';
import { createTag, renameTag, recolorTag, changeTagScope, removeTag } from '../data/tags';
import { createDoc, updateDoc, deleteDoc } from '../data/firestore';
import { clearStoredToken, connectBoth, connectCalendar, connectGmail, getGoogleConnectionStatus } from '../data/google';
import { migrateWorkspaceBackfill, migrateDedupFields } from '../data/migrate';

export default function Settings({ user, onSignOut }) {
  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1 style={{ margin: '0 0 4px', fontFamily: DISPLAY, fontSize: 28, color: COLORS.text }}>Settings</h1>
      <p style={{ margin: '0 0 20px', color: COLORS.textMuted, fontSize: 14 }}>
        Account, tags, and workspace preferences.
      </p>

      <Section title="Account">
        <Row label="Email" value={user && user.email} />
        {onSignOut && (
          <button onClick={onSignOut}
            style={{ marginTop: 12, padding: '8px 14px', background: 'none', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            Sign out
          </button>
        )}
      </Section>

      <IntegrationsSection />

      <WorkspaceSection />

      <DedupBackfillSection />

      <TagsSection />

      <PipelinesSection />

      <ShortcutsSection />
    </div>
  );
}

function IntegrationsSection() {
  const [status, setStatus] = useState(() => getGoogleConnectionStatus());
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const handler = () => setStatus(getGoogleConnectionStatus());
    window.addEventListener('focus', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('focus', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const run = async (which, fn) => {
    setBusy(which); setError(null);
    try {
      await fn();
      setStatus(getGoogleConnectionStatus());
    } catch (err) {
      setError(err.message || 'Connection failed. Make sure you grant the requested scopes.');
    } finally {
      setBusy(null);
    }
  };

  const disconnect = () => {
    if (!window.confirm('Disconnect Google Gmail + Calendar? You can reconnect anytime.')) return;
    clearStoredToken();
    setStatus(getGoogleConnectionStatus());
  };

  return (
    <Section title="Integrations" subtitle="Connect Google Gmail and Calendar. Tokens live ~1 hour; reconnect when prompted.">
      <IntegrationRow
        icon="📧" label="Gmail (read only)"
        desc="Pulls recent emails to/from a person when you open their profile."
        connected={status.connected && status.hasGmail}
        busy={busy === 'gmail'}
        onConnect={() => run('gmail', connectGmail)}
      />
      <IntegrationRow
        icon="📅" label="Google Calendar (read only)"
        desc="Surfaces upcoming interview-like events as suggestions on the Interviews list."
        connected={status.connected && status.hasCalendar}
        busy={busy === 'calendar'}
        onConnect={() => run('calendar', connectCalendar)}
      />

      {status.connected && (status.hasGmail || status.hasCalendar) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: 10, background: COLORS.cardAlt, borderRadius: 6 }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            Connected as <strong style={{ color: COLORS.text }}>{status.email || 'your account'}</strong>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => run('both', connectBoth)}
              style={{ padding: '5px 10px', background: 'none', color: COLORS.primary, border: `1px solid ${COLORS.primary}`, borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
              Re-authorize
            </button>
            <button onClick={disconnect}
              style={{ padding: '5px 10px', background: 'none', color: COLORS.danger, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 11 }}>
              Disconnect
            </button>
          </div>
        </div>
      )}

      {error && <div style={{ marginTop: 8, fontSize: 11, color: COLORS.danger }}>{error}</div>}

      <div style={{ marginTop: 10, fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic' }}>
        OAuth uses the same Google account you signed in with. No refresh tokens are stored — if the token expires, we'll prompt you to reconnect.
      </div>
    </Section>
  );
}

function IntegrationRow({ icon, label, desc, connected, busy, onConnect }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, display: 'flex', alignItems: 'center', gap: 6 }}>
          {label}
          {connected && <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.success, background: '#DCFCE7', padding: '1px 8px', borderRadius: 8 }}>CONNECTED</span>}
        </div>
        <div style={{ fontSize: 11, color: COLORS.textMuted }}>{desc}</div>
      </div>
      <button onClick={onConnect} disabled={busy}
        style={{ padding: '7px 14px', background: connected ? COLORS.cardAlt : COLORS.primary, color: connected ? COLORS.text : '#fff', border: connected ? `1px solid ${COLORS.border}` : 'none', borderRadius: 5, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 }}>
        {busy ? '…' : connected ? 'Reconnect' : 'Connect'}
      </button>
    </div>
  );
}

function WorkspaceSection() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    if (!window.confirm('Re-run workspace classification on every record? Records already stamped with a workspace keep their current value — only unstamped records get classified.')) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const result = await migrateWorkspaceBackfill({ force: true });
      const counts = result?.counts || {};
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const detail = Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(', ');
      setStatus(total === 0 ? 'All records already classified — nothing to update.' : `Classified ${total} records (${detail}).`);
    } catch (err) {
      setError(err.message || 'Reclassification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Workspaces" subtitle="CRM (clients + deals) and Deal Flow (practitioners, firms, targets, referrals) live in the same database, tagged by a `workspace` field on each record.">
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}>
        Run this if new records ever show up in the wrong workspace. It uses the default heuristic — People → Deal Flow, Companies → CRM, Interviews → Deal Flow, Targets → Deal Flow, Deals → CRM — and only stamps records that don't already have a workspace set.
      </div>
      <button onClick={run} disabled={busy}
        style={{ padding: '8px 14px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: busy ? 0.5 : 1 }}>
        {busy ? 'Reclassifying…' : 'Reclassify unstamped records'}
      </button>
      {status && <div style={{ marginTop: 10, fontSize: 12, color: COLORS.success }}>{status}</div>}
      {error && <div style={{ marginTop: 10, fontSize: 12, color: COLORS.danger }}>{error}</div>}
    </Section>
  );
}

function DedupBackfillSection() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  const run = async () => {
    if (!window.confirm(
      'Backfill dedup fields on every person, company, and interview?\n\n'
      + 'This adds normalized email / name / phone fields and scaffolding for the '
      + 'interview-ingestion dedup pipeline. Additive only — no existing data is '
      + 'overwritten. Safe to re-run.',
    )) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    setProgress(null);
    try {
      const result = await migrateDedupFields({
        force: true,
        onProgress: (evt) => setProgress(evt),
      });
      const counts = result?.counts || {};
      const totals = result?.totals || {};
      const detail = Object.entries(counts)
        .map(([k, n]) => `${k}: ${n}/${totals[k] ?? '?'} updated`)
        .join(' · ');
      const totalUpdated = Object.values(counts).reduce((a, b) => a + b, 0);
      setStatus(totalUpdated === 0
        ? `All records already have dedup fields (${totals.people || 0} people, ${totals.companies || 0} companies, ${totals.interviews || 0} interviews scanned).`
        : `Backfill complete — ${detail}.`);
    } catch (err) {
      setError(err.message || 'Dedup backfill failed.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <Section title="Dedup Fields" subtitle="Backfill normalized email, name, and phone fields on all people, companies, and interviews. Required before interview-ingestion dedup (Sprint 3+) goes live.">
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}>
        Additive only — adds <code>emailNormalized</code>, <code>fullNameNormalized</code>, <code>phoneNormalized</code> to people;
        {' '}<code>nameNormalized</code>, <code>contactIds</code> to companies; and <code>extractedEntity</code>, <code>dedupResolution</code>,
        {' '}<code>sourceIngestionJobId</code> to interviews. Idempotent — safe to re-run if you add records.
      </div>
      <button onClick={run} disabled={busy}
        style={{ padding: '8px 14px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: busy ? 0.5 : 1 }}>
        {busy ? 'Backfilling…' : 'Backfill dedup fields'}
      </button>
      {progress && (
        <div style={{ marginTop: 10, fontSize: 11, color: COLORS.textMuted }}>
          {progress.collection}: {progress.processed} / {progress.total}
        </div>
      )}
      {status && <div style={{ marginTop: 10, fontSize: 12, color: COLORS.success }}>{status}</div>}
      {error && <div style={{ marginTop: 10, fontSize: 12, color: COLORS.danger }}>{error}</div>}
    </Section>
  );
}

function ShortcutsSection() {
  const items = [
    { keys: ['⌘', 'K'], desc: 'Open command palette / search' },
    { keys: ['⌘', 'N'], desc: 'New record on current list (People, Companies, Interviews, Deals, Targets, Tasks)' },
    { keys: ['⌘', '/'], desc: 'Show keyboard shortcuts (this section)' },
    { keys: ['?'], desc: 'Focus list search input' },
    { keys: ['Esc'], desc: 'Close modal / palette' },
  ];
  return (
    <Section title="Keyboard shortcuts" subtitle="Tap ⌘/ anywhere to jump here.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
            <div style={{ fontSize: 13, color: COLORS.text }}>{it.desc}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {it.keys.map((k, j) => (
                <kbd key={j} style={{ padding: '2px 8px', background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 11, fontFamily: 'ui-monospace, monospace', color: COLORS.text, fontWeight: 600 }}>
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function PipelinesSection() {
  const { data: pipelines, loading } = useCollection('pipelines');
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => [...pipelines].sort((a, b) => {
    if (a.is_default && !b.is_default) return -1;
    if (!a.is_default && b.is_default) return 1;
    return (a.name || '').localeCompare(b.name || '');
  }), [pipelines]);

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    const id = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `pipeline_${Date.now()}`;
    const slug = pipelines.find((p) => p.id === id) ? `${id}_${Date.now().toString(36).slice(-3)}` : id;
    await createDoc('pipelines', {
      name: newName.trim(),
      is_default: false,
      object_type: 'deal',
      stages: [
        { id: 'stage_1', label: 'Stage 1', probability: 0.3, order: 0, is_won: false, is_lost: false },
        { id: 'closed_won', label: 'Closed-Won', probability: 1.0, order: 1, is_won: true, is_lost: false },
        { id: 'closed_lost', label: 'Closed-Lost', probability: 0.0, order: 2, is_won: false, is_lost: true },
      ],
    }, slug);
    setNewName('');
    setCreating(false);
    setEditingId(slug);
    setBusy(false);
  };

  return (
    <Section title="Pipelines" subtitle="Deal pipelines and stages. The ★ pipeline is the default used by the Convert wizard.">
      {loading ? (
        <div style={{ color: COLORS.textDim, fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((p) => (
            <PipelineRow key={p.id} pipeline={p}
              editing={editingId === p.id}
              onEdit={() => setEditingId(p.id)}
              onClose={() => setEditingId(null)}
              canDelete={!p.is_default && pipelines.length > 1}
              pipelines={pipelines} />
          ))}
        </div>
      )}

      {creating ? (
        <div style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Pipeline name (e.g. Renewals)" autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') { setCreating(false); setNewName(''); } }}
            style={{ flex: 1, padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13 }} />
          <button onClick={create} disabled={busy || !newName.trim()}
            style={{ padding: '8px 14px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: busy || !newName.trim() ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: busy || !newName.trim() ? 0.5 : 1 }}>
            Create
          </button>
          <button onClick={() => { setCreating(false); setNewName(''); }}
            style={{ padding: '8px 12px', background: 'none', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setCreating(true)}
          style={{ marginTop: 12, padding: '8px 14px', background: 'transparent', color: COLORS.primary, border: `1px dashed ${COLORS.primary}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          + New pipeline
        </button>
      )}
    </Section>
  );
}

function PipelineRow({ pipeline, editing, onEdit, onClose, canDelete, pipelines }) {
  const [name, setName] = useState(pipeline.name);
  const [stages, setStages] = useState(pipeline.stages || []);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setName(pipeline.name);
    setStages(pipeline.stages || []);
  }, [pipeline]);

  const save = async () => {
    setSaving(true);
    try {
      const normalized = stages.map((s, i) => ({
        ...s,
        order: i,
        probability: Number.isFinite(Number(s.probability)) ? Number(s.probability) : 0,
      }));
      await updateDoc('pipelines', pipeline.id, { name: name.trim(), stages: normalized });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async () => {
    // Clear existing default, set this one.
    const existing = pipelines.filter((p) => p.is_default && p.id !== pipeline.id);
    for (const p of existing) {
      await updateDoc('pipelines', p.id, { is_default: false });
    }
    await updateDoc('pipelines', pipeline.id, { is_default: true });
  };

  const removeStage = (idx) => {
    setStages(stages.filter((_, i) => i !== idx));
  };
  const addStage = () => {
    const id = `stage_${Date.now().toString(36)}`;
    setStages([...stages, { id, label: 'New stage', probability: 0.5, order: stages.length, is_won: false, is_lost: false }]);
  };
  const moveStage = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= stages.length) return;
    const next = [...stages];
    [next[idx], next[j]] = [next[j], next[idx]];
    setStages(next);
  };
  const updateStage = (idx, patch) => {
    setStages(stages.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const del = async () => {
    if (!window.confirm(`Delete pipeline "${pipeline.name}"? Deals using it will be orphaned.`)) return;
    await deleteDoc('pipelines', pipeline.id);
  };

  return (
    <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12, background: COLORS.cardAlt }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editing ? 10 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {editing ? (
            <input value={name} onChange={(e) => setName(e.target.value)}
              style={{ padding: '5px 8px', border: `1px solid ${COLORS.primary}`, borderRadius: 4, fontSize: 14, fontWeight: 700 }} />
          ) : (
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{pipeline.name}</div>
          )}
          {pipeline.is_default && <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.accent, background: COLORS.accentLight, padding: '2px 6px', borderRadius: 3 }}>★ DEFAULT</span>}
          <span style={{ fontSize: 11, color: COLORS.textMuted }}>{(pipeline.stages || []).length} stages</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {editing ? (
            <>
              <button onClick={save} disabled={saving}
                style={{ padding: '5px 12px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {saving ? 'Saving…' : '✓ Save'}
              </button>
              <button onClick={onClose}
                style={{ padding: '5px 10px', background: 'none', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {!pipeline.is_default && (
                <button onClick={makeDefault}
                  style={{ padding: '5px 10px', background: 'none', color: COLORS.accent, border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                  Make default
                </button>
              )}
              <button onClick={onEdit}
                style={{ padding: '5px 10px', background: COLORS.blueLight, color: COLORS.blue, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                Edit
              </button>
              {canDelete && (
                <button onClick={del}
                  style={{ padding: '5px 10px', background: 'none', color: COLORS.danger, border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stages.map((s, idx) => (
            <div key={s.id || idx} style={{ display: 'grid', gridTemplateColumns: '24px 1.5fr 80px auto auto', gap: 6, alignItems: 'center', padding: 6, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 5 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <button onClick={() => moveStage(idx, -1)} disabled={idx === 0}
                  style={{ padding: 0, width: 20, height: 14, background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 11, opacity: idx === 0 ? 0.3 : 1 }}>▲</button>
                <button onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1}
                  style={{ padding: 0, width: 20, height: 14, background: 'none', border: 'none', cursor: idx === stages.length - 1 ? 'default' : 'pointer', fontSize: 11, opacity: idx === stages.length - 1 ? 0.3 : 1 }}>▼</button>
              </div>
              <input value={s.label} onChange={(e) => updateStage(idx, { label: e.target.value })}
                style={{ padding: '5px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 12 }} />
              <input type="number" step="0.1" min="0" max="1" value={s.probability} onChange={(e) => updateStage(idx, { probability: e.target.value })}
                style={{ padding: '5px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 12 }} />
              <div style={{ display: 'flex', gap: 6, fontSize: 10, color: COLORS.textMuted }}>
                <label style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <input type="checkbox" checked={!!s.is_won} onChange={(e) => updateStage(idx, { is_won: e.target.checked, is_lost: e.target.checked ? false : s.is_lost })} />
                  Won
                </label>
                <label style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <input type="checkbox" checked={!!s.is_lost} onChange={(e) => updateStage(idx, { is_lost: e.target.checked, is_won: e.target.checked ? false : s.is_won })} />
                  Lost
                </label>
              </div>
              <button onClick={() => removeStage(idx)}
                style={{ padding: '3px 8px', background: 'none', color: COLORS.danger, border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                ✕
              </button>
            </div>
          ))}
          <button onClick={addStage}
            style={{ padding: '6px 10px', background: 'transparent', color: COLORS.primary, border: `1px dashed ${COLORS.primary}`, borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            + Add stage
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {(pipeline.stages || []).map((s) => (
            <span key={s.id}
              style={{ padding: '2px 8px', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, fontSize: 11, color: COLORS.textMuted }}>
              {s.label} {Math.round((s.probability || 0) * 100)}%{s.is_won ? ' ✓' : s.is_lost ? ' ✕' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TagsSection() {
  const { data: tags, loading } = useCollection('tags');
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [scope, setScope] = useState('any');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!label.trim()) return;
    setBusy(true);
    await createTag({ label: label.trim(), color, scope });
    setLabel('');
    setBusy(false);
  };

  return (
    <Section title="Tags" subtitle="Labels for People and Companies.">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New tag label"
          onKeyDown={(e) => e.key === 'Enter' && add()}
          style={{ flex: '1 1 180px', padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13 }} />
        <select value={scope} onChange={(e) => setScope(e.target.value)}
          style={{ padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, background: '#fff' }}>
          <option value="any">Any</option>
          <option value="person">People only</option>
          <option value="company">Companies only</option>
        </select>
        <ColorPicker value={color} onChange={setColor} />
        <button onClick={add} disabled={busy || !label.trim()}
          style={{ padding: '8px 14px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: busy || !label.trim() ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: busy || !label.trim() ? 0.5 : 1 }}>
          Add
        </button>
      </div>

      {loading ? (
        <div style={{ color: COLORS.textDim, fontSize: 13 }}>Loading…</div>
      ) : tags.length === 0 ? (
        <div style={{ color: COLORS.textDim, fontSize: 13, fontStyle: 'italic' }}>No tags yet. Create one above.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tags.map((t) => <TagRow key={t.id} tag={t} />)}
        </div>
      )}
    </Section>
  );
}

function TagRow({ tag }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(tag.label);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, border: `1px solid ${COLORS.border}`, borderRadius: 6, background: COLORS.cardAlt }}>
      <ColorPicker value={tag.color} onChange={(c) => recolorTag(tag.id, c)} small />
      {editing ? (
        <input value={label} onChange={(e) => setLabel(e.target.value)}
          onBlur={() => { if (label.trim() && label !== tag.label) renameTag(tag.id, label.trim()); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setLabel(tag.label); setEditing(false); } }}
          autoFocus
          style={{ flex: 1, padding: '4px 8px', border: `1px solid ${COLORS.primary}`, borderRadius: 4, fontSize: 13 }} />
      ) : (
        <button onClick={() => setEditing(true)}
          style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: COLORS.text, padding: '4px 8px' }}>
          <span style={{ background: tag.color, color: '#fff', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{tag.label}</span>
        </button>
      )}
      <select value={tag.scope || 'any'} onChange={(e) => changeTagScope(tag.id, e.target.value)}
        style={{ padding: '4px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 12, background: '#fff' }}>
        <option value="any">Any</option>
        <option value="person">People</option>
        <option value="company">Companies</option>
      </select>
      <button onClick={() => { if (window.confirm(`Delete tag "${tag.label}"?`)) removeTag(tag.id); }}
        style={{ padding: '4px 10px', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, color: COLORS.danger }}>
        Delete
      </button>
    </div>
  );
}

function ColorPicker({ value, onChange, small }) {
  const [open, setOpen] = useState(false);
  const size = small ? 16 : 22;
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((v) => !v)}
        style={{ width: size, height: size, background: value, border: `1px solid ${COLORS.border}`, borderRadius: '50%', cursor: 'pointer', padding: 0 }} />
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: 'absolute', top: size + 6, left: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: 8, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4, zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {TAG_COLORS.map((c) => (
              <button key={c} onClick={() => { onChange(c); setOpen(false); }}
                style={{ width: 22, height: 22, background: c, border: value === c ? `2px solid ${COLORS.text}` : `1px solid ${COLORS.border}`, borderRadius: '50%', cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ color: COLORS.text }}>{value}</span>
    </div>
  );
}
