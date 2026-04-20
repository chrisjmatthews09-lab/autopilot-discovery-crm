import { COLORS } from './design-tokens';

export const LIFECYCLE_STAGES = [
  'Research-Contact',
  'Subscriber',
  'Lead',
  'MQL',
  'SQL',
  'Opportunity',
  'Customer',
  'Evangelist',
];

export const LIFECYCLE_STAGE_COLORS = {
  'Research-Contact': { bg: COLORS.purpleLight, fg: COLORS.purple },
  'Subscriber':       { bg: '#F5F5F4',           fg: COLORS.textMuted },
  'Lead':             { bg: COLORS.blueLight,    fg: COLORS.blue },
  'MQL':              { bg: '#D6E5F4',           fg: '#13477A' },
  'SQL':              { bg: COLORS.accentLight,  fg: COLORS.accent },
  'Opportunity':      { bg: '#FFE3D6',           fg: '#A83F17' },
  'Customer':         { bg: COLORS.primaryLight, fg: COLORS.primary },
  'Evangelist':       { bg: COLORS.goldLight,    fg: COLORS.gold },
};

const STAGE_INDEX = Object.fromEntries(LIFECYCLE_STAGES.map((s, i) => [s, i]));

// Moving forward (same stage or higher) is free. Moving backward requires a reason.
export function isForward(from, to) {
  return STAGE_INDEX[to] >= STAGE_INDEX[from];
}

// Explicit forward-transition map. Any target stage outside the allowed set is a
// backward / cross-track move and requires a reason.
export const VALID_TRANSITIONS = {
  'Research-Contact': ['Subscriber', 'Lead', 'MQL', 'SQL'],
  'Subscriber':       ['Lead', 'MQL', 'SQL'],
  'Lead':             ['MQL', 'SQL', 'Opportunity'],
  'MQL':              ['SQL', 'Opportunity'],
  'SQL':              ['Opportunity', 'Customer'],
  'Opportunity':      ['Customer'],
  'Customer':         ['Evangelist'],
  'Evangelist':       [],
};

export function isValidTransition(from, to) {
  if (!from) return true;
  if (from === to) return true;
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

// Per PRD Sprint 5: conversion wizard only enabled for these stages.
export const CONVERTIBLE_STAGES = new Set(['Research-Contact', 'Subscriber', 'Lead']);

// Rough NAICS-flavored set focused on accounting / services / construction verticals.
export const INDUSTRIES = [
  'Accounting & Bookkeeping',
  'Tax Services',
  'Legal Services',
  'Management Consulting',
  'Construction — General',
  'Construction — Specialty Trades',
  'Real Estate',
  'Architecture & Engineering',
  'Professional Services — Other',
  'Retail',
  'Wholesale',
  'Manufacturing',
  'Healthcare',
  'Technology / SaaS',
  'Food & Hospitality',
  'Transportation & Logistics',
  'Agriculture',
  'Non-profit',
  'Other',
];

export const REVENUE_BANDS = ['<1M', '1-3M', '3-6M', '6-10M', '10M+'];

export const ENTITY_TYPES = ['Sole Prop', 'LLC', 'S-Corp', 'C-Corp', 'Partnership', 'Non-profit', 'Other'];

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export const TAG_COLORS = [
  '#1A5C3A', '#C4552D', '#2563A0', '#6B4FA0', '#9A7B2C',
  '#DC2626', '#16A34A', '#D97706', '#78716C', '#1C1917',
  '#0F766E', '#BE185D',
];

// ───── Deals / Pipelines / Packages (Sprint 5) ─────

export const TASK_STATUSES = ['Open', 'In-Progress', 'Done', 'Cancelled'];
export const TASK_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
export const TASK_PRIORITY_COLORS = {
  P0: { bg: '#FEE2E2', fg: '#991B1B' },
  P1: { bg: '#FEF3C7', fg: '#92400E' },
  P2: { bg: '#E0E7FF', fg: '#3730A3' },
  P3: { bg: '#F5F5F4',  fg: '#57534E' },
};

export const PIPELINES = [
  { id: 'new_client', label: 'New Client' },
  { id: 'cleanup', label: 'Cleanup Project' },
  { id: 'advisory', label: 'Advisory' },
];

export const DEAL_STAGES = ['Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export const PACKAGES = [
  { id: 'essentials', label: 'Essentials', mrr: 1000, setup: 0 },
  { id: 'controller', label: 'Controller', mrr: 2000, setup: 0 },
  { id: 'cfo',        label: 'CFO',        mrr: 3500, setup: 0 },
  { id: 'cleanup',    label: 'Cleanup',    mrr: 0,    setup: 5000 },
  { id: 'custom',     label: 'Custom',     mrr: 0,    setup: 0 },
];

// Map legacy `status` values (from Sprint 2 kanban) to new lifecycle stages.
export const LEGACY_STATUS_TO_LIFECYCLE = {
  new: 'Research-Contact',
  contacted: 'Lead',
  interested: 'MQL',
  hired: 'Customer',
  declined: 'Research-Contact', // archive-on-migrate: handled separately
};
