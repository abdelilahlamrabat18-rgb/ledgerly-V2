import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { createEntitiesBatch, deleteEntity, entityFields, listEntity } from '../../services/dataService';
import { toCSV, downloadCSV } from '../../lib/export';
import { differenceInDays, parseISO } from 'date-fns';
import type { EntityName, ImportFileFormat } from '../../types';

const ENTITY_OPTIONS: { value: EntityName; label: string; keyFields: string[] }[] = [
  { value: 'clients', label: 'Clients', keyFields: ['name', 'email', 'company'] },
  { value: 'invoices', label: 'Invoices', keyFields: ['invoice_number', 'issue_date', 'due_date', 'amount', 'status'] },
  { value: 'expenses', label: 'Expenses', keyFields: ['description', 'amount', 'category', 'date'] },
  { value: 'orders', label: 'Orders', keyFields: ['product', 'total', 'quantity', 'order_date', 'status'] },
];

const ENTITY_IMPORT_ORDER: EntityName[] = ['clients', 'invoices', 'expenses', 'orders'];

const MAX_ROWS = 5000;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.csv,.xlsx,.xls,.json';

const TEMPLATE_HEADERS: Record<EntityName, string[]> = {
  clients: ['name', 'email', 'phone', 'company', 'address', 'notes'],
  invoices: ['invoice_number', 'client_id', 'client_name', 'amount', 'status', 'issue_date', 'due_date', 'notes'],
  expenses: ['description', 'category', 'amount', 'date', 'notes'],
  orders: ['product', 'client_id', 'client_name', 'quantity', 'total', 'status', 'order_date', 'notes'],
};

const TEMPLATE_SAMPLE_ROWS: Record<EntityName, string[][]> = {
  clients: [
    ['Acme Corporation', 'contact@acme.com', '+1-555-0100', 'Acme Corp', '123 Main St, Springfield', 'Primary contact: Jane Doe'],
    ['Globex Inc', 'sales@globex.io', '+1-555-0200', 'Globex', '456 Oak Ave, Shelbyville', 'Net-30 terms'],
  ],
  invoices: [
    ['INV-1001', '', 'Acme Corporation', '2500.00', 'paid', '2024-01-15', '2024-02-14', 'Web design project'],
    ['INV-1002', '', 'Globex Inc', '1200.50', 'pending', '2024-02-01', '2024-03-03', 'Monthly retainer'],
  ],
  expenses: [
    ['Adobe Creative Cloud', 'Software', '599.88', '2024-01-10', 'Annual subscription'],
    ['Office Rent', 'Workspace', '2500.00', '2024-02-01', 'February rent'],
  ],
  orders: [
    ['Website Redesign', '', 'Acme Corporation', '1', '5000.00', 'completed', '2024-01-20', 'Phase 1 delivery'],
    ['SEO Optimization', '', 'Globex Inc', '3', '1500.00', 'processing', '2024-02-15', 'Monthly retainer x3'],
  ],
};

function downloadTemplate(entity: EntityName) {
  const headers = TEMPLATE_HEADERS[entity];
  const sampleRows = TEMPLATE_SAMPLE_ROWS[entity];
  const csvContent = toCSV(
    [headers, ...sampleRows].map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
      return obj;
    }),
    headers.map((h) => ({ key: h, label: h.replace(/_/g, ' ') }))
  );
  downloadCSV(csvContent, `${entity}-template.csv`);
}

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

function mappingStorageKey(entity: EntityName) {
  return `ledgerly:import-mapping:${entity}`;
}
function loadSavedMapping(entity: EntityName): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(mappingStorageKey(entity));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}
function saveMapping(entity: EntityName, mapping: Record<string, string>) {
  try {
    window.localStorage.setItem(mappingStorageKey(entity), JSON.stringify(mapping));
  } catch {
    // Ignore storage failures.
  }
}
function recordDuplicateKey(target: EntityName, record: Record<string, unknown>) {
  if (target === 'invoices') return `invoice:${String(record.invoice_number || '').trim().toLowerCase()}`;
  if (target === 'clients') return `client:${String(record.name || '').trim().toLowerCase()}|${String(record.email || '').trim().toLowerCase()}`;
  if (target === 'expenses') return `expense:${String(record.description || '').trim().toLowerCase()}|${String(record.date || '')}|${String(record.amount ?? '')}`;
  return `order:${String(record.product || '').trim().toLowerCase()}|${String(record.order_date || '')}|${String(record.total ?? '')}`;
}

type SheetState = {
  headers: string[];
  rows: string[][];
  targetEntity: EntityName;
  mapping: Record<string, string>;
  included: boolean;
  hygieneSummary: HygieneSummary | null;
  mappingCompleteness: { mapped: number; total: number; required: number; requiredTotal: number; isComplete: boolean } | null;
  duplicateCount: number;
  structuralWarning: string | null;
  imported: boolean;
  importedCount: number;
};

type ImportSource = {
  batchId: string;
  fileName: string;
  sheetName: string;
  targetEntity: EntityName;
  rowCount: number;
  importedAt: string;
  status: 'active' | 'declined';
  recordIds: string[];
};

const IMPORT_SOURCES_KEY = 'ledgerly:import-sources';
const DECLINED_RECORDS_KEY = 'ledgerly:declined-import-records';

function loadImportSources(): ImportSource[] {
  try {
    const raw = window.localStorage.getItem(IMPORT_SOURCES_KEY);
    return raw ? (JSON.parse(raw) as ImportSource[]) : [];
  } catch {
    return [];
  }
}
function saveImportSources(sources: ImportSource[]) {
  try { window.localStorage.setItem(IMPORT_SOURCES_KEY, JSON.stringify(sources)); } catch {}
}
function loadDeclinedRecordIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DECLINED_RECORDS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
function saveDeclinedRecordIds(ids: Set<string>) {
  try { window.localStorage.setItem(DECLINED_RECORDS_KEY, JSON.stringify([...ids])); } catch {}
}
const WORKBOOK_STORAGE_KEY = 'ledgerly:workbook-session';

