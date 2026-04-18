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
  CONTACTS: 'Contacts', // legacy, kept for backward-compat
  ANALYSES: 'Analyses',
  SYNTHESIS: 'Synthesis',
  SETTINGS: 'Settings',
  PRACTITIONERS: 'Practitioners',
  BUSINESSES: 'Businesses',
  TRANSCRIPTS: 'Transcripts',
};

const SHEET_HEADERS = {
  Contacts: ['id', 'name', 'company', 'role', 'type', 'industry', 'phone', 'email', 'status', 'interviewDate', 'notes', 'source', 'createdAt', 'updatedAt'],
  Analyses: ['id', 'contactId', 'intervieweeName', 'type', 'analyzedAt', 'overallSentiment', 'leadScore', 'fullJSON'],
  Synthesis: ['id', 'createdAt', 'fullJSON'],
  Settings: ['key', 'value'],
  Practitioners: [
    'id', 'name', 'firmName', 'role', 'phone', 'email',
    'firmType', 'firmSize', 'clientCount', 'revenueEstimate', 'yearsInBusiness',
    'location', 'specialties', 'techStack',
    'painPoints', 'acquisitionSignals', 'aiSentiment',
    'status', 'interviewDate',
    'transcriptUrl', 'summaryUrl', 'enrichedAt',
    'source', 'notes', 'createdAt', 'updatedAt',
  ],
  Businesses: [
    'id', 'name', 'company', 'role', 'phone', 'email',
    'industry', 'revenue', 'revenueMidpoint', 'employees', 'yearsInBusiness',
    'location', 'currentAccounting', 'monthsBehind', 'currentSpend',
    'painPoints', 'wtpSignals', 'leadScore', 'quotableLines',
    'status', 'interviewDate',
    'transcriptUrl', 'summaryUrl', 'enrichedAt',
    'source', 'notes', 'createdAt', 'updatedAt',
  ],
  Transcripts: [
    'id', 'intervieweeName', 'interviewDate',
    'transcriptUrl', 'summaryUrl',
    'linkedType', 'linkedContactId',
    'status', 'extractedData',
    'createdAt', 'processedAt',
  ],
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
          practitioners: readSheet(SHEET_NAMES.PRACTITIONERS),
          businesses: readSheet(SHEET_NAMES.BUSINESSES),
          transcripts: readSheet(SHEET_NAMES.TRANSCRIPTS),
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
      if (!e.postData || !e.postData.contents) {
        return serveJSON({ error: 'POST body is empty — the request may have been redirected as a GET. Check your client redirect handling.' });
      }
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return serveJSON({ error: 'Invalid JSON in POST body: ' + parseErr.toString() });
    }

    const action = payload.action;

    switch (action) {
      case 'upsertContact':
        return handleUpsertContact(payload.data);

      case 'deleteContact':
        return handleDeleteContact(payload.id);

      // V2 schema handlers ---------------------------------------------------
      case 'upsertPractitioner':
        return handleUpsertRow(SHEET_NAMES.PRACTITIONERS, payload.data);

      case 'deletePractitioner':
        return handleDeleteRow(SHEET_NAMES.PRACTITIONERS, payload.id);

      case 'upsertBusiness':
        return handleUpsertRow(SHEET_NAMES.BUSINESSES, payload.data);

      case 'deleteBusiness':
        return handleDeleteRow(SHEET_NAMES.BUSINESSES, payload.id);

      case 'ingestTranscript':
        return handleIngestTranscript(payload.data);

      case 'upsertTranscript':
        return handleUpsertRow(SHEET_NAMES.TRANSCRIPTS, payload.data);

      case 'deleteTranscript':
        return handleDeleteRow(SHEET_NAMES.TRANSCRIPTS, payload.id);

      case 'linkTranscript':
        return handleLinkTranscript(
          payload.transcriptId,
          payload.linkedType,
          payload.linkedContactId
        );

      case 'enrichContact':
        return handleEnrichContact(
          payload.contactType,
          payload.contactId,
          payload.transcriptId
        );
      // ----------------------------------------------------------------------

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
// V2 GENERIC ROW HANDLERS (Practitioners / Businesses / Transcripts)
// ============================================================================

/**
 * Upsert a row in any V2 sheet by id. Creates if new, merges if existing.
 */
function handleUpsertRow(sheetName, data) {
  const headers = SHEET_HEADERS[sheetName];
  if (!headers) return serveJSON({ error: 'Unknown sheet: ' + sheetName });
  if (!data || !data.id) return serveJSON({ error: 'Missing row id' });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return serveJSON({ error: 'Sheet not found: ' + sheetName });

  const values = sheet.getDataRange().getValues();
  const now = new Date().toISOString();

  // Find existing row by id
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.id) {
      rowIndex = i;
      break;
    }
  }

  // Normalize: serialize any object/array values to JSON strings
  const normalized = {};
  Object.keys(data).forEach((k) => {
    const v = data[k];
    normalized[k] =
      v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
  });

  if (rowIndex >= 0) {
    // UPDATE — merge with existing row
    const existing = {};
    headers.forEach((h, i) => { existing[h] = values[rowIndex][i]; });
    const merged = Object.assign({}, existing, normalized, { updatedAt: now });
    const rowValues = headers.map((h) => {
      const v = merged[h];
      return v === undefined || v === null ? '' : v;
    });
    sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([rowValues]);
    return serveJSON({ success: true, row: merged });
  } else {
    // INSERT
    const merged = Object.assign(
      { createdAt: now, updatedAt: now },
      normalized
    );
    const rowValues = headers.map((h) => {
      const v = merged[h];
      return v === undefined || v === null ? '' : v;
    });
    sheet.appendRow(rowValues);
    return serveJSON({ success: true, row: merged });
  }
}

