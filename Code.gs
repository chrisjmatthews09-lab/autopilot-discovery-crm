// ============================================================================
// AUTOPILOT DISCOVERY CRM - GOOGLE APPS SCRIPT BACKEND
// ============================================================================
// Deploy as a web app (Execute as: Me, Who has access: Anyone).

// ============================================================================
// SHEET NAMES
// ============================================================================
const SHEET_NAMES = {
  ANALYSES:      'Analyses',
  SYNTHESIS:     'Synthesis',
  SETTINGS:      'Settings',
  PRACTITIONERS: 'Practitioners',
  BUSINESSES:    'Businesses',
  TRANSCRIPTS:   'Transcripts',
};

const SHEET_HEADERS = {
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
    'id', 'intervieweeName', 'intervieweeBusinessName', 'interviewDate',
    'transcriptUrl', 'summaryUrl',
    'linkedType', 'linkedContactId',
    'status', 'extractedData',
    'createdAt', 'processedAt',
  ],
};

// ============================================================================
// MAIN ENTRY POINTS
// ============================================================================

function doGet(e) {
  const action = e.parameter.action;
  try {
    switch (action) {
      case 'getData':
        return serveJSON({
          practitioners: readSheet(SHEET_NAMES.PRACTITIONERS),
          businesses:    readSheet(SHEET_NAMES.BUSINESSES),
          transcripts:   readSheet(SHEET_NAMES.TRANSCRIPTS),
          analyses:      readSheet(SHEET_NAMES.ANALYSES),
          synthesis:     readSheet(SHEET_NAMES.SYNTHESIS),
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

function doPost(e) {
  try {
    let payload;
    try {
      if (!e.postData || !e.postData.contents) {
        return serveJSON({ error: 'POST body is empty — the request may have been redirected as a GET.' });
      }
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return serveJSON({ error: 'Invalid JSON in POST body: ' + parseErr.toString() });
    }

    const action = payload.action;

    switch (action) {
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
        return handleLinkTranscript(payload.transcriptId, payload.linkedType, payload.linkedContactId);
      case 'enrichContact':
        return handleEnrichContact(payload.contactType, payload.contactId, payload.transcriptId);
      case 'saveAnalysis':
        return handleSaveAnalysis(payload.data);
      case 'saveSynthesis':
        return handleSaveSynthesis(payload.data);
      case 'analyzeTranscript':
        return handleAnalyzeTranscript(payload.transcript, payload.interviewType, payload.intervieweeName);
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

function handleSaveAnalysis(analysisData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.ANALYSES);
  sheet.appendRow([
    analysisData.id, analysisData.contactId, analysisData.intervieweeName,
    analysisData.type, analysisData.analyzedAt, analysisData.overallSentiment,
    analysisData.leadScore, analysisData.fullJSON,
  ]);
  return serveJSON({ success: true, analysis: analysisData });
}

function handleSaveSynthesis(synthesisData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SYNTHESIS);
  const data  = sheet.getDataRange().getValues();
  if (data.length > 1) {
    sheet.getRange(2, 1).setValue(synthesisData.id);
    sheet.getRange(2, 2).setValue(synthesisData.createdAt);
    sheet.getRange(2, 3).setValue(synthesisData.fullJSON);
  } else {
    sheet.appendRow([synthesisData.id, synthesisData.createdAt, synthesisData.fullJSON]);
  }
  return serveJSON({ success: true, synthesis: synthesisData });
}

function handleAnalyzeTranscript(transcript, interviewType, intervieweeName) {
  const settings = readSettingsAsObject();
  const apiKey   = settings.anthropicApiKey;
  if (!apiKey) return serveJSON({ error: 'Anthropic API key not configured in Settings' });

  const systemPrompt = interviewType === 'pro' ? PRO_SYSTEM_PROMPT : BIZ_SYSTEM_PROMPT;
  const userMessage  =
    'Analyze this interview transcript. Interviewee name: ' +
    (intervieweeName || 'Unknown') + '\n\nTRANSCRIPT:\n' + transcript;

  try {
    return serveJSON(callAnthropicAPI(apiKey, systemPrompt, userMessage, 3000));
  } catch (err) {
    return serveJSON({ error: 'Anthropic API error: ' + err.toString() });
  }
}

function handleRunSynthesis(analyses) {
  const settings = readSettingsAsObject();
  const apiKey   = settings.anthropicApiKey;
  if (!apiKey) return serveJSON({ error: 'Anthropic API key not configured in Settings' });

  const parsedAnalyses = analyses.map((a) => {
    try { return typeof a.fullJSON === 'string' ? JSON.parse(a.fullJSON) : a; }
    catch (e) { return a; }
  });

  const summaries = parsedAnalyses.map((a, i) => {
    const typeLabel = a.type === 'pro' ? 'Practitioner' : 'Business Owner';
    const name      = a.intervieweeName || a.interviewee?.name || 'Unknown';
    const insights  = (a.keyInsights  || []).join('; ');
    const pains     = (a.painPoints   || []).join('; ');
    const pricing   = a.pricingData
      ? 'Pricing: BK ' + (a.pricingData.bookkeepingRange || 'n/a') +
        ', CAS ' + (a.pricingData.casRange || 'n/a')
      : '';
    const wtp = a.wtpSignals
      ? 'WTP: Named price ' + (a.wtpSignals.namedPrice || 'n/a') +
        ', AI sentiment ' + (a.wtpSignals.aiSentiment || a.valueProTesting?.aiSentiment || 'n/a')
      : '';
    const quotes = a.quotableLines ? 'Quotes: ' + a.quotableLines.join('; ') : '';
    return (
      'Interview ' + (i + 1) + ' (' + typeLabel + ' — ' + name + '):\n' +
      'Key Insights: ' + insights + '\nPain Points: ' + pains + '\n' +
      pricing + '\n' + wtp + '\n' + quotes
    );
  }).join('\n\n---\n\n');

  try {
    return serveJSON(callAnthropicAPI(
      apiKey, SYNTHESIS_SYSTEM_PROMPT,
      'Synthesize these ' + parsedAnalyses.length + ' interview analyses:\n\n' + summaries,
      4000
    ));
  } catch (err) {
    return serveJSON({ error: 'Anthropic API error: ' + err.toString() });
  }
}

function handleSaveSetting(key, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return serveJSON({ success: true });
    }
  }
  sheet.appendRow([key, value]);
  return serveJSON({ success: true });
}

// ============================================================================
// SHEET OPERATIONS
// ============================================================================

function readSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(SHEET_HEADERS[sheetName]);
  }
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map((row) => {
    const obj = {};
    headers.forEach((header, idx) => { obj[header] = row[idx] || ''; });
    return obj;
  });
}

function readSettingsAsObject() {
  const settings = readSheet(SHEET_NAMES.SETTINGS);
  const obj = {};
  settings.forEach((row) => { obj[row.key] = row.value; });
  return obj;
}

function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(SHEET_NAMES).forEach((sheetName) => {
    if (!ss.getSheetByName(sheetName)) {
      const sheet = ss.insertSheet(sheetName);
      sheet.appendRow(SHEET_HEADERS[sheetName]);
    }
  });
}

// ============================================================================
// ANTHROPIC API
// ============================================================================

function callAnthropicAPI(apiKey, systemPrompt, userMessage, maxTokens, model) {
  const url     = 'https://api.anthropic.com/v1/messages';
  const payload = {
    model:      model || 'claude-opus-4-5',
    max_tokens: maxTokens || 3000,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userMessage }],
  };
  const options = {
    method:             'post',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const result   = JSON.parse(response.getContentText());

  if (response.getResponseCode() !== 200) {
    throw new Error(result.error?.message || 'Unknown Anthropic API error');
  }
  if (result.content && result.content[0] && result.content[0].text) {
    const responseText = result.content[0].text;
    try   { return JSON.parse(responseText); }
    catch (e) {
      return { rawAnalysis: responseText, overallSentiment: 'unclear', leadScore: 0 };
    }
  }
  throw new Error('No content in Anthropic response');
}

