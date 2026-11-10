import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { listSpreadsheets, startGoogleConnection, disconnectGoogle, listTabs, previewSheet, syncSheet } from '../../services/googleSheets';
import type { SpreadsheetFile, SpreadsheetListResult, SpreadsheetTab, SheetPreview, EntityName } from '../../types';
import { entityFields } from '../../services/dataService';

const ENTITY_OPTIONS: { value: EntityName; label: string }[] = [
  { value: 'clients', label: 'Clients' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'orders', label: 'Orders' },
];

let requestCounter = 0;
let activeRequestId = 0;

export function GoogleSheetsPage() {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<SpreadsheetFile[]>([]);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [tabs, setTabs] = useState<SpreadsheetTab[] | null>(null);
  const [tabsError, setTabsError] = useState<string | null>(null);
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [preview, setPreview] = useState<SheetPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importTarget, setImportTarget] = useState<EntityName>('clients');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped?: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const connected = params.get('connected');
    const oauthError = params.get('error');
    if (connected === 'true') {
      navigate('/app/google-sheets', { replace: true });
      toast('Google account connected successfully.', 'success');
    }
    if (oauthError) {
      const messages: Record<string, string> = {
        access_denied: 'Google authorization was denied.',
        redirect_uri_mismatch: 'Google redirect URI mismatch. Contact support.',
        authorization_failed: 'Google authorization failed.',
        invalid_authorization: 'Invalid OAuth state. Please try again.',
        expired_authorization: 'OAuth state expired. Please try again.',
        token_exchange_failed: 'Token exchange failed. Please try again.',
        connection_failed: 'Connection failed. Please try again.',
        configuration_missing: 'Google Sheets is not configured.',
      };
      toast(messages[oauthError] || 'Connection failed.', 'error');
      navigate('/app/google-sheets', { replace: true });
    }
  }, [location.search, navigate, toast]);

  async function load(pageToken?: string) {
    setLoading(true);
    setError(null);
    try {
      const result: SpreadsheetListResult = await listSpreadsheets(pageToken);
      setFiles(pageToken ? (prev: SpreadsheetFile[]) => [...prev, ...result.files] : (result.files ?? []));
      setConnectedEmail(result.connectedEmail ?? null);
      setNextPageToken(result.nextPageToken ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load spreadsheets.';
      setError(message);
      if (pageToken) {
        // Keep previously loaded spreadsheets on pagination failure.
      } else {
        setFiles([]);
      }
      if (/authorization|token|reconnect/i.test(message)) {
        toast('Your Google authorization has expired. Please reconnect.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function connect() {
    setConnecting(true);
    try {
      await startGoogleConnection();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to start Google connection.', 'error');
      setConnecting(false);
    }
  }

  async function disconnect() {
    try {
      await disconnectGoogle();
      setFiles([]);
      setConnectedEmail(null);
      setNextPageToken(null);
      resetSelection();
      toast('Google connection removed.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to disconnect.', 'error');
    }
  }

  function resetSelection() {
    setSelectedId(null);
    setSelectedName(null);
    setTabs(null);
    setTabsError(null);
    setLoadingTabs(false);
    setSelectedTab(null);
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(false);
    setImportTarget('clients');
    setMapping({});
    setImportResult(null);
    setImportError(null);
    setShowImportConfirm(false);
  }

  function selectSpreadsheet(file: SpreadsheetFile) {
    const requestId = ++requestCounter;
    activeRequestId = requestId;
    setSelectedId(file.id);
    setSelectedName(file.name);
    setTabs(null);
    setTabsError(null);
    setLoadingTabs(true);
    setSelectedTab(null);
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(false);
    setImportResult(null);
    setImportError(null);
    setShowImportConfirm(false);
    setImportTarget('clients');
    setMapping({});
    toast(`Selected "${file.name}".`, 'success');
    console.log('[ledgerly][diag] selectSpreadsheet start:', { fileId: file.id, fileName: file.name });
    void (async () => {
      try {
        console.log('[ledgerly][diag] calling listTabs:', { spreadsheetIdPresent: Boolean(file.id) });
        const result = await listTabs(file.id);
        console.log('[ledgerly][diag] listTabs resolved:', { tabCount: (result.sheets ?? []).length });
        if (requestId !== activeRequestId) return;
        setTabs(result.sheets ?? []);
      } catch (err) {
        if (requestId !== activeRequestId) return;
        console.log('[ledgerly][diag] listTabs error:', { error: err instanceof Error ? err.message : String(err) });
        setTabsError(err instanceof Error ? err.message : 'Could not load sheet tabs.');
        setTabs([]);
      } finally {
        if (requestId === activeRequestId) setLoadingTabs(false);
      }
    })();
  }

  function selectTab(tab: SpreadsheetTab) {
    const requestId = ++requestCounter;
    activeRequestId = requestId;
    setSelectedTab(tab.title);
    setPreview(null);
    setPreviewError(null);
    setLoadingPreview(true);
    setImportResult(null);
    setImportError(null);
    setShowImportConfirm(false);
    void (async () => {
      try {
        const result = await previewSheet(selectedId ?? '', tab.title);
        if (requestId !== activeRequestId) return;
        setPreview(result);
      } catch (err) {
        if (requestId !== activeRequestId) return;
        setPreviewError(err instanceof Error ? err.message : 'Could not preview this sheet.');
        setPreview(null);
      } finally {
        if (requestId === activeRequestId) setLoadingPreview(false);
      }
    })();
  }

  function updateMapping(header: string, field: string) {
    setMapping((prev) => {
      const next: Record<string, string> = {};
      for (const key of Object.keys(prev)) {
        if (prev[key] === header && key !== field) next[key] = '';
        else next[key] = prev[key];
      }
      next[field] = header;
      return next;
    });
  }

  function clearMapping(header: string) {
    setMapping((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key] === header) next[key] = '';
      }
      return next;
    });
  }

  function isMappingComplete() {
    const required = entityFields[importTarget];
    return required.every((field) => Boolean((mapping[field] || '').trim()));
  }

  function startImport() {
    if (!isMappingComplete()) {
      setImportError('Map every required spreadsheet column before importing.');
      return;
    }
    setImportError(null);
    setImportResult(null);
    setShowImportConfirm(true);
  }

  async function confirmImport() {
    if (!selectedId || !selectedName || !selectedTab) return;
    if (!isMappingComplete()) {
      setImportError('Map every required spreadsheet column before importing.');
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await syncSheet({
        spreadsheetId: selectedId,
        spreadsheetName: selectedName,
        sheetName: selectedTab,
        target: importTarget,
        mapping,
      });
      setImportResult(result);
      toast(`Imported ${result.imported} row(s).`, 'success');
      window.dispatchEvent(new CustomEvent('ledgerly:data-updated'));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed.');
      toast(err instanceof Error ? err.message : 'Import failed.', 'error');
    } finally {
      setImporting(false);
      setShowImportConfirm(false);
    }
  }

  function cancelImport() {
    if (importing) return;
    setShowImportConfirm(false);
  }

  function goBack() {
    resetSelection();
    setSelectedId(null);
    setSelectedName(null);
  }
  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Integrations</p>
          <h1 className="page-title">Google Sheets</h1>
          <p className="page-subtitle">Connect your Google account to import spreadsheet data.</p>
        </div>
      </div>
      {error && <div className="notice" style={{ marginBottom: 18 }}>{error}</div>}
      {connectedEmail && (
        <div className="notice" style={{ marginBottom: 18, borderColor: '#2db47a' }}>
          Connected Google account: <strong>{connectedEmail}</strong>
        </div>
      )}
      <section className="card" style={{ padding: 20 }}>
        {loading ? (
          <p>Loading spreadsheets…</p>
        ) : files.length === 0 ? (
          <div className="empty-state">
            <p>No Google Sheets spreadsheets found.</p>
            <p className="muted">Create a spreadsheet in Google Drive, then connect another account, or start with a blank sheet.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="button button-primary" onClick={() => void connect()} disabled={connecting}>
                {connecting ? 'Connecting...' : 'Connect Google'}
              </button>
              <button className="button" onClick={() => void disconnect()}>Disconnect</button>
            </div>
          </div>
        ) : (
          <div className="sheet-list">
            <p style={{ marginTop: 0 }}>{files.length} spreadsheet(s) available.</p>
            <ul className="sheet-list-items" style={{ listStyle: 'none', padding: 0, margin: '12px 0' }}>
              {files.map((file) => (
                <li key={file.id} style={{ marginBottom: 8 }}>
                  <button
                    className={`button ${selectedId === file.id ? 'button-primary' : 'button'}`}
                    onClick={() => selectSpreadsheet(file)}
                    style={{ width: '100%', justifyContent: 'flex-start' }}
                  >
                    <span>{file.name}</span>
                    {file.modifiedTime && <span className="muted" style={{ marginLeft: 8, fontSize: 11 }}>{new Date(file.modifiedTime).toLocaleDateString()}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="button button-primary" onClick={() => void connect()} disabled={connecting}>
                {connecting ? 'Connecting...' : 'Connect Google'}
              </button>
              <button className="button" onClick={() => void disconnect()}>Disconnect</button>
              {nextPageToken && (
                <button className="button" onClick={() => void load(nextPageToken)} disabled={loading}>
                  Load more
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {selectedId && selectedName && (
        <section className="card" style={{ padding: 20, marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Selected spreadsheet</p>
              <h3 style={{ margin: '4px 0 0', fontSize: 15 }}>{selectedName}</h3>
            </div>
            <button className="button button-ghost" onClick={goBack}>Choose another spreadsheet</button>
          </div>

          {loadingTabs ? (
            <p>Loading sheet tabs…</p>
          ) : tabsError ? (
            <div className="notice" style={{ borderColor: '#e95f67' }}>{tabsError}</div>
          ) : tabs && tabs.length === 0 ? (
            <p className="muted">This spreadsheet has no tabs. Add a sheet and try again.</p>
          ) : (
            <div>
              <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>Select a tab to preview its contents.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tabs?.map((tab) => (
                  <button
                    key={tab.id}
                    className={`button ${selectedTab === tab.title ? 'button-primary' : 'button-secondary'}`}
                    onClick={() => selectTab(tab)}
                    disabled={loadingPreview}
                  >
                    {tab.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
      {selectedTab && (
        <section className="card" style={{ padding: 20, marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Preview</p>
              <h3 style={{ margin: '4px 0 0', fontSize: 15 }}>{selectedTab}</h3>
            </div>
            <span className="muted" style={{ fontSize: 11 }}>{preview ? `${preview.totalRows} data row(s) available` : ''}</span>
          </div>

          {loadingPreview ? (
            <p>Loading preview…</p>
          ) : previewError ? (
            <div className="notice" style={{ borderColor: '#e95f67' }}>{previewError}</div>
          ) : !preview || !preview.headers.length ? (
            <div className="empty-state">
              <p>This sheet is empty or has no header row.</p>
              <p className="muted">Add column headers to the top row of the sheet, then preview again.</p>
            </div>
          ) : (
            <div>
              <p className="muted" style={{ marginTop: 0, marginBottom: 10, fontSize: 11 }}>
                Showing a preview of the first {preview.rows.length} row(s). Map your columns, then import the full sheet.
              </p>
              <div className="table-scroll" style={{ border: '1px solid #e8ebf1', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      {preview.headers.map((header, index) => (
                        <th key={`${header}-${index}`}>{header || `Column ${index + 1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`}>
                        {preview.headers.map((header, colIndex) => (
                          <td key={`cell-${rowIndex}-${colIndex}`}>{row[colIndex] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 18 }}>
                <p className="muted" style={{ marginTop: 0, marginBottom: 10, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  Map spreadsheet columns to Ledgerly fields
                </p>
                <p className="muted" style={{ marginTop: 0, marginBottom: 12, fontSize: 11 }}>
                  Select which spreadsheet column supplies each required field. Leave unmapped fields blank.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {ENTITY_OPTIONS.map((option) => (
                    <div key={option.value} style={{ border: '1px solid #e8ebf1', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#556274' }}>{option.label}</label>
                        <input
                          type="radio"
                          name={`entity-${option.value}`}
                          checked={importTarget === option.value}
                          onChange={() => { setImportTarget(option.value); setMapping({}); setImportResult(null); setImportError(null); }}
                        />
                      </div>
                      {entityFields[option.value].map((field) => (
                        <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          <label style={{ fontSize: 10, color: '#677487', flex: '0 0 auto', whiteSpace: 'nowrap' }}>{field}</label>
                          <select
                            className="form-select"
                            style={{ padding: '6px 8px', fontSize: 10 }}
                            value={mapping[field] || ''}
                            onChange={(event) => updateMapping(event.target.value, field)}
                          >
                            <option value="">— Not mapped —</option>
                            {preview.headers.map((header, index) => (
                              <option key={`${header}-${index}`} value={header}>{header || `Column ${index + 1}`}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button className="button button-primary" onClick={startImport} disabled={importing || !isMappingComplete()}>
                    Import Data
                  </button>
                  <button className="button button-ghost" onClick={() => { setMapping({}); setImportResult(null); setImportError(null); }}>Reset mapping</button>
                  {!isMappingComplete() && <span className="muted" style={{ fontSize: 11 }}>Map every required column before importing.</span>}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {importResult && (
        <div className="notice" style={{ marginTop: 18, borderColor: '#2db47a' }}>
          Import complete: <strong>{importResult.imported}</strong> row(s) imported
          {typeof importResult.skipped === 'number' ? ` and <strong>{importResult.skipped}</strong> row(s) skipped` : ''}.
        </div>
      )}
      {importError && (
        <div className="notice" style={{ marginTop: 18, borderColor: '#e95f67' }}>{importError}</div>
      )}
      {showImportConfirm && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-labelledby="import-confirm-title">
            <div className="modal-header">
              <div>
                <h3 id="import-confirm-title" className="modal-title">Confirm import</h3>
                <p className="modal-subtitle">This will push spreadsheet data into your Ledgerly workspace.</p>
              </div>
              <button className="icon-button" onClick={cancelImport} aria-label="Close" disabled={importing}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: '#556274' }}>
                Import <strong>{selectedName}</strong> from the <strong>{selectedTab}</strong> tab into <strong>{ENTITY_OPTIONS.find((option) => option.value === importTarget)?.label}</strong>.
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#718096' }}>
                Rows that do not match the required columns will be skipped. This action cannot be undone automatically.
              </p>
            </div>
            <div className="form-actions">
              <button className="button button-secondary" onClick={cancelImport} disabled={importing}>Cancel</button>
              <button className="button button-primary" onClick={confirmImport} disabled={importing}>
                {importing ? 'Importing…' : 'Confirm import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
export default GoogleSheetsPage;