/**
 * Delete a row by id from any V2 sheet.
 */
function handleDeleteRow(sheetName, id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return serveJSON({ error: 'Sheet not found: ' + sheetName });

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      return serveJSON({ success: true });
    }
  }
  return serveJSON({ error: 'Row not found: ' + id });
}

// ============================================================================
// TRANSCRIPT INGESTION + LINKING + ENRICHMENT
// ============================================================================

/**
 * Called by Zapier when a new Plaud transcript is ready.
 * Expected payload.data:
 *   { intervieweeName, interviewDate, transcriptUrl, summaryUrl }
 */
function handleIngestTranscript(data) {
  const id = 'trans-' + new Date().getTime();
  const row = {
    id,
    intervieweeName: data.intervieweeName || '',
    interviewDate: data.interviewDate || new Date().toISOString(),
    transcriptUrl: data.transcriptUrl || '',
    summaryUrl: data.summaryUrl || '',
    linkedType: '',
    linkedContactId: '',
    status: 'new',
    extractedData: '',
  };
  return handleUpsertRow(SHEET_NAMES.TRANSCRIPTS, row);
}

/**
 * Link a transcript to an existing Practitioner or Business.
 */
function handleLinkTranscript(transcriptId, linkedType, linkedContactId) {
  if (!['practitioner', 'business'].includes(linkedType)) {
    return serveJSON({ error: 'linkedType must be "practitioner" or "business"' });
  }

  // Update the transcript row
  const updateTrans = handleUpsertRow(SHEET_NAMES.TRANSCRIPTS, {
    id: transcriptId,
    linkedType,
    linkedContactId,
    status: 'linked',
  });

  // Also copy the transcript/summary URLs onto the contact record
  const trans = findRowById(SHEET_NAMES.TRANSCRIPTS, transcriptId);
  if (trans) {
    const targetSheet =
      linkedType === 'practitioner'
        ? SHEET_NAMES.PRACTITIONERS
        : SHEET_NAMES.BUSINESSES;
    handleUpsertRow(targetSheet, {
      id: linkedContactId,
      transcriptUrl: trans.transcriptUrl,
      summaryUrl: trans.summaryUrl,
      interviewDate: trans.interviewDate,
    });
  }

  return updateTrans;
}