// ============================================================================
// SYSTEM PROMPTS
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
// V2 GENERIC ROW HANDLERS
// ============================================================================

function handleUpsertRow(sheetName, data) {
  const headers = SHEET_HEADERS[sheetName];
  if (!headers) return serveJSON({ error: 'Unknown sheet: ' + sheetName });
  if (!data || !data.id) return serveJSON({ error: 'Missing row id' });

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return serveJSON({ error: 'Sheet not found: ' + sheetName });

  const values = sheet.getDataRange().getValues();
  const now    = new Date().toISOString();

  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(data.id)) { rowIndex = i; break; }
  }

  const normalized = {};
  Object.keys(data).forEach((k) => {
    const v = data[k];
    normalized[k] = (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
  });

  if (rowIndex >= 0) {
    const existing = {};
    headers.forEach((h, i) => { existing[h] = values[rowIndex][i]; });
    const merged    = Object.assign({}, existing, normalized, { updatedAt: now });
    const rowValues = headers.map((h) =>
      (merged[h] === undefined || merged[h] === null ? '' : merged[h])
    );
    sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([rowValues]);
    return serveJSON({ success: true, row: merged });
  } else {
    const merged    = Object.assign({ createdAt: now, updatedAt: now }, normalized);
    const rowValues = headers.map((h) =>
      (merged[h] === undefined || merged[h] === null ? '' : merged[h])
    );
    sheet.appendRow(rowValues);
    return serveJSON({ success: true, row: merged });
  }
}

