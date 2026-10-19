import { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { listSpreadsheets, startGoogleConnection, disconnectGoogle } from '../../services/googleSheets';
import type { SpreadsheetFile } from '../../types';

export function GoogleSheetsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<SpreadsheetFile[]>([]);
  const [connecting, setConnecting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await listSpreadsheets();
      setFiles(result.files ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spreadsheets.');
      setFiles([]);
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
      toast('Google connection removed.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to disconnect.', 'error');
    }
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
      <section className="card" style={{ padding: 20 }}>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <>
            <p>{files.length} spreadsheet(s) available.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="button button-primary" onClick={() => void connect()} disabled={connecting}>
                {connecting ? 'Connecting...' : 'Connect Google'}
              </button>
              <button className="button" onClick={() => void disconnect()}>Disconnect</button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