/**
 * Read a transcript/summary from Google Drive, call Claude to extract
 * structured fields, and update the linked contact row.
 */
function handleEnrichContact(contactType, contactId, transcriptId) {
  const settings = readSettingsAsObject();
  const apiKey = settings.anthropicApiKey;
  if (!apiKey) return serveJSON({ error: 'Anthropic API key not set in Settings' });

  const trans = findRowById(SHEET_NAMES.TRANSCRIPTS, transcriptId);
  if (!trans) return serveJSON({ error: 'Transcript not found' });

  // Prefer summary (short), fall back to transcript (long)
  let sourceText = '';
  try {
    if (trans.summaryUrl) sourceText = readDriveFile(trans.summaryUrl);
    if (!sourceText && trans.transcriptUrl) sourceText = readDriveFile(trans.transcriptUrl);
  } catch (err) {
    return serveJSON({ error: 'Could not read Drive file: ' + err.toString() });
  }
  if (!sourceText) return serveJSON({ error: 'No transcript or summary content found' });

  // Pick prompt for the right object type
  const systemPrompt =
    contactType === 'practitioner'
      ? PRACTITIONER_EXTRACTION_PROMPT
      : BUSINESS_EXTRACTION_PROMPT;

  const userMessage =
    'Extract structured fields from this interview material. ' +
    'Return ONLY valid JSON matching the schema in the system prompt.\n\n' +
    'INTERVIEWEE: ' + (trans.intervieweeName || 'Unknown') + '\n\n' +
    'MATERIAL:\n' + sourceText.slice(0, 30000); // hard cap to stay within token limits

  let extracted;
  try {
    extracted = callAnthropicAPI(apiKey, systemPrompt, userMessage, 3000);
  } catch (err) {
    return serveJSON({ error: 'Claude API error: ' + err.toString() });
  }

  if (!extracted || typeof extracted !== 'object') {
    return serveJSON({ error: 'Claude did not return structured JSON' });
  }

  // Compute revenue midpoint helper for Businesses
  if (contactType === 'business' && extracted.revenue && !extracted.revenueMidpoint) {
    extracted.revenueMidpoint = estimateRevenueMidpoint(extracted.revenue);
  }

  // Merge extracted fields into the contact row
  const targetSheet =
    contactType === 'practitioner'
      ? SHEET_NAMES.PRACTITIONERS
      : SHEET_NAMES.BUSINESSES;

  const updatePayload = Object.assign({}, extracted, {
    id: contactId,
    enrichedAt: new Date().toISOString(),
  });
  const result = handleUpsertRow(targetSheet, updatePayload);

  // Mark transcript enriched
  handleUpsertRow(SHEET_NAMES.TRANSCRIPTS, {
    id: transcriptId,
    status: 'enriched',
    extractedData: JSON.stringify(extracted),
    processedAt: new Date().toISOString(),
  });

  return result;
}

/**
 * Find a row by id in a given sheet, returned as a plain object.
 */
function findRowById(sheetName, id) {
  const rows = readSheet(sheetName);
  return rows.find((r) => r.id === id) || null;
}

/**
 * Turn a Google Drive file URL into plain text we can feed to Claude.
 * Works with:
 *   - Google Docs (extracted as plain text)
 *   - .txt / .md / .rtf files
 *   - Any file with textual blob content
 */
function readDriveFile(url) {
  const fileId = extractDriveFileId(url);
  if (!fileId) throw new Error('Could not parse Drive file id from URL: ' + url);

  const file = DriveApp.getFileById(fileId);
  const mime = file.getMimeType();

  if (mime === 'application/vnd.google-apps.document') {
    return DocumentApp.openById(fileId).getBody().getText();
  }

  // For everything else, try to read as text blob
  return file.getBlob().getDataAsString();
}

function extractDriveFileId(url) {
  if (!url) return null;
  // /d/<id>/ pattern (Docs, Sheets)
  let m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // ?id=<id> pattern
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // Bare id
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;
  return null;
}

/**
 * Parse a revenue range string into an approximate midpoint (for sorting/charts).
 */
