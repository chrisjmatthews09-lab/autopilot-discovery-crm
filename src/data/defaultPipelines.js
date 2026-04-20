const stage = (id, label, probability, order, opts = {}) => ({
  id, label, probability, order,
  is_won: !!opts.won, is_lost: !!opts.lost,
});

// HubSpot-style CRM funnel — MQL → SQL → Opportunity → Proposal → Close.
export const DEFAULT_PIPELINES = [
  {
    id: 'sales_pipeline',
    name: 'Sales Pipeline',
    is_default: true,
    object_type: 'deal',
    stages: [
      stage('mql',          'MQL',          0.2, 0),
      stage('sql',          'SQL',          0.4, 1),
      stage('opportunity',  'Opportunity',  0.6, 2),
      stage('proposal',     'Proposal',     0.8, 3),
      stage('closed_won',   'Closed-Won',   1.0, 4, { won: true }),
      stage('closed_lost',  'Closed-Lost',  0.0, 5, { lost: true }),
    ],
  },
  {
    id: 'service_upgrade',
    name: 'Service Upgrade',
    is_default: false,
    object_type: 'deal',
    stages: [
      stage('evaluation', 'Evaluation', 0.3, 0),
      stage('proposed',   'Proposed',   0.6, 1),
      stage('accepted',   'Accepted',   1.0, 2, { won: true }),
      stage('declined',   'Declined',   0.0, 3, { lost: true }),
    ],
  },
];

export const DEFAULT_TARGET_PIPELINES = [
  {
    id: 'ma_targets',
    name: 'M&A Targets',
    is_default: true,
    object_type: 'target',
    stages: [
      stage('sourced',         'Sourced',         0.1, 0),
      stage('initial_contact', 'Initial-Contact', 0.2, 1),
      stage('nda',             'NDA',             0.35, 2),
      stage('loi',             'LOI',             0.5, 3),
      stage('diligence',       'Diligence',       0.7, 4),
      stage('negotiation',     'Negotiation',     0.85, 5),
      stage('closed_won',      'Closed-Won',      1.0, 6, { won: true }),
      stage('passed',          'Passed',          0.0, 7, { lost: true }),
    ],
  },
];