function handleDeleteRow(sheetName, id) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return serveJSON({ error: 'Sheet not found: ' + sheetName });

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return serveJSON({ success: true });
    }
  }
  return serveJSON({ error: 'Row not found: ' + id });
}

// ============================================================================
// SEQUENTIAL ID GENERATORS
// ============================================================================

function getNextTranscriptId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.TRANSCRIPTS);
  if (!sheet) return 't-001';
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][0] || '').match(/^t-(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return 't-' + String(maxNum + 1).padStart(3, '0');
}

function getNextPractitionerId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.PRACTITIONERS);
  if (!sheet) return 'prac-001';
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][0] || '').match(/^prac-(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return 'prac-' + String(maxNum + 1).padStart(3, '0');
}

function getNextBusinessId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.BUSINESSES);
  if (!sheet) return 'biz-001';
  const data = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const m = String(data[i][0] || '').match(/^biz-(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return 'biz-' + String(maxNum + 1).padStart(3, '0');
}

// ============================================================================
// INTERVIEW CLASSIFICATION + NAME EXTRACTION
// ============================================================================

function classifyInterview(apiKey, sourceText, rawTitle) {
  const systemPrompt =
    'You are analyzing an interview for Autopilot Accounting market research.\n\n' +
    'From the interview content, extract three things:\n' +
    '1. The interviewee\'s first and last name — the actual person being interviewed, ' +
    'NOT the interviewer, and NOT a company or meeting title\n' +
    '2. The name of their business or accounting firm\n' +
    '3. Whether they are a PRACTITIONER (bookkeeper, CPA, accountant, or accounting firm ' +
    'owner/employee) or a BUSINESS OWNER (owner of a non-accounting small business)\n\n' +
    'Return ONLY valid JSON — no markdown, no extra text:\n' +
    '{\n' +
    '  "intervieweeName": "First Last",\n' +
    '  "intervieweeBusinessName": "Business or Firm Name",\n' +
    '  "type": "business"\n' +
    '}\n\n' +
    'Important rules:\n' +
    '- Use only "practitioner" or "business" for type\n' +
    '- intervieweeName must be a real person\'s name only (e.g. "John Smith")\n' +
    '- Never use a document title, meeting title, or topic as intervieweeName\n' +
    '- If you cannot confidently identify the person\'s name, use an empty string ""';

  const userMessage =
    'Document title (do NOT use as intervieweeName): ' +
    (rawTitle || 'Unknown') + '\n\n' +
    'Interview content:\n' + sourceText.slice(0, 3000);

  Logger.log('Calling classifyInterview...');
  const result = callAnthropicAPI(apiKey, systemPrompt, userMessage, 150, 'claude-haiku-4-5-20251001');
  Logger.log('Classification raw result: ' + JSON.stringify(result));

  if (result && result.type) {
    const name    = String(result.intervieweeName         || '').trim();
    const bizName = String(result.intervieweeBusinessName || '').trim();
    Logger.log('Extracted → name: "' + name + '" | biz: "' + bizName + '" | type: ' + result.type);
    return {
      type:                    result.type === 'practitioner' ? 'practitioner' : 'business',
      intervieweeName:         name,
      intervieweeBusinessName: bizName,
    };
  }

  const raw = String(result.rawAnalysis || '').toLowerCase();
  Logger.log('Classification fallback, raw: "' + raw + '"');
  return {
    type:                    raw.includes('practitioner') ? 'practitioner' : 'business',
    intervieweeName:         '',
    intervieweeBusinessName: '',
  };
}

// ============================================================================
// TRANSCRIPT INGESTION + AUTO-PIPELINE
// ============================================================================

function handleIngestTranscript(data) {
  const rawTitle = data.intervieweeName || '';
  let transcriptRow;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    if (data.transcriptUrl) {
      const existing = readSheet(SHEET_NAMES.TRANSCRIPTS);
      const dupe     = existing.find(r => r.transcriptUrl === data.transcriptUrl);
      if (dupe) {
        Logger.log('Duplicate ingest blocked for: ' + data.transcriptUrl);
        return serveJSON({ success: true, row: dupe, duplicate: true });
      }
    }

    const id  = getNextTranscriptId();
    const now = new Date().toISOString();
    transcriptRow = {
      id,
      intervieweeName:         '',
      intervieweeBusinessName: '',
      interviewDate:           data.interviewDate || now,
      transcriptUrl:           data.transcriptUrl || '',
      summaryUrl:              data.summaryUrl    || '',
      linkedType:              '',
      linkedContactId:         '',
      status:                  'new',
      extractedData:           '',
      createdAt:               now,
      processedAt:             '',
    };
    handleUpsertRow(SHEET_NAMES.TRANSCRIPTS, transcriptRow);
    Logger.log('Transcript created: ' + id + ' | raw title: ' + rawTitle);
  } finally {
    lock.releaseLock();
  }

  const settings = readSettingsAsObject();
  const apiKey   = settings.anthropicApiKey;

  if (!apiKey) {
    Logger.log('No API key — transcript saved, classify manually');
    return serveJSON({ success: true, transcriptId: transcriptRow.id, note: 'No API key — classify manually' });
  }

  let sourceText = '';
  try {
    if (transcriptRow.summaryUrl)
      sourceText = readDriveFile(transcriptRow.summaryUrl);
    if (!sourceText && transcriptRow.transcriptUrl)
      sourceText = readDriveFile(transcriptRow.transcriptUrl);
  } catch (err) {
    Logger.log('Drive read failed: ' + err);
    return serveJSON({ success: true, transcriptId: transcriptRow.id, note: 'Drive read failed — classify manually' });
  }

  if (!sourceText || sourceText.length < 50) {
    Logger.log('Source text too short to classify');
    return serveJSON({ success: true, transcriptId: transcriptRow.id, note: 'Content too short — classify manually' });
  }

  let classification;
  try {
    classification = classifyInterview(apiKey, sourceText, rawTitle);
  } catch (err) {
    Logger.log('Classification error: ' + err);
    return serveJSON({ success: true, transcriptId: transcriptRow.id, note: 'Classification failed — classify manually' });
  }

  const contactType           = classification.type;
  const extractedName         = classification.intervieweeName;
  const extractedBusinessName = classification.intervieweeBusinessName;

  handleUpsertRow(SHEET_NAMES.TRANSCRIPTS, {
    id:                      transcriptRow.id,
    intervieweeName:         extractedName,
    intervieweeBusinessName: extractedBusinessName,
  });

  const contactId   = contactType === 'practitioner' ? getNextPractitionerId() : getNextBusinessId();
  const targetSheet = contactType === 'practitioner'
    ? SHEET_NAMES.PRACTITIONERS
    : SHEET_NAMES.BUSINESSES;
  const now2        = new Date().toISOString();
  const displayName = extractedName || extractedBusinessName || '';

  handleUpsertRow(targetSheet, {
    id:            contactId,
    name:          displayName,
    company:       extractedBusinessName,
    interviewDate: transcriptRow.interviewDate,
    transcriptUrl: transcriptRow.transcriptUrl,
    summaryUrl:    transcriptRow.summaryUrl,
    status:        'new',
    source:        'zapier',
    createdAt:     now2,
    updatedAt:     now2,
  });
  Logger.log('Contact created: ' + contactId);

  handleUpsertRow(SHEET_NAMES.TRANSCRIPTS, {
    id:              transcriptRow.id,
    linkedType:      contactType,
    linkedContactId: contactId,
    status:          'linked',
  });
  Logger.log('Transcript ' + transcriptRow.id + ' linked to ' + contactType + ' ' + contactId);

  return serveJSON({
    success: true, transcriptId: transcriptRow.id,
    contactType, contactId,
    intervieweeName: extractedName,
    intervieweeBusinessName: extractedBusinessName,
    note: 'Ingested, classified, and linked. Run testEnrichLatest() to populate all fields.',
  });
}

