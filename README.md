# Autopilot Discovery CRM

A market discovery CRM for conducting and analyzing 100 interviews across Colorado accounting practitioners and business owners. Built on a 100% free stack: React + Vite on GitHub Pages, Google Sheets as the database, and Google Apps Script as the serverless API layer.

## Architecture

```
iPhone / Desktop Browser
         ↓
React App on GitHub Pages     ← free, works on mobile Safari
         ↓ fetch (text/plain)
Google Apps Script Web App    ← free serverless API, no server costs
      ↓              ↓
Google Sheets DB    Anthropic API   ← called server-side (key never exposed)
```

**Why this stack for your use case?**
- **Google Sheets** = your live database AND your analysis tool. No ETL, no exports needed.
- **Google Apps Script** = free serverless compute, runs in Google's infrastructure.
- **GitHub Pages** = free HTTPS hosting, works in iPhone Safari (add to home screen as PWA).
- **Anthropic API** = called server-side from Apps Script, so your `sk-ant-...` key is never in browser code.
- Total monthly cost: **$0** (plus your Anthropic API usage, which is pennies per interview).

---

## One-Time Setup (~20 minutes)

### Step 1: Create your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) → create a new blank spreadsheet
2. Name it something like "Autopilot Discovery CRM"
3. **Don't** create any tabs manually — the Apps Script creates them automatically on first run

The script will create four tabs:
| Tab | Purpose |
|-----|---------|
| **Contacts** | All CRM contacts (name, company, status, notes, etc.) |
| **Analyses** | AI-parsed interview transcript results |
| **Synthesis** | Cross-interview synthesis summaries |
| **Settings** | API keys and config (stored here, not in frontend code) |

### Step 2: Deploy the Apps Script backend

1. In your Google Sheet → click **Extensions** → **Apps Script**
2. Delete all default code in the editor
3. Paste the entire contents of **`Code.gs`** from this repo
4. Click the save icon (or Cmd+S), name the project "Autopilot CRM API"
5. In the left sidebar, click **Run** → `initializeSpreadsheet` (this creates all four tabs)
6. Click **Deploy** → **New deployment**
7. Set type to: **Web app**
8. Configure:
   - **Execute as:** Me (your Google account)
   - **Who has access:** Anyone
9. Click **Deploy** → authorize permissions when prompted
10. **Copy the Web App URL** (looks like `https://script.google.com/macros/s/AKfy.../exec`) — you'll need this in Step 5

> **Important:** Every time you edit Code.gs, you must create a **new deployment** (not update an existing one) for changes to take effect. Go to Deploy → Manage deployments → New deployment.

### Step 3: Add your Anthropic API key to the Settings sheet

In your Google Sheet, find the **Settings** tab and add one row:
| Column A (key) | Column B (value) |
|---|---|
| `anthropicApiKey` | `sk-ant-api03-...` |

