// ============================================================
// AUTOPILOT DISCOVERY CRM — Code.gs
// ============================================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_FAST = 'claude-haiku-4-5-20251001';
const MODEL_RICH = 'claude-opus-4-5';

// Single source of truth for all sheet column orders
const SHEET_HEADERS = {
  Transcripts: [
    'id', 'intervieweeName', 'intervieweeBusinessName', 'interviewDate',
    'transcriptUrl', 'summaryUrl',
    'linkedType', 'linkedContactId',
    'status', 'extractedData',
    'createdAt', 'processedAt',
  ],
  Practitioners: [
    'id', 'name', 'company', 'role', 'phone', 'email',
    'industry', 'firmSize', 'yearsInPractice', 'location',
    'softwareStack', 'clientCount', 'avgClientRevenue',
    'painPoints', 'wtpSignals', 'leadScore', 'quotableLines',
    'status', 'interviewDate', 'transcriptUrl', 'summaryUrl',
    'enrichedAt', 'source', 'notes', 'createdAt', 'updatedAt',
  ],
  Businesses: [
    'id', 'name', 'company', 'role', 'phone', 'email',
    'industry', 'revenue', 'revenueMidpoint', 'employees',
    'yearsInBusiness', 'location', 'currentAccounting',
    'monthsBehind', 'currentSpend',
    'painPoints', 'wtpSignals', 'leadScore', 'quotableLines',
    'status', 'interviewDate', 'transcriptUrl', 'summaryUrl',
    'enrichedAt', 'source', 'notes', 'createdAt', 'updatedAt',
  ],
  Analyses: [
    'id', 'transcriptId', 'contactId', 'contactType',
    'analysisType', 'content', 'model', 'createdAt',
  ],
  Synthesis: [
    'id', 'title', 'content', 'sourceTranscriptIds', 'model', 'createdAt',
  ],
  Settings: [
    'key', 'value', 'description',
  ],
};

// ============================================================
// SHEET SETUP
// ============================================================

function setupSchemaV2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.entries(SHEET_HEADERS).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    const existing = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];
    if (existing.join(',') !== headers.join(',')) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  });

  // Remove legacy Contacts sheet if present
  const contacts = ss.getSheetByName('Contacts');
  if (contacts) ss.deleteSheet(contacts);

  Logger.log('setupSchemaV2 complete');
}

// ============================================================
// SEQUENTIAL ID GENERATORS
// ============================================================

function getNextTranscriptId() {
  return getNextId_('Transcripts', 't');
}

function getNextPractitionerId() {
  return getNextId_('Practitioners', 'prac');
}

function getNextBusinessId() {
  return getNextId_('Businesses', 'biz');
}

function getNextId_(sheetName, prefix) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return prefix + '-001';
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map(r => r[0]).filter(v => typeof v === 'string' && v.startsWith(prefix + '-'));
  if (ids.length === 0) return prefix + '-001';
  const max = Math.max(...ids.map(id => parseInt(id.split('-')[1], 10) || 0));
  return prefix + '-' + String(max + 1).padStart(3, '0');
}

// ============================================================
// GENERIC UPSERT ROW (uses SHEET_HEADERS for column mapping)
// ============================================================

function handleUpsertRow(sheetName, idValue, fields) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  const headers = SHEET_HEADERS[sheetName];
  if (!headers) throw new Error('No SHEET_HEADERS defined for: ' + sheetName);

  // Find existing row by ID
  let rowIndex = -1;
  if (sheet.getLastRow() >= 2) {
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === idValue) { rowIndex = i + 2; break; }
    }
  }

  if (rowIndex === -1) {
    // Append new row
    const row = headers.map(h => {
      if (h === 'id') return idValue;
      const val = fields[h];
      return serializeCell_(val);
    });
    sheet.appendRow(row);
  } else {
    // Update existing row field by field
    Object.entries(fields).forEach(([key, val]) => {
      const col = headers.indexOf(key);
      if (col === -1) return;
      sheet.getRange(rowIndex, col + 1).setValue(serializeCell_(val));
    });
  }
}