function onTranscriptRowEdit(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.TRANSCRIPTS);
    if (!sheet) return;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const idRange = sheet.getRange(2, 1, lastRow - 1, 1);
    const ids     = idRange.getValues();
    let changed   = false;

    for (let i = 0; i < ids.length; i++) {
      if (!ids[i][0]) {
        ids[i][0] = getNextTranscriptId();
        changed    = true;
        Logger.log('Auto-assigned ' + ids[i][0] + ' to Transcripts row ' + (i + 2));
      }
    }
    if (changed) idRange.setValues(ids);
  } catch (err) {
    Logger.log('onTranscriptRowEdit error: ' + err);
  }
}

function handleLinkTranscript(transcriptId, linkedType, linkedContactId) {
  if (!['practitioner', 'business'].includes(linkedType)) {
    return serveJSON({ error: 'linkedType must be "practitioner" or "business"' });
  }
  const updateTrans = handleUpsertRow(SHEET_NAMES.TRANSCRIPTS, {
    id: transcriptId, linkedType, linkedContactId, status: 'linked',
  });
  const trans = findRowById(SHEET_NAMES.TRANSCRIPTS, transcriptId);
  if (trans) {
    const targetSheet = linkedType === 'practitioner'
      ? SHEET_NAMES.PRACTITIONERS : SHEET_NAMES.BUSINESSES;
    handleUpsertRow(targetSheet, {
      id: linkedContactId,
      transcriptUrl: trans.transcriptUrl,
      summaryUrl:    trans.summaryUrl,
      interviewDate: trans.interviewDate,
    });
  }
  return updateTrans;
}

