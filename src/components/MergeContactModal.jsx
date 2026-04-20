// Sprint 9 — Two-step merge flow: pick target → preview → confirm.
//
// Step 1 reuses ContactPickerModal to pick a target from the same
// workspace/appType pool. Step 2 surfaces a preview ("N interviews, M calls,
// P notes will move") with a warning that the action isn't auto-reversible
// outside of the Recently-merged undo button.

import React, { useState, useMemo } from 'react';
import { COLORS } from '../config/design-tokens';
import ContactPickerModal from './ContactPickerModal.jsx';
import { mergeContacts } from '../data/merges';
import { useCollection } from '../hooks/useCollection';

function interviewBelongsTo(iv, kind, id) {
  if (!iv || !id) return false;
  if (iv.linkedType === kind && iv.linkedContactId === id) return true;
  const r = iv.dedupResolution;
  if (!r) return false;
  if (kind === 'person' && r.matchedContactId === id) return true;
  if (kind === 'company' && r.matchedBusinessId === id) return true;
  return false;
}

export default function MergeContactModal({ sourceContact, kind, candidates, onClose, onMerged }) {
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const { data: interviews } = useCollection('interviews');
  const { data: interactions } = useCollection('interactions');

  const preview = useMemo(() => {
    if (!sourceContact) return null;
    const ivs = (interviews || []).filter((iv) => interviewBelongsTo(iv, kind, sourceContact.id));
    const its = (interactions || []).filter((it) => it.entity_type === kind && it.entity_id === sourceContact.id);
    const calls = its.filter((it) => it.kind === 'call').length;
    const notes = its.filter((it) => it.kind === 'note').length;
    return { interviews: ivs.length, calls, notes, other: its.length - calls - notes };
  }, [interviews, interactions, kind, sourceContact]);

  const handleConfirm = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const result = await mergeContacts({ sourceId: sourceContact.id, targetId: target.id, kind });
      onMerged?.(target, result.mergeId);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Merge failed.');
      setBusy(false);
    }
  };

  if (!target) {
    return (
      <ContactPickerModal
        title={`Merge "${sourceContact.name || '(unnamed)'}" into…`}
        contacts={candidates}
        onSelect={setTarget}
        onClose={onClose}
        disabled={(c) => c.id === sourceContact.id}
        confirmLabel="Preview merge"
      />
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.card, borderRadius: 10, padding: 22,
          width: 520, maxWidth: '94%', border: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 10 }}>
          Confirm merge
        </div>
        <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.55, marginBottom: 14 }}>
          <strong>{sourceContact.name || '(unnamed)'}</strong> and all of its records will be merged into{' '}
          <strong>{target.name || '(unnamed)'}</strong>.
        </div>
        {preview && (
          <ul style={{ margin: '0 0 14px', padding: '0 0 0 18px', color: COLORS.textMuted, fontSize: 13, lineHeight: 1.6 }}>
            <li>{preview.interviews} interview{preview.interviews === 1 ? '' : 's'} move to target</li>
            <li>{preview.calls} call{preview.calls === 1 ? '' : 's'} move to target</li>
            <li>{preview.notes} note{preview.notes === 1 ? '' : 's'} move to target</li>
            {preview.other > 0 && <li>{preview.other} other interaction{preview.other === 1 ? '' : 's'} move to target</li>}
            <li>Source contact is soft-deleted and removed from lists</li>
            <li>Missing fields on the target are filled from the source</li>
          </ul>
        )}
        <div style={{
          padding: '8px 10px', background: '#FEF3C7', color: '#92400E',
          borderRadius: 6, fontSize: 12, marginBottom: 14,
        }}>
          ⚠ This cannot be undone automatically. You can reverse it from Settings → Recently merged.
        </div>
        {error && (
          <div style={{ padding: '8px 10px', background: '#FEE2E2', color: COLORS.danger, borderRadius: 6, fontSize: 12, marginBottom: 14 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={() => setTarget(null)} style={btnGhost} disabled={busy}>← Back</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btnGhost} disabled={busy}>Cancel</button>
            <button onClick={handleConfirm} style={btnDanger(busy)} disabled={busy}>
              {busy ? 'Merging…' : 'Confirm merge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const btnGhost = { padding: '8px 14px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 13 };
const btnDanger = (busy) => ({ padding: '8px 14px', background: busy ? COLORS.border : COLORS.danger, color: '#fff', border: 'none', borderRadius: 5, cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 });
