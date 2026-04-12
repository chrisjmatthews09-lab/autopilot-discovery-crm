// ============================================================================
// AUTOPILOT DISCOVERY CRM - GOOGLE APPS SCRIPT BACKEND
// ============================================================================
// This script serves as the serverless API for the React CRM frontend.
// Deploy this as a web app (Execute as: Me, Who has access: Anyone).
// The script manages Google Sheets data and proxies Anthropic API calls.

// ============================================================================
// SHEET NAMES
// ============================================================================
const SHEET_NAMES = {
  CONTACTS: 'Contacts',
  ANALYSES: 'Analyses',
  SYNTHESIS: 'Synthesis',
  SETTINGS: 'Settings',
};

const SHEET_HEADERS = {
  Contacts: ['id', 'name', 'company', 'role', 'type', 'industry', 'phone', 'email', 'status', 'interviewDate', 'notes', 'source', 'createdAt', 'updatedAt'],
  Analyses: ['id', 'contactId', 'intervieweeName', 'type', 'analyzedAt', 'overallSentiment', 'leadScore', 'fullJSON'],
  Synthesis: ['id', 'createdAt', 'fullJSON'],
  Settings: ['key', 'value'],
};

// ============================================================================
// MAIN ENTRY POINTS
// ============================================================================

/**
 * Handle GET requests
 */
function doGet(e) {
  const action = e.parameter.action;

  try {
    switch (action) {
      case 'getData':
        return serveJSON({
          contacts: readSheet(SHEET_NAMES.CONTACTS),
          analyses: readSheet(SHEET_NAMES.ANALYSES),
          synthesis: readSheet(SHEET_NAMES.SYNTHESIS),
        });
      case 'getSettings':
        return serveJSON(readSettingsAsObject());
      default:
        return serveJSON({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return serveJSON({ error: err.toString() });
  }
}

/**
 * Handle POST requests
 */
function doPost(e) {
  try {
    // Parse the POST body as JSON (sent as text/plain to avoid CORS preflight)
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return serveJSON({ error: 'Invalid JSON in POST body' });
    }

    const action = payload.action;

    switch (action) {
      case 'upsertContact':
        return handleUpsertContact(payload.data);

      case 'deleteContact':
        return handleDeleteContact(payload.id);

      case 'saveAnalysis':
        return handleSaveAnalysis(payload.data);

      case 'saveSynthesis':
        return handleSaveSynthesis(payload.data);

      case 'analyzeTranscript':
        return handleAnalyzeTranscript(
          payload.transcript,
          payload.interviewType,
          payload.intervieweeName
        );

      case 'runSynthesis':
        return handleRunSynthesis(payload.analyses);

      case 'saveSetting':
        return handleSaveSetting(payload.key, payload.value);

      default:
        return serveJSON({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return serveJSON({ error: err.toString() });
  }
}

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

function handleUpsertContact(contactData) {
  const contacts = readSheet(SHEET_NAMES.CONTACTS);
  const existingIndex = contacts.findIndex((c) => c.id === contactData.id);

  if (existingIndex >= 0) {
    // Update existing
    const updated = { ...contacts[existingIndex], ...contactData };
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CONTACTS);
    const row = existingIndex + 2; // +2 because row 1 is header, 0-indexed array

    SHEET_HEADERS.Contacts.forEach((header, col) => {
      sheet.getRange(row, col + 1).setValue(updated[header] || '');
    });

    return serveJSON({ success: true, contact: updated });
  } else {
    // Create new
    const newContact = {
      ...contactData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CONTACTS);
    const newRow = [
      newContact.id,
      newContact.name,
      newContact.company,
      newContact.role,
      newContact.type,
      newContact.industry,
      newContact.phone,
      newContact.email,
      newContact.status,
      newContact.interviewDate,
      newContact.notes,
      newContact.source,
      newContact.createdAt,
      newContact.updatedAt,
    ];
    sheet.appendRow(newRow);

    return serveJSON({ success: true, contact: newContact });
  }
}

function handleDeleteContact(id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.CONTACTS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return serveJSON({ success: true });
    }
  }

  return serveJSON({ error: 'Contact not found' });
}

function handleSaveAnalysis(analysisData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ANALYSES);
  const newRow = [
    analysisData.id,
    analysisData.contactId,
    analysisData.intervieweeName,
    analysisData.type,
    analysisData.analyzedAt,
    analysisData.overallSentiment,
    analysisData.leadScore,
    analysisData.fullJSON,
  ];
  sheet.appendRow(newRow);

  return serveJSON({ success: true, analysis: analysisData });
}

function handleSaveSynthesis(synthesisData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SYNTHESIS);
  const data = sheet.getDataRange().getValues();

  if (data.length > 1) {
    // Update first row if exists
    sheet.getRange(2, 1).setValue(synthesisData.id);
    sheet.getRange(2, 2).setValue(synthesisData.createdAt);
    sheet.getRange(2, 3).setValue(synthesisData.fullJSON);
  } else {
    // Add new row
    sheet.appendRow([synthesisData.id, synthesisData.createdAt, synthesisData.fullJSON]);
  }

  return serveJSON({ success: true, synthesis: synthesisData });
}