function serializeCell_(val) {
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.join('\n');
  if (typeof val === 'object') return JSON.stringify(val);
  return val;
}

// ============================================================
// SETTINGS
// ============================================================

function getSetting_(key) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Settings');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1] ? data[i][1].toString().trim() : null;
  }
  return null;
}

// ============================================================
// ANTHROPIC API
// ============================================================

function callAnthropicAPI(apiKey, systemPrompt, userContent, maxTokens, model) {
  const m = model || MODEL_RICH;
  const payload = {
    model: m,
    max_tokens: maxTokens || 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(ANTHROPIC_API_URL, options);
  const result = JSON.parse(response.getContentText());
  if (result.error) throw new Error(result.error.message);
  return result.content[0].text;
}

// Strip markdown code fences from Claude responses
function stripCodeFences_(text) {
  return (text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

// ============================================================
// DRIVE FILE READER
// ============================================================

function readDriveFile_(url) {
  if (!url) return '';
  try {
    const match = url.match(/\/d\/([\w-]+)/);
    if (!match) return '';
    const fileId = match[1];
    try {
      const doc = DocumentApp.openById(fileId);
      return doc.getBody().getText();
    } catch (e) {
      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      return blob.getDataAsString();
    }
  } catch (e) {
    Logger.log('readDriveFile_ error: ' + e.message);
    return '';
  }
}

// ============================================================
// CLASSIFICATION
// ============================================================

function classifyInterview(apiKey, sourceText, rawTitle) {
  const system = `You are classifying a discovery interview transcript.
Return ONLY valid JSON with no markdown fences, no explanation.
Schema:
{
  "type": "practitioner" or "business",
  "intervieweeName": "First Last or empty string",
  "intervieweeBusinessName": "Company name or empty string"
}
Rules:
- "practitioner" = accountant, CPA, bookkeeper, tax professional
- "business" = business owner, entrepreneur, operator
- intervieweeName: extract from transcript content only. Never use the document title "${rawTitle}". Leave blank if not found.
- intervieweeBusinessName: extract from transcript content. Leave blank if not found.`;

  const user = sourceText.substring(0, 8000);
  const raw = callAnthropicAPI(apiKey, system, user, 256, MODEL_FAST);
  const cleaned = stripCodeFences_(raw);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    Logger.log('classifyInterview parse error: ' + e.message + ' | raw: ' + raw);
    return { type: 'business', intervieweeName: '', intervieweeBusinessName: '' };
  }
}

// ============================================================
// ENRICHMENT
// ============================================================

function enrichBusiness(apiKey, sourceText) {
  const system = `You are extracting structured data from a business owner discovery interview.
Return ONLY valid JSON with no markdown fences, no explanation.
Schema:
{
  "name": "",
  "company": "",
  "role": "",
  "phone": "",
  "email": "",
  "industry": "",
  "revenue": "",
  "revenueMidpoint": "",
  "employees": "",
  "yearsInBusiness": "",
  "location": "",
  "currentAccounting": "",
  "monthsBehind": "",
  "currentSpend": "",
  "painPoints": [],
  "wtpSignals": {
    "namedPrice": "",
    "ownerTimeDisplacement": "",
    "decisionMakingBlindness": "",
    "compliancePressure": "",
    "priorBadExperience": ""
  },
  "leadScore": 0,
  "quotableLines": [],
  "notes": ""
}
leadScore: 1-10 integer. quotableLines: verbatim quotes. Leave fields blank if not found.`;

  const user = sourceText.substring(0, 12000);
  const raw = callAnthropicAPI(apiKey, system, user, 2048, MODEL_RICH);
  const cleaned = stripCodeFences_(raw);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    Logger.log('enrichBusiness parse error: ' + e.message + ' | raw: ' + raw);
    throw new Error('Failed to parse enrichment response: ' + e.message);
  }
}

function enrichPractitioner(apiKey, sourceText) {
  const system = `You are extracting structured data from an accountant/CPA discovery interview.
Return ONLY valid JSON with no markdown fences, no explanation.
Schema:
{
  "name": "",
  "company": "",
  "role": "",
  "phone": "",
  "email": "",
  "industry": "",
  "firmSize": "",
  "yearsInPractice": "",
  "location": "",
  "softwareStack": [],
  "clientCount": "",
  "avgClientRevenue": "",
  "painPoints": [],
  "wtpSignals": {
    "namedPrice": "",
    "ownerTimeDisplacement": "",
    "decisionMakingBlindness": "",
    "compliancePressure": "",
    "priorBadExperience": ""
  },
  "leadScore": 0,
  "quotableLines": [],
  "notes": ""
}
leadScore: 1-10 integer. quotableLines: verbatim quotes. Leave fields blank if not found.`;

  const user = sourceText.substring(0, 12000);
  const raw = callAnthropicAPI(apiKey, system, user, 2048, MODEL_RICH);
  const cleaned = stripCodeFences_(raw);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    Logger.log('enrichPractitioner parse error: ' + e.message + ' | raw: ' + raw);
    throw new Error('Failed to parse enrichment response: ' + e.message);
  }
}