function estimateRevenueMidpoint(revenueStr) {
  if (!revenueStr || typeof revenueStr !== 'string') return 0;
  const s = revenueStr.toLowerCase().replace(/[$,\s]/g, '');
  const nums = [];
  const re = /([\d.]+)(k|m|b)?/g;
  let match;
  while ((match = re.exec(s)) !== null) {
    let n = parseFloat(match[1]);
    const u = match[2];
    if (u === 'k') n *= 1000;
    else if (u === 'm') n *= 1000000;
    else if (u === 'b') n *= 1000000000;
    nums.push(n);
  }
  if (!nums.length) return 0;
  if (nums.length === 1) return Math.round(nums[0]);
  return Math.round((nums[0] + nums[1]) / 2);
}

// ============================================================================
// V2 EXTRACTION PROMPTS
// ============================================================================

const PRACTITIONER_EXTRACTION_PROMPT = `You are extracting structured data from an interview with an accounting practitioner (bookkeeper, CPA, or firm owner) for Autopilot Accounting's market research and M&A roll-up thesis.

Return ONLY valid JSON — no markdown, no preamble. Use this exact shape; leave fields as empty strings/arrays when the transcript does not say:

{
  "name": "interviewee full name",
  "firmName": "their firm's name",
  "role": "their role (Owner, Partner, Manager, etc.)",
  "firmType": "one of: tax | bookkeeping | tax+bk | cas | cfo-advisory | full-service",
  "firmSize": "one of: solo | 2-5 | 6-20 | 20+",
  "clientCount": "approximate client count as a string (e.g., '150')",
  "revenueEstimate": "firm annual revenue range (e.g., '$500K-$1M')",
  "yearsInBusiness": "number as string",
  "location": "city, state",
  "specialties": ["vertical", "vertical"],
  "techStack": ["QBO", "Karbon"],
  "painPoints": ["pain 1", "pain 2", "pain 3"],
  "acquisitionSignals": {
    "openToSelling": "yes | no | maybe | unclear",
    "valuationExpectation": "stated price or multiple if any",
    "successorSituation": "succession planning notes"
  },
  "aiSentiment": "positive | neutral | negative",
  "notes": "1-3 sentence summary of the most interesting takeaway"
}

If a field is not discussed, leave it as "" or []. Never invent facts.`;

const BUSINESS_EXTRACTION_PROMPT = `You are extracting structured data from an interview with a small business owner for Autopilot Accounting's market research on outsourced accounting demand.

Return ONLY valid JSON — no markdown, no preamble. Use this exact shape; leave fields empty when the transcript does not say:

{
  "name": "interviewee full name",
  "company": "their business name",
  "role": "their role (Owner, CEO, Founder, etc.)",
  "industry": "specific industry (e.g., 'construction - painting')",
  "revenue": "annual revenue as a range string (e.g., '$1M-$3M')",
  "employees": "headcount as string",
  "yearsInBusiness": "number as string",
  "location": "city, state",
  "currentAccounting": "who handles books today (e.g., 'spouse + QBO', 'external CPA')",
  "monthsBehind": "how current their books are, in months (e.g., '3')",
  "currentSpend": "what they pay today (e.g., '$2K/yr tax only')",
  "painPoints": ["pain 1", "pain 2", "pain 3"],
  "wtpSignals": {
    "namedPrice": "any explicit price mentioned",
    "ownerTimeDisplacement": "hours/week the owner or spouse spends on books",
    "decisionMakingBlindness": "evidence they fly blind on numbers",
    "compliancePressure": "SBA, bonding, banking triggers",
    "priorBadExperience": "past bad bookkeeper/CPA story"
  },
  "leadScore": 7,
  "quotableLines": ["memorable quote 1", "memorable quote 2"],
  "notes": "1-3 sentence summary of the most interesting takeaway"
}

Score leadScore 1-10 based on fit for Autopilot's $1K/$2K/$3.5K CAS tiers. Never invent facts.`;

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

