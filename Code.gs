// ============================================================
// AUTOPILOT DISCOVERY CRM — Code.gs
// ============================================================

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL_FAST = 'claude-haiku-4-5-20251001';
const MODEL_RICH = 'claude-opus-4-5';

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
// TRIGGER — fires when Zapier writes a row to the sheet
// ============================================================

function onTranscriptRowEdit(e) {
  processNewTranscripts();
}

// ============================================================
// CORE PROCESSOR — finds unprocessed rows and runs the pipeline
// ============================================================

function processNewTranscripts() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log('Could not acquire lock — another run in progress');
    return;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tSheet = ss.getSheetByName('Transcripts');
    if (!tSheet || tSheet.getLastRow() < 2) return;

    const apiKey = getSetting_('anthropicApiKey');
    if (!apiKey) { Logger.log('ERROR: anthropicApiKey not set in Settings'); return; }

    const data = tSheet.getDataRange().getValues();
    const headers = data[0];
    const idIdx = headers.indexOf('id');
    const transcriptUrlIdx = headers.indexOf('transcriptUrl');
    const summaryUrlIdx = headers.indexOf('summaryUrl');
    const interviewDateIdx = headers.indexOf('interviewDate');
    const intervieweeNameIdx = headers.indexOf('intervieweeName');
    const statusIdx = headers.indexOf('status');

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[idIdx]) continue;
      const transcriptUrl = (row[transcriptUrlIdx] || '').toString().trim();
      if (!transcriptUrl) continue;

      const summaryUrl = (row[summaryUrlIdx] || '').toString().trim();
      const rawTitle = (row[intervieweeNameIdx] || '').toString().trim();
      const interviewDate = row[interviewDateIdx]
        ? new Date(row[interviewDateIdx]).toISOString()
        : new Date().toISOString();
      const now = new Date().toISOString();
      const rowNum = i + 1;

      const id = getNextTranscriptId();
      tSheet.getRange(rowNum, idIdx + 1).setValue(id);
      tSheet.getRange(rowNum, statusIdx + 1).setValue('processing');
      tSheet.getRange(rowNum, intervieweeNameIdx + 1).setValue('');
      SpreadsheetApp.flush();

      Logger.log('Processing: ' + id + ' | ' + transcriptUrl);

      try {
        const transcriptText = readDriveFile_(transcriptUrl);
        const summaryText = readDriveFile_(summaryUrl);
        const sourceText = [summaryText, transcriptText].filter(Boolean).join('\n\n---\n\n');

        if (!sourceText) {
          tSheet.getRange(rowNum, statusIdx + 1).setValue('error-no-source');
          continue;
        }

        const classification = classifyInterview(apiKey, sourceText, rawTitle);
        const interviewType = classification.type || 'business';
        Logger.log('Classified as: ' + interviewType);

        let contactId, enriched;

        if (interviewType === 'practitioner') {
          contactId = getNextPractitionerId();
          enriched = enrichPractitioner(apiKey, sourceText);
          handleUpsertRow('Practitioners', contactId, {
            ...enriched,
            status: 'enriched',
            interviewDate,
            transcriptUrl,
            summaryUrl,
            enrichedAt: now,
            source: 'zapier',
            createdAt: now,
            updatedAt: now,
          });
        } else {
          contactId = getNextBusinessId();
          enriched = enrichBusiness(apiKey, sourceText);
          handleUpsertRow('Businesses', contactId, {
            ...enriched,
            status: 'enriched',
            interviewDate,
            transcriptUrl,
            summaryUrl,
            enrichedAt: now,
            source: 'zapier',
            createdAt: now,
            updatedAt: now,
          });
        }

        handleUpsertRow('Transcripts', id, {
          intervieweeName: enriched.name || '',
          intervieweeBusinessName: enriched.company || '',
          linkedType: interviewType,
          linkedContactId: contactId,
          status: 'enriched',
          extractedData: JSON.stringify({ rawAnalysis: JSON.stringify(enriched) }),
          processedAt: now,
        });

        Logger.log('Complete: ' + id + ' → ' + contactId);

      } catch (e) {
        Logger.log('Error on ' + id + ': ' + e.message);
        tSheet.getRange(rowNum, statusIdx + 1).setValue('error: ' + e.message.substring(0, 80));
      }
    }
  } finally {
    lock.releaseLock();
  }
}

