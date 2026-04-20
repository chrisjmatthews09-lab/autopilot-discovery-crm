import { createDoc, updateDoc } from './firestore';

const newId = () => `int-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const CONTACT_KINDS = new Set(['note', 'call', 'email', 'meeting']);

export async function logInteraction({ kind, entity_type, entity_id, title, body = '', from_stage = null, to_stage = null, meta = {} }) {
  const id = newId();
  const occurred_at = new Date().toISOString();
  await createDoc('interactions', {
    kind,
    entity_type,
    entity_id,
    title: title || '',
    body: body || '',
    from_stage,
    to_stage,
    meta,
    occurred_at,
  }, id);

  // Auto-update last_contact_date on Targets when a contact interaction is logged.
  if (entity_type === 'target' && entity_id && CONTACT_KINDS.has(kind)) {
    try { await updateDoc('targets', entity_id, { last_contact_date: occurred_at }); } catch { /* ignore */ }
  }
  if (meta && meta.related_target_id && CONTACT_KINDS.has(kind)) {
    try { await updateDoc('targets', meta.related_target_id, { last_contact_date: occurred_at }); } catch { /* ignore */ }
  }

  return id;
}

export const INTERACTION_KINDS = [
  { value: 'note', label: 'Note', icon: '📝' },
  { value: 'call', label: 'Call', icon: '📞' },
  { value: 'email', label: 'Email', icon: '✉️' },
  { value: 'meeting', label: 'Meeting', icon: '🤝' },
  { value: 'stage_change', label: 'Stage change', icon: '🔄' },
];

export function kindMeta(kind) {
  return INTERACTION_KINDS.find((k) => k.value === kind) || { value: kind, label: kind, icon: '•' };
}
