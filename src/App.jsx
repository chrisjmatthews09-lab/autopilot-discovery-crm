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
          // POST request with text/plain to avoid CORS preflight
          const payload = { action, ...data };
          response = await fetch(sheetsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload),
          });
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
    if (!formData.name || !formData.company) {
      alert('Name and company are required');
      return;
    }
    await onAdd({
      ...formData,
      id: editingId || `contact-${Date.now()}`,
      updatedAt: new Date().toISOString(),
    });
    resetForm();
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

function DesktopContactForm({ formData, setFormData, onSave, onCancel }) {
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
          style={{
            padding: '10px 16px',
            backgroundColor: COLORS.success,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function MobileContactForm({ formData, setFormData, onSave, onCancel, isEditing }) {
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
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: COLORS.success,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {isEditing ? 'Update' : 'Add'}
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
        {script.split('\n').map((line, idx) => {
          const key = `${scriptType}-${idx}`;
          const isChecked = checkedQs[key];

          if (!line.trim()) return null;

          const isSection = /^\d+\./.test(line);

          return (
            <div
              key={idx}
              style={{
                marginBottom: '12px',
                padding: '8px',
                backgroundColor: isSection ? COLORS.bg : 'transparent',
                borderRadius: '4px',
                textDecoration: isChecked ? 'line-through' : 'none',
                opacity: isChecked ? 0.6 : 1,
              }}
            >
              {isSection ? (
                <div
                  style={{
                    color: COLORS.accent,
                    fontWeight: '600',
                    marginBottom: '8px',
                  }}
                >
                  {line}
                </div>
              ) : (
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    cursor: 'pointer',
                    color: COLORS.text,
                    fontSize: '14px',
                    lineHeight: '1.5',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCheck(key)}
                    style={{
                      marginTop: '3px',
                      cursor: 'pointer',
                      accentColor: COLORS.accent,
                    }}
                  />
                  <span>{line.trim()}</span>
                </label>
              )}
            </div>
          );
        })}
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
function App() {
  const [currentTab, setCurrentTab] = useState('crm');
  const [contacts, setContacts] = useState([]);
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
      }
      setIsInitialized(true);
    };

    loadData();
  }, [sheetsUrl]);

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
    }
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

  const TABS = [
    { id: 'crm', label: 'Contacts' },
    { id: 'script-pro', label: 'PRO Script' },
    { id: 'script-biz', label: 'BIZ Script' },
    { id: 'analysis', label: 'Analyze' },
    { id: 'settings', label: 'Settings' },
  ];

  const renderContent = () => {
    switch (currentTab) {
      case 'crm':
        return (
          <CRMPage
            contacts={contacts}
            onAdd={handleAddContact}
            onDelete={handleDeleteContact}
            onExport={handleExportCSV}
            loading={loading}
          />
        );
      case 'script-pro':
        return <ScriptPage contacts={contacts} scriptType="pro" />;
      case 'script-biz':
        return <ScriptPage contacts={contacts} scriptType="biz" />;
      case 'analysis':
        return (
          <AnalysisPage
            contacts={contacts}
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