function handleAnalyzeTranscript(transcript, interviewType, intervieweeName) {
  // Get Anthropic API key from Settings
  const settings = readSettingsAsObject();
  const apiKey = settings.anthropicApiKey;

  if (!apiKey) {
    return serveJSON({ error: 'Anthropic API key not configured in Settings' });
  }

  // Select system prompt based on interview type
  const systemPrompt = interviewType === 'pro' ? PRO_SYSTEM_PROMPT : BIZ_SYSTEM_PROMPT;

  // Call Anthropic API — include interviewee name in the user message for context
  const userMessage = `Analyze this interview transcript. Interviewee name: ${intervieweeName || 'Unknown'}\n\nTRANSCRIPT:\n${transcript}`;

  try {
    const response = callAnthropicAPI(apiKey, systemPrompt, userMessage, 3000);
    return serveJSON(response);
  } catch (err) {
    return serveJSON({ error: 'Anthropic API error: ' + err.toString() });
  }
}

function handleRunSynthesis(analyses) {
  // Get Anthropic API key from Settings
  const settings = readSettingsAsObject();
  const apiKey = settings.anthropicApiKey;

  if (!apiKey) {
    return serveJSON({ error: 'Anthropic API key not configured in Settings' });
  }

  // Analyses are passed as row objects from the sheet — parse the fullJSON field
  // to reconstruct rich objects for summarization
  const parsedAnalyses = analyses.map((a) => {
    try {
      return typeof a.fullJSON === 'string' ? JSON.parse(a.fullJSON) : a;
    } catch (e) {
      return a;
    }
  });

  // Build the rich synthesis prompt matching the original app's format
  const summaries = parsedAnalyses
    .map((a, i) => {
      const typeLabel = a.type === 'pro' ? 'Practitioner' : 'Business Owner';
      const name = a.intervieweeName || a.interviewee?.name || 'Unknown';
      const insights = (a.keyInsights || []).join('; ');
      const pains = (a.painPoints || []).join('; ');
      const pricing = a.pricingData
        ? `Pricing: BK ${a.pricingData.bookkeepingRange || 'n/a'}, CAS ${a.pricingData.casRange || 'n/a'}`
        : '';
      const wtp = a.wtpSignals
        ? `WTP: Named price ${a.wtpSignals.namedPrice || 'n/a'}, AI sentiment ${a.wtpSignals.aiSentiment || a.valueProTesting?.aiSentiment || 'n/a'}`
        : '';
      const quotes = a.quotableLines ? `Quotes: ${a.quotableLines.join('; ')}` : '';
      return `Interview ${i + 1} (${typeLabel} — ${name}):\nKey Insights: ${insights}\nPain Points: ${pains}\n${pricing}\n${wtp}\n${quotes}`;
    })
    .join('\n\n---\n\n');

  const synthesisPrompt = `Synthesize these ${parsedAnalyses.length} interview analyses:\n\n${summaries}`;

  try {
    const response = callAnthropicAPI(apiKey, SYNTHESIS_SYSTEM_PROMPT, synthesisPrompt, 4000);
    return serveJSON(response);
  } catch (err) {
    return serveJSON({ error: 'Anthropic API error: ' + err.toString() });
  }
}

function handleSaveSetting(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return serveJSON({ success: true });
    }
  }

  // Key doesn't exist, add it
  sheet.appendRow([key, value]);
  return serveJSON({ success: true });
}

// ============================================================================
// SHEET OPERATIONS
// ============================================================================

/**
 * Read a sheet and return as array of objects
 */
function readSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  // Auto-create sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = SHEET_HEADERS[sheetName];
    sheet.appendRow(headers);
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  return data.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] || '';
    });
    return obj;
  });
}

/**
 * Read Settings sheet as a key/value object
 */
function readSettingsAsObject() {
  const settings = readSheet(SHEET_NAMES.SETTINGS);
  const obj = {};
  settings.forEach((row) => {
    obj[row.key] = row.value;
  });
  return obj;
}

/**
 * Ensure all required sheets exist
 */
function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(SHEET_NAMES).forEach((sheetName) => {
    if (!ss.getSheetByName(sheetName)) {
      const sheet = ss.insertSheet(sheetName);
      const headers = SHEET_HEADERS[sheetName];
      sheet.appendRow(headers);
    }
  });
}

// ============================================================================
// ANTHROPIC API INTEGRATION
// ============================================================================

/**
 * Call Anthropic API and return parsed response
 */
