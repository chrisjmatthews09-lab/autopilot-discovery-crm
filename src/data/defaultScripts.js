const qid = (() => { let n = 0; return () => `q${Date.now().toString(36)}-${(n++).toString(36)}`; })();
const sid = (() => { let n = 0; return () => `s${Date.now().toString(36)}-${(n++).toString(36)}`; })();

export const DEFAULT_PRO_SCRIPT = {
  id: 'pro',
  type: 'pro',
  title: 'Bookkeeper / CPA / Accounting Firm Interview',
  intro: "Thank you for taking the time. I'm researching the accounting services market in Colorado to understand how firms operate, what's working, what's not, and where the industry is heading. Everything you share is confidential and just for my own market research. This should take about 30–40 minutes.",
  sections: [
    {
      id: sid(),
      name: 'Warm-Up & Context',
      color: 'blue',
      questions: [
        { id: qid(), q: "Tell me about your firm — how long have you been operating, how many clients, what's your team look like?", why: 'Establishes firm size, maturity, and capacity baseline' },
        { id: qid(), q: 'What types of clients make up the bulk of your revenue? Industries, size, service mix?', why: 'Reveals vertical concentration and service line economics' },
        { id: qid(), q: 'What percentage of your revenue comes from tax prep vs. monthly/recurring services vs. advisory?', why: 'Quantifies the tax-only vs. CAS revenue split — the core arbitrage' },
      ],
    },
    {
      id: sid(),
      name: 'Service Delivery & Operations',
      color: 'primary',
      questions: [
        { id: qid(), q: 'Walk me through how you onboard a new monthly bookkeeping or CAS client — what does that process look like from signed engagement letter to first deliverable?', why: 'Maps the operational workflow and identifies bottlenecks' },
        { id: qid(), q: "How many clients can one bookkeeper/accountant handle on your team? What's the realistic capacity?", why: 'Critical for validating the 40-50 client per bookkeeper assumption with Digits' },
        { id: qid(), q: "What's your tech stack? GL, bank feeds, bill pay, payroll, reporting — walk me through it.", why: 'Identifies where Digits creates real differentiation vs. existing stacks' },
        { id: qid(), q: 'Where do things break down operationally? What takes longer than it should? Where do errors happen?', why: 'Reveals pain points Digits automation could solve' },
        { id: qid(), q: 'How do you handle month-end close? How long does it typically take per client? When do clients get their financials?', why: 'Benchmarks close speed — Digits promises real-time' },
      ],
    },
    {
      id: sid(),
      name: 'Pricing & Economics',
      color: 'gold',
      questions: [
        { id: qid(), q: 'How do you price your services? Hourly, fixed fee, tiered packages? Has that changed in the last few years?', why: 'Maps pricing model trends across the market' },
        { id: qid(), q: "What's your typical monthly fee range for a $1M–$5M revenue business? What about $5M–$10M?", why: 'Direct pricing benchmark — compare to $1K/$2K/$3.5K tiers' },
        { id: qid(), q: 'Have you raised prices in the last 12 months? By how much? How did clients react?', why: 'Tests price elasticity and validates the 80% fee-increase trend' },
        { id: qid(), q: "What's your gross margin on bookkeeping vs. tax prep vs. advisory work? Which line is most profitable?", why: 'Validates the margin thesis — advisory should be highest' },
        { id: qid(), q: "What would you charge a construction company with $5M revenue, 3 entities, and job costing needs for full monthly CAS?", why: "Direct comp for Autopilot's construction-vertical pricing" },
      ],
    },
    {
      id: sid(),
      name: 'Competition & Market',
      color: 'accent',
      questions: [
        { id: qid(), q: 'Who do you lose deals to? What are the main reasons prospects choose someone else?', why: 'Identifies real competitive threats and positioning gaps' },
        { id: qid(), q: 'What do you think about firms like Bench, Pilot, or other tech-enabled bookkeeping providers? Are they taking your clients?', why: 'Gauges perception of tech-enabled competition' },
        { id: qid(), q: "Have you looked at or used Digits? What's your take on AI-powered accounting platforms?", why: 'Direct intelligence on Digits adoption and perception among practitioners' },
        { id: qid(), q: 'If someone offered to buy your firm, what multiple would you expect? What would make you consider selling?', why: 'Critical M&A intelligence for the acquisition strategy' },
        { id: qid(), q: "What's the biggest challenge facing your firm in the next 2–3 years?", why: 'Surfaces macro threats — staffing shortage, AI disruption, margin compression' },
      ],
    },
    {
      id: sid(),
      name: 'Staffing & Talent',
      color: 'purple',
      questions: [
        { id: qid(), q: 'How hard is it to hire right now? What positions are hardest to fill? What are you paying?', why: 'Validates the CPA shortage thesis and labor cost assumptions' },
        { id: qid(), q: "How much of your team's time goes to manual data entry, categorization, and reconciliation vs. actual analysis and advisory?", why: 'Quantifies the automation opportunity — the % Digits could eliminate' },
        { id: qid(), q: 'If AI could handle 90%+ of transaction categorization and reconciliation, how would that change your business?', why: 'Tests receptivity to the Digits value prop from the practitioner side' },
      ],
    },
    {
      id: sid(),
      name: 'Closing & Relationship',
      color: 'primary',
      questions: [
        { id: qid(), q: 'If you could wave a magic wand and fix one thing about running your firm, what would it be?', why: 'Often surfaces the deepest pain point' },
        { id: qid(), q: "Do you refer clients to other firms for services you don't offer? What services?", why: 'Identifies referral partnership opportunities' },
        { id: qid(), q: 'Would you be open to staying in touch? I may have opportunities for collaboration or referrals down the road.', why: 'Builds the referral pipeline from Day 1' },
      ],
    },
  ],
};

