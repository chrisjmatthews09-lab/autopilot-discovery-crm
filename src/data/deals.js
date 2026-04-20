import { createDoc, updateDoc, deleteDoc, batchWrite } from './firestore';

const newId = () => `deal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export async function createDeal(data) {
  const id = data.id || newId();
  const now = new Date().toISOString();
  const payload = {
    name: '',
    company_id: null,
    primary_person_id: null,
    pipeline_id: 'new_client',
    stage_id: 'discovery',
    amount_mrr: 0,
    amount_setup: 0,
    package: null,
    expected_close_date: null,
    actual_close_date: null,
    status: 'Open',
    lost_reason: null,
    notes_md: '',
    buying_committee: [],
    owner: 'Chris',
    stage_changed_at: now,
    ...data,
  };
  delete payload.id;
  await createDoc('deals', payload, id);
  return id;
}

export async function updateDeal(id, patch) {
  await updateDoc('deals', id, patch);
}

export async function deleteDeal(id) {
  await deleteDoc('deals', id);
}

export async function moveDealStage(deal, newStageId, extras = {}) {
  const patch = {
    stage_id: newStageId,
    stage_changed_at: new Date().toISOString(),
    ...extras,
  };
  await updateDoc('deals', deal.id, patch);
}

export function daysInStage(deal) {
  if (!deal.stage_changed_at) return 0;
  const ms = new Date(deal.stage_changed_at).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
}

export function findStage(pipeline, stageId) {
  return pipeline?.stages?.find((s) => s.id === stageId) || null;
}

export function getDefaultPipeline(pipelines) {
  return pipelines.find((p) => p.is_default) || pipelines[0] || null;
}

export function stageIndex(pipeline, stageId) {
  return (pipeline?.stages || []).findIndex((s) => s.id === stageId);
}