function handleEnrichContact(contactType, contactId, transcriptId) {
  Logger.log('enrich start: ' + contactType + ' ' + contactId + ' ' + transcriptId);
  const settings = readSettingsAsObject();
  const apiKey   = settings.anthropicApiKey;
  Logger.log('api key present: ' + !!apiKey + ' (length ' + (apiKey || '').length + ')');
  if (!apiKey) return serveJSON({ error: 'Anthropic API key not set in Settings' });

  const trans = findRowById(SHEET_NAMES.TRANSCRIPTS, transcriptId);
  Logger.log('transcript found: ' + !!trans + ' id=' + transcriptId);
  if (!trans) return serveJSON({ error: 'Transcript not found' });
  Logger.log('urls: t=' + trans.transcriptUrl + ' s=' + trans.summaryUrl);

  let sourceText = '';
  try {
    if (trans.summaryUrl)    sourceText = readDriveFile(trans.summaryUrl);
    if (!sourceText && trans.transcriptUrl) sourceText = readDriveFile(trans.transcriptUrl);
  } catch (err) {
    return serveJSON({ error: 'Could not read Drive file: ' + err.toString() });
  }
  if (!sourceText) return serveJSON({ error: 'No transcript or summary content found' });

  const systemPrompt = contactType === 'practitioner'
    ? PRACTITIONER_EXTRACTION_PROMPT : BUSINESS_EXTRACTION_PROMPT;

  const userMessage =
    'Extract structured fields from this interview material. ' +
    'Return ONLY valid JSON matching the schema in the system prompt.\n\n' +
    'INTERVIEWEE: ' + (trans.intervieweeName || 'Unknown') + '\n\n' +
    'MATERIAL:\n' + sourceText.slice(0, 30000);

  let extracted;
  try {
    extracted = callAnthropicAPI(apiKey, systemPrompt, userMessage, 3000);
  } catch (err) {
    return serveJSON({ error: 'Claude API error: ' + err.toString() });
  }

  if (!extracted || typeof extracted !== 'object') {
    return serveJSON({ error: 'Claude did not return structured JSON' });
  }

  if (contactType === 'business' && extracted.revenue && !extracted.revenueMidpoint) {
    extracted.revenueMidpoint = estimateRevenueMidpoint(extracted.revenue);
  }

  const targetSheet = contactType === 'practitioner'
    ? SHEET_NAMES.PRACTITIONERS : SHEET_NAMES.BUSINESSES;

  const result = handleUpsertRow(targetSheet, Object.assign({}, extracted, {
    id: contactId, enrichedAt: new Date().toISOString(),
  }));

  handleUpsertRow(SHEET_NAMES.TRANSCRIPTS, {
    id:            transcriptId,
    status:        'enriched',
    extractedData: JSON.stringify(extracted),
    processedAt:   new Date().toISOString(),
  });

  return result;
}