// ============================================================================
// SCHEMA V2: Practitioners / Businesses / Transcripts
// ============================================================================
// Run setupSchemaV2() ONCE from the Apps Script editor to create the new
// sheets. Safe to run multiple times — it's idempotent and leaves the old
// "Contacts" sheet untouched so the existing CRM continues to work.
// ============================================================================

const SCHEMA_V2 = {
  Practitioners: [
    'id', 'name', 'firmName', 'role', 'phone', 'email',
    'firmType', 'firmSize', 'clientCount', 'revenueEstimate', 'yearsInBusiness',
    'location', 'specialties', 'techStack',
    'painPoints', 'acquisitionSignals', 'aiSentiment',
    'status', 'interviewDate',
    'transcriptUrl', 'summaryUrl', 'enrichedAt',
    'source', 'notes', 'createdAt', 'updatedAt',
  ],
  Businesses: [
    'id', 'name', 'company', 'role', 'phone', 'email',
    'industry', 'revenue', 'revenueMidpoint', 'employees', 'yearsInBusiness',
    'location', 'currentAccounting', 'monthsBehind', 'currentSpend',
    'painPoints', 'wtpSignals', 'leadScore', 'quotableLines',
    'status', 'interviewDate',
    'transcriptUrl', 'summaryUrl', 'enrichedAt',
    'source', 'notes', 'createdAt', 'updatedAt',
  ],
  Transcripts: [
    'id', 'intervieweeName', 'interviewDate',
    'transcriptUrl', 'summaryUrl',
    'linkedType', 'linkedContactId',
    'status', 'extractedData',
    'createdAt', 'processedAt',
  ],
};

/**
 * One-time setup: creates Practitioners, Businesses, and Transcripts sheets
 * with the correct headers. Leaves existing Contacts / Analyses / Synthesis /
 * Settings sheets untouched.
 *
 * HOW TO RUN:
 *   1. Open this script in the Apps Script editor
 *   2. In the top toolbar, select "setupSchemaV2" from the function dropdown
 *   3. Click ▶ Run
 *   4. Check the execution log — you should see "✅ Schema v2 setup complete"
 */
function setupSchemaV2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const created = [];
  const updated = [];

  Object.entries(SCHEMA_V2).forEach(([sheetName, headers]) => {
    let sheet = ss.getSheetByName(sheetName);
    const isNew = !sheet;

    if (isNew) {
      sheet = ss.insertSheet(sheetName);
      created.push(sheetName);
    }

    // Write / overwrite the header row
    const currentCols = Math.max(1, sheet.getLastColumn());
    const currentHeaders = sheet.getRange(1, 1, 1, currentCols).getValues()[0];
    const headersMatch =
      currentHeaders.length === headers.length &&
      headers.every((h, i) => currentHeaders[i] === h);

    if (!headersMatch) {
      sheet.getRange(1, 1, 1, headers.length)
        .setValues([headers])
        .setFontWeight('bold')
        .setBackground('#E8F5EE')
        .setFontColor('#1A5C3A');
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headers.length);
      if (!isNew) updated.push(sheetName);
    }
  });

  // Make sure auxiliary sheets exist
  ['Analyses', 'Synthesis', 'Settings'].forEach((name) => {
    if (!ss.getSheetByName(name)) {
      const sheet = ss.insertSheet(name);
      const hdrs = SHEET_HEADERS[name];
      if (hdrs) {
        sheet.getRange(1, 1, 1, hdrs.length).setValues([hdrs]).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
      created.push(name);
    }
  });

  Logger.log('✅ Schema v2 setup complete');
  Logger.log('Created: ' + (created.length ? created.join(', ') : '(none — all existed)'));
  Logger.log('Updated headers on: ' + (updated.length ? updated.join(', ') : '(none)'));
  Logger.log('All sheets now in this spreadsheet:');
  ss.getSheets().forEach((s) => Logger.log('  • ' + s.getName()));

  return {
    ok: true,
    created,
    updated,
    allSheets: ss.getSheets().map((s) => s.getName()),
  };
}