function loadWorkbookSession(): { fileName: string; fileFormat: ImportFileFormat; sheetNames: string[]; sheetStates: Record<string, SheetState>; selectedSheet: string | null } | null {
  try {
    const raw = window.sessionStorage.getItem(WORKBOOK_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as any) : null;
  } catch {
    return null;
  }
}
function saveWorkbookSession(data: { fileName: string; fileFormat: ImportFileFormat; sheetNames: string[]; sheetStates: Record<string, SheetState>; selectedSheet: string | null }) {
  try { window.sessionStorage.setItem(WORKBOOK_STORAGE_KEY, JSON.stringify(data)); } catch {}
}
function clearWorkbookSession() {
  try { window.sessionStorage.removeItem(WORKBOOK_STORAGE_KEY); } catch {}
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
  const normalizedHeaders = headers.map(h => normalizeHeader(h));
  for (const field of entityFields[target]) {
    const normalizedField = normalizeHeader(field);
    const idx = normalizedHeaders.findIndex(h => h === normalizedField);
    if (idx >= 0) mapping[field] = headers[idx];
  }
  return mapping;
}

function scoreEntity(headers: string[], target: EntityName) {
  const normalizedHeaders = headers.map(h => normalizeHeader(h));
  let score = 0;
  const option = ENTITY_OPTIONS.find(o => o.value === target);
  const keyFields = option?.keyFields || [];
  for (const field of entityFields[target]) {
    const normalizedField = normalizeHeader(field);
    if (normalizedHeaders.includes(normalizedField)) {
      score += keyFields.includes(field) ? 3 : 1;
    }
  }
  return score;
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

function getMappingCompleteness(target: EntityName, headers: string[], mapping: Record<string, string>) {
  const fields = entityFields[target];
  const mapped = fields.filter(f => mapping[f] && headers.includes(mapping[f])).length;
  const required = requiredFields(target).filter(f => mapping[f] && headers.includes(mapping[f])).length;
  const requiredTotal = requiredFields(target).length;
  return { mapped, total: fields.length, required, requiredTotal, isComplete: required === requiredTotal };
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
      return `Map a valid column to the required "${field.replace(/_/g, ' ')}" field.`;
    }
  }
  for (const header of Object.values(mapping)) {
    if (header && !headers.includes(header)) return 'A mapped column no longer exists. Load the data again.';
  }
  return null;
}