function findRowById(sheetName, id) {
  return readSheet(sheetName).find((r) => String(r.id) === String(id)) || null;
}

function readDriveFile(url) {
  const fileId = extractDriveFileId(url);
  if (!fileId) throw new Error('Could not parse Drive file id from URL: ' + url);
  const file = DriveApp.getFileById(fileId);
  const mime = file.getMimeType();
  if (mime === 'application/vnd.google-apps.document') {
    return DocumentApp.openById(fileId).getBody().getText();
  }
  return file.getBlob().getDataAsString();
}

function extractDriveFileId(url) {
  if (!url) return null;
  let m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(url)) return url;
  return null;
}

function estimateRevenueMidpoint(revenueStr) {
  if (!revenueStr || typeof revenueStr !== 'string') return 0;
  const s    = revenueStr.toLowerCase().replace(/[$,\s]/g, '');
  const nums = [];
  const re   = /([\d.]+)(k|m|b)?/g;
  let match;
  while ((match = re.exec(s)) !== null) {
    let n   = parseFloat(match[1]);
    const u = match[2];
    if (u === 'k') n *= 1000;
    else if (u === 'm') n *= 1000000;
    else if (u === 'b') n *= 1000000000;
    nums.push(n);
  }
  if (!nums.length)      return 0;
  if (nums.length === 1) return Math.round(nums[0]);
  return Math.round((nums[0] + nums[1]) / 2);
}

// ============================================================================
// EXTRACTION PROMPTS
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
// SCHEMA V2 SETUP
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
    'id', 'intervieweeName', 'intervieweeBusinessName', 'interviewDate',
    'transcriptUrl', 'summaryUrl',
    'linkedType', 'linkedContactId',
    'status', 'extractedData',
    'createdAt', 'processedAt',
  ],
};

