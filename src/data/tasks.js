import { createDoc, updateDoc, deleteDoc, batchWrite } from './firestore';

const newId = () => `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const RELATED_KEYS = {
  person: 'related_person_id',
  company: 'related_company_id',
  interview: 'related_interview_id',
  deal: 'related_deal_id',
  target: 'related_target_id',
};

export async function createTask({ title, description_md = '', due_date = null, priority = 'P2', status = 'Open', assignee = 'Chris', related = null, workspace = 'crm' }) {
  const id = newId();
  const data = {
    title: (title || '').trim(),
    description_md,
    due_date,
    status,
    priority,
    assignee,
    related_person_id: null,
    related_company_id: null,
    related_interview_id: null,
    related_deal_id: null,
    related_target_id: null,
    completed_at: null,
    workspace,
  };
  if (related && RELATED_KEYS[related.type]) data[RELATED_KEYS[related.type]] = related.id;
  await createDoc('tasks', data, id);
  return id;
}

export async function updateTask(id, patch) {
  const next = { ...patch };
  if (patch.status === 'Done' && !patch.completed_at) next.completed_at = new Date().toISOString();
  if (patch.status && patch.status !== 'Done') next.completed_at = null;
  await updateDoc('tasks', id, next);
}

export async function deleteTask(id) {
  await deleteDoc('tasks', id);
}

export async function bulkUpdateTasks(ids, patch) {
  const base = { ...patch };
  if (patch.status === 'Done') base.completed_at = new Date().toISOString();
  if (patch.status && patch.status !== 'Done') base.completed_at = null;
  const ops = ids.map((id) => ({ type: 'update', collection: 'tasks', id, data: base }));
  await batchWrite(ops);
}

export function isOverdue(task) {
  if (!task.due_date || task.status === 'Done' || task.status === 'Cancelled') return false;
  const due = new Date(task.due_date);
  return due.getTime() < new Date().setHours(0, 0, 0, 0);
}

export function isDueThisWeek(task) {
  if (!task.due_date || task.status === 'Done' || task.status === 'Cancelled') return false;
  const due = new Date(task.due_date).getTime();
  const start = new Date().setHours(0, 0, 0, 0);
  const end = start + 7 * 24 * 60 * 60 * 1000;
  return due >= start && due < end;
}
