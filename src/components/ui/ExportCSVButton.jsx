import React from 'react';
import { COLORS } from '../../config/design-tokens';
import { buildCSV, downloadCSV } from '../../data/csv';

export default function ExportCSVButton({ rows, columns, filename, label = 'Export CSV' }) {
  const handle = () => {
    if (!rows || rows.length === 0) {
      alert('Nothing to export — no visible rows.');
      return;
    }
    // Columns may be DataTable columns (key, header, render). Convert to export columns.
    const cols = (columns || []).map((c) => ({
      header: typeof c.header === 'string' ? c.header : (c.key || ''),
      accessor: c.accessor || ((row) => {
        const v = row[c.key];
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') { try { return JSON.stringify(v); } catch { return String(v); } }
        return v;
      }),
    })).filter((c) => c.header && c.header !== 'Actions' && c.header.toLowerCase() !== 'actions');
    const csv = buildCSV(rows, cols);
    downloadCSV(filename || 'export.csv', csv);
  };

  return (
    <button onClick={handle}
      style={{ padding: '7px 12px', background: COLORS.cardAlt, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      ⬇ {label}
    </button>
  );
}
