import { batchWrite } from './firestore';
import template from './diligence-template.json';

const makeId = () => `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const DILIGENCE_TEMPLATE = template;
export const DILIGENCE_CATEGORIES = Array.from(new Set(template.map((t) => t.category)));
export const DILIGENCE_TASK_COUNT = template.length;

// Generate diligence tasks for a target via a single batch write.
// Each task gets related_target_id + a "Diligence" tag in meta + category in title prefix.
export async function generateDiligenceTasks(targetId, { assignee = 'Chris', due_date = null } = {}) {
  if (!targetId) throw new Error('targetId required');
  const now = new Date().toISOString();
  const ops = template.map((t, i) => ({
    type: 'set',
    collection: 'tasks',
    id: makeId() + `-${i}`,
    data: {
      title: t.title,
      description_md: t.description,
      due_date,
      status: 'Open',
      priority: t.priority || 'P2',
      assignee,
      related_person_id: null,
      related_company_id: null,
      related_interview_id: null,
      related_deal_id: null,
      related_target_id: targetId,
      completed_at: null,
      category: t.category,
      source: 'diligence_template',
      source_created_at: now,
    },
  }));
  await batchWrite(ops);
  return ops.length;
}
