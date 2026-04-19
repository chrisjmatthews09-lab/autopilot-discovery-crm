import React, { useState, useEffect, useRef, useCallback } from 'react';

// ==================== CONSTANTS ====================
const COLORS = {
  bg: "#F8F6F1",
  card: "#FFFFFF",
  cardAlt: "#FDFCF9",
  primary: "#1A5C3A",
  primaryLight: "#E8F5EE",
  accent: "#C4552D",
  accentLight: "#FFF0EB",
  blue: "#2563A0",
  blueLight: "#EBF3FC",
  purple: "#6B4FA0",
  purpleLight: "#F3EFFE",
  gold: "#9A7B2C",
  goldLight: "#FBF6E8",
  text: "#1C1917",
  textMuted: "#78716C",
  textDim: "#78716C",
  sidebar: "#FDFCF9",
  border: "#E7E5E0",
  borderDark: "#D6D3CD",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
};

const FONT = `'Karla', 'Nunito Sans', sans-serif`;
const DISPLAY = `'Fraunces', 'Playfair Display', serif`;

// ==================== INTERVIEW SCRIPTS ====================
const PRO_SCRIPT = {
  title: "Bookkeeper / CPA / Accounting Firm Interview",
  intro: "Thank you for taking the time. I'm researching the accounting services market in Colorado to understand how firms operate, what's working, what's not, and where the industry is heading. Everything you share is confidential and just for my own market research. This should take about 30–40 minutes.",
  sections: [
    {
      name: "Warm-Up & Context",
      color: COLORS.blue,
      questions: [
        { q: "Tell me about your firm — how long have you been operating, how many clients, what's your team look like?", why: "Establishes firm size, maturity, and capacity baseline" },
        { q: "What types of clients make up the bulk of your revenue? Industries, size, service mix?", why: "Reveals vertical concentration and service line economics" },
        { q: "What percentage of your revenue comes from tax prep vs. monthly/recurring services vs. advisory?", why: "Quantifies the tax-only vs. CAS revenue split — the core arbitrage" },
      ]
    },
    {
      name: "Service Delivery & Operations",
      color: COLORS.primary,
      questions: [
        { q: "Walk me through how you onboard a new monthly bookkeeping or CAS client — what does that process look like from signed engagement letter to first deliverable?", why: "Maps the operational workflow and identifies bottlenecks" },
        { q: "How many clients can one bookkeeper/accountant handle on your team? What's the realistic capacity?", why: "Critical for validating the 40-50 client per bookkeeper assumption with Digits" },
        { q: "What's your tech stack? GL, bank feeds, bill pay, payroll, reporting — walk me through it.", why: "Identifies where Digits creates real differentiation vs. existing stacks" },
        { q: "Where do things break down operationally? What takes longer than it should? Where do errors happen?", why: "Reveals pain points Digits automation could solve" },
        { q: "How do you handle month-end close? How long does it typically take per client? When do clients get their financials?", why: "Benchmarks close speed — Digits promises real-time" },
      ]
    },
    {
      name: "Pricing & Economics",
      color: COLORS.gold,
      questions: [
        { q: "How do you price your services? Hourly, fixed fee, tiered packages? Has that changed in the last few years?", why: "Maps pricing model trends across the market" },
        { q: "What's your typical monthly fee range for a $1M–$5M revenue business? What about $5M–$10M?", why: "Direct pricing benchmark — compare to $1K/$2K/$3.5K tiers" },
        { q: "Have you raised prices in the last 12 months? By how much? How did clients react?", why: "Tests price elasticity and validates the 80% fee-increase trend" },
        { q: "What's your gross margin on bookkeeping vs. tax prep vs. advisory work? Which line is most profitable?", why: "Validates the margin thesis — advisory should be highest" },
        { q: "What would you charge a construction company with $5M revenue, 3 entities, and job costing needs for full monthly CAS?", why: "Direct comp for Autopilot's construction-vertical pricing" },
      ]
    },
    {
      name: "Competition & Market",
      color: COLORS.accent,
      questions: [
        { q: "Who do you lose deals to? What are the main reasons prospects choose someone else?", why: "Identifies real competitive threats and positioning gaps" },
        { q: "What do you think about firms like Bench, Pilot, or other tech-enabled bookkeeping providers? Are they taking your clients?", why: "Gauges perception of tech-enabled competition" },
        { q: "Have you looked at or used Digits? What's your take on AI-powered accounting platforms?", why: "Direct intelligence on Digits adoption and perception among practitioners" },
        { q: "If someone offered to buy your firm, what multiple would you expect? What would make you consider selling?", why: "Critical M&A intelligence for the acquisition strategy" },
        { q: "What's the biggest challenge facing your firm in the next 2–3 years?", why: "Surfaces macro threats — staffing shortage, AI disruption, margin compression" },
      ]
    },
    {
      name: "Staffing & Talent",
      color: COLORS.purple,
      questions: [
        { q: "How hard is it to hire right now? What positions are hardest to fill? What are you paying?", why: "Validates the CPA shortage thesis and labor cost assumptions" },
        { q: "How much of your team's time goes to manual data entry, categorization, and reconciliation vs. actual analysis and advisory?", why: "Quantifies the automation opportunity — the % Digits could eliminate" },
        { q: "If AI could handle 90%+ of transaction categorization and reconciliation, how would that change your business?", why: "Tests receptivity to the Digits value prop from the practitioner side" },
      ]
    },
    {
      name: "Closing & Relationship",
      color: COLORS.primary,
      questions: [
        { q: "If you could wave a magic wand and fix one thing about running your firm, what would it be?", why: "Often surfaces the deepest pain point" },
        { q: "Do you refer clients to other firms for services you don't offer? What services?", why: "Identifies referral partnership opportunities" },
        { q: "Would you be open to staying in touch? I may have opportunities for collaboration or referrals down the road.", why: "Builds the referral pipeline from Day 1" },
      ]
    },
  ]
};

