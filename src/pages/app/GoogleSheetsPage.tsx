import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { createEntitiesBatch, entityFields } from '../../services/dataService';
import type { EntityName, ImportFileFormat } from '../../types';

const ENTITY_OPTIONS: { value: EntityName; label: string }[] = [
  { value: 'clients', label: 'Clients' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'orders', label: 'Orders' },
];

const MAX_ROWS = 5000;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.csv,.xlsx,.xls,.json';

function detectFormat(file: File): ImportFileFormat | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.xlsx')) return 'xlsx';
  if (name.endsWith('.xls')) return 'xls';
  if (name.endsWith('.json')) return 'json';
  return null;
}

function toCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

function rowsFromArrays(arrays: unknown[][]): { headers: string[]; rows: string[][] } | null {
  if (!arrays.length) return null;
  const headerRow = arrays[0].map((c) => toCell(c));
  if (!headerRow.some((h) => h)) return null;
  const headers = headerRow;
  const rows = arrays.slice(1).map((r) => headers.map((_, i) => toCell((r as unknown[])[i])));
  return { headers, rows: rows.filter((r) => r.some((c) => c !== '')) };
}

function parseJson(text: string): { headers: string[]; rows: string[][] } {
  const data = JSON.parse(text) as unknown;
  if (Array.isArray(data)) {
    if (!data.length) throw new Error('This JSON file is empty.');
    if (Array.isArray(data[0])) {
      const parsed = rowsFromArrays(data as unknown[][]);
      if (!parsed) throw new Error('This JSON file has no header row. Add column headers and try again.');
      return parsed;
    }
    if (typeof data[0] === 'object' && data[0] !== null) {
      const objects = data as Record<string, unknown>[];
      const headers = Array.from(new Set(objects.flatMap((o) => Object.keys(o || {}))));
      if (!headers.length) throw new Error('This JSON file has no fields to import.');
      const rows = objects.map((o) => headers.map((h) => toCell(o?.[h])));
      return { headers, rows: rows.filter((r) => r.some((c) => c !== '')) };
    }
    throw new Error('JSON must be an array of objects or a 2D array with a header row.');
  }
  if (data && typeof data === 'object') {
    const values = Object.values(data as Record<string, unknown>);
    if (Array.isArray(values[0])) return parseJson(JSON.stringify(values[0]));
  }
  throw new Error('JSON must be an array of records or a 2D array.');
}

function parseSheet(wb: XLSX.WorkBook, sheetName: string, formatLabel: string): { headers: string[]; rows: string[][] } {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('Selected sheet could not be read.');
  const arrays = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' }) as unknown[][];
  const parsed = rowsFromArrays(arrays);
  if (!parsed) throw new Error(`This ${formatLabel} sheet is empty or has no header row. Add column headers and try again.`);
  return parsed;
}