// ============================================================
// CORE INGEST PIPELINE
// ============================================================

function handleIngestTranscript(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const apiKey = getSetting_('anthropicApiKey');
    if (!apiKey) throw new Error('anthropicApiKey not set in Settings sheet');

    const now = new Date().toISOString();
    const transcriptUrl = data.transcriptUrl || '';
    const summaryUrl = data.summaryUrl || '';
    const rawTitle = data.intervieweeName || '';

    // Dedup by transcriptUrl
    const tSheet = ss.getSheetByName('Transcripts');
    if (transcriptUrl && tSheet.getLastRow() >= 2) {
      const urls = tSheet.getRange(2, SHEET_HEADERS.Transcripts.indexOf('transcriptUrl') + 1,
        tSheet.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < urls.length; i++) {
        if (urls[i][0] === transcriptUrl) {
          Logger.log('Duplicate transcriptUrl — skipping: ' + transcriptUrl);
          lock.releaseLock();
          return { status: 'duplicate', message: 'Already ingested' };
        }
      }
    }

    // Create transcript row (names always blank until Claude extracts)
    const id = getNextTranscriptId();
    handleUpsertRow('Transcripts', id, {
      intervieweeName: '',
      intervieweeBusinessName: '',
      interviewDate: data.interviewDate || now,
      transcriptUrl,
      summaryUrl,
      linkedType: '',
      linkedContactId: '',
      status: 'new',
      extractedData: '',
      createdAt: now,
      processedAt: '',
    });

    lock.releaseLock();

    // Read Drive files
    const transcriptText = readDriveFile_(transcriptUrl);
    const summaryText = readDriveFile_(summaryUrl);
    const sourceText = [summaryText, transcriptText].filter(Boolean).join('\n\n---\n\n');

    if (!sourceText) {
      handleUpsertRow('Transcripts', id, { status: 'error-no-source' });
      return { status: 'error', message: 'Could not read Drive files' };
    }

    // Classify
    Logger.log('Classifying interview ' + id + '...');
    const classification = classifyInterview(apiKey, sourceText, rawTitle);
    Logger.log('Classification: ' + JSON.stringify(classification));

    const interviewType = classification.type || 'business';
    const intervieweeName = classification.intervieweeName || '';
    const intervieweeBusinessName = classification.intervieweeBusinessName || '';

    // Create contact row
    let contactId;
    let enriched;

    if (interviewType === 'practitioner') {
      contactId = getNextPractitionerId();
      enriched = enrichPractitioner(apiKey, sourceText);
      handleUpsertRow('Practitioners', contactId, {
        ...enriched,
        status: 'enriched',
        interviewDate: data.interviewDate || now,
        transcriptUrl,
        summaryUrl,
        enrichedAt: new Date().toISOString(),
        source: 'zapier',
        createdAt: now,
        updatedAt: new Date().toISOString(),
      });
    } else {
      contactId = getNextBusinessId();
      enriched = enrichBusiness(apiKey, sourceText);
      handleUpsertRow('Businesses', contactId, {
        ...enriched,
        status: 'enriched',
        interviewDate: data.interviewDate || now,
        transcriptUrl,
        summaryUrl,
        enrichedAt: new Date().toISOString(),
        source: 'zapier',
        createdAt: now,
        updatedAt: new Date().toISOString(),
      });
    }

    // Update transcript row with classification + link
    handleUpsertRow('Transcripts', id, {
      intervieweeName: enriched.name || intervieweeName,
      intervieweeBusinessName: enriched.company || intervieweeBusinessName,
      linkedType: interviewType,
      linkedContactId: contactId,
      status: 'enriched',
      extractedData: JSON.stringify({ rawAnalysis: JSON.stringify(enriched), overallSentiment: 'unclear' }),
      processedAt: new Date().toISOString(),
    });

    Logger.log('Pipeline complete: ' + id + ' → ' + contactId);
    return { status: 'success', transcriptId: id, contactId, contactType: interviewType };

  } catch (e) {
    Logger.log('handleIngestTranscript error: ' + e.message);
    lock.releaseLock();
    throw e;
  }
}

