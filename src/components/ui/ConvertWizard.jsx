import React, { useMemo, useState } from 'react';
import { COLORS } from '../../config/design-tokens';
import { PACKAGES } from '../../config/enums';
import { batchWrite } from '../../data/firestore';
import { logInteraction } from '../../data/interactions';
import { useCollection } from '../../hooks/useCollection';
import { getDefaultPipeline } from '../../data/deals';

const dealId = () => `deal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const companyId = () => `company-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export default function ConvertWizard({ person, companies, onClose, onDone }) {
  const { data: pipelines } = useCollection('pipelines');
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const existingMatch = useMemo(() => {
    if (person.company_id) return companies.find((c) => c.id === person.company_id);
    const norm = (s) => (s || '').trim().toLowerCase();
    return person.company ? companies.find((c) => norm(c.name) === norm(person.company)) : null;
  }, [person, companies]);

  const [companyChoice, setCompanyChoice] = useState(existingMatch ? 'existing' : 'create');
  const [selectedCompanyId, setSelectedCompanyId] = useState(existingMatch?.id || '');
  const [newCompanyName, setNewCompanyName] = useState(person.company || '');
  const [newCompanyDomain, setNewCompanyDomain] = useState(person.website || person.domain || '');

  const [createDeal, setCreateDeal] = useState(true);
  const defaultPipeline = useMemo(() => getDefaultPipeline(pipelines), [pipelines]);
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const selectedPipeline = useMemo(() => pipelines.find((p) => p.id === pipelineId) || defaultPipeline, [pipelines, pipelineId, defaultPipeline]);
  const selectedStages = (selectedPipeline?.stages || []).filter((s) => !s.is_won && !s.is_lost);

  // Initialize pipeline/stage when pipelines load
  React.useEffect(() => {
    if (!pipelineId && defaultPipeline) setPipelineId(defaultPipeline.id);
  }, [defaultPipeline, pipelineId]);
  React.useEffect(() => {
    if (!stageId && selectedPipeline?.stages?.length) {
      const first = selectedPipeline.stages.find((s) => !s.is_won && !s.is_lost) || selectedPipeline.stages[0];
      setStageId(first.id);
    }
  }, [selectedPipeline, stageId]);

  const [pkg, setPkg] = useState('essentials');
  const [mrr, setMrr] = useState(1000);
  const [setupFee, setSetupFee] = useState(0);
  const [closeDate, setCloseDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  const [targetStage, setTargetStage] = useState('SQL');

  const pickPackage = (id) => {
    const p = PACKAGES.find((x) => x.id === id);
    if (!p) return;
    setPkg(id);
    setMrr(p.mrr);
    setSetupFee(p.setup);
  };

  const canProceed = () => {
    if (step === 1) {
      if (companyChoice === 'existing') return !!selectedCompanyId;
      return !!newCompanyName.trim();
    }
    if (step === 2 && createDeal) return !!pipelineId && !!stageId && !!pkg;
    if (step === 3) return !!targetStage;
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const ops = [];
      let companyIdToLink = null;

      if (companyChoice === 'existing') {
        companyIdToLink = selectedCompanyId;
      } else {
        companyIdToLink = companyId();
        ops.push({
          type: 'set', collection: 'companies', id: companyIdToLink,
          data: {
            name: newCompanyName.trim(),
            domain: newCompanyDomain.trim() || null,
            lifecycle_stage: 'Research-Contact',
          },
        });
      }

      const personPatch = {
        company_id: companyIdToLink,
        lifecycle_stage: targetStage,
      };
      if (companyChoice === 'create' && !person.company) personPatch.company = newCompanyName.trim();
      ops.push({ type: 'update', collection: 'people', id: person.id, data: personPatch });

      let newDealId = null;
      if (createDeal) {
        newDealId = dealId();
        const pkgObj = PACKAGES.find((p) => p.id === pkg);
        ops.push({
          type: 'set', collection: 'deals', id: newDealId,
          data: {
            name: `${newCompanyName || existingMatch?.name || person.company || person.name} — ${pkgObj?.label || pkg}`,
            pipeline_id: pipelineId,
            stage_id: stageId,
            package: pkg,
            amount_mrr: Number(mrr) || 0,
            amount_setup: Number(setupFee) || 0,
            expected_close_date: closeDate || null,
            actual_close_date: null,
            status: 'Open',
            lost_reason: null,
            notes_md: '',
            buying_committee: [],
            company_id: companyIdToLink,
            primary_person_id: person.id,
            owner: 'Chris',
            stage_changed_at: new Date().toISOString(),
          },
        });
      }

      await batchWrite(ops);

      logInteraction({
        kind: 'stage_change',
        entity_type: 'person',
        entity_id: person.id,
        title: `Converted via wizard → ${targetStage}`,
        from_stage: person.lifecycle_stage || null,
        to_stage: targetStage,
        meta: { wizard: true, deal_id: newDealId, company_id: companyIdToLink },
      }).catch(() => {});

      onDone?.({ personId: person.id, companyId: companyIdToLink, dealId: newDealId, newStage: targetStage });
      onClose();
    } catch (err) {
      console.error('Conversion failed', err);
      setError(err.message || 'Conversion failed — check console.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.card, borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Convert {person.name || 'Person'}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>Step {step} of 3</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COLORS.textMuted }}>✕</button>
        </div>

        <div style={{ padding: '8px 20px', display: 'flex', gap: 4 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? COLORS.primary : COLORS.border }} />
          ))}
        </div>

        <div style={{ padding: 20, flex: 1 }}>
          {step === 1 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>1. Confirm Company</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 14 }}>Link this person to a company record.</div>
              {existingMatch && (
                <div style={{ padding: 10, background: COLORS.primaryLight, border: `1px solid ${COLORS.primary}`, borderRadius: 6, fontSize: 12, color: COLORS.primary, marginBottom: 12 }}>
                  ✓ Matched existing company: <strong>{existingMatch.name}</strong>
                </div>
              )}
              <label style={radioLabel}>
                <input type="radio" checked={companyChoice === 'existing'} onChange={() => setCompanyChoice('existing')} />
                <span>Use existing company</span>
              </label>
              {companyChoice === 'existing' && (
                <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)}
                  style={{ ...inputStyle, width: '100%', marginBottom: 12 }}>
                  <option value="">— Pick a company —</option>
                  {[...companies].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((c) => (
                    <option key={c.id} value={c.id}>{c.name || '(unnamed)'}{c.domain && ` · ${c.domain}`}</option>
                  ))}
                </select>
              )}
              <label style={radioLabel}>
                <input type="radio" checked={companyChoice === 'create'} onChange={() => setCompanyChoice('create')} />
                <span>Create new company</span>
              </label>
              {companyChoice === 'create' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  <input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="Company name *" style={inputStyle} />
                  <input value={newCompanyDomain} onChange={(e) => setNewCompanyDomain(e.target.value)} placeholder="Domain (optional)" style={inputStyle} />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>2. Create Deal</div>
              <label style={{ ...radioLabel, marginBottom: 14 }}>
                <input type="checkbox" checked={createDeal} onChange={(e) => setCreateDeal(e.target.checked)} />
                <span>Also create a Deal record</span>
              </label>
              {createDeal ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Field label="Pipeline">
                    <select value={pipelineId} onChange={(e) => { setPipelineId(e.target.value); setStageId(''); }} style={inputStyle}>
                      {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Stage">
                    <select value={stageId} onChange={(e) => setStageId(e.target.value)} style={inputStyle}>
                      {selectedStages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Package">
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {PACKAGES.map((p) => (
                        <label key={p.id} style={{ ...radioLabel, flex: '1 1 45%', margin: 0, padding: '6px 10px', border: `1px solid ${pkg === p.id ? COLORS.primary : COLORS.border}`, borderRadius: 5, background: pkg === p.id ? COLORS.primaryLight : 'transparent', cursor: 'pointer' }}>
                          <input type="radio" checked={pkg === p.id} onChange={() => pickPackage(p.id)} />
                          <span>{p.label}</span>
                        </label>
                      ))}
                    </div>
                  </Field>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Field label="MRR ($)" style={{ flex: 1 }}>
                      <input type="number" value={mrr} onChange={(e) => setMrr(e.target.value)} style={inputStyle} />
                    </Field>
                    <Field label="Setup fee ($)" style={{ flex: 1 }}>
                      <input type="number" value={setupFee} onChange={(e) => setSetupFee(e.target.value)} style={inputStyle} />
                    </Field>
                  </div>
                  <Field label="Expected close date">
                    <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic' }}>Skipping deal creation. You can still move lifecycle forward.</div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>3. Update Lifecycle</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 14 }}>Current: <strong>{person.lifecycle_stage || 'Research-Contact'}</strong></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['MQL', 'SQL', 'Opportunity'].map((s) => (
                  <label key={s} style={{ ...radioLabel, padding: '8px 12px', border: `1px solid ${targetStage === s ? COLORS.primary : COLORS.border}`, borderRadius: 5, background: targetStage === s ? COLORS.primaryLight : 'transparent', cursor: 'pointer' }}>
                    <input type="radio" checked={targetStage === s} onChange={() => setTargetStage(s)} />
                    <span><strong>{s}</strong> {createDeal && s === 'SQL' && <span style={{ color: COLORS.textMuted, fontSize: 11 }}> (recommended when creating a deal)</span>}
                      {!createDeal && s === 'MQL' && <span style={{ color: COLORS.textMuted, fontSize: 11 }}> (recommended)</span>}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <div style={{ marginTop: 12, fontSize: 12, color: COLORS.danger }}>{error}</div>}
        </div>

        <div style={{ padding: '14px 20px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={step === 1 ? onClose : () => setStep(step - 1)}
            style={{ padding: '8px 14px', background: 'transparent', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 5, cursor: 'pointer', fontSize: 13 }}>
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canProceed()}
              style={{ padding: '8px 18px', background: canProceed() ? COLORS.primary : COLORS.border, color: '#fff', border: 'none', borderRadius: 5, cursor: canProceed() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}>
              Next →
            </button>
          ) : (
            <button onClick={submit} disabled={submitting || !canProceed()}
              style={{ padding: '8px 18px', background: COLORS.success, color: '#fff', border: 'none', borderRadius: 5, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
              {submitting ? 'Converting…' : '✓ Convert'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = { padding: '7px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 5, fontSize: 13, background: COLORS.card, color: COLORS.text, width: '100%', boxSizing: 'border-box' };
const radioLabel = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: COLORS.text, marginBottom: 8 };
