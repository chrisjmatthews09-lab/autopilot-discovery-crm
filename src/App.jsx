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
          // GET request
          response = await fetch(`${sheetsUrl}?action=${action}`);
        } else {
          // POST request with text/plain to avoid CORS preflight.
          // Google Apps Script redirects POST → GET on the first hop, losing the body.
          // Fix: use redirect:'manual' to catch the redirect URL, then re-POST to it.
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
            // Follow the redirect manually, re-POSTing the body
            const redirectUrl = firstResponse.headers.get('Location');
            if (redirectUrl) {
              response = await fetch(redirectUrl, {
                method: 'POST',
                headers,
                body,
              });
            } else {
              // No Location header — fall back to following redirect normally
              response = await fetch(sheetsUrl, {
                method: 'POST',
                headers,
                body,
                redirect: 'follow',
              });
            }
          } else {
            response = firstResponse;
          }
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        if (result.error) {
          throw new Error(result.error);
        }

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

// Hook to detect window width for responsive layout
const useWindowWidth = () => {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
};

// Settings Page Component
function SettingsPage({ sheetsUrl, setSheetsUrl, apiKey, setApiKey, onTestConnection }) {
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
        setTestStatus({
          success: false,
          msg: `HTTP ${response.status}. Check the URL.`,
        });
      }
    } catch (err) {
      setTestStatus({
        success: false,
        msg: `Connection failed: ${err.message}. Check CORS and URL.`,
      });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px' }}>
      <h2 style={{ color: COLORS.text, marginBottom: '20px' }}>Settings</h2>

      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            color: COLORS.textDim,
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          Apps Script Web App URL
        </label>
        <input
          type="text"
          value={sheetsUrl}
          onChange={(e) => setSheetsUrl(e.target.value)}
          placeholder="https://script.google.com/macros/d/..."
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: COLORS.card,
            color: COLORS.text,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '4px',
            boxSizing: 'border-box',
            marginBottom: '10px',
          }}
        />
        <p style={{ color: COLORS.textDim, fontSize: '12px', margin: '0' }}>
          Get this from Extensions → Apps Script → Deploy → New deployment
        </p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            color: COLORS.textDim,
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          Anthropic API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: COLORS.card,
            color: COLORS.text,
            border: `1px solid ${COLORS.border}`,
            borderRadius: '4px',
            boxSizing: 'border-box',
            marginBottom: '10px',
          }}
        />
        <p style={{ color: COLORS.textDim, fontSize: '12px', margin: '0' }}>
          This will be saved to your Google Sheet's Settings tab (server-side only)
        </p>
      </div>

      <button
        onClick={handleTest}
        disabled={testLoading || !sheetsUrl}
        style={{
          padding: '10px 16px',
          backgroundColor: testLoading ? COLORS.border : COLORS.accent,
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: testLoading ? 'not-allowed' : 'pointer',
          marginBottom: '10px',
        }}
      >
        {testLoading ? 'Testing...' : 'Test Connection'}
      </button>

      {testStatus && (
        <div
          style={{
            padding: '10px',
            backgroundColor: testStatus.success ? '#1b5e20' : '#b71c1c',
            color: '#fff',
            borderRadius: '4px',
            marginBottom: '20px',
            fontSize: '14px',
          }}
        >
          {testStatus.msg}
        </div>
      )}

      <div
        style={{
          backgroundColor: COLORS.card,
          padding: '15px',
          borderRadius: '4px',
          color: COLORS.textDim,
          fontSize: '13px',
          lineHeight: '1.6',
        }}
      >
        <strong style={{ color: COLORS.text }}>Setup Instructions:</strong>
        <ol style={{ marginTop: '10px', paddingLeft: '20px' }}>
          <li>Create a Google Sheet or open an existing one</li>
          <li>Go to Extensions → Apps Script</li>
          <li>Replace the default code with the provided Code.gs</li>
          <li>
            Click Deploy → New deployment → Web app → Execute as "Me" → Who has access
            "Anyone"
          </li>
          <li>Copy the web app URL from the deployment modal</li>
          <li>Paste it above and click Test Connection</li>
          <li>The API key will be sent to Google Sheets when you save</li>
        </ol>
      </div>
    </div>
  );
}

