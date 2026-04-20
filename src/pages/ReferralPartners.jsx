import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '../config/design-tokens';
import { REFERRAL_STAGES, REFERRAL_STAGE_COLORS } from '../config/workspaces';
import FilterBar from '../components/table/FilterBar';
import DataTable from '../components/table/DataTable';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import { updateDoc } from '../data/firestore';

const REFERRAL_FIELDS = [
  { key: 'intro_source', label: 'Intro source' },
  { key: 'first_referral_date', label: 'First referral date', type: 'date' },
  { key: 'referrals_sent', label: 'Referrals sent', type: 'number' },
  { key: 'referrals_closed', label: 'Referrals closed', type: 'number' },
  { key: 'commission_terms', label: 'Commission terms' },
];

export default function ReferralPartnersList({ firms, loading, onUpsertCompany }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const partners = useMemo(
    () => (firms || []).filter((f) => Array.isArray(f.roles) && f.roles.includes('referral_partner')),
    [firms]
  );

  const filtered = useMemo(() => {
    let rows = partners;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        (r.company || r.name || '').toLowerCase().includes(q) ||
        (r.intro_source || '').toLowerCase().includes(q)
      );
    }
    if (stageFilter.length) {
      rows = rows.filter((r) => stageFilter.includes(r.referral_stage || 'introd'));
    }
    return rows;
  }, [partners, search, stageFilter]);

  const columns = [
    { key: 'company', header: 'Firm', render: (r) => <strong>{r.company || r.name || 'Unnamed'}</strong> },
    { key: 'referral_stage', header: 'Stage', render: (r) => <StagePill stage={r.referral_stage || 'introd'} /> },
    { key: 'intro_source', header: 'Intro source' },
    { key: 'referrals_sent', header: 'Sent', render: (r) => r.referrals_sent || 0 },
    { key: 'referrals_closed', header: 'Closed', render: (r) => r.referrals_closed || 0 },
    { key: 'first_referral_date', header: 'First referral', render: (r) => r.first_referral_date || '—' },
  ];

  const handleRowClick = (row) => navigate(`/deal-flow/firms/${row.id}`);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Referral Partners</h1>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>Accounting firms who send you business.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate('/deal-flow/referrals/pipeline')}
            style={{ padding: '8px 14px', background: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            📊 Pipeline view
          </button>
          <button onClick={() => setShowForm(true)}
            style={{ padding: '8px 14px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            + Add partner
          </button>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by firm or intro source…"
        multiSelects={[{
          key: 'stage',
          label: 'Stage',
          options: REFERRAL_STAGES.map((s) => ({ value: s.id, label: s.label })),
          value: stageFilter,
          onChange: setStageFilter,
        }]}
      />

      {loading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🤝"
          title={partners.length === 0 ? 'No referral partners yet' : 'No partners match your filters'}
          body={partners.length === 0 ? 'Add an accounting firm and tag them as a Referral Partner to track intros here.' : 'Try clearing filters.'}
          primaryAction={partners.length === 0 ? { label: '+ Add partner', onClick: () => setShowForm(true) } : null}
        />
      ) : (
        <DataTable columns={columns} rows={filtered} onRowClick={handleRowClick} />
      )}

      {showForm && (
        <AddPartnerModal
          onClose={() => setShowForm(false)}
          onSave={async (data) => {
            await onUpsertCompany({
              ...data,
              roles: ['referral_partner'],
              workspace: 'deal_flow',
              referral_stage: data.referral_stage || 'introd',
            });
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

function StagePill({ stage }) {
  const info = REFERRAL_STAGES.find((s) => s.id === stage) || REFERRAL_STAGES[0];
  const colors = REFERRAL_STAGE_COLORS[stage] || REFERRAL_STAGE_COLORS.introd;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: colors.bg, color: colors.fg }}>
      {info.label}
    </span>
  );
}

function AddPartnerModal({ onClose, onSave }) {
  const [form, setForm] = useState({ company: '', name: '', role: '', email: '', phone: '', intro_source: '', referral_stage: 'introd', commission_terms: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.company) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.card, borderRadius: 10, padding: 24, width: 520, maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Add Referral Partner</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Firm name *" value={form.company} onChange={(v) => setForm((f) => ({ ...f, company: v }))} />
          <Field label="Contact name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Field label="Role / title" value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} />
          <Field label="Email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          <Field label="Intro source" value={form.intro_source} onChange={(v) => setForm((f) => ({ ...f, intro_source: v }))} />
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textMuted, marginBottom: 4 }}>Stage</label>
            <select value={form.referral_stage} onChange={(e) => setForm((f) => ({ ...f, referral_stage: e.target.value }))}
              style={{ width: '100%', padding: '7px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 13 }}>
              {REFERRAL_STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <Field label="Commission terms" value={form.commission_terms} onChange={(v) => setForm((f) => ({ ...f, commission_terms: v }))} />
        </div>
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', background: 'none', border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={!form.company || saving}
            style={{ padding: '8px 14px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: saving || !form.company ? 'not-allowed' : 'pointer', opacity: saving || !form.company ? 0.6 : 1, fontWeight: 600 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: COLORS.textMuted, marginBottom: 4 }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '7px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 13 }} />
    </div>
  );
}

export { REFERRAL_FIELDS };