function callAnthropicAPI(apiKey, systemPrompt, userMessage, maxTokens) {
  const url = 'https://api.anthropic.com/v1/messages';

  const payload = {
    model: 'claude-opus-4-5',
    max_tokens: maxTokens || 3000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userMessage,
      },
    ],
  };

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error(result.error?.message || 'Unknown Anthropic API error');
  }

  // Extract the text content from the response
  if (result.content && result.content[0] && result.content[0].text) {
    const responseText = result.content[0].text;

    // Try to parse as JSON
    try {
      return JSON.parse(responseText);
    } catch (e) {
      // If not JSON, return as plain text result
      return {
        rawAnalysis: responseText,
        overallSentiment: 'unclear',
        leadScore: 0,
      };
    }
  }

  throw new Error('No content in Anthropic response');
}

// ============================================================================
// SYSTEM PROMPTS FOR CLAUDE
// ============================================================================

const PRO_SYSTEM_PROMPT = `You are analyzing an interview transcript with a bookkeeper, CPA, or accounting firm practitioner. Extract structured insights for market research on an outsourced accounting business (Autopilot Accounting) targeting Colorado SMBs.

Return ONLY valid JSON with this exact structure:
{
  "interviewee": { "name": "", "firmType": "", "firmSize": "", "yearsInBusiness": "" },
  "keyInsights": ["insight1", "insight2", "insight3", "insight4", "insight5"],
  "pricingData": { "bookkeepingRange": "", "casRange": "", "cfoRange": "", "pricingModel": "", "recentIncreases": "" },
  "techStack": ["tool1", "tool2"],
  "painPoints": ["pain1", "pain2", "pain3"],
  "competitiveLandscape": { "whoTheyLoseTo": "", "techDisruptionView": "", "aiSentiment": "" },
  "staffingInsights": { "hiringDifficulty": "", "capacityPerPerson": "", "automationOpportunity": "" },
  "acquisitionSignals": { "wouldConsiderSelling": "", "valuationExpectation": "", "biggestConcern": "" },
  "verticalIntelligence": { "topIndustries": [], "constructionSpecific": "" },
  "quotableLines": ["quote1", "quote2"],
  "actionItems": ["action1", "action2"],
  "overallSentiment": "positive/neutral/negative",
  "relevanceScore": 8
}`;

const BIZ_SYSTEM_PROMPT = `You are analyzing an interview transcript with a business owner. Extract structured insights about their accounting pain points, willingness to pay, and value proposition validation for Autopilot Accounting.

Return ONLY valid JSON with this exact structure:
{
  "interviewee": { "name": "", "businessType": "", "industry": "", "revenueRange": "", "employeeCount": "" },
  "keyInsights": ["insight1", "insight2", "insight3", "insight4", "insight5"],
  "currentState": { "whoDoesBooks": "", "software": "", "monthsBehind": "", "currentSpend": "", "satisfaction": "" },
  "painPoints": ["pain1", "pain2", "pain3"],
  "wtpSignals": { "ownerTimeDisplacement": "", "decisionMakingBlindness": "", "compliancePressure": "", "priorBadExperience": "", "namedPrice": "" },
  "valueProTesting": { "dashboardReaction": "", "peaceOfMindValue": "", "advisoryInterest": "", "aiSentiment": "" },
  "buyingBehavior": { "primaryCriterion": "", "discoveryChannel": "", "switchingHistory": "", "healthScoreInterest": "" },
  "quotableLines": ["quote1", "quote2"],
  "magicWandAnswer": "",
  "actionItems": ["action1", "action2"],
  "overallSentiment": "positive/neutral/negative",
  "leadScore": 8
}`;

const SYNTHESIS_SYSTEM_PROMPT = `You are synthesizing multiple interview analyses for Autopilot Accounting's market research. Return ONLY valid JSON:
{
  "executiveSummary": "3-4 sentence overview of what the interviews reveal",
  "topThemes": [{"theme": "", "frequency": 0, "evidence": ""}],
  "pricingConsensus": {"bookkeeping": "", "cas": "", "cfo": "", "willingness": ""},
  "painPointRanking": [{"pain": "", "mentions": 0, "severity": "high/med/low"}],
  "competitiveInsights": ["insight1", "insight2"],
  "verticalFindings": [{"industry": "", "attractiveness": "high/med/low", "evidence": ""}],
  "wtpSummary": {"averageNamedPrice": "", "highestPrice": "", "lowestPrice": "", "keyDrivers": []},
  "aiSentiment": {"positive": 0, "neutral": 0, "negative": 0, "commonConcerns": []},
  "topQuotes": ["quote1", "quote2", "quote3"],
  "strategicRecommendations": ["rec1", "rec2", "rec3", "rec4"],
  "risksIdentified": ["risk1", "risk2"],
  "nextSteps": ["step1", "step2"]
}`;

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Serve JSON response with CORS headers
 */
function serveJSON(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);

  // Add CORS headers
  if (typeof output.setHeader !== 'undefined') {
    output.setHeader('Access-Control-Allow-Origin', '*');
    output.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    output.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  return output;
}

/**
 * Initialize the spreadsheet with all required sheets (call this once on first deploy)
 */
function initializeSpreadsheet() {
  ensureSheets();
  Logger.log('Spreadsheet initialized with all required sheets');
}