const BIZ_SCRIPT = {
  title: "Business Owner Interview",
  intro: "Thank you for your time. I'm researching how Colorado business owners handle their finances — the good, the bad, and the ugly. I want to understand what's working, what's painful, and what ideal financial support would look like. Everything is confidential. Should take about 25–30 minutes.",
  sections: [
    {
      name: "Business Context",
      color: COLORS.blue,
      questions: [
        { q: "Tell me about your business — what do you do, how long have you been operating, roughly how many employees?", why: "Establishes size, stage, and complexity" },
        { q: "What's your approximate annual revenue range? (We can use buckets: under $1M, $1–3M, $3–5M, $5–10M, $10M+)", why: "Segments by revenue tier for pricing analysis" },
        { q: "What industry would you say you're in? Do you have any industry-specific accounting needs?", why: "Maps vertical and surfaces specialized requirements (job costing, retainage, etc.)" },
      ]
    },
    {
      name: "Current Financial Operations",
      color: COLORS.primary,
      questions: [
        { q: "Who handles your books today? In-house person, outside bookkeeper, CPA firm, you/spouse, or nobody?", why: "Maps the current provider landscape and identifies DIY owners" },
        { q: "What accounting software do you use? QuickBooks, Xero, spreadsheets, shoeboxes?", why: "Identifies migration complexity and tech sophistication" },
        { q: "How current are your books right now — like, today? When was your last complete monthly close?", why: "The key pain indicator. If books are >60 days behind, they're a strong prospect" },
        { q: "How much are you paying for accounting/bookkeeping services right now? Monthly or annually?", why: "Establishes current spend baseline — critical for pricing validation" },
        { q: "When was the last time you looked at a P&L or balance sheet and used it to make a business decision?", why: "Tests whether they use financials for decisions or just compliance" },
      ]
    },
    {
      name: "Pain Points (The Gold Mine)",
      color: COLORS.accent,
      questions: [
        { q: "What's the most frustrating thing about managing your business finances right now?", why: "Open-ended — let them rant. The pain they volunteer first is the real pain." },
        { q: "Have you ever missed a deduction, overpaid taxes, made a bad hiring/purchasing decision because you didn't have good financial data?", why: "Surfaces concrete $ cost of bad financial visibility" },
        { q: "How much time per week do YOU personally spend on financial admin — invoicing, bills, reconciliation, payroll questions?", why: "Quantifies owner time displacement value" },
        { q: "Has your bookkeeper or accountant ever made a significant mistake? What happened?", why: "Prior bad experience = pre-sold on quality" },
        { q: "Do you feel confident you know your exact cash position, profitability by service/project, and financial runway right now?", why: "If the answer is no to any of these — they need help" },
        { q: "Have you ever had a bank, bonding company, or lender ask for financials and you weren't ready?", why: "Compliance/banking pressure = high WTP signal" },
      ]
    },
    {
      name: "Value Proposition Testing",
      color: COLORS.gold,
      questions: [
        { q: "If I could give you a dashboard on your phone showing your real-time P&L, cash flow, and key metrics — updated every day, not 30 days late — how valuable would that be?", why: "Tests the core Digits real-time visibility value prop" },
        { q: "What would it be worth to you to never think about bookkeeping again — just have it done, accurately, every month?", why: "Tests the 'peace of mind' value prop — let them name a price" },
        { q: "If someone could show you exactly where you're leaking money — unnecessary expenses, pricing mistakes, unprofitable jobs — would you pay for that insight?", why: "Tests advisory/controller-level value prop" },
        { q: "Would you prefer a cheap basic bookkeeper, or would you pay more for someone who also gives you financial advice and strategy?", why: "Tests the CAS upsell — bookkeeping + advisory vs. bookkeeping alone" },
        { q: "What's the most you'd be willing to pay per month for a service that gave you clean books, real-time dashboards, and a quarterly financial strategy review?", why: "Direct WTP testing — compare to $1K/$2K tier pricing" },
      ]
    },
    {
      name: "Decision-Making & Buying Signals",
      color: COLORS.purple,
      questions: [
        { q: "If you were going to hire an accounting firm, what would matter most — price, industry expertise, technology, responsiveness, or something else?", why: "Identifies the primary buying criterion by segment" },
        { q: "How would you find an accounting firm? Google? Referral? Industry group? Your attorney or banker?", why: "Maps actual acquisition channels — validates GTM strategy" },
        { q: "Have you ever switched accounting providers? What made you switch? What was the biggest hesitation?", why: "Surfaces switching triggers and barriers" },
        { q: "Would the word 'AI' in an accounting firm's pitch make you more interested, less interested, or not care?", why: "Tests AI messaging — critical for positioning" },
        { q: "If a firm said 'we'll do a free financial health assessment of your books,' would you take that meeting?", why: "Validates the Digits Health Score as a lead gen mechanism" },
      ]
    },
    {
      name: "Closing",
      color: COLORS.primary,
      questions: [
        { q: "If you could have one thing about your business finances magically fixed overnight, what would it be?", why: "The magic wand question — pure gold for messaging" },
        { q: "Is there anything about how your finances are managed that keeps you up at night?", why: "Emotional anchor — identifies the deepest concern" },
        { q: "Would you be open to me following up if I build something that addresses the issues you described?", why: "Pipeline development — warm lead capture" },
      ]
    },
  ]
};

