export const WORKSPACES = {
  crm: {
    id: 'crm',
    label: 'CRM',
    subtitle: 'Clients & leads',
    icon: '💼',
    routePrefix: '/crm',
    defaultPath: '/crm',
    accent: '#7C3AED',
  },
  deal_flow: {
    id: 'deal_flow',
    label: 'Deal Flow',
    subtitle: 'Firms, targets, referrals',
    icon: '🎯',
    routePrefix: '/deal-flow',
    defaultPath: '/deal-flow',
    accent: '#0E7490',
  },
};

export const WORKSPACE_IDS = ['crm', 'deal_flow'];

export const DEFAULT_WORKSPACE = 'crm';

export function workspaceFromPath(pathname) {
  if (!pathname) return DEFAULT_WORKSPACE;
  if (pathname.startsWith('/deal-flow')) return 'deal_flow';
  if (pathname.startsWith('/crm')) return 'crm';
  return DEFAULT_WORKSPACE;
}

export function otherWorkspace(id) {
  return id === 'crm' ? 'deal_flow' : 'crm';
}

// Route helpers for a given record — figures out the correct workspace path
// so links always land in the workspace that owns the record.
export function personPath(person) {
  const ws = person?.workspace || 'deal_flow';
  return ws === 'deal_flow' ? `/deal-flow/practitioners/${person.id}` : `/crm/people/${person.id}`;
}

export function companyPath(company) {
  const ws = company?.workspace || 'crm';
  return ws === 'deal_flow' ? `/deal-flow/firms/${company.id}` : `/crm/companies/${company.id}`;
}

// Interviews, Insights, Scripts, Tasks, and Review Queue are platform-level —
// they live at canonical paths and aren't duplicated per workspace. The
// `interview` argument is accepted (and ignored) to keep the call sites
// symmetric with personPath/companyPath.
export function interviewPath(interview) {
  return `/interviews/${interview.id}`;
}

export function interviewsListPath(/* workspaceId */) {
  return '/interviews';
}

// Referral Partner pipeline — lightweight kanban inside Deal Flow.
export const REFERRAL_STAGES = [
  { id: 'introd', label: "Intro'd" },
  { id: 'sent_lead', label: 'Sent lead' },
  { id: 'closed_won', label: 'Closed - Won' },
  { id: 'closed_lost', label: 'Closed - Lost' },
];

export const REFERRAL_STAGE_COLORS = {
  introd:       { bg: '#EDE9FE', fg: '#5B21B6' },
  sent_lead:    { bg: '#DBEAFE', fg: '#1E40AF' },
  closed_won:   { bg: '#D1FAE5', fg: '#065F46' },
  closed_lost:  { bg: '#F5F5F4', fg: '#57534E' },
};

// Roles a Firm (deal_flow company) can carry. A firm can have multiple.
export const FIRM_ROLES = [
  { id: 'target', label: 'Acquisition Target', color: '#DC2626' },
  { id: 'referral_partner', label: 'Referral Partner', color: '#0E7490' },
  { id: 'research', label: 'Research Only', color: '#78716C' },
];