// ============================================================
// SHEET SETUP
// ============================================================

function setupSchemaV2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.entries(SHEET_HEADERS).forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    const existing = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];
    if (existing.join(',') !== headers.join(',')) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  });
  const contacts = ss.getSheetByName('Contacts');
  if (contacts) ss.deleteSheet(contacts);
  Logger.log('setupSchemaV2 complete');
}

// ============================================================
// SEQUENTIAL ID GENERATORS
// ============================================================

function getNextTranscriptId()   { return getNextId_('Transcripts',   't'); }
function getNextPractitionerId() { return getNextId_('Practitioners', 'prac'); }
function getNextBusinessId()     { return getNextId_('Businesses',    'biz'); }

function getNextId_(sheetName, prefix) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return prefix + '-001';
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues()
    .map(r => r[0]).filter(v => typeof v === 'string' && v.startsWith(prefix + '-'));
  if (!ids.length) return prefix + '-001';
  const max = Math.max(...ids.map(id => parseInt(id.split('-')[1], 10) || 0));
  return prefix + '-' + String(max + 1).padStart(3, '0');
}

// ============================================================
// GENERIC UPSERT ROW
// ============================================================

function handleUpsertRow(sheetName, idValue, fields) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  const headers = SHEET_HEADERS[sheetName];
  if (!headers) throw new Error('No SHEET_HEADERS for: ' + sheetName);

  let rowIndex = -1;
  if (sheet.getLastRow() >= 2) {
    const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === idValue) { rowIndex = i + 2; break; }
    }
  }

  if (rowIndex === -1) {
    const row = headers.map(h => h === 'id' ? idValue : serializeCell_(fields[h]));
    sheet.appendRow(row);
  } else {
    Object.entries(fields).forEach(([key, val]) => {
      const col = headers.indexOf(key);
      if (col === -1) return;
      sheet.getRange(rowIndex, col + 1).setValue(serializeCell_(val));
    });
  }
}