// Custom hook for API calls
const useAPI = (sheetsUrl) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const call = useCallback(
    async (action, data = null) => {
      if (!sheetsUrl) {
        setError('Apps Script URL not configured. Go to Settings tab.');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        let response;
        if (action === 'getData' || action === 'getSettings') {
          response = await fetch(`${sheetsUrl}?action=${action}`);
        } else {
          const payload = { action, ...data };
          const body = JSON.stringify(payload);
          const headers = { 'Content-Type': 'text/plain' };

          let firstResponse = await fetch(sheetsUrl, {
            method: 'POST',
            headers,
            body,
            redirect: 'manual',
          });

          if (firstResponse.type === 'opaqueredirect') {
            const redirectUrl = firstResponse.headers.get('Location');
            if (redirectUrl) {
              response = await fetch(redirectUrl, { method: 'POST', headers, body });
            } else {
              response = await fetch(sheetsUrl, { method: 'POST', headers, body, redirect: 'follow' });
            }
          } else {
            response = firstResponse;
          }
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        return result;
      } catch (err) {
        const msg = err.message || 'API call failed';
        setError(msg);
        console.error(`API ${action} error:`, err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [sheetsUrl]
  );

  return { call, loading, error, setError };
};

const useWindowWidth = () => {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
};

// ==================== SETTINGS PAGE ====================
function SettingsPage({ sheetsUrl, setSheetsUrl, apiKey, setApiKey }) {
  const [testLoading, setTestLoading] = useState(false);
  const [testStatus, setTestStatus] = useState(null);

  const handleTest = async () => {
    setTestLoading(true);
    setTestStatus(null);
    try {
      const response = await fetch(`${sheetsUrl}?action=getSettings`);
      if (response.ok) {
        setTestStatus({ success: true, msg: 'Connected to Apps Script!' });
      } else {
        setTestStatus({ success: false, msg: `HTTP ${response.status}. Check the URL.` });
      }
    } catch (err) {
      setTestStatus({ success: false, msg: `Connection failed: ${err.message}` });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h2 style={{ color: COLORS.text, marginBottom: '20px' }}>Settings</h2>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', color: COLORS.textDim, fontSize: '14px', marginBottom: '8px' }}>
          Apps Script Web App URL
        </label>
        <input type="text" value={sheetsUrl} onChange={(e) => setSheetsUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/..."
          style={{ width: '100%', padding: '10px', backgroundColor: COLORS.card, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: '4px', boxSizing: 'border-box', marginBottom: '10px' }} />
        <p style={{ color: COLORS.textDim, fontSize: '12px', margin: '0' }}>
          Get this from Extensions → Apps Script → Deploy → Manage deployments
        </p>
      </div>
      <button onClick={handleTest} disabled={testLoading || !sheetsUrl}
        style={{ padding: '10px 16px', backgroundColor: testLoading ? COLORS.border : COLORS.accent, color: '#fff', border: 'none', borderRadius: '4px', cursor: testLoading ? 'not-allowed' : 'pointer', marginBottom: '10px' }}>
        {testLoading ? 'Testing...' : 'Test Connection'}
      </button>
      {testStatus && (
        <div style={{ padding: '10px', backgroundColor: testStatus.success ? '#1b5e20' : '#b71c1c', color: '#fff', borderRadius: '4px', marginBottom: '20px', fontSize: '14px' }}>
          {testStatus.msg}
        </div>
      )}
      <div style={{ backgroundColor: COLORS.card, padding: '15px', borderRadius: '4px', color: COLORS.textDim, fontSize: '13px', lineHeight: '1.6' }}>
        <strong style={{ color: COLORS.text }}>Setup Instructions:</strong>
        <ol style={{ marginTop: '10px', paddingLeft: '20px' }}>
          <li>Open your Google Sheet → Extensions → Apps Script</li>
          <li>Replace all code with the provided Code.gs</li>
          <li>Deploy → Manage deployments → Edit → New version → Save</li>
          <li>Copy the web app URL and paste it above</li>
          <li>Set <code>anthropicApiKey</code> in the Settings sheet tab</li>
        </ol>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px',
  backgroundColor: COLORS.card,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: '4px',
  boxSizing: 'border-box',
  fontSize: '14px',
};

// ==================== V2 SCHEMA CONFIG ====================
const V2_SCHEMA = {
  practitioner: {
    label: 'Practitioners',
    singular: 'Practitioner',
    icon: '👥',
    idPrefix: 'prac',
    nameField: 'name',
    orgField: 'company',
    orgLabel: 'Firm Name',
    coreFields: [
      { key: 'name', label: 'Full Name', required: true },
      { key: 'company', label: 'Firm Name', required: true },
      { key: 'role', label: 'Role' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'location', label: 'Location (City, State)' },
    ],
    firmFields: [
      { key: 'industry', label: 'Industry' },
      { key: 'firmSize', label: 'Firm Size' },
      { key: 'clientCount', label: 'Client Count' },
      { key: 'avgClientRevenue', label: 'Avg Client Revenue' },
      { key: 'yearsInPractice', label: 'Years in Practice' },
      { key: 'leadScore', label: 'Lead Score (1-10)' },
    ],
    richFields: ['softwareStack', 'painPoints', 'wtpSignals', 'quotableLines'],
    statusOptions: ['new', 'contacted', 'interested', 'declined'],
  },
  business: {
    label: 'Businesses',
    singular: 'Business',
    icon: '🏢',
    idPrefix: 'biz',
    nameField: 'name',
    orgField: 'company',
    orgLabel: 'Company',
    coreFields: [
      { key: 'name', label: 'Owner Name', required: true },
      { key: 'company', label: 'Company', required: true },
      { key: 'role', label: 'Role' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'location', label: 'Location (City, State)' },
    ],
    firmFields: [
      { key: 'industry', label: 'Industry' },
      { key: 'revenue', label: 'Revenue (range, e.g. $1M-$3M)' },
      { key: 'employees', label: 'Employees' },
      { key: 'yearsInBusiness', label: 'Years in Business' },
      { key: 'currentAccounting', label: 'Current Accounting Setup' },
      { key: 'monthsBehind', label: 'Months Behind on Books' },
      { key: 'currentSpend', label: 'Current Annual Accounting Spend' },
      { key: 'leadScore', label: 'Lead Score (1-10)' },
    ],
    richFields: ['painPoints', 'wtpSignals', 'quotableLines'],
    statusOptions: ['new', 'contacted', 'interested', 'hired', 'declined'],
  },
};

// ==================== V2 CONTACT PAGE ====================
function V2ContactPage({ kind, rows, transcripts, onUpsert, onDelete, onLinkTranscript, onEnrich, loading }) {
  const cfg = V2_SCHEMA[kind];
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [filter, setFilter] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const emptyForm = { status: 'new' };
  const [formData, setFormData] = useState(emptyForm);

  const detailRow = rows.find((r) => r.id === detailId);
  const filtered = rows.filter((r) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return [r.name, r.company, r.industry, r.location]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  const openNew = () => { setFormData({ status: 'new' }); setEditingId(null); setShowForm(true); };
  const openEdit = (row) => { setFormData(row); setEditingId(row.id); setShowForm(true); };
  const resetForm = () => { setFormData(emptyForm); setEditingId(null); setShowForm(false); };

  const handleSave = async () => {
    if (saveStatus === 'saving') return;
    const missing = cfg.coreFields.filter((f) => f.required && !formData[f.key]).map((f) => f.label);
    if (missing.length) { alert('Required: ' + missing.join(', ')); return; }
    setSaveStatus('saving');
    const ok = await onUpsert({ ...formData, id: editingId || `${cfg.idPrefix}-${Date.now()}` });
    if (ok) { setSaveStatus('success'); setTimeout(() => { resetForm(); setSaveStatus('idle'); }, 1200); }
    else { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 2500); }
  };

  if (detailRow) {
    return (
      <ContactDetail
        row={detailRow}
        kind={kind}
        transcripts={transcripts.filter((t) => t.linkedContactId === detailRow.id)}
        onClose={() => setDetailId(null)}
        onEdit={() => { setDetailId(null); openEdit(detailRow); }}
        onDelete={async () => { if (window.confirm(`Delete ${detailRow.name}?`)) { await onDelete(detailRow.id); setDetailId(null); } }}
        onEnrich={(transcriptId) => onEnrich(kind, detailRow.id, transcriptId)}
      />
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: COLORS.text, margin: 0 }}>
          {cfg.icon} {cfg.label} <span style={{ color: COLORS.textDim, fontSize: 16, fontWeight: 400 }}>({rows.length})</span>
        </h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <input type="text" placeholder={`Search ${cfg.label.toLowerCase()}…`} value={filter} onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '8px 12px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, minWidth: 220 }} />
          <button onClick={() => (showForm ? resetForm() : openNew())}
            style={{ padding: '8px 16px', backgroundColor: showForm ? COLORS.border : COLORS.primary, color: showForm ? COLORS.text : '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
            {showForm ? 'Cancel' : `+ Add ${cfg.singular}`}
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ backgroundColor: COLORS.card, padding: 20, borderRadius: 8, marginBottom: 20, border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ marginTop: 0, color: COLORS.text }}>{editingId ? `Edit ${cfg.singular}` : `New ${cfg.singular}`}</h3>
          <V2Form cfg={cfg} formData={formData} setFormData={setFormData} onSave={handleSave} onCancel={resetForm} saveStatus={saveStatus} isEditing={!!editingId} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: COLORS.textDim, backgroundColor: COLORS.card, borderRadius: 8, border: `1px dashed ${COLORS.border}` }}>
          {rows.length === 0
            ? `No ${cfg.label.toLowerCase()} yet. They appear automatically after Zapier sends an interview.`
            : `No ${cfg.label.toLowerCase()} match "${filter}".`}
        </div>
      ) : (
        <div style={{ backgroundColor: COLORS.card, borderRadius: 8, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1.1fr 0.9fr 0.7fr 0.8fr', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: 'uppercase', borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.cardAlt }}>
            <div>Name</div><div>{cfg.orgLabel}</div><div>Industry</div><div>Revenue / Size</div><div>Status</div><div style={{ textAlign: 'right' }}>Actions</div>
          </div>
          {filtered.map((r) => (
            <div key={r.id} onClick={() => setDetailId(r.id)}
              style={{ display: 'grid', gridTemplateColumns: '1.3fr 1.6fr 1.1fr 0.9fr 0.7fr 0.8fr', padding: '12px 16px', fontSize: 13, borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer', alignItems: 'center' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.primaryLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
              <div style={{ fontWeight: 600, color: COLORS.text }}>
                {r.name || <span style={{ color: COLORS.textDim, fontStyle: 'italic' }}>(no name)</span>}
                {r.enrichedAt && <span style={{ marginLeft: 6, fontSize: 10, color: COLORS.success }}>✨</span>}
              </div>
              <div style={{ color: COLORS.textMuted }}>{r[cfg.orgField] || '—'}</div>
              <div style={{ color: COLORS.textMuted }}>{r.industry || '—'}</div>
              <div style={{ color: COLORS.textMuted }}>{kind === 'practitioner' ? (r.firmSize || '—') : (r.revenue || '—')}</div>
              <div><StatusPill status={r.status} /></div>
              <div style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => openEdit(r)} style={iconBtn}>✎</button>
                <button onClick={() => window.confirm(`Delete ${r.name}?`) && onDelete(r.id)} style={{ ...iconBtn, color: COLORS.danger }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {loading && <div style={{ textAlign: 'center', padding: 16, color: COLORS.textDim }}>Loading…</div>}
    </div>
  );
}

const iconBtn = { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontSize: 14, color: COLORS.textMuted };

function StatusPill({ status }) {
  const s = status || 'new';
  const colors = {
    new: { bg: '#EBF3FC', fg: '#2563A0' },
    contacted: { bg: '#FBF6E8', fg: '#9A7B2C' },
    interested: { bg: '#E8F5EE', fg: '#1A5C3A' },
    hired: { bg: '#F3EFFE', fg: '#6B4FA0' },
    declined: { bg: '#FCE8E8', fg: '#DC2626' },
    enriched: { bg: '#E8F5EE', fg: '#1A5C3A' },
  };
  const c = colors[s] || colors.new;
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: c.bg, color: c.fg, textTransform: 'capitalize' }}>{s}</span>;
}

function V2Form({ cfg, formData, setFormData, onSave, onCancel, saveStatus, isEditing }) {
  const isSaving = saveStatus === 'saving';
  const isSuccess = saveStatus === 'success';
  const isError = saveStatus === 'error';
  const btnLabel = isSaving ? 'Saving…' : isSuccess ? `✓ ${cfg.singular} ${isEditing ? 'Updated' : 'Created'}!` : isError ? '✗ Retry' : 'Save';
  const allFields = [...cfg.coreFields, ...cfg.firmFields];
  const updateField = (k, v) => setFormData((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {allFields.map((f) => (
          <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3 }}>
              {f.label}{f.required && <span style={{ color: COLORS.danger }}> *</span>}
            </label>
            {f.type === 'select' ? (
              <select value={formData[f.key] || ''} onChange={(e) => updateField(f.key, e.target.value)} style={inputStyle}>
                {f.options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
              </select>
            ) : (
              <input type={f.type || 'text'} value={formData[f.key] || ''} onChange={(e) => updateField(f.key, e.target.value)} style={inputStyle} />
            )}
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3 }}>Status</label>
          <select value={formData.status || 'new'} onChange={(e) => updateField('status', e.target.value)} style={inputStyle}>
            {cfg.statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3 }}>Interview Date</label>
          <input type="date" value={formData.interviewDate || ''} onChange={(e) => updateField('interviewDate', e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 0.3 }}>Notes</label>
        <textarea value={formData.notes || ''} onChange={(e) => updateField('notes', e.target.value)} style={{ ...inputStyle, width: '100%', minHeight: 80, marginTop: 4 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: '10px 16px', backgroundColor: COLORS.border, color: COLORS.text, border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
        <button onClick={onSave} disabled={isSaving || isSuccess}
          style={{ padding: '10px 18px', minWidth: 160, backgroundColor: isError ? COLORS.danger : COLORS.success, color: '#fff', border: 'none', borderRadius: 6, cursor: isSaving || isSuccess ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {isSaving && <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'autopilot-spin 0.7s linear infinite' }} />}
          {btnLabel}
        </button>
      </div>
      <style>{`@keyframes autopilot-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ==================== CONTACT DETAIL VIEW ====================
function ContactDetail({ row, kind, transcripts, onClose, onEdit, onDelete, onEnrich }) {
  const cfg = V2_SCHEMA[kind];
  const [enrichingId, setEnrichingId] = useState(null);
  const [enrichError, setEnrichError] = useState(null);
  const parse = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } };

  const pains = parse(row.painPoints);
  const wtp = parse(row.wtpSignals);
  const quotes = parse(row.quotableLines);
  const softwareStack = parse(row.softwareStack);

  const runEnrich = async (transcriptId) => {
    setEnrichError(null);
    setEnrichingId(transcriptId);
    const ok = await onEnrich(transcriptId);
    setEnrichingId(null);
    if (!ok) setEnrichError('Enrichment failed — check Settings API key and Drive permissions.');
  };

  return (
    <div style={{ padding: 20 }}>
      <button onClick={onClose} style={{ marginBottom: 12, background: 'none', border: 'none', color: COLORS.primary, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
        ← Back to {cfg.label}
      </button>
      <div style={{ backgroundColor: COLORS.card, borderRadius: 12, padding: 28, border: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: '0 0 4px', color: COLORS.text, fontFamily: DISPLAY, fontSize: 32 }}>
              {row.name || '(Unnamed)'}
              {row.enrichedAt && <span title={`Enriched ${row.enrichedAt}`} style={{ fontSize: 18, marginLeft: 10 }}>✨</span>}
            </h1>
            <div style={{ color: COLORS.textMuted, fontSize: 15 }}>
              {row[cfg.orgField] || '—'}
              {row.role && <> · {row.role}</>}
              {row.location && <> · 📍 {row.location}</>}
            </div>
            <div style={{ marginTop: 8 }}><StatusPill status={row.status} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEdit} style={{ padding: '8px 14px', backgroundColor: COLORS.blueLight, color: COLORS.blue, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>✎ Edit</button>
            <button onClick={onDelete} style={{ padding: '8px 14px', backgroundColor: '#FEF2F2', color: COLORS.danger, border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>🗑 Delete</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          {kind === 'business' ? (
            <>
              <Tile label="Industry" value={row.industry} />
              <Tile label="Revenue" value={row.revenue} />
              <Tile label="Employees" value={row.employees} />
              <Tile label="Years" value={row.yearsInBusiness} />
              <Tile label="Lead Score" value={row.leadScore ? `${row.leadScore}/10` : null} />
            </>
          ) : (
            <>
              <Tile label="Firm Size" value={row.firmSize} />
              <Tile label="Clients" value={row.clientCount} />
              <Tile label="Avg Client Rev" value={row.avgClientRevenue} />
              <Tile label="Years" value={row.yearsInPractice} />
              <Tile label="Lead Score" value={row.leadScore ? `${row.leadScore}/10` : null} />
            </>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24, fontSize: 13 }}>
          {row.email && <div><strong>Email:</strong> {row.email}</div>}
          {row.phone && <div><strong>Phone:</strong> {row.phone}</div>}
          {row.interviewDate && <div><strong>Interviewed:</strong> {row.interviewDate}</div>}
          {kind === 'business' && row.currentAccounting && <div><strong>Accounting:</strong> {row.currentAccounting}</div>}
          {kind === 'business' && row.monthsBehind && <div><strong>Months Behind:</strong> {row.monthsBehind}</div>}
          {kind === 'business' && row.currentSpend && <div><strong>Current Spend:</strong> {row.currentSpend}</div>}
        </div>

        {Array.isArray(pains) && pains.length > 0 && (
          <Section title="😤 Pain Points"><ChipList items={pains} color={COLORS.danger} /></Section>
        )}
        {Array.isArray(softwareStack) && softwareStack.length > 0 && (
          <Section title="🛠 Software Stack"><ChipList items={softwareStack} color={COLORS.blue} /></Section>
        )}
        {wtp && typeof wtp === 'object' && (
          <Section title="💰 Willingness-to-Pay Signals"><KVList obj={wtp} /></Section>
        )}
        {Array.isArray(quotes) && quotes.length > 0 && (
          <Section title="💬 Quotable Lines">
            {quotes.map((q, i) => (
              <div key={i} style={{ padding: '10px 14px', backgroundColor: COLORS.cardAlt, borderLeft: `3px solid ${COLORS.accent}`, borderRadius: 4, marginBottom: 8, fontStyle: 'italic', fontSize: 13 }}>"{q}"</div>
            ))}
          </Section>
        )}
        {row.notes && (
          <Section title="📝 Notes">
            <div style={{ fontSize: 13, lineHeight: 1.7, color: COLORS.text, whiteSpace: 'pre-wrap' }}>{row.notes}</div>
          </Section>
        )}

        <Section title="📄 Linked Transcripts">
          {transcripts.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.textDim, fontStyle: 'italic' }}>No transcripts linked.</div>
          ) : (
            transcripts.map((t) => (
              <div key={t.id} style={{ padding: 14, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.intervieweeName || t.intervieweeBusinessName || 'Interview'} — {t.interviewDate}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                    Status: {t.status}
                    {t.summaryUrl && <> · <a href={t.summaryUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.primary }}>Summary</a></>}
                    {t.transcriptUrl && <> · <a href={t.transcriptUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.primary }}>Transcript</a></>}
                  </div>
                </div>
                <button onClick={() => runEnrich(t.id)} disabled={enrichingId === t.id}
                  style={{ padding: '8px 14px', backgroundColor: enrichingId === t.id ? COLORS.border : COLORS.purple, color: enrichingId === t.id ? COLORS.textMuted : '#fff', border: 'none', borderRadius: 6, cursor: enrichingId === t.id ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12 }}>
                  {enrichingId === t.id ? '⏳ Enriching…' : '✨ Enrich with Claude'}
                </button>
              </div>
            ))
          )}
          {enrichError && <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 8 }}>{enrichError}</div>}
        </Section>
      </div>
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div style={{ padding: 14, backgroundColor: COLORS.cardAlt, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{value || <span style={{ color: COLORS.textDim, fontWeight: 400 }}>—</span>}</div>
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, color: COLORS.text, margin: '0 0 10px', fontWeight: 700 }}>{title}</h3>
      {children}
    </div>
  );
}
function ChipList({ items, color }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((it, i) => (
        <span key={i} style={{ padding: '5px 12px', borderRadius: 14, fontSize: 12, backgroundColor: color + '15', color, border: `1px solid ${color}30` }}>{String(it)}</span>
      ))}
    </div>
  );
}
function KVList({ obj }) {
  const entries = Object.entries(obj).filter(([, v]) => v);
  if (!entries.length) return <div style={{ fontSize: 12, color: COLORS.textDim, fontStyle: 'italic' }}>No data extracted.</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6, fontSize: 13 }}>
      {entries.map(([k, v]) => (
        <React.Fragment key={k}>
          <div style={{ color: COLORS.textDim, fontWeight: 600 }}>{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</div>
          <div style={{ color: COLORS.text }}>{String(v)}</div>
        </React.Fragment>
      ))}
    </div>
  );
}

// ==================== SCRIPT PAGE ====================
function ScriptPage({ contacts, scriptType }) {
  const script = scriptType === 'pro' ? PRO_SCRIPT : BIZ_SCRIPT;
  const [checkedQs, setCheckedQs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('autopilot-checklist') || '{}'); } catch { return {}; }
  });

  const toggleCheck = (key) => {
    const newChecked = { ...checkedQs, [key]: !checkedQs[key] };
    setCheckedQs(newChecked);
    localStorage.setItem('autopilot-checklist', JSON.stringify(newChecked));
  };

  const clearProgress = () => {
    if (window.confirm('Clear all checklist progress?')) {
      setCheckedQs({});
      localStorage.removeItem('autopilot-checklist');
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: COLORS.text, margin: 0 }}>{scriptType === 'pro' ? 'Professional' : 'Business'} Script</h2>
        <button onClick={clearProgress} style={{ padding: '8px 12px', backgroundColor: COLORS.danger, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Clear Progress</button>
      </div>
      <div style={{ backgroundColor: COLORS.card, padding: 20, borderRadius: 4, border: `1px solid ${COLORS.border}` }}>
        {script.sections.map((section, sectionIdx) => (
          <div key={sectionIdx} style={{ marginBottom: 28 }}>
            <h3 style={{ color: section.color, fontWeight: 700, marginBottom: 12, fontSize: 17 }}>{section.name}</h3>
            {section.questions.map((question, qIdx) => {
              const key = `${scriptType}-${sectionIdx}-${qIdx}`;
              const isChecked = checkedQs[key];
              return (
                <label key={qIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', color: COLORS.text, fontSize: 15, lineHeight: 1.6, marginBottom: 12, padding: 10, backgroundColor: isChecked ? COLORS.bg : 'transparent', borderRadius: 4, textDecoration: isChecked ? 'line-through' : 'none', opacity: isChecked ? 0.6 : 1, border: `1px solid ${COLORS.border}` }}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleCheck(key)} style={{ marginTop: 4, cursor: 'pointer', accentColor: COLORS.accent }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>{question.q}</div>
                    <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>{question.why}</div>
                  </div>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== THEMES PAGE ====================
function ThemesPage({ businesses, practitioners, sheetsUrl }) {
  const { call } = useAPI(sheetsUrl);
  const [bizThemes, setBizThemes] = useState(null);
  const [pracThemes, setPracThemes] = useState(null);
  const [bizLoading, setBizLoading] = useState(false);
  const [pracLoading, setPracLoading] = useState(false);
  const [bizError, setBizError] = useState(null);
  const [pracError, setPracError] = useState(null);

  const analyzeBusinesses = async () => {
    setBizLoading(true);
    setBizError(null);
    try {
      const result = await call('analyzeThemes', { type: 'business' });
      if (result && result.themes) setBizThemes(result.themes);
      else setBizError(result?.error || 'Analysis failed — check API key in Settings');
    } catch (e) {
      setBizError(e.message);
    }
    setBizLoading(false);
  };

  const analyzePractitioners = async () => {
    setPracLoading(true);
    setPracError(null);
    try {
      const result = await call('analyzeThemes', { type: 'practitioner' });
      if (result && result.themes) setPracThemes(result.themes);
      else setPracError(result?.error || 'Analysis failed — check API key in Settings');
    } catch (e) {
      setPracError(e.message);
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
      />
    </div>
  );
}

function ThemeSection({ title, icon, color, count, total, themes, loading, error, onAnalyze }) {
  return (
    <div style={{ marginBottom: 56 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: COLORS.text, fontSize: 20 }}>
          {icon} {title}
          <span style={{ color: COLORS.textDim, fontSize: 14, fontWeight: 400, marginLeft: 8 }}>
            ({count} enriched{total !== count ? ` of ${total}` : ''})
          </span>
        </h3>
        <button onClick={onAnalyze} disabled={loading || count === 0}
          style={{ padding: '10px 22px', backgroundColor: loading || count === 0 ? COLORS.border : color, color: loading || count === 0 ? COLORS.textMuted : '#fff', border: 'none', borderRadius: 8, cursor: loading || count === 0 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading ? (
            <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'autopilot-spin 0.7s linear infinite' }} /> Analyzing…</>
          ) : '🔍 Analyze Themes'}
        </button>
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

      {/* Practitioner-specific */}
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

// ==================== MAIN APP ====================
function App() {
  const [currentTab, setCurrentTab] = useState('practitioners');
  const [practitioners, setPractitioners] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [sheetsUrl, setSheetsUrl] = useState(() => {
    try { return localStorage.getItem('autopilot-sheets-url') || ''; } catch { return ''; }
  });
  const [apiKey, setApiKey] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const { call, loading } = useAPI(sheetsUrl);
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const loadData = async () => {
      if (!sheetsUrl) { setIsInitialized(true); return; }
      const data = await call('getData');
      if (data) {
        setPractitioners(data.practitioners || []);
        setBusinesses(data.businesses || []);
        setTranscripts(data.transcripts || []);
      }
      setIsInitialized(true);
    };
    loadData();
  }, [sheetsUrl]);

  useEffect(() => {
    if (sheetsUrl) localStorage.setItem('autopilot-sheets-url', sheetsUrl);
  }, [sheetsUrl]);

  const refreshData = async () => {
    const data = await call('getData');
    if (data) {
      setPractitioners(data.practitioners || []);
      setBusinesses(data.businesses || []);
      setTranscripts(data.transcripts || []);
    }
  };

  const handleUpsertPractitioner = async (row) => {
    const result = await call('upsertPractitioner', { data: row });
    if (result) {
      setPractitioners((prev) => {
        const i = prev.findIndex((p) => p.id === row.id);
        const merged = result.row || row;
        if (i >= 0) { const u = [...prev]; u[i] = merged; return u; }
        return [...prev, merged];
      });
      return true;
    }
    return false;
  };

  const handleDeletePractitioner = async (id) => {
    const result = await call('deletePractitioner', { id });
    if (result) setPractitioners((prev) => prev.filter((p) => p.id !== id));
  };

  const handleUpsertBusiness = async (row) => {
    const result = await call('upsertBusiness', { data: row });
    if (result) {
      setBusinesses((prev) => {
        const i = prev.findIndex((b) => b.id === row.id);
        const merged = result.row || row;
        if (i >= 0) { const u = [...prev]; u[i] = merged; return u; }
        return [...prev, merged];
      });
      return true;
    }
    return false;
  };

  const handleDeleteBusiness = async (id) => {
    const result = await call('deleteBusiness', { id });
    if (result) setBusinesses((prev) => prev.filter((b) => b.id !== id));
  };

  const handleLinkTranscript = async (transcriptId, linkedType, linkedContactId) => {
    const result = await call('linkTranscript', { transcriptId, linkedType, linkedContactId });
    if (result) { await refreshData(); return true; }
    return false;
  };

  const handleEnrichContact = async (contactType, contactId, transcriptId) => {
    const result = await call('enrichContact', { contactType, contactId, transcriptId });
    if (result) { await refreshData(); return true; }
    return false;
  };

  const handleDeleteTranscript = async (id) => {
    const result = await call('deleteTranscript', { id });
    if (result) setTranscripts((prev) => prev.filter((t) => t.id !== id));
  };

  const combinedContacts = [
    ...practitioners.map((p) => ({ ...p, type: 'pro' })),
    ...businesses.map((b) => ({ ...b, type: 'biz' })),
  ];

  const TABS = [
    { id: 'practitioners', label: '👥 Practitioners' },
    { id: 'businesses', label: '🏢 Businesses' },
    { id: 'themes', label: '🧠 Themes' },
    { id: 'script-pro', label: '📝 PRO Script' },
    { id: 'script-biz', label: '📝 BIZ Script' },
    { id: 'settings', label: '⚙ Settings' },
  ];

  const renderContent = () => {
    switch (currentTab) {
      case 'practitioners':
        return (
          <V2ContactPage kind="practitioner" rows={practitioners} transcripts={transcripts}
            onUpsert={handleUpsertPractitioner} onDelete={handleDeletePractitioner}
            onLinkTranscript={handleLinkTranscript} onEnrich={handleEnrichContact} loading={loading} />
        );
      case 'businesses':
        return (
          <V2ContactPage kind="business" rows={businesses} transcripts={transcripts}
            onUpsert={handleUpsertBusiness} onDelete={handleDeleteBusiness}
            onLinkTranscript={handleLinkTranscript} onEnrich={handleEnrichContact} loading={loading} />
        );
      case 'themes':
        return <ThemesPage businesses={businesses} practitioners={practitioners} sheetsUrl={sheetsUrl} />;
      case 'script-pro':
        return <ScriptPage contacts={combinedContacts} scriptType="pro" />;
      case 'script-biz':
        return <ScriptPage contacts={combinedContacts} scriptType="biz" />;
      case 'settings':
        return <SettingsPage sheetsUrl={sheetsUrl} setSheetsUrl={setSheetsUrl} apiKey={apiKey} setApiKey={setApiKey} />;
      default:
        return null;
    }
  };

  if (!isInitialized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: COLORS.bg, color: COLORS.text }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Karla:wght@400;500;600;700;800&family=Fraunces:wght@700;800;900&display=swap" rel="stylesheet" />

      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '60px' }}>{renderContent()}</div>
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: COLORS.sidebar, borderTop: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 100 }}>
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setCurrentTab(tab.id)}
                style={{ flex: 1, height: '100%', backgroundColor: currentTab === tab.id ? COLORS.accent : 'transparent', color: currentTab === tab.id ? '#fff' : COLORS.textDim, border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', width: '100%' }}>
          <div style={{ width: '200px', backgroundColor: COLORS.sidebar, borderRight: `1px solid ${COLORS.border}`, padding: '20px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 20px 8px', color: COLORS.accent }}>Autopilot</h1>
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setCurrentTab(tab.id)}
                style={{ padding: '10px 12px', backgroundColor: currentTab === tab.id ? COLORS.accent : 'transparent', color: currentTab === tab.id ? '#fff' : COLORS.text, border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: currentTab === tab.id ? 600 : 400, transition: 'all 0.15s' }}
                onMouseEnter={(e) => { if (currentTab !== tab.id) e.currentTarget.style.backgroundColor = COLORS.border; }}
                onMouseLeave={(e) => { if (currentTab !== tab.id) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                {tab.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: COLORS.bg }}>{renderContent()}</div>
        </div>
      )}
    </div>
  );
}

export default App;