function setupSchemaV2() {
  const ss      = SpreadsheetApp.getActiveSpreadsheet();
  const created = [];
  const updated = [];

  Object.entries(SCHEMA_V2).forEach(([sheetName, headers]) => {
    let sheet   = ss.getSheetByName(sheetName);
    const isNew = !sheet;
    if (isNew) { sheet = ss.insertSheet(sheetName); created.push(sheetName); }

    const currentCols    = Math.max(1, sheet.getLastColumn());
    const currentHeaders = sheet.getRange(1, 1, 1, currentCols).getValues()[0];
    const headersMatch   =
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

  ['Analyses', 'Synthesis', 'Settings'].forEach((name) => {
    if (!ss.getSheetByName(name)) {
      const sheet = ss.insertSheet(name);
      const hdrs  = SHEET_HEADERS[name];
      if (hdrs) {
        sheet.getRange(1, 1, 1, hdrs.length).setValues([hdrs]).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
      created.push(name);
    }
  });

  Logger.log('✅ Schema v2 setup complete');
  Logger.log('Created: '            + (created.length ? created.join(', ') : '(none)'));
  Logger.log('Updated headers on: ' + (updated.length ? updated.join(', ') : '(none)'));
  ss.getSheets().forEach((s) => Logger.log('  • ' + s.getName()));
  return { ok: true, created, updated };
}

// ============================================================================
// UTILITIES
// ============================================================================

function serveJSON(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function initializeSpreadsheet() {
  ensureSheets();
  Logger.log('Spreadsheet initialized');
}

// ============================================================================
// TEST & REPAIR HELPERS
// ============================================================================

/**
 * STEP 1 — Run this first to confirm the correct code is loaded.
 * Must show: "Column count: 12" and "✅ Correct version is running"
 */
function debugDeployment() {
  Logger.log('=== DEPLOYMENT CHECK ===');
  Logger.log('Transcripts headers: ' + JSON.stringify(SHEET_HEADERS.Transcripts));
  Logger.log('Column count: ' + SHEET_HEADERS.Transcripts.length + ' (expected 12)');
  if (SHEET_HEADERS.Transcripts.includes('intervieweeBusinessName')) {
    Logger.log('✅ Correct version is running');
  } else {
    Logger.log('❌ OLD version is running — save the file (Cmd+S) and run this again');
  }
}

/**
 * STEP 2 — Directly rewrites the t-001 row with correct column alignment.
 * Reads current cell values by position and shifts them into the right columns.
 * Run from the Apps Script editor — does NOT need Zapier or a deployment.
 */
function manualFixT001() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transcripts');
  if (!sheet) { Logger.log('ERROR: Transcripts sheet not found'); return; }

  const data = sheet.getDataRange().getValues();
  Logger.log('Total rows (including header): ' + data.length);
  Logger.log('Header row: ' + JSON.stringify(data[0]));

  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== 't-001') continue;
    found = true;

    Logger.log('Found t-001 at sheet row ' + (i + 1));
    Logger.log('Current raw values: ' + JSON.stringify(data[i]));

    // Current (wrong) layout — old 11-col data sitting under new 12-col header:
    // [0]=id [1]=docTitle [2]=interviewDate [3]=transcriptUrl [4]=summaryUrl
    // [5]=linkedType [6]=linkedContactId [7]=status [8]=extractedData
    // [9]=createdAt [10]=processedAt
    const fixed = [
      data[i][0],   // A: id          = t-001
      '',           // B: intervieweeName         (blank — Claude fills this)
      '',           // C: intervieweeBusinessName  (blank — reclassifyT001 fills this)
      data[i][2],   // D: interviewDate   (was at col C)
      data[i][3],   // E: transcriptUrl  (was at col D)
      data[i][4],   // F: summaryUrl     (was at col E)
      data[i][5],   // G: linkedType
      data[i][6],   // H: linkedContactId
      data[i][7],   // I: status
      data[i][8],   // J: extractedData
      data[i][9],   // K: createdAt
      data[i][10],  // L: processedAt
    ];

    Logger.log('Writing fixed values: ' + JSON.stringify(fixed));
    sheet.getRange(i + 1, 1, 1, 12).setValues([fixed]);
    Logger.log('✅ t-001 row fixed. Now run reclassifyT001 to extract names.');
    return;
  }

  if (!found) Logger.log('ERROR: t-001 row not found in Transcripts sheet');
}

/**
 * STEP 3 — Calls Claude to read the Drive files for t-001 and extract
 * the interviewee name, business name, and contact type, then writes
 * those values back to the sheet and creates the Businesses/Practitioners row.
 */
function reclassifyT001() {
  const settings = readSettingsAsObject();
  const apiKey   = settings.anthropicApiKey;
  if (!apiKey) { Logger.log('ERROR: No API key in Settings tab'); return; }

  const trans = findRowById(SHEET_NAMES.TRANSCRIPTS, 't-001');
  if (!trans) { Logger.log('ERROR: t-001 not found — run manualFixT001 first'); return; }

  Logger.log('Reading Drive files for t-001...');
  Logger.log('summaryUrl: '    + trans.summaryUrl);
  Logger.log('transcriptUrl: ' + trans.transcriptUrl);

  let sourceText = '';
  try {
    if (trans.summaryUrl)    sourceText = readDriveFile(trans.summaryUrl);
    if (!sourceText && trans.transcriptUrl) sourceText = readDriveFile(trans.transcriptUrl);
  } catch (err) {
    Logger.log('ERROR reading Drive file: ' + err);
    return;
  }

  if (!sourceText || sourceText.length < 50) {
    Logger.log('ERROR: Source text is empty or too short — check Drive file access');
    return;
  }

  Logger.log('Source text length: ' + sourceText.length + ' chars');

  const classification = classifyInterview(apiKey, sourceText, '');
  Logger.log('Classification: ' + JSON.stringify(classification));

  const contactType           = classification.type;
  const extractedName         = classification.intervieweeName;
  const extractedBusinessName = classification.intervieweeBusinessName;

  // Update transcript row with names
  handleUpsertRow(SHEET_NAMES.TRANSCRIPTS, {
    id:                      't-001',
    intervieweeName:         extractedName,
    intervieweeBusinessName: extractedBusinessName,
  });
  Logger.log('Transcript names updated');

  // Create contact row
  const contactId   = contactType === 'practitioner' ? getNextPractitionerId() : getNextBusinessId();
  const targetSheet = contactType === 'practitioner'
    ? SHEET_NAMES.PRACTITIONERS : SHEET_NAMES.BUSINESSES;
  const now = new Date().toISOString();

  handleUpsertRow(targetSheet, {
    id:            contactId,
    name:          extractedName || extractedBusinessName || '',
    company:       extractedBusinessName,
    interviewDate: trans.interviewDate,
    transcriptUrl: trans.transcriptUrl,
    summaryUrl:    trans.summaryUrl,
    status:        'new',
    source:        'zapier',
    createdAt:     now,
    updatedAt:     now,
  });
  Logger.log('Contact created: ' + contactId + ' in ' + targetSheet);

  // Link transcript
  handleUpsertRow(SHEET_NAMES.TRANSCRIPTS, {
    id:              't-001',
    linkedType:      contactType,
    linkedContactId: contactId,
    status:          'linked',
  });
  Logger.log('✅ Done. t-001 linked to ' + contactType + ' ' + contactId);
  Logger.log('Now run testEnrichLatest to populate all fields.');
}

function testDriveAccess() {
  const url  = 'https://docs.google.com/document/d/1_4JcpJG0FVq9p2bdjOLr45y8o7t589TVbyxWDBrxDzk/edit?usp=drivesdk';
  const text = readDriveFile(url);
  Logger.log('First 200 chars: ' + text.slice(0, 200));
}

function testEnrichLatest() {
  const transcripts = readSheet(SHEET_NAMES.TRANSCRIPTS);
  const pending     = transcripts.filter(t => t.linkedContactId && t.status === 'linked');
  if (!pending.length) {
    Logger.log('No linked transcripts pending enrichment.');
    return;
  }
  const trans = pending[pending.length - 1];
  Logger.log('Enriching: ' + trans.id + ' → ' + trans.linkedType + ' ' + trans.linkedContactId);
  const result = handleEnrichContact(trans.linkedType, trans.linkedContactId, trans.id);
  Logger.log('RESULT: ' + result.getContent());
}

function testEnrichContact() {
  const contactType  = 'business';
  const contactId    = 'biz-001';
  const transcriptId = 't-001';
  const result = handleEnrichContact(contactType, contactId, transcriptId);
  Logger.log('FINAL RESULT: ' + result.getContent());
}