// ============================================================
// WEB APP HANDLERS
// ============================================================

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'getTranscripts') return handleGetTranscripts();
  if (action === 'getBusinesses') return handleGetContacts('Businesses');
  if (action === 'getPractitioners') return handleGetContacts('Practitioners');
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Autopilot Discovery CRM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || (e.parameter && e.parameter.action);

    if (action === 'ingestTranscript') {
      const result = handleIngestTranscript(body);
      return jsonResponse_(result);
    }
    if (action === 'enrichTranscript') {
      const result = handleEnrichTranscript(body.transcriptId);
      return jsonResponse_(result);
    }
    return jsonResponse_({ error: 'Unknown action: ' + action });
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    return jsonResponse_({ error: err.message });
  }
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// ENRICH EXISTING TRANSCRIPT (UI button handler)
// ============================================================

function handleEnrichTranscript(transcriptId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const apiKey = getSetting_('anthropicApiKey');
  if (!apiKey) throw new Error('anthropicApiKey not set in Settings sheet');

  const tSheet = ss.getSheetByName('Transcripts');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];

  const rowIdx = tData.findIndex((r, i) => i > 0 && r[0] === transcriptId);
  if (rowIdx === -1) throw new Error('Transcript not found: ' + transcriptId);

  const row = tData[rowIdx];
  const transcriptUrl = row[tHeaders.indexOf('transcriptUrl')];
  const summaryUrl = row[tHeaders.indexOf('summaryUrl')];
  const linkedType = row[tHeaders.indexOf('linkedType')];
  const linkedContactId = row[tHeaders.indexOf('linkedContactId')];

  const transcriptText = readDriveFile_(transcriptUrl);
  const summaryText = readDriveFile_(summaryUrl);
  const sourceText = [summaryText, transcriptText].filter(Boolean).join('\n\n---\n\n');
  if (!sourceText) throw new Error('Could not read Drive files');

  const interviewDate = row[tHeaders.indexOf('interviewDate')];
  const now = new Date().toISOString();

  let contactId = linkedContactId;
  let interviewType = linkedType;
  let enriched;

  if (!interviewType || !contactId) {
    const rawTitle = row[tHeaders.indexOf('intervieweeName')] || '';
    const classification = classifyInterview(apiKey, sourceText, rawTitle);
    interviewType = classification.type || 'business';
    contactId = interviewType === 'practitioner' ? getNextPractitionerId() : getNextBusinessId();
  }

  if (interviewType === 'practitioner') {
    enriched = enrichPractitioner(apiKey, sourceText);
    handleUpsertRow('Practitioners', contactId, {
      ...enriched,
      status: 'enriched',
      interviewDate,
      transcriptUrl,
      summaryUrl,
      enrichedAt: now,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    });
  } else {
    enriched = enrichBusiness(apiKey, sourceText);
    handleUpsertRow('Businesses', contactId, {
      ...enriched,
      status: 'enriched',
      interviewDate,
      transcriptUrl,
      summaryUrl,
      enrichedAt: now,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
    });
  }

  handleUpsertRow('Transcripts', transcriptId, {
    intervieweeName: enriched.name || '',
    intervieweeBusinessName: enriched.company || '',
    linkedType: interviewType,
    linkedContactId: contactId,
    status: 'enriched',
    extractedData: JSON.stringify({ rawAnalysis: JSON.stringify(enriched) }),
    processedAt: now,
  });

  return { status: 'success', contactId, contactType: interviewType };
}

