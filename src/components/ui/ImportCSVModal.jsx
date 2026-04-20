import React, { useMemo, useState } from 'react';
import { COLORS } from '../../config/design-tokens';
import { parseCSV, csvRowsToObjects, guessFieldMapping } from '../../data/csv';
import { batchWrite } from '../../data/firestore';

/**
 * ImportCSVModal — 4-step CSV importer (upload, map, preview, import).
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   kind: 'person' | 'company'
 *   collectionName: 'people' | 'companies'
 *   targetFields: [{ key, label, required? }]  // selectable target fields
 *   existingRows: [...]  // used for dedupe preview
 *   dedupeFn: (existingRows, row) => existingRow | null
 *   idPrefix: string  // used to build doc ids
 *   defaultValues?: object  // merged into every created doc
 *   onDone?: (result) => void  // { inserted, skipped }
 */
export default function ImportCSVModal({ open, onClose, kind, collectionName, targetFields, existingRows, dedupeFn, idPrefix, defaultValues = {}, onDone }) {
  const [step, setStep] = useState(1);
  const [fileName, setFileName] = useState('');
  const [rawRows, setRawRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [records, setRecords] = useState([]);
  const [mapping, setMapping] = useState({}); // { header: fieldKey | '' }
  const [skipDupes, setSkipDupes] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!open) return null;

  const reset = () => {
    setStep(1); setFileName(''); setRawRows([]); setHeaders([]); setRecords([]);
    setMapping({}); setImporting(false); setResult(null); setError(null);
  };

  const close = () => { reset(); onClose(); };

  const handleFile = async (file) => {
    setError(null);
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCSV(text);
    const { headers: hs, records: rs } = csvRowsToObjects(rows);
    if (hs.length === 0) { setError('CSV appears to be empty or has no headers.'); return; }
    const auto = {};
    for (const h of hs) {
      const g = guessFieldMapping(h, targetFields);
      auto[h] = g || '';
    }
    setRawRows(rows); setHeaders(hs); setRecords(rs); setMapping(auto);
    setStep(2);
  };

  const mappedRecords = useMemo(() => {
    return records.map((rec) => {
      const out = {};
      for (const [header, fieldKey] of Object.entries(mapping)) {
        if (!fieldKey) continue;
        const v = rec[header];
        if (v !== undefined && v !== '') out[fieldKey] = v;
      }
      return out;
    });
  }, [records, mapping]);

  const previewRows = useMemo(() => {
    return mappedRecords.slice(0, 5).map((r) => ({
      ...r,
      _dup: dedupeFn ? dedupeFn(existingRows, r) : null,
    }));
  }, [mappedRecords, existingRows, dedupeFn]);

  const requiredMissing = useMemo(() => {
    const required = targetFields.filter((f) => f.required).map((f) => f.key);
    return required.filter((k) => !Object.values(mapping).includes(k));
  }, [mapping, targetFields]);

  const doImport = async () => {
    setImporting(true); setError(null);
    try {
      let inserted = 0, skipped = 0;
      const ops = [];
      for (const r of mappedRecords) {
        const required = targetFields.filter((f) => f.required);
        const hasRequired = required.every((f) => r[f.key] && String(r[f.key]).trim());
        if (!hasRequired) { skipped++; continue; }
        if (skipDupes && dedupeFn && dedupeFn(existingRows, r)) { skipped++; continue; }
        const id = `${idPrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${inserted}`;
        ops.push({ type: 'set', collection: collectionName, id, data: { ...defaultValues, ...r } });
        inserted++;
      }
      // Firestore batch limit: 500
      for (let i = 0; i < ops.length; i += 500) {
        await batchWrite(ops.slice(i, i + 500));
      }
      setResult({ inserted, skipped });
      setStep(4);
      onDone && onDone({ inserted, skipped });
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: COLORS.card, borderRadius: 10, padding: 22, minWidth: 640, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
            Import {kind === 'person' ? 'People' : 'Companies'} from CSV
          </div>
          <button onClick={close} style={{ background: 'none', border: 'none', fontSize: 18, color: COLORS.textMuted, cursor: 'pointer' }}>✕</button>
        </div>

        <Stepper step={step} />

        {step === 1 && (
          <StepUpload onFile={handleFile} error={error} />
        )}

        {step === 2 && (
          <StepMap headers={headers} targetFields={targetFields} mapping={mapping} setMapping={setMapping}
            requiredMissing={requiredMissing} onBack={() => setStep(1)} onNext={() => setStep(3)} />
        )}

        {step === 3 && (
          <StepPreview records={mappedRecords} preview={previewRows} headers={Object.values(mapping).filter(Boolean)}
            targetFields={targetFields} skipDupes={skipDupes} setSkipDupes={setSkipDupes}
            importing={importing} error={error}
            onBack={() => setStep(2)} onImport={doImport} />
        )}

        {step === 4 && result && (
          <StepDone result={result} onClose={close} />
        )}
      </div>
    </div>
  );
}

function Stepper({ step }) {
  const labels = ['Upload', 'Map columns', 'Preview', 'Done'];
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
      {labels.map((l, i) => {
        const idx = i + 1;
        const active = step === idx;
        const done = step > idx;
        return (
          <div key={l} style={{ flex: 1, padding: '6px 10px', fontSize: 11, fontWeight: 600, textAlign: 'center', borderRadius: 5, color: active ? '#fff' : done ? COLORS.primary : COLORS.textMuted, background: active ? COLORS.primary : done ? COLORS.primaryLight : COLORS.cardAlt, border: `1px solid ${active ? COLORS.primary : COLORS.border}` }}>
            {idx}. {l}
          </div>
        );
      })}
    </div>
  );
}

