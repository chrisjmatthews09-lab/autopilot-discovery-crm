// Minimal CSV parser — handles quoted fields, escaped quotes ("") and \r\n.
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += ch; i++;
  }
  // Flush
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  // Trim trailing empty rows
  while (rows.length && rows[rows.length - 1].every((c) => c === '')) rows.pop();
  return rows;
}

export function csvRowsToObjects(rows) {
  if (!rows || rows.length === 0) return { headers: [], records: [] };
  const headers = (rows[0] || []).map((h) => String(h || '').trim());
  const records = rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] ?? '').trim(); });
    return obj;
  });
  return { headers, records };
}

export function escapeCSVCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s === '') return '';
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCSV(rows, columns) {
  // columns: [{ header, accessor: (row) => string | value }]
  const header = columns.map((c) => escapeCSVCell(c.header)).join(',');
  const body = rows.map((r) =>
    columns.map((c) => escapeCSVCell(typeof c.accessor === 'function' ? c.accessor(r) : r[c.accessor])).join(',')
  ).join('\n');
  return `${header}\n${body}`;
}

export function downloadCSV(filename, csvText) {
  const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Best-effort guess of the target field for a given CSV header.
export function guessFieldMapping(header, candidateFields) {
  const h = header.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!h) return null;
  for (const f of candidateFields) {
    const k = String(f.key || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const l = String(f.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (h === k || h === l) return f.key;
  }
  for (const f of candidateFields) {
    const k = String(f.key || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const l = String(f.label || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (h.includes(k) || k.includes(h) || h.includes(l) || l.includes(h)) return f.key;
  }
  return null;
}
