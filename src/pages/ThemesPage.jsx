import React, { useState } from 'react';
import { COLORS, DISPLAY } from '../config/design-tokens';
import { useCollection } from '../hooks/useCollection';
import { createDoc, deleteDoc } from '../data/firestore';
import { analyzeThemes } from '../services/themesService.js';

export default function ThemesPage({ businesses, practitioners }) {
  const [bizThemes, setBizThemes] = useState(null);
  const [pracThemes, setPracThemes] = useState(null);
  const [bizLoading, setBizLoading] = useState(false);
  const [pracLoading, setPracLoading] = useState(false);
  const [bizError, setBizError] = useState(null);
  const [pracError, setPracError] = useState(null);
  const [saveStatus, setSaveStatus] = useState({});
  const { data: syntheses } = useCollection('syntheses');

  const saveSynthesis = async (kind, themes) => {
    if (!themes) return;
    const baseCount = kind === 'business' ? businesses.filter((b) => b.enrichedAt || b.painPoints).length : practitioners.filter((p) => p.enrichedAt || p.painPoints).length;
    const id = `synth-${Date.now()}`;
    const name = (window.prompt('Name this synthesis:', `${kind === 'business' ? 'Business' : 'Practitioner'} themes · ${new Date().toLocaleDateString()}`) || '').trim();
    if (!name) return;
    setSaveStatus((s) => ({ ...s, [kind]: 'saving' }));
    try {
      await createDoc('syntheses', { name, kind, themes, interview_count: baseCount, createdAt: new Date().toISOString() }, id);
      setSaveStatus((s) => ({ ...s, [kind]: 'saved' }));
      setTimeout(() => setSaveStatus((s) => ({ ...s, [kind]: null })), 1800);
    } catch (err) {
      console.error('Save synthesis failed', err);
      setSaveStatus((s) => ({ ...s, [kind]: 'error' }));
    }
  };

  const deleteSynthesis = async (id) => {
    if (!window.confirm('Delete this synthesis?')) return;
    await deleteDoc('syntheses', id);
  };

  const analyzeBusinesses = async () => {
    setBizLoading(true);
    setBizError(null);
    try {
      const records = businesses.filter((b) => b.enrichedAt || b.painPoints);
      const result = await analyzeThemes({ type: 'business', records });
      if (result && result.themes) setBizThemes(result.themes);
      else setBizError('Analysis returned no themes.');
    } catch (e) {
      setBizError(e.message || String(e));
    }
    setBizLoading(false);
  };

  const analyzePractitioners = async () => {
    setPracLoading(true);
    setPracError(null);
    try {
      const records = practitioners.filter((p) => p.enrichedAt || p.painPoints);
      const result = await analyzeThemes({ type: 'practitioner', records });
      if (result && result.themes) setPracThemes(result.themes);
      else setPracError('Analysis returned no themes.');
    } catch (e) {
      setPracError(e.message || String(e));
    }
    setPracLoading(false);
  };

  const enrichedBiz = businesses.filter(b => b.enrichedAt || b.painPoints);
  const enrichedPrac = practitioners.filter(p => p.enrichedAt || p.painPoints);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h2 style={{ color: COLORS.text, margin: '0 0 6px', fontFamily: DISPLAY, fontSize: 28 }}>🧠 Themes</h2>
      <p style={{ color: COLORS.textMuted, fontSize: 14, marginBottom: 36 }}>
        Cross-interview synthesis. Claude analyzes all enriched records and extracts strategic patterns across your interview set.
      </p>

      <ThemeSection
        title="Business Owner Themes"
        icon="🏢"
        color={COLORS.accent}
        count={enrichedBiz.length}
        total={businesses.length}
        themes={bizThemes}
        loading={bizLoading}
        error={bizError}
        onAnalyze={analyzeBusinesses}
        onSave={() => saveSynthesis('business', bizThemes)}
        saveStatus={saveStatus.business}
      />

      <ThemeSection
        title="Practitioner Themes"
        icon="👥"
        color={COLORS.primary}
        count={enrichedPrac.length}
        total={practitioners.length}
        themes={pracThemes}
        loading={pracLoading}
        error={pracError}
        onAnalyze={analyzePractitioners}
        onSave={() => saveSynthesis('practitioner', pracThemes)}
        saveStatus={saveStatus.practitioner}
      />

      {syntheses.length > 0 && (
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${COLORS.border}` }}>
          <h3 style={{ color: COLORS.text, margin: '0 0 12px', fontSize: 18 }}>💾 Saved Syntheses ({syntheses.length})</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            {[...syntheses].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                    {s.kind} · {s.interview_count || 0} records · {s.createdAt ? new Date(s.createdAt).toLocaleString() : ''}
                  </div>
                </div>
                <button onClick={() => deleteSynthesis(s.id)} style={{ background: 'none', border: 'none', color: COLORS.danger, cursor: 'pointer', fontSize: 14 }}>🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeSection({ title, icon, color, count, total, themes, loading, error, onAnalyze, onSave, saveStatus }) {
  return (
    <div style={{ marginBottom: 56 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: COLORS.text, fontSize: 20 }}>
          {icon} {title}
          <span style={{ color: COLORS.textDim, fontSize: 14, fontWeight: 400, marginLeft: 8 }}>
            ({count} enriched{total !== count ? ` of ${total}` : ''})
          </span>
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
        {themes && onSave && (
          <button onClick={onSave} disabled={saveStatus === 'saving'}
            style={{ padding: '10px 16px', backgroundColor: saveStatus === 'saved' ? COLORS.success : 'transparent', border: `1px solid ${saveStatus === 'saved' ? COLORS.success : COLORS.border}`, color: saveStatus === 'saved' ? '#fff' : COLORS.text, borderRadius: 8, cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12 }}>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? '✗ Retry' : '💾 Save as synthesis'}
          </button>
        )}
        <button onClick={onAnalyze} disabled={loading || count === 0}
          style={{ padding: '10px 22px', backgroundColor: loading || count === 0 ? COLORS.border : color, color: loading || count === 0 ? COLORS.textMuted : '#fff', border: 'none', borderRadius: 8, cursor: loading || count === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading ? (
            <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'autopilot-spin 0.7s linear infinite' }} /> Analyzing…</>
          ) : '🔍 Analyze Themes'}
        </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8, color: COLORS.danger, fontSize: 13, marginBottom: 16, border: '1px solid #FCA5A5' }}>
          ✗ {error}
        </div>
      )}

      {count === 0 && !themes && (
        <div style={{ padding: 32, textAlign: 'center', backgroundColor: COLORS.card, borderRadius: 8, border: `1px dashed ${COLORS.border}`, color: COLORS.textDim, fontSize: 14 }}>
          No enriched records yet. Trigger Zapier with an interview to populate data.
        </div>
      )}

      {themes && <ThemesDashboard themes={themes} color={color} />}
    </div>
  );
}

function ThemesDashboard({ themes, color }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {themes.executiveSummary && (
        <div style={{ padding: 20, backgroundColor: color + '10', borderRadius: 10, border: `1px solid ${color}25` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Executive Summary</div>
          <div style={{ fontSize: 15, lineHeight: 1.7, color: COLORS.text }}>{themes.executiveSummary}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {themes.topPainPoints && themes.topPainPoints.length > 0 && (
          <ThemeCard title="😤 Top Pain Points" color={COLORS.danger}>
            {themes.topPainPoints.map((p, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < themes.topPainPoints.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{p.theme}</div>
                  {p.frequency && <span style={{ fontSize: 11, color: COLORS.textDim, backgroundColor: COLORS.bg, padding: '2px 8px', borderRadius: 10, border: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap', marginLeft: 8 }}>{p.frequency}</span>}
                </div>
                {p.evidence && <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>{p.evidence}</div>}
              </div>
            ))}
          </ThemeCard>
        )}

        {themes.wtpProfile && (
          <ThemeCard title="💰 Willingness-to-Pay Profile" color={COLORS.gold}>
            {themes.wtpProfile.priceRange && <KVRow label="Price Range" value={themes.wtpProfile.priceRange} />}
            {themes.wtpProfile.sensitivity && <KVRow label="Price Sensitivity" value={themes.wtpProfile.sensitivity} />}
            {themes.wtpProfile.keyInsight && (
              <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: COLORS.goldLight, borderRadius: 6, fontSize: 12, color: COLORS.gold, lineHeight: 1.5 }}>
                💡 {themes.wtpProfile.keyInsight}
              </div>
            )}
            {themes.wtpProfile.primaryDrivers && themes.wtpProfile.primaryDrivers.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Primary Drivers</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {themes.wtpProfile.primaryDrivers.map((d, i) => (
                    <span key={i} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, backgroundColor: COLORS.goldLight, color: COLORS.gold, border: `1px solid ${COLORS.gold}30` }}>{d}</span>
                  ))}
                </div>
              </div>
            )}
          </ThemeCard>
        )}

        {themes.idealCustomerProfile && (
          <ThemeCard title="🎯 Ideal Customer Profile" color={COLORS.primary}>
            {Object.entries(themes.idealCustomerProfile)
              .filter(([, v]) => v && !(Array.isArray(v) && v.length === 0))
              .map(([k, v]) => (
                <KVRow key={k} label={k.replace(/([A-Z])/g, ' $1').trim()} value={Array.isArray(v) ? v.join(', ') : String(v)} />
              ))}
          </ThemeCard>
        )}

        {themes.competitiveLandscape && themes.competitiveLandscape.length > 0 && (
          <ThemeCard title="⚔️ Competitive Landscape" color={COLORS.blue}>
            {themes.competitiveLandscape.map((item, i) => (
              <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < themes.competitiveLandscape.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{item.name || item}</div>
                {item.insight && <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2, lineHeight: 1.5 }}>{item.insight}</div>}
              </div>
            ))}
          </ThemeCard>
        )}
      </div>

      {themes.firmLandscape && (
        <ThemeCard title="🏢 Firm Landscape" color={COLORS.blue}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: themes.firmLandscape.insight ? 12 : 0 }}>
            {themes.firmLandscape.dominantSize && (
              <div style={{ padding: 12, backgroundColor: COLORS.bg, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>{themes.firmLandscape.dominantSize}</div>
                <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: 'uppercase', marginTop: 2 }}>Dominant Size</div>
              </div>
            )}
            {themes.firmLandscape.avgClientCount && (
              <div style={{ padding: 12, backgroundColor: COLORS.bg, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>{themes.firmLandscape.avgClientCount}</div>
                <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: 'uppercase', marginTop: 2 }}>Avg Client Count</div>
              </div>
            )}
          </div>
          {themes.firmLandscape.primaryServiceMix && <KVRow label="Service Mix" value={themes.firmLandscape.primaryServiceMix} />}
          {themes.firmLandscape.insight && (
            <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: COLORS.blueLight, borderRadius: 6, fontSize: 12, color: COLORS.blue, lineHeight: 1.5 }}>
              💡 {themes.firmLandscape.insight}
            </div>
          )}
        </ThemeCard>
      )}

      {themes.aiReceptivity && (
        <ThemeCard title="🤖 AI Receptivity" color={COLORS.purple}>
          {themes.aiReceptivity.overall && <KVRow label="Overall Sentiment" value={themes.aiReceptivity.overall} />}
          {themes.aiReceptivity.keyInsight && (
            <div style={{ margin: '10px 0', padding: '8px 12px', backgroundColor: COLORS.purpleLight, borderRadius: 6, fontSize: 12, color: COLORS.purple, lineHeight: 1.5 }}>
              💡 {themes.aiReceptivity.keyInsight}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
            {themes.aiReceptivity.concerns && themes.aiReceptivity.concerns.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: COLORS.danger, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Concerns</div>
                {themes.aiReceptivity.concerns.map((c, i) => <div key={i} style={{ fontSize: 12, color: COLORS.text, padding: '3px 0' }}>• {c}</div>)}
              </div>
            )}
            {themes.aiReceptivity.opportunities && themes.aiReceptivity.opportunities.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: COLORS.success, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Opportunities</div>
                {themes.aiReceptivity.opportunities.map((o, i) => <div key={i} style={{ fontSize: 12, color: COLORS.text, padding: '3px 0' }}>• {o}</div>)}
              </div>
            )}
          </div>
        </ThemeCard>
      )}

      {themes.techStackInsights && (
        <ThemeCard title="🛠 Tech Stack Insights" color={COLORS.blue}>
          {themes.techStackInsights.dominant && themes.techStackInsights.dominant.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Dominant Tools</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {themes.techStackInsights.dominant.map((t, i) => (
                  <span key={i} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, backgroundColor: COLORS.blueLight, color: COLORS.blue, border: `1px solid ${COLORS.blue}30` }}>{t}</span>
                ))}
              </div>
            </div>
          )}
          {themes.techStackInsights.gaps && themes.techStackInsights.gaps.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', marginBottom: 6 }}>Gaps / Opportunities</div>
              {themes.techStackInsights.gaps.map((g, i) => <div key={i} style={{ fontSize: 12, color: COLORS.text, padding: '3px 0' }}>• {g}</div>)}
            </div>
          )}
          {themes.techStackInsights.switchingBarriers && <KVRow label="Switching Barriers" value={themes.techStackInsights.switchingBarriers} />}
        </ThemeCard>
      )}

      {themes.pricingBenchmarks && (
        <ThemeCard title="💵 Pricing Benchmarks" color={COLORS.gold}>
          {themes.pricingBenchmarks.typicalMonthlyRange && <KVRow label="Typical Range" value={themes.pricingBenchmarks.typicalMonthlyRange} />}
          {themes.pricingBenchmarks.profitableSegments && themes.pricingBenchmarks.profitableSegments.length > 0 && (
            <KVRow label="Most Profitable" value={themes.pricingBenchmarks.profitableSegments.join(', ')} />
          )}
          {themes.pricingBenchmarks.keyInsight && (
            <div style={{ marginTop: 10, padding: '8px 12px', backgroundColor: COLORS.goldLight, borderRadius: 6, fontSize: 12, color: COLORS.gold, lineHeight: 1.5 }}>
              💡 {themes.pricingBenchmarks.keyInsight}
            </div>
          )}
        </ThemeCard>
      )}

      {themes.partnershipSignals && themes.partnershipSignals.length > 0 && (
        <ThemeCard title="🤝 Partnership Signals" color={COLORS.primary}>
          {themes.partnershipSignals.map((s, i) => (
            <div key={i} style={{ fontSize: 13, color: COLORS.text, padding: '5px 0', borderBottom: i < themes.partnershipSignals.length - 1 ? `1px solid ${COLORS.border}` : 'none' }}>• {s}</div>
          ))}
        </ThemeCard>
      )}

      {themes.keyQuotes && themes.keyQuotes.length > 0 && (
        <ThemeCard title="💬 Voice of Customer" color={COLORS.accent}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            {themes.keyQuotes.map((q, i) => (
              <div key={i} style={{ padding: '12px 14px', backgroundColor: COLORS.bg, borderLeft: `3px solid ${COLORS.accent}`, borderRadius: 4 }}>
                <div style={{ fontStyle: 'italic', fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>"{typeof q === 'string' ? q : q.quote}"</div>
                {(q.speaker || q.significance) && (
                  <div style={{ marginTop: 6, fontSize: 11, color: COLORS.textDim }}>
                    {q.speaker && <span>— {q.speaker}</span>}
                    {q.significance && <span style={{ marginLeft: 6, fontStyle: 'normal' }}>· {q.significance}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ThemeCard>
      )}

      {themes.strategicRecommendations && themes.strategicRecommendations.length > 0 && (
        <ThemeCard title="🚀 Strategic Recommendations" color={COLORS.success}>
          {themes.strategicRecommendations.map((rec, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: COLORS.success, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{rec.title || rec}</div>
                {rec.rationale && <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 3, lineHeight: 1.5 }}>{rec.rationale}</div>}
              </div>
            </div>
          ))}
        </ThemeCard>
      )}

      {themes.riskFlags && themes.riskFlags.length > 0 && (
        <ThemeCard title="⚠️ Risk Flags" color={COLORS.warning}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {themes.riskFlags.map((flag, i) => (
              <span key={i} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' }}>
                {typeof flag === 'string' ? flag : flag.flag}
              </span>
            ))}
          </div>
        </ThemeCard>
      )}
    </div>
  );
}

function ThemeCard({ title, color, children }) {
  return (
    <div style={{ backgroundColor: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', backgroundColor: color + '12', borderBottom: `1px solid ${color}20` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function KVRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13, gap: 12 }}>
      <span style={{ color: COLORS.textMuted, fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ color: COLORS.text, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