export const DEFAULT_BIZ_SCRIPT = {
  id: 'biz',
  type: 'biz',
  title: 'Business Owner Interview',
  intro: "Thank you for your time. I'm researching how Colorado business owners handle their finances — the good, the bad, and the ugly. I want to understand what's working, what's painful, and what ideal financial support would look like. Everything is confidential. Should take about 25–30 minutes.",
  sections: [
    {
      id: sid(),
      name: 'Business Context',
      color: 'blue',
      questions: [
        { id: qid(), q: "Tell me about your business — what do you do, how long have you been operating, roughly how many employees?", why: 'Establishes size, stage, and complexity' },
        { id: qid(), q: "What's your approximate annual revenue range? (We can use buckets: under $1M, $1–3M, $3–5M, $5–10M, $10M+)", why: 'Segments by revenue tier for pricing analysis' },
        { id: qid(), q: "What industry would you say you're in? Do you have any industry-specific accounting needs?", why: 'Maps vertical and surfaces specialized requirements (job costing, retainage, etc.)' },
      ],
    },
    {
      id: sid(),
      name: 'Current Financial Operations',
      color: 'primary',
      questions: [
        { id: qid(), q: 'Who handles your books today? In-house person, outside bookkeeper, CPA firm, you/spouse, or nobody?', why: 'Maps the current provider landscape and identifies DIY owners' },
        { id: qid(), q: 'What accounting software do you use? QuickBooks, Xero, spreadsheets, shoeboxes?', why: 'Identifies migration complexity and tech sophistication' },
        { id: qid(), q: 'How current are your books right now — like, today? When was your last complete monthly close?', why: 'The key pain indicator. If books are >60 days behind, they are a strong prospect' },
        { id: qid(), q: 'How much are you paying for accounting/bookkeeping services right now? Monthly or annually?', why: 'Establishes current spend baseline — critical for pricing validation' },
        { id: qid(), q: 'When was the last time you looked at a P&L or balance sheet and used it to make a business decision?', why: 'Tests whether they use financials for decisions or just compliance' },
      ],
    },
    {
      id: sid(),
      name: 'Pain Points (The Gold Mine)',
      color: 'accent',
      questions: [
        { id: qid(), q: "What's the most frustrating thing about managing your business finances right now?", why: 'Open-ended — let them rant. The pain they volunteer first is the real pain.' },
        { id: qid(), q: "Have you ever missed a deduction, overpaid taxes, made a bad hiring/purchasing decision because you didn't have good financial data?", why: 'Surfaces concrete $ cost of bad financial visibility' },
        { id: qid(), q: 'How much time per week do YOU personally spend on financial admin — invoicing, bills, reconciliation, payroll questions?', why: 'Quantifies owner time displacement value' },
        { id: qid(), q: 'Has your bookkeeper or accountant ever made a significant mistake? What happened?', why: 'Prior bad experience = pre-sold on quality' },
        { id: qid(), q: 'Do you feel confident you know your exact cash position, profitability by service/project, and financial runway right now?', why: 'If the answer is no to any of these — they need help' },
        { id: qid(), q: "Have you ever had a bank, bonding company, or lender ask for financials and you weren't ready?", why: 'Compliance/banking pressure = high WTP signal' },
      ],
    },
    {
      id: sid(),
      name: 'Value Proposition Testing',
      color: 'gold',
      questions: [
        { id: qid(), q: 'If I could give you a dashboard on your phone showing your real-time P&L, cash flow, and key metrics — updated every day, not 30 days late — how valuable would that be?', why: 'Tests the core Digits real-time visibility value prop' },
        { id: qid(), q: 'What would it be worth to you to never think about bookkeeping again — just have it done, accurately, every month?', why: "Tests the 'peace of mind' value prop — let them name a price" },
        { id: qid(), q: "If someone could show you exactly where you're leaking money — unnecessary expenses, pricing mistakes, unprofitable jobs — would you pay for that insight?", why: 'Tests advisory/controller-level value prop' },
        { id: qid(), q: 'Would you prefer a cheap basic bookkeeper, or would you pay more for someone who also gives you financial advice and strategy?', why: 'Tests the CAS upsell — bookkeeping + advisory vs. bookkeeping alone' },
        { id: qid(), q: "What's the most you'd be willing to pay per month for a service that gave you clean books, real-time dashboards, and a quarterly financial strategy review?", why: 'Direct WTP testing — compare to $1K/$2K tier pricing' },
      ],
    },
    {
      id: sid(),
      name: 'Decision-Making & Buying Signals',
      color: 'purple',
      questions: [
        { id: qid(), q: 'If you were going to hire an accounting firm, what would matter most — price, industry expertise, technology, responsiveness, or something else?', why: 'Identifies the primary buying criterion by segment' },
        { id: qid(), q: 'How would you find an accounting firm? Google? Referral? Industry group? Your attorney or banker?', why: 'Maps actual acquisition channels — validates GTM strategy' },
        { id: qid(), q: 'Have you ever switched accounting providers? What made you switch? What was the biggest hesitation?', why: 'Surfaces switching triggers and barriers' },
        { id: qid(), q: "Would the word 'AI' in an accounting firm's pitch make you more interested, less interested, or not care?", why: 'Tests AI messaging — critical for positioning' },
        { id: qid(), q: "If a firm said 'we'll do a free financial health assessment of your books,' would you take that meeting?", why: 'Validates the Digits Health Score as a lead gen mechanism' },
      ],
    },
    {
      id: sid(),
      name: 'Closing',
      color: 'primary',
      questions: [
        { id: qid(), q: 'If you could have one thing about your business finances magically fixed overnight, what would it be?', why: 'The magic wand question — pure gold for messaging' },
        { id: qid(), q: 'Is there anything about how your finances are managed that keeps you up at night?', why: 'Emotional anchor — identifies the deepest concern' },
        { id: qid(), q: 'Would you be open to me following up if I build something that addresses the issues you described?', why: 'Pipeline development — warm lead capture' },
      ],
    },
  ],
};

export const DEFAULT_SCRIPTS = [DEFAULT_PRO_SCRIPT, DEFAULT_BIZ_SCRIPT];