// ============================================================
// GET HANDLERS (for UI data loading)
// ============================================================

function handleGetTranscripts() {
  return jsonResponse_(getSheetData_('Transcripts'));
}

function handleGetContacts(sheetName) {
  return jsonResponse_(getSheetData_(sheetName));
}

function getSheetData_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

// ============================================================
// REPAIR / TEST HELPERS
// ============================================================

function debugDeployment() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEET_HEADERS).forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) { Logger.log(name + ': MISSING'); return; }
    const cols = sheet.getLastColumn();
    Logger.log(name + ': ' + cols + ' columns, expected ' + SHEET_HEADERS[name].length);
  });
  Logger.log('SHEET_HEADERS.Transcripts: ' + JSON.stringify(SHEET_HEADERS.Transcripts));
  Logger.log('Deployment check complete');
}

function debugApiKey() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = ss.getSheetByName('Settings');
  if (!settings) { Logger.log('Settings sheet MISSING'); return; }
  const data = settings.getDataRange().getValues();
  data.forEach(row => Logger.log(row[0] + ': ' + (row[1] ? row[1].toString().substring(0, 10) + '...' : 'MISSING')));
}

function testEnrichLatest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tSheet = ss.getSheetByName('Transcripts');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const linkedIdx = tHeaders.indexOf('linkedContactId');

  let latestRow = null;
  for (let i = tData.length - 1; i >= 1; i--) {
    if (tData[i][linkedIdx]) { latestRow = tData[i]; break; }
  }
  if (!latestRow) { Logger.log('No linked transcript found'); return; }

  const transcriptId = latestRow[0];
  Logger.log('Enriching transcript: ' + transcriptId);
  const result = handleEnrichTranscript(transcriptId);
  Logger.log('Result: ' + JSON.stringify(result));
}