function StepUpload({ onFile, error }) {
  return (
    <div>
      <div style={{ padding: 32, textAlign: 'center', border: `2px dashed ${COLORS.border}`, borderRadius: 10, background: COLORS.cardAlt }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>Select a CSV file</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 14 }}>First row must contain column headers.</div>
        <label style={{ padding: '9px 18px', background: COLORS.primary, color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'inline-block' }}>
          Choose file
          <input type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </div>
      {error && <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 10 }}>{error}</div>}
    </div>
  );
}

function StepMap({ headers, targetFields, mapping, setMapping, requiredMissing, onBack, onNext }) {
  const setField = (h, key) => setMapping({ ...mapping, [h]: key });
  return (
    <div>
      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 10 }}>
        Match each CSV column to a target field. Unmapped columns will be ignored.
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: 6 }}>
        {headers.map((h) => (
          <div key={h} style={{ display: 'grid', gridTemplateColumns: '1.2fr auto 1.2fr', gap: 10, padding: '8px 12px', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}`, background: COLORS.cardAlt }}>
            <div style={{ fontSize: 12, color: COLORS.text, fontWeight: 600 }}>{h}</div>
            <div style={{ color: COLORS.textMuted, fontSize: 13 }}>→</div>
            <select value={mapping[h] || ''} onChange={(e) => setField(h, e.target.value)}
              style={{ padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 12, background: '#fff' }}>
              <option value="">— Ignore —</option>
              {targetFields.map((f) => (
                <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {requiredMissing.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: COLORS.danger }}>
          Missing required field{requiredMissing.length > 1 ? 's' : ''}: {requiredMissing.join(', ')}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
        <button onClick={onBack} style={{ padding: '8px 14px', background: 'none', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Back</button>
        <button onClick={onNext} disabled={requiredMissing.length > 0}
          style={{ padding: '8px 16px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: requiredMissing.length > 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: requiredMissing.length > 0 ? 0.5 : 1 }}>
          Preview →
        </button>
      </div>
    </div>
  );
}

function StepPreview({ records, preview, headers, targetFields, skipDupes, setSkipDupes, importing, error, onBack, onImport }) {
  const fieldLabel = Object.fromEntries(targetFields.map((f) => [f.key, f.label]));
  const dupCount = preview.filter((r) => r._dup).length;
  return (
    <div>
      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 10 }}>
        {records.length} row{records.length === 1 ? '' : 's'} ready. Showing first 5 for preview.
      </div>
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 6, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: COLORS.cardAlt }}>
              <th style={{ padding: 8, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontWeight: 700 }}>Status</th>
              {headers.map((h) => <th key={h} style={{ padding: 8, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}`, color: COLORS.textMuted, fontWeight: 700 }}>{fieldLabel[h] || h}</th>)}
            </tr>
          </thead>
          <tbody>
            {preview.map((r, i) => (
              <tr key={i}>
                <td style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}` }}>
                  {r._dup ? (
                    <span style={{ background: '#FEF3C7', color: '#9A7B2C', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>DUP</span>
                  ) : (
                    <span style={{ background: COLORS.primaryLight, color: COLORS.primary, padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>NEW</span>
                  )}
                </td>
                {headers.map((h) => <td key={h} style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text }}>{r[h] || '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dupCount > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: COLORS.text, cursor: 'pointer' }}>
          <input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} />
          Skip suspected duplicates
        </label>
      )}
      {error && <div style={{ fontSize: 12, color: COLORS.danger, marginTop: 8 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
        <button onClick={onBack} disabled={importing} style={{ padding: '8px 14px', background: 'none', color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 6, cursor: importing ? 'not-allowed' : 'pointer', fontSize: 13 }}>Back</button>
        <button onClick={onImport} disabled={importing}
          style={{ padding: '8px 16px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: importing ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600 }}>
          {importing ? 'Importing…' : `Import ${records.length} row${records.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  );
}

function StepDone({ result, onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: 20 }}>
      <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>Import complete</div>
      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 14 }}>
        Inserted <strong style={{ color: COLORS.primary }}>{result.inserted}</strong>, skipped <strong>{result.skipped}</strong>.
      </div>
      <button onClick={onClose}
        style={{ padding: '9px 18px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
        Done
      </button>
    </div>
  );
}