Get your API key from [console.anthropic.com](https://console.anthropic.com) → API Keys.

Alternatively, you can set this from within the CRM app's Settings tab after Step 5.

### Step 4: Create the GitHub repo and deploy to GitHub Pages

Open your terminal and run these commands:

```bash
# 1. Go to the folder containing these files
cd /path/to/autopilot-crm-files

# 2. Install dependencies
npm install

# 3. Create a new GitHub repo (requires GitHub CLI — install from https://cli.github.com)
gh auth login
gh repo create autopilot-discovery-crm --public --source=. --push

# 4. Enable GitHub Pages in repo settings:
#    Go to: github.com/chrismatthews09/autopilot-discovery-crm
#    Settings → Pages → Source: "GitHub Actions"
#    (Or use the gh-pages branch approach in Step 5)

# 5. Build and deploy to GitHub Pages
npm run deploy
```

After `npm run deploy`, your app will be live at:
**`https://chrismatthews09.github.io/autopilot-discovery-crm/`**

> **No GitHub CLI?** Alternatively: go to github.com → New repository → name it `autopilot-discovery-crm` → upload these files manually or use VS Code's built-in Git integration.

### Step 5: Connect the app to your Google Sheet

1. Open your deployed app at `https://chrismatthews09.github.io/autopilot-discovery-crm/`
2. Click the **⚙ Settings** tab in the sidebar
3. Paste your **Apps Script Web App URL** from Step 2
4. Optionally paste your **Anthropic API key** here (it will be saved to your Settings sheet)
5. Click **Test Connection** — you should see "Connected!"
6. Start adding contacts 🎉

---

## iPhone Setup (Add to Home Screen as PWA)

1. Open Safari on iPhone → navigate to your GitHub Pages URL
2. Tap the **Share** button (square with arrow) → **Add to Home Screen**
3. Name it "Autopilot CRM" → tap **Add**
4. The app now opens full-screen like a native app, with your data synced via Google Sheets

**Tips for iPhone use:**
- The app switches to a bottom navigation bar on mobile (< 768px viewport)
- Contact cards display vertically instead of as a table
- Forms collapse to single-column on mobile
- The interview script checklists work with touch — tap to check off questions as you go

---

## Daily Workflow

### Before an interview
1. Open the CRM → add the contact with status "Scheduled"
2. Open the Pro or Biz Script tab → review the questions for the interview type
3. Use the checklist during the live interview to track which questions you've covered

### After an interview
1. Update contact status to "Completed"
2. Add 2-3 bullet takeaways to the contact's Notes field
3. Go to AI Analysis tab → paste the Plaud.ai transcript → click Analyze
4. Tag any referrals mentioned → add them as new contacts
5. Once you have 5+ analyses → run "Synthesize All" for cross-interview patterns

### Weekly
- Open Google Sheets directly to filter and sort contacts by status, industry, or score
- Review the Analyses tab for cumulative intelligence
- Share the Synthesis tab output with any partners or investors

---

## Long-Term CRM Strategy

This tool is built for a specific 100-interview research sprint, but the data you collect has long-term value. Here's how to think about it:

### Phase 1: Research Sprint (Weeks 1–8)
- Goal: 50 practitioner + 50 business owner interviews
- Use status tracking (Identified → Contacted → Scheduled → Completed) to manage your pipeline
- Tag every contact with `source` (LinkedIn, referral, AGC event, etc.) to understand what channels work
- After every 10 interviews, run the AI Synthesis to spot emerging patterns

### Phase 2: Warm Pipeline (Month 2–3)
After the sprint, your "Completed" contacts split into three buckets:
1. **Hot prospects** (business owners who showed high WTP signals) — move to your sales CRM
2. **Referral partners** (practitioners who expressed interest in collaborating) — keep warm with monthly check-ins
3. **Intelligence contacts** (good data points, no immediate opportunity) — archive but don't delete

Use the Notes field + the AI analysis `actionItems` field to track follow-up commitments.

### Phase 3: Ongoing Intelligence
The Analyses tab in Google Sheets becomes a searchable market intelligence database. You can:
- Filter by `overallSentiment` to find your warmest contacts
- Sort by `leadScore` to prioritize follow-up
- Use Google Sheets' built-in charts to visualize pricing data across all interviews
- Export a range to CSV and feed it back into Claude for deeper analysis

### Scaling Beyond 100 Interviews
If this becomes an ongoing CRM (not just a sprint tool), consider:
- **Firebase Firestore** — free tier handles thousands of contacts, better query performance than Sheets
- **Supabase** — PostgreSQL with a free tier, great if you want SQL analysis
- Migration from Google Sheets is straightforward since all your data is already structured

---

## Google Sheets as Your Analysis Dashboard

One of the biggest advantages of this architecture: your data is *already* in a spreadsheet. You can immediately do things like:

- **Pivot table** on `industry` + `status` to see which verticals are converting
- **COUNTIF on `overallSentiment`** to track sentiment across practitioner vs. business owner interviews
- **Filter the Analyses tab by `leadScore > 7`** to surface your best prospects instantly
- **Chart pricing data** from the Analyses tab to visualize market pricing consensus
- **Sort by `createdAt`** to see your cadence and identify slowdowns

The Analyses tab stores the full JSON for every interview in the `fullJSON` column — you can use `=IMPORTJSON()` or Apps Script formulas to pull specific fields into dedicated columns for even richer analysis.

---

## Project Structure

```
autopilot-discovery-crm/
├── src/
│   ├── App.jsx          ← Main React app (all UI + logic)
│   └── main.jsx         ← React entry point
├── index.html           ← HTML shell
├── package.json         ← Vite + gh-pages config
├── vite.config.js       ← Vite config (base path for GitHub Pages)
├── favicon.svg          ← App icon
├── .gitignore
├── Code.gs              ← Google Apps Script backend (paste into Apps Script editor)
└── README.md
```

---

## Troubleshooting

**"Apps Script URL not configured"**
→ Go to Settings tab in the app and paste your Apps Script URL

**"Connected to Apps Script!" but data isn't saving**
→ Make sure the Apps Script was deployed with "Execute as: Me" and "Who has access: Anyone"
→ After editing Code.gs, you must create a **new deployment** (not update existing)

**Analysis returns generic results**
→ Check the Settings sheet has your Anthropic API key in row 2, column B
→ Make sure the key starts with `sk-ant-`

**App looks wrong on iPhone**
→ Make sure you're using Safari → Add to Home Screen for the best experience
→ Chrome on iPhone may not support the PWA viewport correctly

**CORS errors in browser console**
→ This usually means the Apps Script URL is wrong or the deployment wasn't configured with "Anyone" access
→ Double-check the URL ends in `/exec` not `/dev`

**GitHub Pages shows 404**
→ Check that `vite.config.js` has `base: '/autopilot-discovery-crm/'` matching your exact repo name
→ After `npm run deploy`, wait 2–3 minutes for GitHub to build

---

## Security Notes

- Your Anthropic API key is stored in your **private Google Sheet**, not in the GitHub repo or browser
- The Apps Script URL is non-secret (it's essentially a public endpoint), but without your Google account it can only read/write to your specific sheet
- For a personal research tool, this security model is appropriate. If this ever becomes a multi-user tool, add Apps Script authentication (e.g., verify a shared secret token passed in request headers)
- The GitHub repo is public by default in this setup — it contains no credentials

---

## Updating the App

To make changes to the React app:
```bash
# Edit src/App.jsx locally
# Then:
npm run deploy   # Builds and pushes to gh-pages branch automatically
```

To update the Apps Script backend:
1. Open the Apps Script editor (Extensions → Apps Script in your Google Sheet)
2. Edit Code.gs
3. Click Deploy → **New deployment** (important — must be a new deployment)
4. Copy the new URL if it changed → update it in the app's Settings tab