function reclassifyT001() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const apiKey = getSetting_('anthropicApiKey');
  if (!apiKey) { Logger.log('ERROR: anthropicApiKey not set'); return; }

  const tSheet = ss.getSheetByName('Transcripts');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const t001Idx = tData.findIndex((r, i) => i > 0 && r[0] === 't-001');
  if (t001Idx === -1) { Logger.log('t-001 not found'); return; }

  const row = tData[t001Idx];
  const transcriptUrl = row[tHeaders.indexOf('transcriptUrl')];
  const summaryUrl = row[tHeaders.indexOf('summaryUrl')];
  Logger.log('transcriptUrl: ' + transcriptUrl);
  Logger.log('summaryUrl: ' + summaryUrl);

  const transcriptText = readDriveFile_(transcriptUrl);
  const summaryText = readDriveFile_(summaryUrl);
  const sourceText = [summaryText, transcriptText].filter(Boolean).join('\n\n---\n\n');
  Logger.log('Source text length: ' + sourceText.length);

  if (!sourceText) { Logger.log('ERROR: Could not read Drive files'); return; }

  Logger.log('Calling classifyInterview...');
  const classification = classifyInterview(apiKey, sourceText, '');
  Logger.log('Classification: ' + JSON.stringify(classification));

  const interviewType = classification.type || 'business';
  let contactId;
  let enriched;

  if (interviewType === 'practitioner') {
    contactId = getNextPractitionerId();
    enriched = enrichPractitioner(apiKey, sourceText);
    handleUpsertRow('Practitioners', contactId, {
      ...enriched,
      status: 'enriched',
      interviewDate: row[tHeaders.indexOf('interviewDate')],
      transcriptUrl,
      summaryUrl,
      enrichedAt: new Date().toISOString(),
      source: 'repair',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else {
    contactId = getNextBusinessId();
    enriched = enrichBusiness(apiKey, sourceText);
    handleUpsertRow('Businesses', contactId, {
      ...enriched,
      status: 'enriched',
      interviewDate: row[tHeaders.indexOf('interviewDate')],
      transcriptUrl,
      summaryUrl,
      enrichedAt: new Date().toISOString(),
      source: 'repair',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  handleUpsertRow('Transcripts', 't-001', {
    intervieweeName: enriched.name || classification.intervieweeName || '',
    intervieweeBusinessName: enriched.company || classification.intervieweeBusinessName || '',
    linkedType: interviewType,
    linkedContactId: contactId,
    status: 'enriched',
    extractedData: JSON.stringify({ rawAnalysis: JSON.stringify(enriched) }),
    processedAt: new Date().toISOString(),
  });

  Logger.log('reclassifyT001 complete: ' + contactId);
}

function repairBiz001() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tSheet = ss.getSheetByName('Transcripts');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const t001Idx = tData.findIndex((r, i) => i > 0 && r[0] === 't-001');
  if (t001Idx === -1) { Logger.log('t-001 not found'); return; }

  const row = tData[t001Idx];
  const extractedRaw = row[tHeaders.indexOf('extractedData')];
  if (!extractedRaw) { Logger.log('No extractedData on t-001'); return; }

  const extractedData = JSON.parse(extractedRaw);
  let rawAnalysis = extractedData.rawAnalysis || '';
  // rawAnalysis may itself be a stringified JSON object OR a markdown-fenced string
  rawAnalysis = stripCodeFences_(rawAnalysis);
  let parsed;
  try {
    parsed = JSON.parse(rawAnalysis);
  } catch (e) {
    // Try parsing as direct JSON if rawAnalysis was already a JSON string
    try { parsed = JSON.parse(extractedData.rawAnalysis); } catch (e2) {
      Logger.log('Could not parse rawAnalysis: ' + e2.message);
      return;
    }
  }

  Logger.log('Parsed enrichment data: ' + JSON.stringify(parsed));

  const bizSheet = ss.getSheetByName('Businesses');
  const bizData = bizSheet.getDataRange().getValues();
  const bizHeaders = bizData[0];
  const bizRowIdx = bizData.findIndex((r, i) => i > 0 && r[0] === 'biz-001');
  if (bizRowIdx === -1) { Logger.log('biz-001 not found'); return; }

  const fields = ['name','company','role','phone','email','industry','revenue',
    'revenueMidpoint','employees','yearsInBusiness','location','currentAccounting',
    'monthsBehind','currentSpend','painPoints','wtpSignals','leadScore',
    'quotableLines','notes'];

  fields.forEach(f => {
    const col = bizHeaders.indexOf(f);
    if (col === -1) return;
    bizSheet.getRange(bizRowIdx + 1, col + 1).setValue(serializeCell_(parsed[f]));
  });

  const statusCol = bizHeaders.indexOf('status');
  const enrichedAtCol = bizHeaders.indexOf('enrichedAt');
  bizSheet.getRange(bizRowIdx + 1, statusCol + 1).setValue('enriched');
  bizSheet.getRange(bizRowIdx + 1, enrichedAtCol + 1).setValue(new Date().toISOString());

  tSheet.getRange(t001Idx + 1, tHeaders.indexOf('intervieweeName') + 1).setValue(parsed.name || '');
  tSheet.getRange(t001Idx + 1, tHeaders.indexOf('intervieweeBusinessName') + 1).setValue(parsed.company || '');

  Logger.log('repairBiz001 complete');
}
