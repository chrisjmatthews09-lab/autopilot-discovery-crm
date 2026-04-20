// Sprint 8 — Contacts list on the Business detail page.
//
// Lists all people linked to the company, shows a "Primary" badge for
// company.primaryContactId (fallback: oldest active contact), surfaces
// per-contact interview/last-interaction summaries, and offers:
//   - View  → navigate into the person detail
//   - Set as primary → writes company.primaryContactId
//   - + Add Contact → inline modal creating a new person tied to the company

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '../config/design-tokens';
import { createDoc, updateDoc } from '../data/firestore';
import { getInterviewDate } from '../lib/interviewFields.js';

function toMs(v) {
  if (!v) return 0;
  if (typeof v === 'object' && v.seconds) return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function shortDate(value) {
  if (!value) return null;
  const d = new Date(typeof value === 'object' && value.seconds ? value.seconds * 1000 : value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function interviewBelongsToPerson(interview, personId) {
  if (!interview || !personId) return false;
  if (interview.linkedType === 'person' && interview.linkedContactId === personId) return true;
  if (interview.dedupResolution?.matchedContactId === personId) return true;
  return false;
}

/**
 * @param {object} props
 * @param {object} props.company           The company row being viewed.
 * @param {Array}  props.contacts          People records linked to the company.
 * @param {Array}  props.interviews        All interviews (filtered here).
 * @param {Array}  props.interactions      All interactions (filtered here).
 * @param {string} props.workspaceId       'crm' | 'deal_flow' (for new rows).
 * @param {(personId:string) => void} [props.onNavigate]  Optional nav override.
 */
export default function CompanyContactsSection({ company, contacts, interviews, interactions, workspaceId, onNavigate }) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const primaryId = useMemo(() => {
    if (company?.primaryContactId && contacts.some((c) => c.id === company.primaryContactId)) {
      return company.primaryContactId;
    }
    const sorted = [...contacts].sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
    return sorted[0]?.id || null;
  }, [company?.primaryContactId, contacts]);

  const statsByContact = useMemo(() => {
    const map = new Map();
    contacts.forEach((c) => map.set(c.id, { interviewCount: 0, lastTs: 0 }));
    (interviews || []).forEach((iv) => {
      contacts.forEach((c) => {
        if (interviewBelongsToPerson(iv, c.id)) {
          const entry = map.get(c.id);
          entry.interviewCount += 1;
          const ts = toMs(getInterviewDate(iv));
          if (ts > entry.lastTs) entry.lastTs = ts;
        }
      });
    });
    (interactions || []).forEach((it) => {
      if (it.entity_type !== 'person') return;
      const entry = map.get(it.entity_id);
      if (!entry) return;
      const ts = toMs(it.occurred_at || it.createdAt);
      if (ts > entry.lastTs) entry.lastTs = ts;
    });
    return map;
  }, [contacts, interviews, interactions]);

  const handleSetPrimary = async (personId) => {
    if (personId === primaryId) return;
    setBusyId(personId);
    try {
      await updateDoc('companies', company.id, { primaryContactId: personId });
    } catch (err) {
      console.error(err);
      alert('Failed to set primary — check console.');
    } finally {
      setBusyId(null);
    }
  };

  const openPerson = (p) => {
    if (onNavigate) onNavigate(p.id);
    else {
      const base = (p.workspace || 'deal_flow') === 'crm' ? '/crm/people' : '/deal-flow/practitioners';
      navigate(`${base}/${p.id}`);
    }
  };

  const label = (company?.workspace || workspaceId || 'deal_flow') === 'deal_flow' ? 'Practitioners' : 'People';

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
          👥 {label} ({contacts.length})
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} style={btnPrimary}>+ Add Contact</button>
        )}
      </div>

      {adding && (
        <AddContactForm
          company={company}
          workspaceId={workspaceId}
          onDone={() => setAdding(false)}
        />
      )}

      {contacts.length === 0 ? (
        <div style={{
          fontSize: 13, color: COLORS.textDim, fontStyle: 'italic',
          padding: '18px 14px', textAlign: 'center',
          background: COLORS.cardAlt, border: `1px dashed ${COLORS.border}`, borderRadius: 8,
        }}>
          No contacts yet. Add one to start tracking calls, notes and interviews against this business.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {contacts.map((p) => {
            const stats = statsByContact.get(p.id) || { interviewCount: 0, lastTs: 0 };
            const isPrimary = p.id === primaryId;
            return (
              <div key={p.id} style={{
                padding: '10px 12px',
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                background: COLORS.card,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{p.name || '(Unnamed)'}</span>
                    {isPrimary && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, background: '#E8F0FE',
                        color: '#1A4D99', fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: 0.3,
                      }}>Primary</span>
                    )}
                    {p.role && <span style={{ fontSize: 12, color: COLORS.textMuted }}>· {p.role}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 3 }}>
                    {p.email && <>{p.email}</>}
                    {stats.interviewCount > 0 && <> · {stats.interviewCount} interview{stats.interviewCount === 1 ? '' : 's'}</>}
                    {stats.lastTs > 0 && <> · last {shortDate(stats.lastTs)}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!isPrimary && (
                    <button
                      onClick={() => handleSetPrimary(p.id)}
                      disabled={busyId === p.id}
                      style={ghostBtn}
                    >
                      {busyId === p.id ? 'Saving…' : 'Set primary'}
                    </button>
                  )}
                  <button onClick={() => openPerson(p)} style={ghostBtn}>View →</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddContactForm({ company, workspaceId, onDone }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { alert('Name is required.'); return; }
    setSaving(true);
    try {
      const newId = `person-${Date.now()}`;
      await createDoc('people', {
        workspace: company?.workspace || workspaceId || 'deal_flow',
        name: name.trim(),
        company: company?.name || company?.company || '',
        company_id: company?.id || null,
        role: role.trim(),
        email: email.trim(),
        phone: phone.trim(),
        lifecycle_stage: 'Research-Contact',
      }, newId);
      onDone();
    } catch (err) {
      console.error(err);
      alert('Failed to create contact — check console.');
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: COLORS.cardAlt, border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: 12, marginBottom: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, marginBottom: 8 }}>➕ New contact</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name *" style={inputStyle} autoFocus />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" style={inputStyle} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" style={inputStyle} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={save} disabled={saving} style={btnSuccess(saving)}>
          {saving ? 'Saving…' : 'Create contact'}
        </button>
        <button onClick={onDone} style={btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

const btnPrimary = { padding: '6px 12px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 600 };
const btnSuccess = (saving) => ({ padding: '6px 14px', background: saving ? COLORS.border : COLORS.success, color: '#fff', border: 'none', borderRadius: 5, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600 });
const btnGhost = { padding: '6px 14px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 12 };
const ghostBtn = { padding: '4px 10px', background: 'transparent', border: `1px solid ${COLORS.border}`, borderRadius: 4, cursor: 'pointer', fontSize: 11, color: COLORS.textMuted };
const inputStyle = { padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 13, background: COLORS.card, color: COLORS.text, width: '100%', boxSizing: 'border-box' };