function handleDeleteRow_(sheetName, idValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return false;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === idValue) {
      sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
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
  const payload = {
    model: model || MODEL_RICH,
    max_tokens: maxTokens || 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  };
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(ANTHROPIC_API_URL, options);
  const result = JSON.parse(response.getContentText());
  if (result.error) throw new Error(result.error.message);
  return result.content[0].text;
}

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
      return DocumentApp.openById(fileId).getBody().getText();
    } catch (e) {
      return DriveApp.getFileById(fileId).getBlob().getDataAsString();
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
Return ONLY valid JSON — no markdown fences, no explanation.
Schema: { "type": "practitioner" or "business", "intervieweeName": "First Last or empty string", "intervieweeBusinessName": "Company name or empty string" }
Rules:
- "practitioner" = accountant, CPA, bookkeeper, tax professional
- "business" = business owner, entrepreneur, operator
- intervieweeName: extract from transcript content only. Never use the document title "${rawTitle}". Leave blank if not found.
- intervieweeBusinessName: extract from content. Leave blank if not found.`;

  const raw = callAnthropicAPI(apiKey, system, sourceText.substring(0, 8000), 256, MODEL_FAST);
  try {
    return JSON.parse(stripCodeFences_(raw));
  } catch (e) {
    Logger.log('classifyInterview parse error: ' + e.message);
    return { type: 'business', intervieweeName: '', intervieweeBusinessName: '' };
  }
}

// ============================================================
// ENRICHMENT
// ============================================================

function enrichBusiness(apiKey, sourceText) {
  const system = `You are extracting structured data from a business owner discovery interview.
Return ONLY valid JSON — no markdown fences, no explanation.
Schema:
{
  "name": "", "company": "", "role": "", "phone": "", "email": "",
  "industry": "", "revenue": "", "revenueMidpoint": "", "employees": "",
  "yearsInBusiness": "", "location": "", "currentAccounting": "",
  "monthsBehind": "", "currentSpend": "",
  "painPoints": [],
  "wtpSignals": { "namedPrice": "", "ownerTimeDisplacement": "", "decisionMakingBlindness": "", "compliancePressure": "", "priorBadExperience": "" },
  "leadScore": 0, "quotableLines": [], "notes": ""
}
leadScore: 1-10 integer. Leave fields blank if not found.`;

  const raw = callAnthropicAPI(apiKey, system, sourceText.substring(0, 12000), 2048, MODEL_RICH);
  try {
    return JSON.parse(stripCodeFences_(raw));
  } catch (e) {
    Logger.log('enrichBusiness parse error: ' + e.message);
    throw new Error('Failed to parse business enrichment: ' + e.message);
  }
}

function enrichPractitioner(apiKey, sourceText) {
  const system = `You are extracting structured data from an accountant/CPA discovery interview.
Return ONLY valid JSON — no markdown fences, no explanation.
Schema:
{
  "name": "", "company": "", "role": "", "phone": "", "email": "",
  "industry": "", "firmSize": "", "yearsInPractice": "", "location": "",
  "softwareStack": [], "clientCount": "", "avgClientRevenue": "",
  "painPoints": [],
  "wtpSignals": { "namedPrice": "", "ownerTimeDisplacement": "", "decisionMakingBlindness": "", "compliancePressure": "", "priorBadExperience": "" },
  "leadScore": 0, "quotableLines": [], "notes": ""
}
leadScore: 1-10 integer. Leave fields blank if not found.`;

  const raw = callAnthropicAPI(apiKey, system, sourceText.substring(0, 12000), 2048, MODEL_RICH);
  try {
    return JSON.parse(stripCodeFences_(raw));
  } catch (e) {
    Logger.log('enrichPractitioner parse error: ' + e.message);
    throw new Error('Failed to parse practitioner enrichment: ' + e.message);
  }
}

// ============================================================
// WEB APP HANDLERS
// ============================================================

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'getData')         return jsonResponse_(handleGetData());
  if (action === 'getTranscripts')  return jsonResponse_(getSheetData_('Transcripts'));
  if (action === 'getBusinesses')   return jsonResponse_(getSheetData_('Businesses'));
  if (action === 'getPractitioners') return jsonResponse_(getSheetData_('Practitioners'));
  if (action === 'getSettings')     return jsonResponse_({ status: 'ok' });
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Autopilot Discovery CRM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || (e.parameter && e.parameter.action);

    if (action === 'enrichTranscript')     return jsonResponse_(handleEnrichTranscript(body.transcriptId));
    if (action === 'enrichContact')        return jsonResponse_(handleEnrichTranscript(body.transcriptId));
    if (action === 'upsertPractitioner')   return jsonResponse_(handleUpsertContact_('Practitioners', body.data));
    if (action === 'upsertBusiness')       return jsonResponse_(handleUpsertContact_('Businesses', body.data));
    if (action === 'deletePractitioner')   return jsonResponse_({ deleted: handleDeleteRow_('Practitioners', body.id) });
    if (action === 'deleteBusiness')       return jsonResponse_({ deleted: handleDeleteRow_('Businesses', body.id) });
    if (action === 'deleteTranscript')     return jsonResponse_({ deleted: handleDeleteRow_('Transcripts', body.id) });
    if (action === 'linkTranscript')       return jsonResponse_(handleLinkTranscript_(body));
    if (action === 'analyzeThemes')        return jsonResponse_(handleAnalyzeThemes(body));

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
// DATA HANDLERS
// ============================================================

function handleGetData() {
  return {
    practitioners: getSheetData_('Practitioners'),
    businesses: getSheetData_('Businesses'),
    transcripts: getSheetData_('Transcripts'),
    contacts: [],
  };
}

function getSheetData_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1)
    .filter(row => row[0]) // skip rows with no ID
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] === '' ? '' : row[i]; });
      return obj;
    });
}

function handleUpsertContact_(sheetName, data) {
  if (!data || !data.id) throw new Error('Missing id in data');
  const now = new Date().toISOString();
  handleUpsertRow(sheetName, data.id, { ...data, updatedAt: now });
  return { status: 'ok', row: data };
}

function handleLinkTranscript_(body) {
  const { transcriptId, linkedType, linkedContactId } = body;
  if (!transcriptId) throw new Error('Missing transcriptId');
  handleUpsertRow('Transcripts', transcriptId, {
    linkedType: linkedType || '',
    linkedContactId: linkedContactId || '',
    status: 'linked',
  });
  return { status: 'ok' };
}

// ============================================================
// ENRICH EXISTING TRANSCRIPT
// ============================================================

function handleEnrichTranscript(transcriptId) {
  const apiKey = getSetting_('anthropicApiKey');
  if (!apiKey) throw new Error('anthropicApiKey not set in Settings sheet');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tSheet = ss.getSheetByName('Transcripts');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const rowIdx = tData.findIndex((r, i) => i > 0 && r[0] === transcriptId);
  if (rowIdx === -1) throw new Error('Transcript not found: ' + transcriptId);

  const row = tData[rowIdx];
  const transcriptUrl = row[tHeaders.indexOf('transcriptUrl')];
  const summaryUrl    = row[tHeaders.indexOf('summaryUrl')];
  const interviewDate = row[tHeaders.indexOf('interviewDate')];
  let linkedType      = row[tHeaders.indexOf('linkedType')];
  let contactId       = row[tHeaders.indexOf('linkedContactId')];
  const now = new Date().toISOString();

  const transcriptText = readDriveFile_(transcriptUrl);
  const summaryText    = readDriveFile_(summaryUrl);
  const sourceText = [summaryText, transcriptText].filter(Boolean).join('\n\n---\n\n');
  if (!sourceText) throw new Error('Could not read Drive files — check permissions');

  if (!linkedType || !contactId) {
    const classification = classifyInterview(apiKey, sourceText, '');
    linkedType = classification.type || 'business';
    contactId  = linkedType === 'practitioner' ? getNextPractitionerId() : getNextBusinessId();
  }

  let enriched;
  if (linkedType === 'practitioner') {
    enriched = enrichPractitioner(apiKey, sourceText);
    handleUpsertRow('Practitioners', contactId, {
      ...enriched, status: 'enriched', interviewDate,
      transcriptUrl, summaryUrl, enrichedAt: now, source: 'manual', createdAt: now, updatedAt: now,
    });
  } else {
    enriched = enrichBusiness(apiKey, sourceText);
    handleUpsertRow('Businesses', contactId, {
      ...enriched, status: 'enriched', interviewDate,
      transcriptUrl, summaryUrl, enrichedAt: now, source: 'manual', createdAt: now, updatedAt: now,
    });
  }

  handleUpsertRow('Transcripts', transcriptId, {
    intervieweeName: enriched.name || '',
    intervieweeBusinessName: enriched.company || '',
    linkedType,
    linkedContactId: contactId,
    status: 'enriched',
    extractedData: JSON.stringify({ rawAnalysis: JSON.stringify(enriched) }),
    processedAt: now,
  });

  return { status: 'success', contactId, contactType: linkedType };
}

// ============================================================
// THEMES ANALYSIS
// ============================================================

function handleAnalyzeThemes(body) {
  const apiKey = getSetting_('anthropicApiKey');
  if (!apiKey) throw new Error('anthropicApiKey not set in Settings sheet');

  const type = body.type || 'business';
  const sheetName = type === 'practitioner' ? 'Practitioners' : 'Businesses';
  const rows = getSheetData_(sheetName);

  if (rows.length === 0) return { error: 'No ' + sheetName + ' data to analyze yet.' };

  const enrichedRows = rows.filter(r => r.enrichedAt || r.painPoints);
  if (enrichedRows.length === 0) return { error: 'No enriched records found. Run the pipeline on at least one interview first.' };

  const summaries = enrichedRows.map(r => {
    if (type === 'business') {
      return {
        company: r.company,
        industry: r.industry,
        revenue: r.revenue,
        employees: r.employees,
        currentAccounting: r.currentAccounting,
        currentSpend: r.currentSpend,
        monthsBehind: r.monthsBehind,
        painPoints: r.painPoints,
        wtpSignals: r.wtpSignals,
        leadScore: r.leadScore,
        quotableLines: r.quotableLines,
        notes: r.notes,
      };
    } else {
      return {
        company: r.company,
        firmSize: r.firmSize,
        industry: r.industry,
        softwareStack: r.softwareStack,
        clientCount: r.clientCount,
        avgClientRevenue: r.avgClientRevenue,
        painPoints: r.painPoints,
        wtpSignals: r.wtpSignals,
        leadScore: r.leadScore,
        quotableLines: r.quotableLines,
        notes: r.notes,
      };
    }
  });

  const bizPrompt = `You are a strategic market intelligence analyst for a venture-backed accounting technology startup. Analyze these business owner discovery interviews and return strategic insights.
Return ONLY valid JSON — no markdown fences, no explanation — using this exact schema:
{
  "executiveSummary": "3-4 sentence executive overview of market signal strength and key finding",
  "topPainPoints": [{ "theme": "Pain theme", "frequency": "X of Y interviews", "evidence": "Quote or observation supporting this" }],
  "wtpProfile": { "priceRange": "$X-$Y/month", "sensitivity": "low|moderate|high", "primaryDrivers": ["driver1", "driver2"], "keyInsight": "one sentence pricing insight" },
  "idealCustomerProfile": { "revenueRange": "$X-$Y", "industries": ["industry"], "booksBehind": "typical months", "characteristics": ["char1", "char2"], "disqualifiers": ["disqualifier1"] },
  "competitiveLandscape": [{ "name": "Current solution", "insight": "how they use it and sentiment" }],
  "keyQuotes": [{ "quote": "verbatim quote", "speaker": "Company name", "significance": "why this matters" }],
  "strategicRecommendations": [{ "title": "Recommendation", "rationale": "why and what to do" }],
  "riskFlags": ["risk or concern to watch"]
}`;

  const pracPrompt = `You are a strategic market intelligence analyst for a venture-backed accounting technology startup. Analyze these accountant/CPA discovery interviews and return strategic insights.
Return ONLY valid JSON — no markdown fences, no explanation — using this exact schema:
{
  "executiveSummary": "3-4 sentence executive overview of the practitioner market and key finding",
  "topPainPoints": [{ "theme": "Pain theme", "frequency": "X of Y interviews", "evidence": "Quote or observation" }],
  "firmLandscape": { "dominantSize": "description", "primaryServiceMix": "description", "avgClientCount": "range", "insight": "key structural insight" },
  "aiReceptivity": { "overall": "positive|mixed|skeptical", "concerns": ["concern1"], "opportunities": ["opportunity1"], "keyInsight": "one sentence on AI positioning" },
  "techStackInsights": { "dominant": ["tool1", "tool2"], "gaps": ["gap1"], "switchingBarriers": "description" },
  "partnershipSignals": ["signal or firm type open to partnership"],
  "pricingBenchmarks": { "typicalMonthlyRange": "$X-$Y", "profitableSegments": ["segment"], "keyInsight": "pricing insight" },
  "keyQuotes": [{ "quote": "verbatim quote", "speaker": "Firm name", "significance": "why this matters" }],
  "strategicRecommendations": [{ "title": "Recommendation", "rationale": "why and what to do" }],
  "riskFlags": ["risk or concern"]
}`;

  const systemPrompt = type === 'business' ? bizPrompt : pracPrompt;
  const userContent = 'Interview data (' + enrichedRows.length + ' records):\n\n' + JSON.stringify(summaries, null, 2);

  try {
    const raw = callAnthropicAPI(apiKey, systemPrompt, userContent, 4096, MODEL_RICH);
    const themes = JSON.parse(stripCodeFences_(raw));
    return { themes, recordCount: enrichedRows.length };
  } catch (e) {
    Logger.log('analyzeThemes error: ' + e.message);
    throw new Error('Themes analysis failed: ' + e.message);
  }
}

// ============================================================
// REPAIR / DEBUG HELPERS
// ============================================================

function debugDeployment() {
  Object.keys(SHEET_HEADERS).forEach(name => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!sheet) { Logger.log(name + ': MISSING'); return; }
    Logger.log(name + ': ' + sheet.getLastColumn() + ' cols, expected ' + SHEET_HEADERS[name].length);
  });
  Logger.log('Transcripts headers: ' + JSON.stringify(SHEET_HEADERS.Transcripts));
}

function debugApiKey() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
  if (!sheet) { Logger.log('Settings sheet MISSING'); return; }
  sheet.getDataRange().getValues().forEach(row =>
    Logger.log(row[0] + ': ' + (row[1] ? row[1].toString().substring(0, 10) + '...' : 'MISSING'))
  );
}

function debugBiz001() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const bizSheet = ss.getSheetByName('Businesses');
  Logger.log('Businesses headers: ' + JSON.stringify(bizSheet.getRange(1,1,1,bizSheet.getLastColumn()).getValues()[0]));
  if (bizSheet.getLastRow() > 1) Logger.log('biz-001 row: ' + JSON.stringify(bizSheet.getDataRange().getValues()[1]));
  const tSheet = ss.getSheetByName('Transcripts');
  Logger.log('Transcripts headers: ' + JSON.stringify(tSheet.getRange(1,1,1,tSheet.getLastColumn()).getValues()[0]));
  if (tSheet.getLastRow() > 1) Logger.log('t-001 row: ' + JSON.stringify(tSheet.getDataRange().getValues()[1]));
}

function testEnrichLatest() {
  const tSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transcripts');
  const tData = tSheet.getDataRange().getValues();
  const linkedIdx = tData[0].indexOf('linkedContactId');
  let latestRow = null;
  for (let i = tData.length - 1; i >= 1; i--) {
    if (tData[i][linkedIdx]) { latestRow = tData[i]; break; }
  }
  if (!latestRow) { Logger.log('No linked transcript found'); return; }
  Logger.log('Enriching: ' + latestRow[0]);
  Logger.log(JSON.stringify(handleEnrichTranscript(latestRow[0])));
}

function reclassifyT001() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const apiKey = getSetting_('anthropicApiKey');
  if (!apiKey) { Logger.log('ERROR: no API key'); return; }

  const tSheet = ss.getSheetByName('Transcripts');
  const tData = tSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const idx = tData.findIndex((r, i) => i > 0 && r[0] === 't-001');
  if (idx === -1) { Logger.log('t-001 not found'); return; }

  const row = tData[idx];
  const transcriptUrl = row[tHeaders.indexOf('transcriptUrl')];
  const summaryUrl    = row[tHeaders.indexOf('summaryUrl')];
  const interviewDate = row[tHeaders.indexOf('interviewDate')];
  const now = new Date().toISOString();

  const sourceText = [readDriveFile_(summaryUrl), readDriveFile_(transcriptUrl)]
    .filter(Boolean).join('\n\n---\n\n');
  if (!sourceText) { Logger.log('ERROR: could not read Drive files'); return; }

  const classification = classifyInterview(apiKey, sourceText, '');
  const interviewType = classification.type || 'business';
  Logger.log('Classified: ' + interviewType);

  let contactId, enriched;
  if (interviewType === 'practitioner') {
    contactId = getNextPractitionerId();
    enriched  = enrichPractitioner(apiKey, sourceText);
    handleUpsertRow('Practitioners', contactId, {
      ...enriched, status: 'enriched', interviewDate, transcriptUrl, summaryUrl,
      enrichedAt: now, source: 'repair', createdAt: now, updatedAt: now,
    });
  } else {
    contactId = getNextBusinessId();
    enriched  = enrichBusiness(apiKey, sourceText);
    handleUpsertRow('Businesses', contactId, {
      ...enriched, status: 'enriched', interviewDate, transcriptUrl, summaryUrl,
      enrichedAt: now, source: 'repair', createdAt: now, updatedAt: now,
    });
  }

  handleUpsertRow('Transcripts', 't-001', {
    intervieweeName: enriched.name || '',
    intervieweeBusinessName: enriched.company || '',
    linkedType: interviewType,
    linkedContactId: contactId,
    status: 'enriched',
    extractedData: JSON.stringify({ rawAnalysis: JSON.stringify(enriched) }),
    processedAt: now,
  });

  Logger.log('reclassifyT001 complete → ' + contactId);
}

function repairBiz001() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tSheet = ss.getSheetByName('Transcripts');
  const tData  = tSheet.getDataRange().getValues();
  const tHdrs  = tData[0];
  const tIdx   = tData.findIndex((r, i) => i > 0 && r[0] === 't-001');
  if (tIdx === -1) { Logger.log('t-001 not found'); return; }

  const extractedRaw = tData[tIdx][tHdrs.indexOf('extractedData')];
  if (!extractedRaw) { Logger.log('No extractedData on t-001'); return; }

  const outer = JSON.parse(extractedRaw);
  let parsed;
  try {
    parsed = JSON.parse(stripCodeFences_(outer.rawAnalysis));
  } catch(e) {
    try { parsed = JSON.parse(outer.rawAnalysis); } catch(e2) {
      Logger.log('Cannot parse rawAnalysis: ' + e2.message); return;
    }
  }

  const bizSheet = ss.getSheetByName('Businesses');
  const bizData  = bizSheet.getDataRange().getValues();
  const bizHdrs  = bizData[0];
  const bizIdx   = bizData.findIndex((r, i) => i > 0 && r[0] === 'biz-001');
  if (bizIdx === -1) { Logger.log('biz-001 not found'); return; }

  ['name','company','role','phone','email','industry','revenue','revenueMidpoint',
   'employees','yearsInBusiness','location','currentAccounting','monthsBehind',
   'currentSpend','painPoints','wtpSignals','leadScore','quotableLines','notes'].forEach(f => {
    const col = bizHdrs.indexOf(f);
    if (col !== -1) bizSheet.getRange(bizIdx + 1, col + 1).setValue(serializeCell_(parsed[f]));
  });
  bizSheet.getRange(bizIdx + 1, bizHdrs.indexOf('status') + 1).setValue('enriched');
  bizSheet.getRange(bizIdx + 1, bizHdrs.indexOf('enrichedAt') + 1).setValue(new Date().toISOString());

  tSheet.getRange(tIdx + 1, tHdrs.indexOf('intervieweeName') + 1).setValue(parsed.name || '');
  tSheet.getRange(tIdx + 1, tHdrs.indexOf('intervieweeBusinessName') + 1).setValue(parsed.company || '');
  Logger.log('repairBiz001 complete');
}
