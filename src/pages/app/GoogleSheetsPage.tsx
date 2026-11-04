import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { listSpreadsheets, startGoogleConnection, disconnectGoogle } from '../../services/googleSheets';
import type { SpreadsheetFile, SpreadsheetListResult } from '../../types';

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
      setSelectedId(null);
      toast('Google connection removed.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to disconnect.', 'error');
    }
  }

  function selectSpreadsheet(file: SpreadsheetFile) {
    setSelectedId(file.id);
    toast(`Selected "${file.name}". Continue to import data.`, 'success');
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
    </main>
  );
}