function normalizeHeader(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isSummaryReport(headers: string[], rows: string[][]) {
  const firstHeader = normalizeHeader(headers[0] || '');
  if (firstHeader === 'ledgerlydemoworkspace' || firstHeader === 'summary' || firstHeader === 'report') return true;
  if (!rows.length) return false;
  let sparseRows = 0;
  for (const row of rows) {
    const populated = row.filter((cell) => String(cell || '').trim()).length;
    if (populated <= 1) sparseRows += 1;
  }
  return sparseRows / rows.length > 0.3;
}

function autoMapHeaders(headers: string[], target: EntityName) {
  const mapping: Record<string, string> = {};
  for (const field of entityFields[target]) {
    const normalizedField = normalizeHeader(field);
    const header = headers.find((h) => normalizeHeader(h) === normalizedField);
    if (header) mapping[field] = header;
  }
  return mapping;
}

function scoreEntity(headers: string[], target: EntityName) {
  return entityFields[target].filter((field) => headers.some((header) => normalizeHeader(header) === normalizeHeader(field))).length;
}

function detectBestEntity(headers: string[]): EntityName {
  let best: EntityName = 'clients';
  let bestScore = -1;
  for (const option of ENTITY_OPTIONS) {
    const score = scoreEntity(headers, option.value);
    if (score > bestScore) {
      best = option.value;
      bestScore = score;
    }
  }
  return best;
}

function chooseInitialSheet(names: string[]): string | null {
  if (!names.length) return null;
  const lower = names.map((n) => n.toLowerCase().trim());
  const summaryNames = new Set(['summary', 'dashboard summary', 'read me', 'overview', 'instructions']);
  const operationalIndex = lower.findIndex((name) => ENTITY_OPTIONS.some((option) => option.value === name || option.label.toLowerCase() === name));
  if (operationalIndex >= 0) return names[operationalIndex];
  const nonSummaryIndex = lower.findIndex((name) => !summaryNames.has(name));
  if (nonSummaryIndex >= 0) return names[nonSummaryIndex];
  return names[0];
}

function autoDetectSheet(names: string[]): string | null {
  return chooseInitialSheet(names);
}

function parseAmount(value: string) {
  const cleaned = String(value || '').replace(/[$,\s]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
function parseDate(value: string) {
  const text = String(value || '').trim();
  if (!text) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const usDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (usDate) {
    const year = usDate[3].length === 2 ? `20${usDate[3]}` : usDate[3];
    return `${year}-${usDate[1].padStart(2, '0')}-${usDate[2].padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}
function rowValue(row: string[], headers: string[], mapping: Record<string, string>, field: string) {
  const header = mapping[field];
  if (!header) return '';
  const index = headers.indexOf(header);
  return index < 0 ? '' : String(row[index] ?? '').trim();
}
function requiredFields(target: EntityName) {
  if (target === 'clients') return ['name'];
  if (target === 'invoices') return ['invoice_number', 'amount'];
  if (target === 'expenses') return ['description', 'amount'];
  return ['product', 'total'];
}
function validateMapping(target: EntityName, headers: string[], mapping: Record<string, string>) {
  for (const field of requiredFields(target)) {
    const header = mapping[field];
    if (!header || !headers.includes(header)) {
      return `Map a valid column to the required “${field.replace(/_/g, ' ')}” field.`;
    }
  }
  for (const header of Object.values(mapping)) {
    if (header && !headers.includes(header)) return 'A mapped column no longer exists. Load the data again.';
  }
  return null;
}
function mapRecord(target: EntityName, headers: string[], row: string[], mapping: Record<string, string>, userId?: string) {
  const get = (field: string) => rowValue(row, headers, mapping, field);
  const opt = (field: string) => { const v = get(field); return v || null; };
  const common: Record<string, unknown> = userId ? { user_id: userId } : {};
  if (target === 'clients') {
    const name = get('name');
    return name ? { ...common, name, email: opt('email'), phone: opt('phone'), company: opt('company'), address: opt('address'), notes: opt('notes') } : null;
  }
  if (target === 'invoices') {
    const invoiceNumber = get('invoice_number');
    const amount = parseAmount(get('amount'));
    if (!invoiceNumber || amount === null || amount < 0) return null;
    const validStatus = ['draft', 'pending', 'paid', 'overdue', 'cancelled'];
    const status = get('status').toLowerCase();
    const clientId = get('client_id');
    return { ...common, invoice_number: invoiceNumber, amount, status: validStatus.includes(status) ? status : 'draft', issue_date: parseDate(get('issue_date')), due_date: get('due_date') ? parseDate(get('due_date')) : null, notes: opt('notes'), ...(clientId ? { client_id: clientId } : {}) };
  }
  if (target === 'expenses') {
    const description = get('description');
    const amount = parseAmount(get('amount'));
    if (!description || amount === null || amount < 0) return null;
    return { ...common, description, category: get('category') || 'Other', amount, date: parseDate(get('date')), notes: opt('notes') };
  }
  const product = get('product');
  const total = parseAmount(get('total'));
  if (!product || total === null || total < 0) return null;
  const quantity = parseAmount(get('quantity')) || 1;
  const validStatus = ['pending', 'processing', 'completed', 'cancelled'];
  const status = get('status').toLowerCase();
  const clientId = get('client_id');
  return { ...common, product, quantity: Math.max(1, Math.floor(quantity)), total, status: validStatus.includes(status) ? status : 'pending', order_date: parseDate(get('order_date')), notes: opt('notes'), ...(clientId ? { client_id: clientId } : {}) };
}

export function GoogleSheetsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [headers, setHeaders] = useState<string[] | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [fileFormat, setFileFormat] = useState<ImportFileFormat | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);

  const [importTarget, setImportTarget] = useState<EntityName>('clients');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped?: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

  function resetMappingState(nextTarget?: EntityName) {
    setImportTarget(nextTarget ?? 'clients');
    setMapping({});
    setImportResult(null);
    setImportError(null);
    setShowImportConfirm(false);
  }

  function applyParsed(parsed: { headers: string[]; rows: string[][] }, sourceLabel: string) {
    if (!parsed.headers.length) throw new Error('This file has no header row. Add column headers and try again.');
    if (parsed.rows.length > MAX_ROWS) {
      throw new Error(`This file has more than ${MAX_ROWS.toLocaleString()} data rows. Split it into smaller imports.`);
    }
    const bestTarget = detectBestEntity(parsed.headers);
    const nextMapping = autoMapHeaders(parsed.headers, bestTarget);
    setImportTarget(bestTarget);
    setMapping(nextMapping);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    toast(`Loaded ${sourceLabel}. Map columns to import.`, 'success');
  }

  function loadWorkbookSheet(wb: XLSX.WorkBook, sheet: string, format: ImportFileFormat, name: string, resetTarget = true) {
    try {
      const parsed = parseSheet(wb, sheet, format.toUpperCase());
      setSelectedSheet(sheet);
      if (resetTarget) {
        const match = ENTITY_OPTIONS.find((o) => o.value === sheet.toLowerCase() || o.label.toLowerCase() === sheet.toLowerCase());
        resetMappingState(match?.value);
      } else {
        setMapping({});
        setImportResult(null);
        setImportError(null);
        setShowImportConfirm(false);
      }
      applyParsed(parsed, `${name} (${sheet})`);
    } catch (err) {
      setHeaders(null);
      setRows([]);
      setSelectedSheet(sheet);
      setFileError(err instanceof Error ? err.message : 'Could not read this sheet.');
    }
  }

  async function handleFile(file: File) {
    resetMappingState();
    setFileError(null);
    setHeaders(null);
    setRows([]);
    setFileName(file.name);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet(null);
    setFileFormat(null);
    const format = detectFormat(file);
    if (!format) { setFileError('Upload a .csv, .xlsx, .xls, or .json file.'); return; }
    if (file.size > MAX_BYTES) { setFileError('File is too large (max 10 MB).'); return; }
    setFileLoading(true);
    try {
      setFileFormat(format);
      if (format === 'json') {
        const parsed = parseJson(await file.text());
        applyParsed(parsed, file.name);
      } else if (format === 'csv') {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, raw: false });
        const sheet = wb.SheetNames[0];
        if (!sheet) throw new Error('This CSV file could not be read.');
        const parsed = parseSheet(wb, sheet, 'CSV');
        applyParsed(parsed, file.name);
      } else {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
        if (!wb.SheetNames.length) throw new Error('This workbook has no sheets.');
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        const auto = autoDetectSheet(wb.SheetNames);
        if (!auto) throw new Error('This workbook has no sheets.');
        const match = ENTITY_OPTIONS.find((o) => o.value === auto.toLowerCase() || o.label.toLowerCase() === auto.toLowerCase());
        if (match) setImportTarget(match.value);
        loadWorkbookSheet(wb, auto, format, file.name, false);
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not read this file.');
    } finally {
      setFileLoading(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const previewRows = rows.slice(0, 20);
  const structuralWarning = useMemo(() => {
    if (!headers || !headers.length || !rows.length) return null;
    if (isSummaryReport(headers, rows)) return 'This looks like a summary report rather than a data table. Please upload a flat table sheet (such as Clients, Invoices, Expenses, or Orders) or upload the full .xlsx workbook.';
    return null;
  }, [headers, rows]);
  const mappingError = useMemo(() => {
    if (!headers || !headers.length) return null;
    return validateMapping(importTarget, headers, mapping);
  }, [headers, importTarget, mapping]);

  function updateMapping(field: string, header: string) {
    setMapping((prev) => ({ ...prev, [field]: header }));
  }
  function resetMapping() { setMapping({}); setImportResult(null); setImportError(null); }

  function startImport() {
    if (structuralWarning) { setImportError(structuralWarning); return; }
    if (!headers || !headers.length) { setImportError('Load a file with a header row before importing.'); return; }
    setImportError(null);
    setImportResult(null);
    setShowImportConfirm(true);
  }

  async function confirmImport() {
    if (mappingError || structuralWarning || !headers) { setImportError(mappingError || structuralWarning || 'Load a file before importing.'); setShowImportConfirm(false); return; }
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const dataRows = rows.filter((row) => row.some((cell) => String(cell || '').trim()));
      const records = dataRows
        .map((row) => mapRecord(importTarget, headers, row, mapping, user?.id))
        .filter((record): record is NonNullable<typeof record> => record !== null);
      console.log('[ledgerly][import] confirmImport start', {
        targetTable: importTarget,
        authUserId: user?.id,
        file: activeLabel,
        totalDataRows: dataRows.length,
        mappedRecords: records.length,
        mapping,
        samplePayload: records[0] ?? null,
      });
      let imported = 0;
      let skipped = Math.max(dataRows.length - records.length, 0);
      if (records.length) {
        try {
          const inserted = await createEntitiesBatch(importTarget, records as Record<string, unknown>[], user?.id);
          imported = inserted.length || records.length;
        } catch (err) {
          console.error('[ledgerly][import] batch insert failed', { targetTable: importTarget, authUserId: user?.id, error: err });
          setImportError(err instanceof Error ? err.message : 'Import failed.');
          toast(err instanceof Error ? err.message : 'Import failed.', 'error');
          setImporting(false);
          setShowImportConfirm(false);
          return;
        }
      }
      console.log('[ledgerly][import] confirmImport finished', { targetTable: importTarget, authUserId: user?.id, imported, skipped });
      setImportResult({ imported, skipped });
      if (imported > 0) {
        toast(`Imported ${imported} row(s).`, 'success');
        window.dispatchEvent(new Event('ledgerly:data-updated'));
        navigate('/app/dashboard');
        setTimeout(() => window.dispatchEvent(new Event('ledgerly:data-updated')), 150);
        return;
      }
      toast('No valid rows were imported. Check your mapping and data.', 'error');
    } catch (err) {
      console.error('[ledgerly][import] confirmImport fatal error', { targetTable: importTarget, authUserId: user?.id, error: err });
      const message = err instanceof Error ? err.message : 'Import failed.';
      setImportError(message);
      toast(message, 'error');
    } finally {
      setImporting(false);
      setShowImportConfirm(false);
    }
  }
  function cancelImport() { if (!importing) setShowImportConfirm(false); }

  const activeLabel = selectedSheet && fileName ? `${fileName} — ${selectedSheet}` : (fileName || 'File');

  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Integrations</p>
          <h1 className="page-title">Data Import</h1>
          <p className="page-subtitle">Upload a CSV, Excel, or JSON file, map columns, and import data into your workspace.</p>
        </div>
      </div>

      <section className="card" style={{ padding: 20, marginBottom: 18 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Import from file</p>
        <p className="muted" style={{ margin: '6px 0 12px', fontSize: 12 }}>Drag and drop or choose a <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.json</strong> file (max 10 MB, 5,000 data rows). First row must be headers (or JSON array of objects). Excel workbooks can contain multiple sheets.</p>
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          style={{ border: `2px dashed ${dragging ? '#2db47a' : '#d7deea'}`, borderRadius: 10, padding: 18, textAlign: 'center', cursor: 'pointer', background: dragging ? '#f2fbf7' : '#fafbfc' }}
        >
          <p style={{ margin: 0, fontSize: 13 }}><strong>Drop a file here</strong> or click to choose</p>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 11 }}>Supported: CSV, Excel (.xlsx, .xls), JSON</p>
          {fileName && <p className="muted" style={{ margin: '6px 0 0', fontSize: 11 }}>Selected: {fileName}</p>}
        </div>
        <input ref={fileInputRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
        {sheetNames.length > 1 && workbook && fileFormat && (fileFormat === 'xlsx' || fileFormat === 'xls') && (
          <div style={{ marginTop: 14 }}>
            <p className="muted" style={{ margin: '0 0 8px', fontSize: 12 }}>This workbook has multiple sheets. Select which sheet to import:</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {sheetNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={`button ${selectedSheet === name ? 'button-primary' : 'button-secondary'}`}
                  onClick={() => { if (fileName) loadWorkbookSheet(workbook, name, fileFormat, fileName); }}
                  disabled={fileLoading}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}
        {fileError && <div className="notice" style={{ marginTop: 12, borderColor: '#e95f67' }}>{fileError}</div>}
        {structuralWarning && <div className="notice" style={{ marginTop: 12, borderColor: '#f59e0b' }}>{structuralWarning}</div>}
      </section>

      {(fileLoading || (headers && headers.length > 0)) && (
        <section className="card" style={{ padding: 20, marginTop: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Preview & map</p>
              <h3 style={{ margin: '4px 0 0', fontSize: 15 }}>{activeLabel}</h3>
            </div>
            <span className="muted" style={{ fontSize: 11 }}>{headers ? `${rows.length} data row(s) available` : ''}</span>
          </div>

          {fileLoading ? (
            <p>Loading file…</p>
          ) : !headers || !headers.length ? (
            <div className="empty-state">
              <p>This file is empty or has no header row.</p>
              <p className="muted">Add column headers to the first row, then try again.</p>
            </div>
          ) : (
            <div>
              <p className="muted" style={{ marginTop: 0, marginBottom: 10, fontSize: 11 }}>
                Showing a preview of the first {previewRows.length} row(s). Map your columns, then import.
              </p>
              <div className="table-scroll" style={{ border: '1px solid #e8ebf1', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ margin: 0 }}>
                  <thead>
                    <tr>{headers.map((h, i) => (<th key={`${h}-${i}`}>{h || `Column ${i + 1}`}</th>))}</tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr key={`r-${ri}`}>{headers.map((_, ci) => (<td key={`c-${ri}-${ci}`}>{row[ci] ?? ''}</td>))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 18 }}>
                <p className="muted" style={{ marginTop: 0, marginBottom: 10, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>Map columns to Ledgerly fields</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {ENTITY_OPTIONS.map((option) => (
                    <div key={option.value} style={{ border: '1px solid #e8ebf1', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#556274' }}>{option.label}</label>
                        <input type="radio" name="import-target" checked={importTarget === option.value} onChange={() => { setImportTarget(option.value); setMapping({}); setImportResult(null); setImportError(null); }} />
                      </div>
                      {entityFields[option.value].map((field) => (
                        <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          <label style={{ fontSize: 10, color: '#677487', flex: '0 0 auto', whiteSpace: 'nowrap' }}>{field}</label>
                          <select className="form-select" style={{ padding: '6px 8px', fontSize: 10 }} value={mapping[field] || ''} onChange={(e) => updateMapping(field, e.target.value)}>
                            <option value="">— Not mapped —</option>
                            {headers.map((h, i) => (<option key={`${h}-${i}`} value={h}>{h || `Column ${i + 1}`}</option>))}
                          </select>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button className="button button-primary" onClick={startImport} disabled={importing || !!mappingError || !!structuralWarning}>Import Data</button>
                  <button className="button button-ghost" onClick={resetMapping}>Reset mapping</button>
                  {mappingError && <span className="muted" style={{ fontSize: 11 }}>{mappingError}</span>}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {importResult && (
        <div className="notice" style={{ marginTop: 18, borderColor: '#2db47a' }}>
          Import complete: <strong>{importResult.imported}</strong> row(s) imported{typeof importResult.skipped === 'number' ? <> and <strong>{importResult.skipped}</strong> row(s) skipped</> : ''}.
        </div>
      )}
      {importError && <div className="notice" style={{ marginTop: 18, borderColor: '#e95f67' }}>{importError}</div>}

      {showImportConfirm && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-labelledby="import-confirm-title">
            <div className="modal-header">
              <div>
                <h3 id="import-confirm-title" className="modal-title">Confirm import</h3>
                <p className="modal-subtitle">This will add data to your Ledgerly workspace.</p>
              </div>
              <button className="icon-button" onClick={cancelImport} aria-label="Close" disabled={importing}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#556274' }}>
                Import <strong>{activeLabel}</strong> into <strong>{ENTITY_OPTIONS.find((o) => o.value === importTarget)?.label}</strong>.
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#718096' }}>
                Rows that do not match the required columns will be skipped. On success you will be redirected to the dashboard.
              </p>
            </div>
            <div className="form-actions">
              <button className="button button-secondary" onClick={cancelImport} disabled={importing}>Cancel</button>
              <button className="button button-primary" onClick={() => void confirmImport()} disabled={importing}>{importing ? 'Importing…' : 'Confirm import'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default GoogleSheetsPage;







