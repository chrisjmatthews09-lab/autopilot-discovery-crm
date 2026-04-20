import { createDoc, updateDoc, deleteDoc } from './firestore';

const newId = () => `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const VIEW_OBJECT_TYPES = ['person', 'company', 'interview', 'deal', 'target'];

// Workspace-aware route lookup. Pinned views carry a `workspace` so a saved filter
// over Practitioners (deal_flow) doesn't route to CRM People.
export const VIEW_OBJECT_ROUTES_BY_WS = {
  crm: {
    person: '/crm/people',
    company: '/crm/companies',
    interview: '/crm/interviews',
    deal: '/crm/deals',
    target: '/deal-flow/targets',
  },
  deal_flow: {
    person: '/deal-flow/practitioners',
    company: '/deal-flow/firms',
    interview: '/deal-flow/interviews',
    deal: '/crm/deals',
    target: '/deal-flow/targets',
  },
};

// Legacy flat lookup — defaults to CRM. Retained for back-compat with any
// callers that haven't been updated yet.
export const VIEW_OBJECT_ROUTES = VIEW_OBJECT_ROUTES_BY_WS.crm;

export function viewRoute(view) {
  const ws = view?.workspace || 'crm';
  const map = VIEW_OBJECT_ROUTES_BY_WS[ws] || VIEW_OBJECT_ROUTES_BY_WS.crm;
  return map[view?.object_type] || null;
}

export const VIEW_OBJECT_ICONS = {
  person: '👥',
  company: '🏢',
  interview: '🎙️',
  deal: '💼',
  target: '🎯',
};

export async function createView({ name, object_type, filters = {}, sort = null, visible_columns = null, workspace = 'crm' }) {
  const id = newId();
  const payload = {
    name: (name || '').trim() || 'Untitled view',
    object_type,
    workspace,
    filters_json: JSON.stringify(filters || {}),
    sort_json: sort ? JSON.stringify(sort) : null,
    visible_columns: visible_columns || null,
    pinned: true,
  };
  await createDoc('views', payload, id);
  return id;
}

export async function updateView(id, patch) {
  const next = { ...patch };
  if (next.filters && typeof next.filters === 'object') {
    next.filters_json = JSON.stringify(next.filters);
    delete next.filters;
  }
  if (next.sort && typeof next.sort === 'object') {
    next.sort_json = JSON.stringify(next.sort);
    delete next.sort;
  }
  await updateDoc('views', id, next);
}

export async function deleteView(id) {
  await deleteDoc('views', id);
}

export function parseFilters(view) {
  if (!view || !view.filters_json) return {};
  try { return JSON.parse(view.filters_json) || {}; } catch { return {}; }
}

export function parseSort(view) {
  if (!view || !view.sort_json) return null;
  try { return JSON.parse(view.sort_json); } catch { return null; }
}

// Encode a filters object into a URL query string. Arrays are joined with commas.
export function encodeFiltersToSearch(filters) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters || {})) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      sp.set(k, v.join(','));
    } else if (typeof v === 'boolean') {
      if (v) sp.set(k, '1');
    } else {
      sp.set(k, String(v));
    }
  }
  return sp.toString();
}

// Read a filter from URLSearchParams; arrays auto-split by comma.
export function readFilter(searchParams, key, { asArray = false, asBool = false, fallback = null } = {}) {
  const raw = searchParams.get(key);
  if (raw === null) return fallback;
  if (asBool) return raw === '1' || raw === 'true';
  if (asArray) return raw.split(',').filter(Boolean);
  return raw;
}
