import { createDoc, updateDoc, deleteDoc } from './firestore';

const newId = () => `target-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const RELATIONSHIP_STRENGTHS = ['Cold', 'Warm', 'Hot'];

export const RELATIONSHIP_COLORS = {
  Cold: { bg: '#EEF2F7', fg: '#475569' },
  Warm: { bg: '#FBF6E8', fg: '#9A7B2C' },
  Hot:  { bg: '#FFF0EB', fg: '#C4552D' },
};

export const INTRO_PATH_STRENGTHS = ['weak', 'moderate', 'strong'];

export async function createTarget(data) {
  const id = data.id || newId();
  const now = new Date().toISOString();
  const payload = {
    company_id: null,
    owner_person_id: null,
    pipeline_id: 'ma_targets',
    stage_id: 'sourced',
    est_revenue: 0,
    est_ebitda: 0,
    bid_multiple: 0,
    introduction_paths: [],
    relationship_strength: 'Cold',
    last_contact_date: null,
    next_touch_date: null,
    vdr_url: null,
    notes_md: '',
    status: 'Open',
    owner: 'Chris',
    stage_changed_at: now,
    ...data,
  };
  delete payload.id;
  await createDoc('targets', payload, id);
  return id;
}

export async function updateTarget(id, patch) {
  await updateDoc('targets', id, patch);
}

export async function deleteTarget(id) {
  await deleteDoc('targets', id);
}

export async function moveTargetStage(target, newStageId, extras = {}) {
  const patch = {
    stage_id: newStageId,
    stage_changed_at: new Date().toISOString(),
    ...extras,
  };
  await updateDoc('targets', target.id, patch);
}

export function estimatedEV(target) {
  const rev = Number(target?.est_revenue) || 0;
  const mult = Number(target?.bid_multiple) || 0;
  return rev * mult;
}

export function daysSinceLastTouch(target) {
  if (!target?.last_contact_date) return null;
  const ms = new Date(target.last_contact_date).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
}

export function isGoingCold(target, thresholdDays = 60) {
  if (!target) return false;
  if (target.status === 'Won' || target.status === 'Lost' || target.status === 'Passed') return false;
  const days = daysSinceLastTouch(target);
  return days === null || days > thresholdDays;
}