function mapRecord(target: EntityName, headers: string[], row: string[], mapping: Record<string, string>, userId?: string, getVendorCategory?: (description: string) => string | undefined) {
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
    const vendorCategory = getVendorCategory ? getVendorCategory(description) : undefined;
    return { ...common, description, category: get('category') || vendorCategory || 'Other', amount, date: parseDate(get('date')), notes: opt('notes') };
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

function HygieneStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: '8px', background: '#fff', border: '1px solid #e8ebf1', borderRadius: 6 }}>
      <div style={{ fontSize: 11, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

type RowWarning = {
  rowIndex: number;
  issues: string[];
};

type HygieneSummary = {
  totalRows: number;
  rowsWithWarnings: number;
  warnings: {
    blankRequired: number;
    invalidDates: number;
    invalidAmounts: number;
    duplicates: number;
  };
  details: RowWarning[];
};

function analyzeHygiene(target: EntityName, headers: string[], rows: string[][], mapping: Record<string, string>, existingKeys: Set<string>, getVendorCategory?: (description: string) => string | undefined): HygieneSummary {
  const required = requiredFields(target);
  const amountFields = target === 'invoices' ? ['amount'] : target === 'expenses' ? ['amount'] : ['total'];
  const dateFields = target === 'invoices' ? ['issue_date', 'due_date'] : target === 'expenses' ? ['date'] : ['order_date'];
  const details: RowWarning[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const issues: string[] = [];

    // Check blank required fields
    for (const field of required) {
      const header = mapping[field];
      if (header) {
        const idx = headers.indexOf(header);
        const value = idx >= 0 ? row[idx]?.trim() : '';
        if (!value) issues.push(`Missing required: ${field.replace(/_/g, ' ')}`);
      }
    }

    // Check invalid dates
    for (const field of dateFields) {
      const header = mapping[field];
      if (header) {
        const idx = headers.indexOf(header);
        const value = idx >= 0 ? row[idx]?.trim() : '';
        if (value) {
          const parsed = parseDate(value);
          const parsedDate = new Date(parsed);
          if (Number.isNaN(parsedDate.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
            issues.push(`Invalid date in ${field.replace(/_/g, ' ')}`);
          }
        }
      }
    }

    // Check invalid amounts
    for (const field of amountFields) {
      const header = mapping[field];
      if (header) {
        const idx = headers.indexOf(header);
        const value = idx >= 0 ? row[idx]?.trim() : '';
        if (value) {
          const amount = parseAmount(value);
          if (amount === null || amount <= 0) {
            issues.push(`Invalid amount in ${field.replace(/_/g, ' ')}`);
          }
        }
      }
    }

    // Check duplicates against existing data
    const testRecord = mapRecord(target, headers, row, mapping, undefined, getVendorCategory);
    if (testRecord) {
      const key = recordDuplicateKey(target, testRecord as Record<string, unknown>);
      if (existingKeys.has(key)) {
        issues.push('Duplicate of existing record');
      }
    }

    if (issues.length > 0) {
      details.push({ rowIndex: i, issues });
    }
  }

  const blankRequired = details.filter(d => d.issues.some(i => i.startsWith('Missing required'))).length;
  const invalidDates = details.filter(d => d.issues.some(i => i.startsWith('Invalid date'))).length;
  const invalidAmounts = details.filter(d => d.issues.some(i => i.startsWith('Invalid amount'))).length;
  const duplicates = details.filter(d => d.issues.some(i => i.startsWith('Duplicate'))).length;

  return {
    totalRows: rows.length,
    rowsWithWarnings: details.length,
    warnings: { blankRequired, invalidDates, invalidAmounts, duplicates },
    details,
  };
}

export function GoogleSheetsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { getVendorCategory, setVendorCategory } = usePreferences();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      const vendorCategory = getVendorCategory(description);
      return { ...common, description, category: get('category') || vendorCategory || 'Other', amount, date: parseDate(get('date')), notes: opt('notes') };
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
  const [sheetStates, setSheetStates] = useState<Record<string, SheetState>>({});

  const [importTarget, setImportTarget] = useState<EntityName>('clients');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped?: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importSources, setImportSources] = useState<ImportSource[]>(() => loadImportSources());
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [mappingCompleteness, setMappingCompleteness] = useState<{ mapped: number; total: number; required: number; requiredTotal: number; isComplete: boolean } | null>(null);
  const [hygieneSummary, setHygieneSummary] = useState<HygieneSummary | null>(null);
  const [showHygieneDetails, setShowHygieneDetails] = useState(false);
  const [structuralWarning, setStructuralWarning] = useState<string | null>(null);
  const [singleImportSuccess, setSingleImportSuccess] = useState<{ imported: number; sheetName: string; remainingTabs: string[] } | null>(null);

  // Load persisted workbook session on mount
  useEffect(() => {
    const session = loadWorkbookSession();
    if (session) {
      setFileName(session.fileName);
      setFileFormat(session.fileFormat);
      setSheetNames(session.sheetNames);
      setSheetStates(session.sheetStates);
      setSelectedSheet(session.selectedSheet);
      // Restore the selected sheet's data to live preview
      const selectedState = session.sheetStates[session.selectedSheet || ''];
      if (selectedState) {
        setHeaders(selectedState.headers);
        setRows(selectedState.rows);
        setImportTarget(selectedState.targetEntity);
        setMapping(selectedState.mapping);
        setMappingCompleteness(selectedState.mappingCompleteness);
        setStructuralWarning(selectedState.structuralWarning);
        setHygieneSummary(selectedState.hygieneSummary);
        setDuplicateCount(selectedState.duplicateCount);
      }
      // Note: workbook (XLSX.WorkBook) cannot be serialized to sessionStorage,
      // but we have all the parsed sheet data in sheetStates
    }
  }, []);

  // Save workbook session to sessionStorage when relevant state changes
  useEffect(() => {
    if (sheetNames.length > 0 && Object.keys(sheetStates).length > 0) {
      saveWorkbookSession({
        fileName: fileName || '',
        fileFormat: fileFormat!,
        sheetNames,
        sheetStates,
        selectedSheet,
      });
    } else {
      clearWorkbookSession();
    }
  }, [fileName, fileFormat, sheetNames, sheetStates, selectedSheet]);

  function resetMappingState(nextTarget?: EntityName) {
    setImportTarget(nextTarget ?? 'clients');
    setMapping({});
    setMappingCompleteness(null);
    setImportResult(null);
    setImportError(null);
    setShowImportConfirm(false);
    setHygieneSummary(null);
    setStructuralWarning(null);
    setDuplicateCount(0);
  }

  function getSheetState(sheetName: string): SheetState | null {
    return sheetStates[sheetName] || null;
  }

  function updateSheetState(sheetName: string, updates: Partial<SheetState>) {
    setSheetStates(prev => ({
      ...prev,
      [sheetName]: { ...prev[sheetName], ...updates } as SheetState
    }));
  }

  function clearWorkbook() {
    setHeaders(null);
    setRows([]);
    setFileName(null);
    setFileFormat(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet(null);
    setSheetStates({});
    setFileError(null);
    setImportTarget('clients');
    setMapping({});
    setMappingCompleteness(null);
    setImportResult(null);
    setImportError(null);
    setShowImportConfirm(false);
    setHygieneSummary(null);
    setDuplicateCount(0);
    setStructuralWarning(null);
    setSingleImportSuccess(null);
    clearWorkbookSession();
    toast('Workbook cleared. Upload a new file to start importing.', 'success');
  }

  function applyParsed(parsed: { headers: string[]; rows: string[][] }, sourceLabel: string, sheetName?: string) {
    if (!parsed.headers.length) throw new Error('This file has no header row. Add column headers and try again.');
    if (parsed.rows.length > MAX_ROWS) {
      throw new Error(`This file has more than ${MAX_ROWS.toLocaleString()} data rows. Split it into smaller imports.`);
    }
    const bestTarget = detectBestEntity(parsed.headers);
    const nextMapping = autoMapHeaders(parsed.headers, bestTarget);
    const saved = loadSavedMapping(bestTarget);
    for (const field of entityFields[bestTarget]) {
      if (!nextMapping[field] && saved[field] && parsed.headers.includes(saved[field])) nextMapping[field] = saved[field];
    }
    const completeness = getMappingCompleteness(bestTarget, parsed.headers, nextMapping);
    const warning = isSummaryReport(parsed.headers, parsed.rows)
      ? 'This looks like a summary report rather than a data table. Please upload a flat table sheet (such as Clients, Invoices, Expenses, or Orders) or upload the full .xlsx workbook.'
      : null;

    if (sheetName) {
      // Multi-sheet workbook: store state per sheet
      const newSheetState: SheetState = {
        headers: parsed.headers,
        rows: parsed.rows,
        targetEntity: bestTarget,
        mapping: nextMapping,
        included: !warning, // Auto-include if not a summary report
        hygieneSummary: null,
        mappingCompleteness: completeness,
        duplicateCount: 0,
        structuralWarning: warning,
        imported: false,
        importedCount: 0,
      };
      updateSheetState(sheetName, newSheetState);
      
      // If this is the selected sheet, update the live preview
      if (selectedSheet === sheetName) {
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setImportTarget(bestTarget);
        setMapping(nextMapping);
        setMappingCompleteness(completeness);
        setStructuralWarning(warning);
        setHygieneSummary(null);
        setDuplicateCount(0);
      }
    } else {
      // Single file (CSV, JSON): use legacy state
      setImportTarget(bestTarget);
      setMapping(nextMapping);
      setMappingCompleteness(completeness);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setStructuralWarning(warning);
      setHygieneSummary(null);
      setDuplicateCount(0);
    }
    toast(`Loaded ${sourceLabel}. Map columns to import.`, 'success');
  }

  function loadWorkbookSheet(wb: XLSX.WorkBook, sheet: string, format: ImportFileFormat, name: string) {
    try {
      const parsed = parseSheet(wb, sheet, format.toUpperCase());
      setSelectedSheet(sheet);
      applyParsed(parsed, `${name} (${sheet})`, sheet);
    } catch (err) {
      setHeaders(null);
      setRows([]);
      setSelectedSheet(sheet);
      setFileError(err instanceof Error ? err.message : 'Could not read this sheet.');
    }
  }

  function switchSheet(sheetName: string) {
    const state = getSheetState(sheetName);
    if (!state) return;
    
    setSelectedSheet(sheetName);
    setHeaders(state.headers);
    setRows(state.rows);
    setImportTarget(state.targetEntity);
    setMapping(state.mapping);
    setMappingCompleteness(state.mappingCompleteness);
    setStructuralWarning(state.structuralWarning);
    setHygieneSummary(state.hygieneSummary);
    setDuplicateCount(state.duplicateCount);
    setImportResult(null);
    setImportError(null);
    setShowImportConfirm(false);
  }

  async function handleFile(file: File) {
    resetMappingState();
    setSheetStates({});
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
        
        // Parse all sheets and initialize their states
        const initialStates: Record<string, SheetState> = {};
        for (const sheetName of wb.SheetNames) {
          try {
            const parsed = parseSheet(wb, sheetName, format.toUpperCase());
            const bestTarget = detectBestEntity(parsed.headers);
            const nextMapping = autoMapHeaders(parsed.headers, bestTarget);
            const saved = loadSavedMapping(bestTarget);
            for (const field of entityFields[bestTarget]) {
              if (!nextMapping[field] && saved[field] && parsed.headers.includes(saved[field])) nextMapping[field] = saved[field];
            }
            const completeness = getMappingCompleteness(bestTarget, parsed.headers, nextMapping);
            const warning = isSummaryReport(parsed.headers, parsed.rows)
              ? 'This looks like a summary report rather than a data table. Please upload a flat table sheet (such as Clients, Invoices, Expenses, or Orders) or upload the full .xlsx workbook.'
              : null;
            
            initialStates[sheetName] = {
              headers: parsed.headers,
              rows: parsed.rows,
              targetEntity: bestTarget,
              mapping: nextMapping,
              included: !warning,
              hygieneSummary: null,
              mappingCompleteness: completeness,
              duplicateCount: 0,
              structuralWarning: warning,
              imported: false,
              importedCount: 0,
            };
          } catch {
            // If a sheet fails to parse, mark it as excluded
            initialStates[sheetName] = {
              headers: [],
              rows: [],
              targetEntity: 'clients',
              mapping: {},
              included: false,
              hygieneSummary: null,
              mappingCompleteness: null,
              duplicateCount: 0,
              structuralWarning: 'Could not read this sheet.',
              imported: false,
              importedCount: 0,
            };
          }
        }
        setSheetStates(initialStates);
        
        // Auto-select the first non-summary sheet
        const auto = wb.SheetNames.find(name => {
          const state = initialStates[name];
          return state && !state.structuralWarning;
        }) || wb.SheetNames[0];
        
        if (auto) {
          const match = ENTITY_OPTIONS.find((o) => o.value === auto.toLowerCase() || o.label.toLowerCase() === auto.toLowerCase());
          if (match) setImportTarget(match.value);
          loadWorkbookSheet(wb, auto, format, file.name);
        }
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
  const mappingError = useMemo(() => {
    if (!headers || !headers.length) return null;
    return validateMapping(importTarget, headers, mapping);
  }, [headers, importTarget, mapping]);

  const mappingComplete = useMemo(() => {
    if (!headers || !headers.length) return null;
    return getMappingCompleteness(importTarget, headers, mapping);
  }, [headers, importTarget, mapping]);

  function updateMapping(field: string, header: string) {
    setMapping((prev) => ({ ...prev, [field]: header }));
    // Also update the sheet state if we're in multi-sheet mode
    if (selectedSheet && workbook) {
      updateSheetState(selectedSheet, { mapping: { ...sheetStates[selectedSheet]?.mapping, [field]: header } });
    }
  }
  function resetMapping() { setMapping({}); setImportResult(null); setImportError(null); }

  function startImport() {
    if (structuralWarning) { setImportError(structuralWarning); return; }
    if (!headers || !headers.length) { setImportError('Load a file with a header row before importing.'); return; }
    if (!mappingComplete?.isComplete) { setImportError('Please map all required fields before importing.'); return; }
    setImportError(null);
    setImportResult(null);
    // Compute hygiene summary
    void (async () => {
      try {
        const existing = await listEntity(importTarget);
        const existingKeys = new Set(existing.map((record) => recordDuplicateKey(importTarget, record as Record<string, unknown>)));
        const summary = analyzeHygiene(importTarget, headers, rows, mapping, existingKeys, getVendorCategory);
        setHygieneSummary(summary);
        // Also update sheet state if in multi-sheet mode
        if (selectedSheet && workbook) {
          updateSheetState(selectedSheet, { hygieneSummary: summary });
        }
        setShowHygieneDetails(false);
      } catch {
        setHygieneSummary(null);
        if (selectedSheet && workbook) {
          updateSheetState(selectedSheet, { hygieneSummary: null });
        }
      }
      setShowImportConfirm(true);
    })();
  }

  async function confirmImportAll() {
    if (!workbook || !sheetNames.length) {
      setImportError('No workbook loaded.');
      return;
    }

    // Collect all ready sheets in the correct import order
    const readySheets: Array<{ sheetName: string; targetEntity: EntityName; state: SheetState }> = [];
    for (const entityType of ENTITY_IMPORT_ORDER) {
      for (const sheetName of sheetNames) {
        const state = sheetStates[sheetName];
        if (state && state.mappingCompleteness?.isComplete && !state.structuralWarning && state.included && state.targetEntity === entityType) {
          readySheets.push({ sheetName, targetEntity: entityType, state });
        }
      }
    }

    if (readySheets.length === 0) {
      setImportError('No sheets are ready to import. Please map all required fields for at least one sheet.');
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      let totalImported = 0;
      let totalSkipped = 0;
      const newImportSources: ImportSource[] = [];

      // Process each ready sheet in order
      for (const { sheetName, targetEntity, state } of readySheets) {
        const dataRows = state.rows.filter((row) => row.some((cell) => String(cell || '').trim()));
        const records = dataRows
          .map((row) => mapRecord(targetEntity, state.headers, row, state.mapping, user?.id))
          .filter((record): record is NonNullable<typeof record> => record !== null);

        console.log('[ledgerly][import] confirmImportAll sheet', {
          sheetName,
          targetTable: targetEntity,
          authUserId: user?.id,
          file: activeLabel,
          totalDataRows: dataRows.length,
          mappedRecords: records.length,
          mapping: state.mapping,
        });

        let imported = 0;
        let skipped = Math.max(dataRows.length - records.length, 0);
        let recordsToImport = records;

        if (skipDuplicates && state.duplicateCount > 0) {
          try {
            const existing = await listEntity(targetEntity);
            const existingKeys = new Set(existing.map((record) => recordDuplicateKey(targetEntity, record as Record<string, unknown>)));
            recordsToImport = records.filter((record) => !existingKeys.has(recordDuplicateKey(targetEntity, record as Record<string, unknown>)));
            skipped += records.length - recordsToImport.length;
          } catch {
            // If duplicate lookup fails, continue with all mapped records.
          }
        }

        saveMapping(targetEntity, state.mapping);

        // Save vendor-category memory for expenses
        if (targetEntity === 'expenses') {
          for (const record of recordsToImport) {
            const expenseRecord = record as Record<string, unknown> & { description?: string; category?: string };
            const description = expenseRecord.description;
            const category = expenseRecord.category;
            if (description && category && category !== 'Other') {
              setVendorCategory(description, category);
            }
          }
        }

        if (recordsToImport.length) {
          try {
            const inserted = await createEntitiesBatch(targetEntity, recordsToImport as Record<string, unknown>[], user?.id);
            imported = inserted.length || recordsToImport.length;
            const batchId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const source: ImportSource = {
              batchId,
              fileName: fileName || 'File',
              sheetName,
              targetEntity,
              rowCount: recordsToImport.length,
              importedAt: new Date().toISOString(),
              status: 'active',
              recordIds: (inserted as Array<{ id?: string }>).map((record) => String(record.id || '')).filter(Boolean),
            };
            newImportSources.push(source);
          } catch (err) {
            console.error('[ledgerly][import] batch insert failed', { targetTable: targetEntity, authUserId: user?.id, error: err });
            setImportError(err instanceof Error ? err.message : `Import failed for ${sheetName}.`);
            toast(err instanceof Error ? err.message : `Import failed for ${sheetName}.`, 'error');
            setImporting(false);
            return;
          }
        }

        totalImported += imported;
        totalSkipped += skipped;
      }

      // Save all import sources
      if (newImportSources.length) {
        const nextSources = [...newImportSources, ...importSources];
        setImportSources(nextSources);
        saveImportSources(nextSources);
      }

      console.log('[ledgerly][import] confirmImportAll finished', { totalImported, totalSkipped, sheets: readySheets.map(s => s.sheetName) });
      
      // Mark all imported sheets as imported
      for (const { sheetName, state } of readySheets) {
        const dataRows = state.rows.filter((row) => row.some((cell) => String(cell || '').trim()));
        const records = dataRows
          .map((row) => mapRecord(state.targetEntity, state.headers, row, state.mapping, user?.id))
          .filter((record): record is NonNullable<typeof record> => record !== null);
        updateSheetState(sheetName, { imported: true, importedCount: records.length, included: false });
      }
      
      setImportResult({ imported: totalImported, skipped: totalSkipped });
      
      if (totalImported > 0) {
        toast(`Imported ${totalImported} row(s) across ${readySheets.length} sheet(s).`, 'success');
        window.dispatchEvent(new Event('ledgerly:data-updated'));
        navigate('/app');
        setTimeout(() => window.dispatchEvent(new Event('ledgerly:data-updated')), 150);
        return;
      }
      toast('No valid rows were imported. Check your mapping and data.', 'error');
    } catch (err) {
      console.error('[ledgerly][import] confirmImportAll fatal error', { authUserId: user?.id, error: err });
      const message = err instanceof Error ? err.message : 'Import failed.';
      setImportError(message);
      toast(message, 'error');
    } finally {
      setImporting(false);
      setShowImportConfirm(false);
    }
  }

  async function confirmImport() {
    if (structuralWarning || !headers || !mappingComplete?.isComplete) {
      setImportError(structuralWarning || (!mappingComplete?.isComplete ? 'Please map all required fields before importing.' : 'Load a file before importing.'));
      setShowImportConfirm(false);
      return;
    }
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
      let recordsToImport = records;
      if (skipDuplicates && duplicateCount > 0) {
        try {
          const existing = await listEntity(importTarget);
          const existingKeys = new Set(existing.map((record) => recordDuplicateKey(importTarget, record as Record<string, unknown>)));
          recordsToImport = records.filter((record) => !existingKeys.has(recordDuplicateKey(importTarget, record as Record<string, unknown>)));
          skipped += records.length - recordsToImport.length;
        } catch {
          // If duplicate lookup fails, continue with all mapped records.
        }
      }
      saveMapping(importTarget, mapping);
      // Save vendor-category memory for expenses
      if (importTarget === 'expenses') {
        for (const record of recordsToImport) {
          const expenseRecord = record as Record<string, unknown> & { description?: string; category?: string };
          const description = expenseRecord.description;
          const category = expenseRecord.category;
          if (description && category && category !== 'Other') {
            setVendorCategory(description, category);
          }
        }
      }
      if (recordsToImport.length) {
        try {
          const inserted = await createEntitiesBatch(importTarget, recordsToImport as Record<string, unknown>[], user?.id);
          imported = inserted.length || recordsToImport.length;
          const batchId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const source: ImportSource = {
            batchId,
            fileName: fileName || 'File',
            sheetName: selectedSheet || 'Sheet',
            targetEntity: importTarget,
            rowCount: recordsToImport.length,
            importedAt: new Date().toISOString(),
            status: 'active',
            recordIds: (inserted as Array<{ id?: string }>).map((record) => String(record.id || '')).filter(Boolean),
          };
          const nextSources = [source, ...importSources];
          setImportSources(nextSources);
          saveImportSources(nextSources);
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
        // Check if we're in a multi-sheet workbook with unimported tabs
        const isMultiSheetWorkbook = isMultiSheet && selectedSheet;
        const unimportedSheets = isMultiSheetWorkbook
          ? sheetNames.filter(name => {
              const state = sheetStates[name];
              return state && !state.imported && state.headers?.length && !state.structuralWarning;
            })
          : [];

        if (isMultiSheetWorkbook && unimportedSheets.length > 0) {
          // Mark current sheet as imported, uncheck include toggle
          if (selectedSheet) {
            updateSheetState(selectedSheet, { imported: true, importedCount: imported, included: false });
          }
          // Switch to next unimported sheet
          const nextSheet = unimportedSheets[0];
          if (nextSheet) {
            switchSheet(nextSheet);
          }
          // Show success banner with remaining tabs info
          setSingleImportSuccess({ imported, sheetName: selectedSheet || '', remainingTabs: unimportedSheets });
          toast(`Imported ${imported} row(s) from ${selectedSheet}. ${unimportedSheets.length} tab(s) remaining — ready to import.`, 'success');
          window.dispatchEvent(new Event('ledgerly:data-updated'));
        } else {
          // Single file or all tabs imported - redirect to dashboard
          toast(`Imported ${imported} row(s).`, 'success');
          window.dispatchEvent(new Event('ledgerly:data-updated'));
          navigate('/app');
          setTimeout(() => window.dispatchEvent(new Event('ledgerly:data-updated')), 150);
        }
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
  function toggleDecline(source: ImportSource) {
    const nextStatus: ImportSource['status'] = source.status === 'active' ? 'declined' : 'active';
    const declined = loadDeclinedRecordIds();
    if (nextStatus === 'declined') source.recordIds.forEach((id) => declined.add(id));
    else source.recordIds.forEach((id) => declined.delete(id));
    saveDeclinedRecordIds(declined);
    const nextSources = importSources.map((item) => item.batchId === source.batchId ? { ...item, status: nextStatus } : item);
    setImportSources(nextSources);
    saveImportSources(nextSources);
    window.dispatchEvent(new Event('ledgerly:data-updated'));
  }
  function cancelImport() { if (!importing) setShowImportConfirm(false); }
  async function removeImport(source: ImportSource) {
    for (const id of source.recordIds) {
      try { await deleteEntity(source.targetEntity, id); } catch { /* continue */ }
    }
    const nextSources = importSources.filter((item) => item.batchId !== source.batchId);
    setImportSources(nextSources);
    saveImportSources(nextSources);
    const declined = loadDeclinedRecordIds();
    source.recordIds.forEach((id) => declined.delete(id));
    saveDeclinedRecordIds(declined);
    window.dispatchEvent(new Event('ledgerly:data-updated'));
  }

  useEffect(() => {
    if (!headers || !headers.length || !rows.length) { setDuplicateCount(0); return; }
    let cancelled = false;
    void (async () => {
      try {
        const existing = await listEntity(importTarget);
        const keys = new Set(existing.map((record) => recordDuplicateKey(importTarget, record as Record<string, unknown>)));
        let count = 0;
        for (const row of rows) {
          const record = mapRecord(importTarget, headers, row, mapping, user?.id);
          if (record && keys.has(recordDuplicateKey(importTarget, record as Record<string, unknown>))) count += 1;
        }
        if (!cancelled) {
          setDuplicateCount(count);
          // Also update sheet state if in multi-sheet mode
          if (selectedSheet && workbook) {
            updateSheetState(selectedSheet, { duplicateCount: count });
          }
        }
      } catch {
        if (!cancelled) {
          setDuplicateCount(0);
          if (selectedSheet && workbook) {
            updateSheetState(selectedSheet, { duplicateCount: 0 });
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [headers, rows, importTarget, mapping, user?.id, selectedSheet, workbook]);

  const isMultiSheet = sheetNames.length > 1 && workbook && fileFormat && (fileFormat === 'xlsx' || fileFormat === 'xls');
  const readySheetsCount = isMultiSheet ? sheetNames.filter(name => {
    const state = sheetStates[name];
    return state && state.mappingCompleteness?.isComplete && !state.structuralWarning && state.included;
  }).length : 0;

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
        <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#2d3748' }}>Import from file</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#718096' }}>Drag and drop a CSV, Excel, or JSON file (max 10 MB, 5,000 data rows). First row must be headers. Excel workbooks can contain multiple sheets.</p>
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
          {fileName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <p className="muted" style={{ margin: 0, fontSize: 11 }}>Selected: {fileName}</p>
              {isMultiSheet && (
                <button
                  type="button"
                  className="button button-ghost"
                  onClick={clearWorkbook}
                  style={{ fontSize: 11, padding: '4px 8px' }}
                >
                  Clear file
                </button>
              )}
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
        {sheetNames.length > 1 && workbook && fileFormat && (fileFormat === 'xlsx' || fileFormat === 'xls') && (
          <div style={{ marginTop: 14 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#2d3748' }}>Workbook sheets</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {sheetNames.map((name) => {
                const state = sheetStates[name];
                const isReady = state && state.mappingCompleteness?.isComplete && !state.structuralWarning && state.included;
                const rowCount = state?.rows?.length || 0;
                return (
                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      border: selectedSheet === name ? '2px solid #2db47a' : '1px solid #e8ebf1',
                      borderRadius: 8,
                      background: selectedSheet === name ? '#f2fbf7' : '#fff',
                      transition: 'all 0.15s',
                      minWidth: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={state?.included !== false}
                      onChange={(e) => {
                        if (state) updateSheetState(name, { included: e.target.checked });
                      }}
                      disabled={fileLoading || !state?.headers?.length}
                      style={{ accentColor: '#2db47a', width: 16, height: 16, flexShrink: 0 }}
                    />
                    <button
                      type="button"
                      onClick={() => switchSheet(name)}
                      disabled={fileLoading}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontSize: 11,
                        fontWeight: selectedSheet === name ? 600 : 400,
                        color: selectedSheet === name ? '#1e4d36' : '#3d4852',
                        cursor: fileLoading ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {name}
                    </button>
                    <span style={{ fontSize: 10, color: '#9aa4b2', whiteSpace: 'nowrap' }}>{rowCount} row{rowCount !== 1 ? 's' : ''}</span>
                    {state?.structuralWarning && (
                      <span style={{ fontSize: 9, color: '#f59e0b', background: '#fffbf0', padding: '2px 6px', borderRadius: 4 }}>Summary</span>
                    )}
                    {state?.headers?.length && !state?.structuralWarning && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: state.targetEntity ? '#eef7f1' : '#f0edff', color: state.targetEntity ? '#1e4d36' : '#5b3bd6' }}>
                        {state.targetEntity ? ENTITY_OPTIONS.find(o => o.value === state.targetEntity)?.label || state.targetEntity : '—'}
                      </span>
                    )}
                    {state?.headers?.length && !state?.structuralWarning && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: isReady ? '#f2fbf7' : '#fff5f5', color: isReady ? '#1e4d36' : '#c53030' }}>
                        {isReady ? 'Ready' : 'Needs mapping'}
                      </span>
                    )}
                    {state?.imported && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#f2fbf7', color: '#1e4d36' }}>
                        Imported ✓
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {fileError && <div className="notice" style={{ marginTop: 12, borderColor: '#e95f67' }}>{fileError}</div>}
        {structuralWarning && <div className="notice" style={{ marginTop: 12, borderColor: '#f59e0b' }}>{structuralWarning}</div>}
      </section>

      <section className="card" style={{ padding: 20, marginBottom: 18 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#2d3748' }}>Starter templates</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#718096' }}>Download a ready-to-use CSV template with headers and sample data for each entity type.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ENTITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="button button-secondary"
              onClick={() => downloadTemplate(option.value)}
              style={{ fontSize: 12 }}
            >
              Download {option.label} template
            </button>
          ))}
        </div>
      </section>

      {(fileLoading || (headers && headers.length > 0)) && (
        <section className="card" style={{ padding: 20, marginTop: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#2d3748' }}>Preview & map</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#718096' }}>{activeLabel}</p>
            </div>
            <span style={{ fontSize: 11, color: '#9aa4b2' }}>{headers ? `${rows.length} data row(s) available` : ''}</span>
          </div>

          {fileLoading ? (
            <p>Loading file…</p>
          ) : !headers || !headers.length ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', background: '#fafbfc', borderRadius: 10, border: '1px dashed #e8ebf1' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
              <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 500, color: '#3d4852' }}>No data to preview</p>
              <p style={{ margin: 0, fontSize: 12, color: '#718096' }}>This file appears empty or has no header row. Add column headers to the first row and try again.</p>
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: '#718096' }}>
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
                <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600, color: '#2d3748' }}>Map columns to Ledgerly fields</h3>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: '#718096' }}>Review the suggested matches and adjust as needed. Required fields are marked.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                  {ENTITY_OPTIONS.map((option) => {
                    const completeness = importTarget === option.value ? mappingComplete : getMappingCompleteness(option.value, headers || [], mapping);
                    const isActive = importTarget === option.value;
return (
                        <div
                          key={option.value}
                          style={{
                            border: isActive ? '2px solid #2db47a' : '1px solid #e8ebf1',
                            borderRadius: 10,
                            padding: '12px 14px',
                            background: isActive ? '#f2fbf7' : '#fff',
                            transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
                            boxShadow: isActive ? '0 0 0 3px rgba(45, 180, 122, 0.1)' : 'none',
                            minWidth: 0,
                          }}
                        >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#1e4d36' : '#3d4852' }}>{option.label}</label>
                          <input
                            type="radio"
                            name="import-target"
                            checked={isActive}
                            onChange={() => { 
                              setImportTarget(option.value); 
                              setMapping({}); 
                              setImportResult(null); 
                              setImportError(null);
                              // Update sheet state
                              if (selectedSheet && workbook) {
                                updateSheetState(selectedSheet, { 
                                  targetEntity: option.value, 
                                  mapping: {} 
                                });
                              }
                            }}
                            style={{ accentColor: '#2db47a' }}
                          />
                        </div>
                        {entityFields[option.value].map((field) => {
                          const required = requiredFields(option.value).includes(field);
                          const mappedHeader = mapping[field];
                          const isMapped = mappedHeader && (headers || []).includes(mappedHeader);
                          return (
                            <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                              <span style={{ fontSize: 11, color: '#677487', flex: '0 0 auto', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                                {field.replace(/_/g, ' ')}
                                {required && <span style={{ fontSize: 9, fontWeight: 700, color: '#e53e3e', background: '#fff5f5', padding: '1px 5px', borderRadius: 4 }}>Required</span>}
                              </span>
                              <select
                                className="form-select"
                                style={{ padding: '7px 10px', fontSize: 11, minWidth: 140, flex: 1, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                                value={mapping[field] || ''}
                                onChange={(e) => updateMapping(field, e.target.value)}
                                disabled={importTarget !== option.value}
                              >
                                <option value="">— Not mapped —</option>
                                {(headers || []).map((h, i) => (
                                  <option key={`${h}-${i}`} value={h}>{h || `Column ${i + 1}`}</option>
                                ))}
                              </select>
                              {isMapped && <span style={{ fontSize: 10, color: '#2db47a', fontWeight: 600 }}>Mapped</span>}
                            </div>
                          );
                        })}
                        {completeness && (
                          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e8ebf1', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                            <span style={{ color: completeness.isComplete ? '#2db47a' : '#e53e3e', fontWeight: 600 }}>
                              {completeness.isComplete ? '✓ Ready to import' : `${completeness.required}/${completeness.requiredTotal} required fields mapped`}
                            </span>
                            <span style={{ color: '#9aa4b2' }}>{completeness.mapped}/{completeness.total} fields matched</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {isMultiSheet && readySheetsCount > 0 ? (
                    <button className="button button-primary" onClick={confirmImportAll} disabled={importing || readySheetsCount === 0} style={{ fontWeight: 600 }}>
                      Import All Ready Sheets ({readySheetsCount})
                    </button>
                  ) : (
                    <button className="button button-primary" onClick={startImport} disabled={importing || !!structuralWarning || !mappingComplete?.isComplete} style={{ fontWeight: 600 }}>Import Data</button>
                  )}
                  <button className="button button-ghost" onClick={resetMapping}>Reset mapping</button>
                  {mappingError && <span style={{ fontSize: 11, color: '#e53e3e', background: '#fff5f5', padding: '4px 8px', borderRadius: 6 }}>{mappingError}</span>}
                  {headers && rows.length > 0 && (
                    <div style={{ width: '100%', marginTop: 8 }}>
                      <p style={{ margin: 0, fontSize: 11, color: '#718096' }}>
                        {Math.max(rows.length - duplicateCount, 0)} new row(s) and {duplicateCount} potential duplicate(s) detected.
                      </p>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11, color: '#556274' }}>
                        <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
                        Skip potential duplicates
                      </label>
                    </div>
                  )}
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
      {singleImportSuccess && (
        <div className="notice" style={{ marginTop: 18, borderColor: '#2db47a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <strong>Imported {singleImportSuccess.imported} row(s)</strong> from {singleImportSuccess.sheetName}.
            {singleImportSuccess.remainingTabs.length > 0 && (
              <> <br /> Remaining tabs: {singleImportSuccess.remainingTabs.join(', ')} — ready to import.</>
            )}
          </div>
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate('/app')}
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            View Dashboard →
          </button>
        </div>
      )}
      {importError && <div className="notice" style={{ marginTop: 18, borderColor: '#e95f67' }}>{importError}</div>}

      <section className="card" style={{ padding: 20, marginTop: 18 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#2d3748' }}>Imported spreadsheets</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#718096' }}>Review, re-activate, or remove past import batches.</p>
        {importSources.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', background: '#fafbfc', borderRadius: 10, border: '1px dashed #e8ebf1' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📥</div>
            <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 500, color: '#3d4852' }}>No import batches yet</p>
            <p style={{ margin: 0, fontSize: 12, color: '#718096' }}>Upload a file and import your first batch of data to see it here.</p>
          </div>
        ) : (
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {importSources.map((source) => (
              <div key={source.batchId} style={{ border: '1px solid #e8ebf1', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: source.status === 'declined' ? '#fffaf5' : '#fff' }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ fontSize: 13, color: '#2d3748' }}>{source.fileName} — {source.sheetName}</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#718096' }}>{source.targetEntity} · {source.rowCount} row(s) · {new Date(source.importedAt).toLocaleString()}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '4px 8px', borderRadius: 999, background: source.status === 'active' ? '#f2fbf7' : '#fff5f5', color: source.status === 'active' ? '#1e4d36' : '#c53030' }}>
                    {source.status === 'active' ? 'Active' : 'Declined'}
                  </span>
                  <button className="button button-ghost" onClick={() => toggleDecline(source)} style={{ fontSize: 11, fontWeight: 500 }}>{source.status === 'active' ? 'Decline' : 'Reactivate'}</button>
                  <button className="button button-ghost" onClick={() => void removeImport(source)} style={{ fontSize: 11, fontWeight: 500, color: '#e53e3e' }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showImportConfirm && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-labelledby="import-confirm-title" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <h3 id="import-confirm-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#2d3748' }}>Confirm import</h3>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#718096' }}>This will add data to your Ledgerly workspace.</p>
              </div>
              <button className="icon-button" onClick={cancelImport} aria-label="Close" disabled={importing}>&times;</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 400, overflow: 'auto' }}>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#556274' }}>
                Import <strong>{activeLabel}</strong> into <strong>{ENTITY_OPTIONS.find((o) => o.value === importTarget)?.label}</strong>.
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#718096' }}>
                Rows that do not match the required columns will be skipped. On success you will be redirected to the dashboard.
              </p>
              {hygieneSummary && (
                <div style={{ marginTop: 16, padding: 12, background: '#fafbfc', borderRadius: 8, border: '1px solid #e8ebf1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2d3748' }}>Pre-import hygiene check</span>
                    <button
                      type="button"
                      className="button button-ghost"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                      onClick={() => setShowHygieneDetails(!showHygieneDetails)}
                    >
                      {showHygieneDetails ? 'Hide details' : 'Show details'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                    <HygieneStat label="Blank required" value={hygieneSummary.warnings.blankRequired} color="#e53e3e" />
                    <HygieneStat label="Invalid dates" value={hygieneSummary.warnings.invalidDates} color="#f59e0b" />
                    <HygieneStat label="Invalid amounts" value={hygieneSummary.warnings.invalidAmounts} color="#c53030" />
                    <HygieneStat label="Duplicates" value={hygieneSummary.warnings.duplicates} color="#718096" />
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#718096' }}>
                    {hygieneSummary.rowsWithWarnings} of {hygieneSummary.totalRows} row(s) have warnings. Clean rows will import normally.
                  </p>
                  {showHygieneDetails && hygieneSummary.details.length > 0 && (
                    <div style={{ marginTop: 12, maxHeight: 200, overflow: 'auto' }}>
                      {hygieneSummary.details.slice(0, 50).map((d, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#556274', padding: '6px 8px', background: '#fff', border: '1px solid #e8ebf1', borderRadius: 6, marginBottom: 6 }}>
                          <strong>Row {d.rowIndex + 1}:</strong> {d.issues.join(', ')}
                        </div>
                      ))}
                      {hygieneSummary.details.length > 50 && (
                        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9aa4b2' }}>…and {hygieneSummary.details.length - 50} more rows with warnings</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="form-actions">
              <button className="button button-secondary" onClick={cancelImport} disabled={importing}>Cancel</button>
              <button className="button button-primary" onClick={() => void confirmImport()} disabled={importing} style={{ fontWeight: 600 }}>{importing ? 'Importing…' : 'Confirm import'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default GoogleSheetsPage;