// CRM Page Component
function CRMPage({ contacts, onAdd, onEdit, onDelete, onExport, loading }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    role: '',
    type: 'pro',
    industry: '',
    phone: '',
    email: '',
    status: 'new',
    interviewDate: '',
    notes: '',
    source: '',
  });
  // 'idle' | 'saving' | 'success' | 'error'
  const [saveStatus, setSaveStatus] = useState('idle');
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  const resetForm = () => {
    setFormData({
      name: '',
      company: '',
      role: '',
      type: 'pro',
      industry: '',
      phone: '',
      email: '',
      status: 'new',
      interviewDate: '',
      notes: '',
      source: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (contact) => {
    setFormData(contact);
    setEditingId(contact.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (saveStatus === 'saving') return; // guard against double-click
    if (!formData.name || !formData.company) {
      alert('Name and company are required');
      return;
    }
    setSaveStatus('saving');
    const wasEditing = !!editingId;
    const ok = await onAdd({
      ...formData,
      id: editingId || `contact-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    });
    if (ok) {
      setSaveStatus('success');
      // brief success flash, then reset the form + status
      setTimeout(() => {
        resetForm();
        setSaveStatus('idle');
      }, 1400);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this contact?')) {
      onDelete(id);
    }
  };

  if (isMobile) {
    return (
      <div style={{ padding: '16px', maxWidth: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: COLORS.text, margin: '0' }}>Contacts</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '8px 12px',
              backgroundColor: COLORS.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {showForm ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {showForm && (
          <div
            style={{
              backgroundColor: COLORS.card,
              padding: '16px',
              borderRadius: '4px',
              marginBottom: '20px',
            }}
          >
            <MobileContactForm
              formData={formData}
              setFormData={setFormData}
              onSave={handleSave}
              onCancel={resetForm}
              isEditing={!!editingId}
              saveStatus={saveStatus}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button
            onClick={onExport}
            style={{
              padding: '8px 12px',
              backgroundColor: COLORS.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Export CSV
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {contacts.map((contact) => (
            <MobileContactCard
              key={contact.id}
              contact={contact}
              onEdit={() => handleEdit(contact)}
              onDelete={() => handleDelete(contact.id)}
            />
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '20px', color: COLORS.textDim }}>
            Loading...
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{ padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <h2 style={{ color: COLORS.text, margin: '0' }}>Contacts ({contacts.length})</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onExport}
            style={{
              padding: '8px 16px',
              backgroundColor: COLORS.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Export CSV
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '8px 16px',
              backgroundColor: COLORS.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {showForm ? 'Cancel' : '+ Add Contact'}
          </button>
        </div>
      </div>

      {showForm && (
        <div
          style={{
            backgroundColor: COLORS.card,
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ color: COLORS.text, marginTop: '0' }}>
            {editingId ? 'Edit Contact' : 'New Contact'}
          </h3>
          <DesktopContactForm
            formData={formData}
            setFormData={setFormData}
            onSave={handleSave}
            onCancel={resetForm}
            saveStatus={saveStatus}
            isEditing={!!editingId}
          />
        </div>
      )}

      {contacts.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px',
            color: COLORS.textDim,
          }}
        >
          No contacts yet. Add one to get started!
        </div>
      ) : (
        <div
          style={{
            overflowX: 'auto',
            backgroundColor: COLORS.card,
            borderRadius: '8px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
            }}
          >
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    color: COLORS.textDim,
                    fontWeight: '600',
                  }}
                >
                  Name
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    color: COLORS.textDim,
                    fontWeight: '600',
                  }}
                >
                  Company
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    color: COLORS.textDim,
                    fontWeight: '600',
                  }}
                >
                  Role
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    color: COLORS.textDim,
                    fontWeight: '600',
                  }}
                >
                  Type
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    color: COLORS.textDim,
                    fontWeight: '600',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    color: COLORS.textDim,
                    fontWeight: '600',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  style={{ borderBottom: `1px solid ${COLORS.border}` }}
                >
                  <td style={{ padding: '12px', color: COLORS.text }}>
                    {contact.name}
                  </td>
                  <td style={{ padding: '12px', color: COLORS.text }}>
                    {contact.company}
                  </td>
                  <td style={{ padding: '12px', color: COLORS.text }}>
                    {contact.role}
                  </td>
                  <td style={{ padding: '12px', color: COLORS.text }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        backgroundColor:
                          contact.type === 'pro' ? COLORS.accent : COLORS.warning,
                        color: '#fff',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      {contact.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: COLORS.text }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        backgroundColor:
                          contact.status === 'hired' ? COLORS.success : COLORS.warning,
                        color: '#fff',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      {contact.status}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      display: 'flex',
                      gap: '8px',
                      justifyContent: 'center',
                    }}
                  >
                    <button
                      onClick={() => handleEdit(contact)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: COLORS.border,
                        color: COLORS.text,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: COLORS.danger,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px', color: COLORS.textDim }}>
          Loading...
        </div>
      )}
    </div>
  );
}

function DesktopContactForm({ formData, setFormData, onSave, onCancel, saveStatus = 'idle', isEditing = false }) {
  const isSaving = saveStatus === 'saving';
  const isSuccess = saveStatus === 'success';
  const isError = saveStatus === 'error';
  const btnBg = isSuccess ? COLORS.success : isError ? COLORS.danger : COLORS.success;
  const btnLabel = isSaving
    ? (isEditing ? 'Updating…' : 'Saving…')
    : isSuccess
    ? (isEditing ? '✓ Contact Updated!' : '✓ Contact Created!')
    : isError
    ? '✗ Save Failed — Retry'
    : 'Save';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      <input
        type="text"
        placeholder="Name *"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Company *"
        value={formData.company}
        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Role"
        value={formData.role}
        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
        style={inputStyle}
      />
      <select
        value={formData.type}
        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
        style={inputStyle}
      >
        <option value="pro">Pro</option>
        <option value="biz">Business</option>
      </select>
      <input
        type="text"
        placeholder="Industry"
        value={formData.industry}
        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
        style={inputStyle}
      />
      <input
        type="tel"
        placeholder="Phone"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        style={inputStyle}
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        style={inputStyle}
      />
      <select
        value={formData.status}
        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        style={inputStyle}
      >
        <option value="new">New</option>
        <option value="contacted">Contacted</option>
        <option value="interested">Interested</option>
        <option value="hired">Hired</option>
        <option value="declined">Declined</option>
      </select>
      <input
        type="date"
        value={formData.interviewDate}
        onChange={(e) => setFormData({ ...formData, interviewDate: e.target.value })}
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Source"
        value={formData.source}
        onChange={(e) => setFormData({ ...formData, source: e.target.value })}
        style={inputStyle}
      />
      <textarea
        placeholder="Notes"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        style={{ ...inputStyle, gridColumn: '1 / -1', minHeight: '100px' }}
      />
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          gap: '10px',
          justifyContent: 'flex-end',
        }}
      >
        <button
          onClick={onCancel}
          style={{
            padding: '10px 16px',
            backgroundColor: COLORS.border,
            color: COLORS.text,
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isSaving || isSuccess}
          style={{
            padding: '10px 16px',
            minWidth: 170,
            backgroundColor: btnBg,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isSaving || isSuccess ? 'not-allowed' : 'pointer',
            opacity: isSaving && !isSuccess ? 0.85 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'background-color 0.25s ease',
            fontWeight: 600,
          }}
        >
          {isSaving && (
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'autopilot-spin 0.7s linear infinite',
              }}
            />
          )}
          {btnLabel}
        </button>
        <style>{`@keyframes autopilot-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function MobileContactForm({ formData, setFormData, onSave, onCancel, isEditing, saveStatus = 'idle' }) {
  const isSaving = saveStatus === 'saving';
  const isSuccess = saveStatus === 'success';
  const isError = saveStatus === 'error';
  const btnBg = isSuccess ? COLORS.success : isError ? COLORS.danger : COLORS.success;
  const btnLabel = isSaving
    ? (isEditing ? 'Updating…' : 'Saving…')
    : isSuccess
    ? (isEditing ? '✓ Updated!' : '✓ Created!')
    : isError
    ? '✗ Retry'
    : (isEditing ? 'Update' : 'Add');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <input
        type="text"
        placeholder="Name *"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Company *"
        value={formData.company}
        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Role"
        value={formData.role}
        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
        style={inputStyle}
      />
      <select
        value={formData.type}
        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
        style={inputStyle}
      >
        <option value="pro">Pro</option>
        <option value="biz">Business</option>
      </select>
      <input
        type="text"
        placeholder="Industry"
        value={formData.industry}
        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
        style={inputStyle}
      />
      <input
        type="tel"
        placeholder="Phone"
        value={formData.phone}
        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        style={inputStyle}
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        style={inputStyle}
      />
      <select
        value={formData.status}
        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        style={inputStyle}
      >
        <option value="new">New</option>
        <option value="contacted">Contacted</option>
        <option value="interested">Interested</option>
        <option value="hired">Hired</option>
        <option value="declined">Declined</option>
      </select>
      <input
        type="date"
        value={formData.interviewDate}
        onChange={(e) => setFormData({ ...formData, interviewDate: e.target.value })}
        style={inputStyle}
      />
      <input
        type="text"
        placeholder="Source"
        value={formData.source}
        onChange={(e) => setFormData({ ...formData, source: e.target.value })}
        style={inputStyle}
      />
      <textarea
        placeholder="Notes"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        style={{ ...inputStyle, minHeight: '80px' }}
      />
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: COLORS.border,
            color: COLORS.text,
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isSaving || isSuccess}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: btnBg,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: isSaving || isSuccess ? 'not-allowed' : 'pointer',
            opacity: isSaving && !isSuccess ? 0.85 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'background-color 0.25s ease',
            fontWeight: 600,
          }}
        >
          {isSaving && (
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'autopilot-spin 0.7s linear infinite',
              }}
            />
          )}
          {btnLabel}
        </button>
      </div>
    </div>
  );
}

function MobileContactCard({ contact, onEdit, onDelete }) {
  return (
    <div
      style={{
        backgroundColor: COLORS.card,
        padding: '12px',
        borderRadius: '4px',
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '8px',
        }}
      >
        <div>
          <div style={{ color: COLORS.text, fontWeight: '600', marginBottom: '4px' }}>
            {contact.name}
          </div>
          <div style={{ color: COLORS.textDim, fontSize: '13px' }}>
            {contact.company}
          </div>
        </div>
        <span
          style={{
            padding: '4px 8px',
            backgroundColor: contact.status === 'hired' ? COLORS.success : COLORS.warning,
            color: '#fff',
            borderRadius: '4px',
            fontSize: '11px',
          }}
        >
          {contact.status}
        </span>
      </div>

      {contact.role && (
        <div style={{ color: COLORS.textDim, fontSize: '12px', marginBottom: '4px' }}>
          {contact.role}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          onClick={onEdit}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: COLORS.accent,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          style={{
            flex: 1,
            padding: '8px',
            backgroundColor: COLORS.danger,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// Analysis Page Component
function AnalysisPage({ contacts, sheetsUrl, onAnalysisComplete }) {
  const { call, loading, error, setError } = useAPI(sheetsUrl);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [scriptType, setScriptType] = useState('pro');
  const [transcript, setTranscript] = useState('');
  const [intervieweeName, setIntervieweeName] = useState('');
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    if (!selectedContactId || !transcript.trim()) {
      setError('Please select a contact and enter a transcript');
      return;
    }

    const result = await call('analyzeTranscript', {
      transcript,
      interviewType: scriptType,
      intervieweeName: intervieweeName || 'Unknown',
    });

    if (result) {
      setResult(result);
      // Save the analysis
      await call('saveAnalysis', {
        data: {
          id: `analysis-${Date.now()}`,
          contactId: selectedContactId,
          intervieweeName: intervieweeName || 'Unknown',
          type: scriptType,
          analyzedAt: new Date().toISOString(),
          overallSentiment: result.overallSentiment || '',
          leadScore: result.leadScore || result.relevanceScore || 0,
          fullJSON: JSON.stringify(result),
        },
      });
      setTranscript('');
      setResult(null);
      alert('Analysis saved!');
      if (onAnalysisComplete) onAnalysisComplete();
    }
  };

  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  return (
    <div style={{ padding: isMobile ? '16px' : '20px', maxWidth: isMobile ? '100%' : '800px' }}>
      <h2 style={{ color: COLORS.text, marginBottom: '20px' }}>Analyze Transcript</h2>

      {error && (
        <div
          style={{
            padding: '12px',
            backgroundColor: COLORS.danger,
            color: '#fff',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            color: COLORS.textDim,
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          Select Contact
        </label>
        <select
          value={selectedContactId}
          onChange={(e) => setSelectedContactId(e.target.value)}
          style={inputStyle}
        >
          <option value="">-- Choose a contact --</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.company})
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            color: COLORS.textDim,
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          Interviewee Name
        </label>
        <input
          type="text"
          value={intervieweeName}
          onChange={(e) => setIntervieweeName(e.target.value)}
          placeholder="Optional"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            color: COLORS.textDim,
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          Interview Type
        </label>
        <select
          value={scriptType}
          onChange={(e) => setScriptType(e.target.value)}
          style={inputStyle}
        >
          <option value="pro">Professional (PRO Script)</option>
          <option value="biz">Business (BIZ Script)</option>
        </select>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            color: COLORS.textDim,
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          Transcript *
        </label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste the interview transcript here..."
          style={{
            ...inputStyle,
            minHeight: isMobile ? '200px' : '300px',
          }}
        />
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          padding: '10px 16px',
          backgroundColor: loading ? COLORS.border : COLORS.accent,
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
          width: isMobile ? '100%' : 'auto',
        }}
      >
        {loading ? 'Analyzing...' : 'Analyze with Claude'}
      </button>

      {result && (
        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: COLORS.card,
            borderRadius: '4px',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <h3 style={{ color: COLORS.text, marginTop: '0' }}>Analysis Result</h3>
          <pre
            style={{
              color: COLORS.textDim,
              fontSize: '12px',
              overflowX: 'auto',
              padding: '12px',
              backgroundColor: COLORS.bg,
              borderRadius: '4px',
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// Script Page Component
function ScriptPage({ contacts, scriptType }) {
  const script = scriptType === 'pro' ? PRO_SCRIPT : BIZ_SCRIPT;
  const [selectedContactId, setSelectedContactId] = useState('');
  const [checkedQs, setCheckedQs] = useState(() => {
    try {
      const saved = localStorage.getItem('autopilot-checklist');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

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
    <div style={{ padding: isMobile ? '16px' : '20px', maxWidth: isMobile ? '100%' : '900px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '12px' : '0',
        }}
      >
        <h2 style={{ color: COLORS.text, margin: '0' }}>
          {scriptType === 'pro' ? 'Professional' : 'Business'} Script
        </h2>
        <button
          onClick={clearProgress}
          style={{
            padding: '8px 12px',
            backgroundColor: COLORS.danger,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Clear Progress
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            color: COLORS.textDim,
            fontSize: '14px',
            marginBottom: '8px',
          }}
        >
          Current Contact (for reference)
        </label>
        <select
          value={selectedContactId}
          onChange={(e) => setSelectedContactId(e.target.value)}
          style={inputStyle}
        >
          <option value="">-- No contact selected --</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.company})
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          backgroundColor: COLORS.card,
          padding: isMobile ? '12px' : '20px',
          borderRadius: '4px',
          border: `1px solid ${COLORS.border}`,
        }}
      >
                {script.sections.map((section, sectionIdx) => (
          <div key={sectionIdx} style={{ marginBottom: '28px' }}>
            <h3 style={{
              color: section.color,
              fontWeight: '700',
              marginBottom: '12px',
              fontSize: '17px'
            }}>
              {section.name}
            </h3>
            {section.questions.map((question, qIdx) => {
              const key = `${scriptType}-${sectionIdx}-${qIdx}`;
              const isChecked = checkedQs[key];
              return (
                <label
                  key={qIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    color: COLORS.text,
                    fontSize: '15px',
                    lineHeight: '1.6',
                    marginBottom: '12px',
                    padding: '10px',
                    backgroundColor: isChecked ? COLORS.bg : 'transparent',
                    borderRadius: '4px',
                    textDecoration: isChecked ? 'line-through' : 'none',
                    opacity: isChecked ? 0.6 : 1,
                    border: `1px solid ${COLORS.border}`
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCheck(key)}
                    style={{
                      marginTop: '4px',
                      cursor: 'pointer',
                      accentColor: COLORS.accent,
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>{question.q}</div>
                    <div style={{ fontSize: '13px', color: COLORS.textDim, marginTop: '4px' }}>
                      {question.why}
                    </div>
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

// Main App Component
// ==================== V2 SCHEMA CONFIG ====================
const V2_SCHEMA = {
  practitioner: {
    label: 'Practitioners',
    singular: 'Practitioner',
    icon: '👥',
    idPrefix: 'prac',
    nameField: 'name',
    orgField: 'firmName',
    orgLabel: 'Firm Name',
    coreFields: [
      { key: 'name', label: 'Full Name', required: true },
      { key: 'firmName', label: 'Firm Name', required: true },
      { key: 'role', label: 'Role' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'location', label: 'Location (City, State)' },
    ],
    firmFields: [
      { key: 'firmType', label: 'Firm Type', type: 'select',
        options: ['', 'tax', 'bookkeeping', 'tax+bk', 'cas', 'cfo-advisory', 'full-service'] },
      { key: 'firmSize', label: 'Firm Size', type: 'select',
        options: ['', 'solo', '2-5', '6-20', '20+'] },
      { key: 'clientCount', label: 'Client Count' },
      { key: 'revenueEstimate', label: 'Firm Revenue (range)' },
      { key: 'yearsInBusiness', label: 'Years in Business' },
      { key: 'aiSentiment', label: 'AI Sentiment', type: 'select',
        options: ['', 'positive', 'neutral', 'negative'] },
    ],
    richFields: ['specialties', 'techStack', 'painPoints', 'acquisitionSignals'],
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

// ==================== V2 CONTACT PAGE (shared by practitioners + businesses) ====================
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
    return [r.name, r.firmName, r.company, r.industry, r.location, r.firmType]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  const openNew = () => {
    setFormData({ status: 'new' });
    setEditingId(null);
    setShowForm(true);
  };
  const openEdit = (row) => {
    setFormData(row);
    setEditingId(row.id);
    setShowForm(true);
  };
  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (saveStatus === 'saving') return;
    const missing = cfg.coreFields
      .filter((f) => f.required && !formData[f.key])
      .map((f) => f.label);
    if (missing.length) {
      alert('Required: ' + missing.join(', '));
      return;
    }
    setSaveStatus('saving');
    const ok = await onUpsert({
      ...formData,
      id: editingId || `${cfg.idPrefix}-${Date.now()}`,
    });
    if (ok) {
      setSaveStatus('success');
      setTimeout(() => { resetForm(); setSaveStatus('idle'); }, 1200);
    } else {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  if (detailRow) {
    return (
      <ContactDetail
        row={detailRow}
        kind={kind}
        transcripts={transcripts.filter((t) => t.linkedContactId === detailRow.id)}
        onClose={() => setDetailId(null)}
        onEdit={() => { setDetailId(null); openEdit(detailRow); }}
        onDelete={async () => {
          if (window.confirm(`Delete ${detailRow.name}?`)) {
            await onDelete(detailRow.id);
            setDetailId(null);
          }
        }}
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
          <input
            type="text"
            placeholder={`Search ${cfg.label.toLowerCase()}…`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ padding: '8px 12px', border: `1px solid ${COLORS.border}`, borderRadius: 6, fontSize: 13, minWidth: 220 }}
          />
          <button
            onClick={() => (showForm ? resetForm() : openNew())}
            style={{ padding: '8px 16px', backgroundColor: showForm ? COLORS.border : COLORS.primary, color: showForm ? COLORS.text : '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
          >
            {showForm ? 'Cancel' : `+ Add ${cfg.singular}`}
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ backgroundColor: COLORS.card, padding: 20, borderRadius: 8, marginBottom: 20, border: `1px solid ${COLORS.border}` }}>
          <h3 style={{ marginTop: 0, color: COLORS.text }}>
            {editingId ? `Edit ${cfg.singular}` : `New ${cfg.singular}`}
          </h3>
          <V2Form cfg={cfg} formData={formData} setFormData={setFormData} onSave={handleSave} onCancel={resetForm} saveStatus={saveStatus} isEditing={!!editingId} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: COLORS.textDim, backgroundColor: COLORS.card, borderRadius: 8, border: `1px dashed ${COLORS.border}` }}>
          {rows.length === 0
            ? `No ${cfg.label.toLowerCase()} yet. Click "+ Add ${cfg.singular}" to create one, or import from the Inbox.`
            : `No ${cfg.label.toLowerCase()} match "${filter}".`}
        </div>
      ) : (
        <div style={{ backgroundColor: COLORS.card, borderRadius: 8, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: kind === 'practitioner' ? '1.3fr 1.6fr 1fr 0.9fr 0.9fr 0.8fr' : '1.3fr 1.6fr 1.1fr 0.9fr 0.7fr 0.8fr', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: COLORS.textDim, textTransform: 'uppercase', borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.cardAlt }}>
            <div>Name</div>
            <div>{cfg.orgLabel}</div>
            <div>{kind === 'practitioner' ? 'Firm Type' : 'Industry'}</div>
            <div>{kind === 'practitioner' ? 'Size' : 'Revenue'}</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
          {filtered.map((r) => (
            <div key={r.id} onClick={() => setDetailId(r.id)} style={{ display: 'grid', gridTemplateColumns: kind === 'practitioner' ? '1.3fr 1.6fr 1fr 0.9fr 0.9fr 0.8fr' : '1.3fr 1.6fr 1.1fr 0.9fr 0.7fr 0.8fr', padding: '12px 16px', fontSize: 13, borderBottom: `1px solid ${COLORS.border}`, cursor: 'pointer', alignItems: 'center', transition: 'background-color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.primaryLight; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div style={{ fontWeight: 600, color: COLORS.text }}>
                {r.name || <span style={{ color: COLORS.textDim, fontStyle: 'italic' }}>(no name)</span>}
                {r.enrichedAt && <span style={{ marginLeft: 6, fontSize: 10, color: COLORS.success }}>✨</span>}
              </div>
              <div style={{ color: COLORS.textMuted }}>{r[cfg.orgField] || '—'}</div>
              <div style={{ color: COLORS.textMuted }}>{kind === 'practitioner' ? r.firmType : r.industry || '—'}</div>
              <div style={{ color: COLORS.textMuted }}>{kind === 'practitioner' ? r.firmSize : r.revenue || '—'}</div>
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
    new_needs_enrichment: { bg: '#FFF0EB', fg: '#C4552D' },
  };
  const c = colors[s] || colors.new;
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, backgroundColor: c.bg, color: c.fg, textTransform: 'capitalize' }}>{s.replace(/_/g, ' ')}</span>;
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
        <button onClick={onSave} disabled={isSaving || isSuccess} style={{ padding: '10px 18px', minWidth: 160, backgroundColor: isError ? COLORS.danger : COLORS.success, color: '#fff', border: 'none', borderRadius: 6, cursor: isSaving || isSuccess ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {isSaving && (<span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'autopilot-spin 0.7s linear infinite' }} />)}
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
  const acqSignals = parse(row.acquisitionSignals);
  const quotes = parse(row.quotableLines);
  const specialties = parse(row.specialties);
  const techStack = parse(row.techStack);

  const runEnrich = async (transcriptId) => {
    setEnrichError(null);
    setEnrichingId(transcriptId);
    const ok = await onEnrich(transcriptId);
    setEnrichingId(null);
    if (!ok) setEnrichError('Enrichment failed — check API key in Settings and that the Drive file is readable.');
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

        {/* Top tiles */}
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
              <Tile label="Firm Type" value={row.firmType} />
              <Tile label="Size" value={row.firmSize} />
              <Tile label="Clients" value={row.clientCount} />
              <Tile label="Revenue" value={row.revenueEstimate} />
              <Tile label="Years" value={row.yearsInBusiness} />
              <Tile label="AI Sentiment" value={row.aiSentiment} />
            </>
          )}
        </div>

        {/* Contact info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24, fontSize: 13 }}>
          {row.email && <div><strong>Email:</strong> {row.email}</div>}
          {row.phone && <div><strong>Phone:</strong> {row.phone}</div>}
          {row.interviewDate && <div><strong>Interviewed:</strong> {row.interviewDate}</div>}
          {kind === 'business' && row.currentAccounting && <div><strong>Accounting:</strong> {row.currentAccounting}</div>}
          {kind === 'business' && row.monthsBehind && <div><strong>Months Behind:</strong> {row.monthsBehind}</div>}
          {kind === 'business' && row.currentSpend && <div><strong>Current Spend:</strong> {row.currentSpend}</div>}
        </div>

        {/* Rich sections */}
        {Array.isArray(pains) && pains.length > 0 && (
          <Section title="😤 Pain Points">
            <ChipList items={pains} color={COLORS.danger} />
          </Section>
        )}
        {Array.isArray(specialties) && specialties.length > 0 && (
          <Section title="🎯 Specialties">
            <ChipList items={specialties} color={COLORS.primary} />
          </Section>
        )}
        {Array.isArray(techStack) && techStack.length > 0 && (
          <Section title="🛠 Tech Stack">
            <ChipList items={techStack} color={COLORS.blue} />
          </Section>
        )}
        {wtp && typeof wtp === 'object' && (
          <Section title="💰 Willingness-to-Pay Signals">
            <KVList obj={wtp} />
          </Section>
        )}
        {acqSignals && typeof acqSignals === 'object' && (
          <Section title="🤝 Acquisition Signals">
            <KVList obj={acqSignals} />
          </Section>
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

        {/* Transcripts */}
        <Section title="📄 Linked Transcripts">
          {transcripts.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.textDim, fontStyle: 'italic' }}>
              No transcripts linked. Head to the Inbox to link one when it arrives from Plaud.
            </div>
          ) : (
            transcripts.map((t) => (
              <div key={t.id} style={{ padding: 14, border: `1px solid ${COLORS.border}`, borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.intervieweeName || 'Interview'} — {t.interviewDate}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>
                    Status: {t.status} ·
                    {t.summaryUrl && <> <a href={t.summaryUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.primary }}>Summary</a></>}
                    {t.transcriptUrl && <> · <a href={t.transcriptUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.primary }}>Transcript</a></>}
                  </div>
                </div>
                <button
                  onClick={() => runEnrich(t.id)}
                  disabled={enrichingId === t.id}
                  style={{ padding: '8px 14px', backgroundColor: enrichingId === t.id ? COLORS.border : COLORS.purple, color: enrichingId === t.id ? COLORS.textMuted : '#fff', border: 'none', borderRadius: 6, cursor: enrichingId === t.id ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 12 }}
                >
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

// ==================== TRANSCRIPTS INBOX ====================
function TranscriptsInboxPage({ transcripts, practitioners, businesses, onLinkTranscript, onEnrich, onDelete, onUpsertPractitioner, onUpsertBusiness, loading }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const visible = transcripts.filter((t) => filterStatus === 'all' || t.status === filterStatus);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: COLORS.text, margin: 0 }}>📥 Transcripts Inbox <span style={{ color: COLORS.textDim, fontSize: 16, fontWeight: 400 }}>({transcripts.length})</span></h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', 'new', 'linked', 'enriched'].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, backgroundColor: filterStatus === s ? COLORS.primary : COLORS.border, color: filterStatus === s ? '#fff' : COLORS.text, textTransform: 'capitalize' }}>{s}</button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16, padding: 14, backgroundColor: COLORS.primaryLight, borderRadius: 8, border: `1px solid ${COLORS.primary}20` }}>
        💡 New interview transcripts from your Plaud → Zapier pipeline land here. For each, link it to an existing Practitioner or Business, then hit <strong>Enrich with Claude</strong> to auto-populate fields from the summary.
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: COLORS.textDim, backgroundColor: COLORS.card, borderRadius: 8, border: `1px dashed ${COLORS.border}` }}>
          {transcripts.length === 0
            ? 'No transcripts yet. Make sure your Zap is writing to the Transcripts sheet.'
            : `No transcripts with status "${filterStatus}".`}
        </div>
      ) : (
        visible.map((t) => (
          <TranscriptRow
            key={t.id}
            transcript={t}
            practitioners={practitioners}
            businesses={businesses}
            onLink={onLinkTranscript}
            onEnrich={onEnrich}
            onDelete={onDelete}
            onUpsertPractitioner={onUpsertPractitioner}
            onUpsertBusiness={onUpsertBusiness}
          />
        ))
      )}

      {loading && <div style={{ textAlign: 'center', padding: 16, color: COLORS.textDim }}>Loading…</div>}
    </div>
  );
}

function TranscriptRow({ transcript, practitioners, businesses, onLink, onEnrich, onDelete, onUpsertPractitioner, onUpsertBusiness }) {
  const [linkMode, setLinkMode] = useState(null); // null | 'practitioner' | 'business'
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Fuzzy-match suggestion
  const suggestion = (() => {
    if (!transcript.intervieweeName) return null;
    const q = transcript.intervieweeName.toLowerCase();
    const pMatch = practitioners.find((p) => p.name && p.name.toLowerCase().includes(q));
    if (pMatch) return { kind: 'practitioner', row: pMatch };
    const bMatch = businesses.find((b) => b.name && b.name.toLowerCase().includes(q));
    if (bMatch) return { kind: 'business', row: bMatch };
    return null;
  })();

  const pool = linkMode === 'practitioner' ? practitioners : linkMode === 'business' ? businesses : [];

  const runLink = async (kind, contactId) => {
    setBusy(true);
    setFeedback(null);
    const ok = await onLink(transcript.id, kind, contactId);
    setBusy(false);
    setFeedback(ok ? `✓ Linked to ${kind}` : '✗ Link failed');
  };

  const runEnrich = async () => {
    setBusy(true);
    setFeedback(null);
    const ok = await onEnrich(transcript.linkedType, transcript.linkedContactId, transcript.id);
    setBusy(false);
    setFeedback(ok ? '✓ Enriched' : '✗ Enrichment failed — check Settings API key and Drive permissions.');
  };

  const createAndLink = async (kind) => {
    setBusy(true);
    const newId = `${kind === 'practitioner' ? 'prac' : 'biz'}-${Date.now()}`;
    const row = {
      id: newId,
      name: transcript.intervieweeName || 'New from transcript',
      status: 'new',
      interviewDate: transcript.interviewDate,
      transcriptUrl: transcript.transcriptUrl,
      summaryUrl: transcript.summaryUrl,
      source: 'plaud',
    };
    const ok = kind === 'practitioner' ? await onUpsertPractitioner(row) : await onUpsertBusiness(row);
    if (ok) await onLink(transcript.id, kind, newId);
    setBusy(false);
    setFeedback(ok ? `✓ Created new ${kind} and linked` : '✗ Failed');
  };

  const enriched = transcript.status === 'enriched';
  const linked = transcript.status === 'linked' || enriched;

  return (
    <div style={{ padding: 16, backgroundColor: COLORS.card, borderRadius: 8, border: `1px solid ${COLORS.border}`, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>
            📄 {transcript.intervieweeName || '(Name not parsed)'}
            <span style={{ marginLeft: 10, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, backgroundColor: enriched ? COLORS.primaryLight : linked ? COLORS.blueLight : COLORS.accentLight, color: enriched ? COLORS.primary : linked ? COLORS.blue : COLORS.accent }}>
              {transcript.status}
            </span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>
            📅 {transcript.interviewDate}
            {transcript.summaryUrl && <> · <a href={transcript.summaryUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.primary }}>Summary</a></>}
            {transcript.transcriptUrl && <> · <a href={transcript.transcriptUrl} target="_blank" rel="noreferrer" style={{ color: COLORS.primary }}>Transcript</a></>}
          </div>
        </div>
        <button onClick={() => window.confirm('Delete this transcript?') && onDelete(transcript.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.textDim, fontSize: 14 }}>🗑</button>
      </div>

      {!linked && suggestion && (
        <div style={{ padding: 10, backgroundColor: COLORS.primaryLight, borderRadius: 6, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12 }}>
            💡 <strong>Suggested match:</strong> {suggestion.row.name}
            {suggestion.row.firmName && <> @ {suggestion.row.firmName}</>}
            {suggestion.row.company && <> @ {suggestion.row.company}</>}
            <span style={{ color: COLORS.textDim }}> ({suggestion.kind})</span>
          </div>
          <button onClick={() => runLink(suggestion.kind, suggestion.row.id)} disabled={busy} style={{ padding: '6px 14px', backgroundColor: COLORS.primary, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✓ Link</button>
        </div>
      )}

      {!linked && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setLinkMode(linkMode === 'practitioner' ? null : 'practitioner')} style={{ padding: '6px 12px', backgroundColor: linkMode === 'practitioner' ? COLORS.primary : COLORS.border, color: linkMode === 'practitioner' ? '#fff' : COLORS.text, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🔗 Link to Practitioner</button>
          <button onClick={() => setLinkMode(linkMode === 'business' ? null : 'business')} style={{ padding: '6px 12px', backgroundColor: linkMode === 'business' ? COLORS.primary : COLORS.border, color: linkMode === 'business' ? '#fff' : COLORS.text, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🔗 Link to Business</button>
          <button onClick={() => createAndLink('practitioner')} disabled={busy} style={{ padding: '6px 12px', backgroundColor: COLORS.accent, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>➕ Create Practitioner</button>
          <button onClick={() => createAndLink('business')} disabled={busy} style={{ padding: '6px 12px', backgroundColor: COLORS.accent, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>➕ Create Business</button>
        </div>
      )}

      {linkMode && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            <option value="">Select a {linkMode}…</option>
            {pool.map((r) => (
              <option key={r.id} value={r.id}>{r.name} {r.firmName || r.company ? `(${r.firmName || r.company})` : ''}</option>
            ))}
          </select>
          <button onClick={() => selectedId && runLink(linkMode, selectedId)} disabled={!selectedId || busy} style={{ padding: '6px 14px', backgroundColor: COLORS.primary, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Link</button>
        </div>
      )}

      {linked && !enriched && (
        <div style={{ marginTop: 8 }}>
          <button onClick={runEnrich} disabled={busy} style={{ padding: '8px 16px', backgroundColor: COLORS.purple, color: '#fff', border: 'none', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}>
            {busy ? '⏳ Enriching…' : '✨ Enrich with Claude'}
          </button>
        </div>
      )}

      {enriched && (
        <div style={{ marginTop: 8, fontSize: 12, color: COLORS.success, fontWeight: 600 }}>
          ✨ Enriched {transcript.processedAt ? `on ${new Date(transcript.processedAt).toLocaleDateString()}` : ''}
        </div>
      )}

      {feedback && <div style={{ marginTop: 8, fontSize: 12, color: feedback.startsWith('✓') ? COLORS.success : COLORS.danger }}>{feedback}</div>}
    </div>
  );
}

function App() {
  const [currentTab, setCurrentTab] = useState('practitioners');
  const [contacts, setContacts] = useState([]); // legacy, unused in V2 flows
  const [practitioners, setPractitioners] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [sheetsUrl, setSheetsUrl] = useState(() => {
    try {
      return localStorage.getItem('autopilot-sheets-url') || '';
    } catch {
      return '';
    }
  });
  const [apiKey, setApiKey] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const { call, loading } = useAPI(sheetsUrl);
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  // Load initial data on mount
  useEffect(() => {
    const loadData = async () => {
      if (!sheetsUrl) {
        setIsInitialized(true);
        return;
      }

      const data = await call('getData');
      if (data) {
        setContacts(data.contacts || []);
        setPractitioners(data.practitioners || []);
        setBusinesses(data.businesses || []);
        setTranscripts(data.transcripts || []);
      }
      setIsInitialized(true);
    };

    loadData();
  }, [sheetsUrl]);

  // ===== V2 handlers =====
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
    if (result) {
      // refresh transcripts + targeted table
      const data = await call('getData');
      if (data) {
        setTranscripts(data.transcripts || []);
        setPractitioners(data.practitioners || []);
        setBusinesses(data.businesses || []);
      }
      return true;
    }
    return false;
  };
  const handleEnrichContact = async (contactType, contactId, transcriptId) => {
    const result = await call('enrichContact', { contactType, contactId, transcriptId });
    if (result) {
      const data = await call('getData');
      if (data) {
        setTranscripts(data.transcripts || []);
        setPractitioners(data.practitioners || []);
        setBusinesses(data.businesses || []);
      }
      return true;
    }
    return false;
  };
  const handleDeleteTranscript = async (id) => {
    const result = await call('deleteTranscript', { id });
    if (result) setTranscripts((prev) => prev.filter((t) => t.id !== id));
  };

  // Save sheets URL to localStorage
  useEffect(() => {
    if (sheetsUrl) {
      localStorage.setItem('autopilot-sheets-url', sheetsUrl);
    }
  }, [sheetsUrl]);

  const handleAddContact = async (contact) => {
    const result = await call('upsertContact', { data: contact });
    if (result) {
      setContacts((prev) => {
        const existing = prev.findIndex((c) => c.id === contact.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = contact;
          return updated;
        }
        return [...prev, contact];
      });
      return true;
    }
    return false;
  };

  const handleDeleteContact = async (id) => {
    const result = await call('deleteContact', { id });
    if (result) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleExportCSV = () => {
    if (contacts.length === 0) {
      alert('No contacts to export');
      return;
    }

    const headers = [
      'Name',
      'Company',
      'Role',
      'Type',
      'Industry',
      'Phone',
      'Email',
      'Status',
      'Interview Date',
      'Source',
      'Notes',
    ];
    const rows = contacts.map((c) => [
      c.name,
      c.company,
      c.role,
      c.type,
      c.industry,
      c.phone,
      c.email,
      c.status,
      c.interviewDate,
      c.source,
      c.notes,
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach((row) => {
      csv += row.map((cell) => `"${cell || ''}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inboxCount = transcripts.filter((t) => t.status === 'new').length;
  const TABS = [
    { id: 'practitioners', label: '👥 Practitioners' },
    { id: 'businesses', label: '🏢 Businesses' },
    { id: 'transcripts', label: `📥 Inbox${inboxCount ? ` (${inboxCount})` : ''}` },
    { id: 'script-pro', label: '📝 PRO Script' },
    { id: 'script-biz', label: '📝 BIZ Script' },
    { id: 'analysis', label: '🧠 Analyze' },
    { id: 'settings', label: '⚙ Settings' },
  ];

  const combinedContactsForLegacy = [
    ...practitioners.map((p) => ({ ...p, type: 'pro', company: p.firmName })),
    ...businesses.map((b) => ({ ...b, type: 'biz' })),
  ];

  const renderContent = () => {
    switch (currentTab) {
      case 'practitioners':
        return (
          <V2ContactPage
            kind="practitioner"
            rows={practitioners}
            transcripts={transcripts}
            onUpsert={handleUpsertPractitioner}
            onDelete={handleDeletePractitioner}
            onLinkTranscript={handleLinkTranscript}
            onEnrich={handleEnrichContact}
            loading={loading}
          />
        );
      case 'businesses':
        return (
          <V2ContactPage
            kind="business"
            rows={businesses}
            transcripts={transcripts}
            onUpsert={handleUpsertBusiness}
            onDelete={handleDeleteBusiness}
            onLinkTranscript={handleLinkTranscript}
            onEnrich={handleEnrichContact}
            loading={loading}
          />
        );
      case 'transcripts':
        return (
          <TranscriptsInboxPage
            transcripts={transcripts}
            practitioners={practitioners}
            businesses={businesses}
            onLinkTranscript={handleLinkTranscript}
            onEnrich={handleEnrichContact}
            onDelete={handleDeleteTranscript}
            onUpsertPractitioner={handleUpsertPractitioner}
            onUpsertBusiness={handleUpsertBusiness}
            loading={loading}
          />
        );
      case 'script-pro':
        return <ScriptPage contacts={combinedContactsForLegacy} scriptType="pro" />;
      case 'script-biz':
        return <ScriptPage contacts={combinedContactsForLegacy} scriptType="biz" />;
      case 'analysis':
        return (
          <AnalysisPage
            contacts={combinedContactsForLegacy}
            sheetsUrl={sheetsUrl}
            onAnalysisComplete={() => {
              // Refresh data if needed
            }}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            sheetsUrl={sheetsUrl}
            setSheetsUrl={setSheetsUrl}
            apiKey={apiKey}
            setApiKey={setApiKey}
          />
        );
      default:
        return null;
    }
  };

  if (!isInitialized) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: COLORS.bg,
          color: COLORS.text,
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: COLORS.bg,
        color: COLORS.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Karla:wght@400;500;600;700;800&family=Fraunces:wght@700;800;900&display=swap" rel="stylesheet" />
      {isMobile ? (
        // Mobile layout with bottom nav
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              paddingBottom: '60px',
            }}
          >
            {renderContent()}
          </div>

          <div
            style={{
              position: 'fixed',
              bottom: '0',
              left: '0',
              right: '0',
              height: '60px',
              backgroundColor: COLORS.sidebar,
              borderTop: `1px solid ${COLORS.border}`,
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              zIndex: 100,
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                style={{
                  flex: 1,
                  height: '100%',
                  backgroundColor:
                    currentTab === tab.id ? COLORS.accent : 'transparent',
                  color: currentTab === tab.id ? '#fff' : COLORS.textDim,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        // Desktop layout with sidebar
        <div style={{ display: 'flex', width: '100%' }}>
          <div
            style={{
              width: '220px',
              backgroundColor: COLORS.sidebar,
              borderRight: `1px solid ${COLORS.border}`,
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <h1
              style={{
                fontSize: '18px',
                fontWeight: '700',
                margin: '0 0 20px 0',
                color: COLORS.accent,
              }}
            >
              Autopilot
            </h1>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                style={{
                  padding: '10px 12px',
                  backgroundColor:
                    currentTab === tab.id ? COLORS.accent : 'transparent',
                  color: currentTab === tab.id ? '#fff' : COLORS.text,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              backgroundColor: COLORS.bg,
            }}
          >
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
