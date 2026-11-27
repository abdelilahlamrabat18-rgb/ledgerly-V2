import { Bell, Building2, Check, Globe, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { useToast } from '../../context/ToastContext';

export function SettingsPage() {
  const { user, isDemo, displayName, profile, profileLoading, profileError, updateProfile } = useAuth();
  const { currency, language, setCurrency, setLanguage, supportedCurrencies, supportedLanguages } = usePreferences();
  const { toast } = useToast();
  const [name, setName] = useState(displayName === 'Welcome' ? '' : displayName);
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [currencySearch, setCurrencySearch] = useState('');
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);

  useEffect(() => {
    if (!profileLoading) {
      setName(profile?.name || displayName || '');
      setBusinessName(profile?.business_name || '');
    }
  }, [displayName, profile, profileLoading]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const result = await updateProfile({ name: name.trim() || null, business_name: businessName.trim() || null });
    setSaving(false);
    if (result.error) toast(result.error.message, 'error');
    else toast('Settings saved.');
  }

  const filteredCurrencies = supportedCurrencies.filter(code => {
    const displayName = new Intl.DisplayNames(language, { type: 'currency' }).of(code) || code;
    return code.toLowerCase().includes(currencySearch.toLowerCase()) || displayName.toLowerCase().includes(currencySearch.toLowerCase());
  });

  const currentLang = supportedLanguages.find(l => l.code === language) || supportedLanguages[0];
  const currencyDisplayName = new Intl.DisplayNames(language, { type: 'currency' }).of(currency) || currency;

  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Make Ledgerly feel like it belongs to your business.</p>
        </div>
      </div>
      {profileError && <div className="notice" style={{ marginBottom: 18 }}>We couldn't load your saved profile details. You can still edit and retry saving them.</div>}
      <div className="google-layout">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Profile & business</h2>
              <p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>This is how your workspace identifies you.</p>
            </div>
          </div>
          <form style={{ padding: 20 }} onSubmit={(event) => void save(event)}>
            <div className="form-grid">
              <label className="form-field full"><span className="form-label">Your name</span><input className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
              <label className="form-field full"><span className="form-label">Email address</span><div style={{ position: 'relative' }}><Mail size={14} style={{ position: 'absolute', left: 11, top: 11, color: '#9ca5b1' }} /><input className="form-input" style={{ paddingLeft: 32, color: '#8c97a6' }} value={user?.email || (isDemo ? 'Demo workspace' : '')} disabled /></div></label>
              <label className="form-field full"><span className="form-label">Business name</span><input className="form-input" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Your business name" /></label>
            </div>
            <div className="form-actions"><button className="button button-primary" disabled={saving || profileLoading}>{saving ? 'Saving...' : <><Check size={14} /> Save changes</>}</button></div>
          </form>
        </section>
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Preferences</h2>
              <p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>Choose your currency, language, and notification settings.</p>
            </div>
          </div>
          <div style={{ padding: '3px 20px 12px' }}>
            <div className="settings-list">
              <div className="settings-row">
                <div className="settings-row-icon"><Globe size={14} /></div>
                <div className="settings-row-copy"><strong>Currency</strong><span>All amounts displayed in this currency.</span></div>
                <div style={{ position: 'relative' }}>
                  <button className="button button-secondary" onClick={() => setShowCurrencyMenu(!showCurrencyMenu)} style={{ minWidth: 180 }}>
                    {currencyDisplayName} <span style={{ color: '#9aa4b2', fontSize: 10, marginLeft: 8 }}>{currency}</span>
                  </button>
                  {showCurrencyMenu && <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: 8, background: '#fff', border: '1px solid #e8ebf1', borderRadius: 8, boxShadow: '0 -8px 24px rgba(20,28,40,0.12)', zIndex: 50, minWidth: 280, maxHeight: 320, overflow: 'auto' }}>
                    <div style={{ padding: 8 }}>
                      <input
                        type="text"
                        placeholder="Search currencies..."
                        value={currencySearch}
                        onChange={(e) => setCurrencySearch(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8ebf1', borderRadius: 6, fontSize: 12, marginBottom: 8, outline: 'none' }}
                      />
                      {filteredCurrencies.map(code => {
                        const displayName = new Intl.DisplayNames(language, { type: 'currency' }).of(code) || code;
                        return (
                          <button
                            key={code}
                            onClick={() => { setCurrency(code); setShowCurrencyMenu(false); setCurrencySearch(''); }}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: currency === code ? '#f2fbf7' : 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: currency === code ? '#1e4d36' : '#3d4852', borderRadius: 6, textAlign: 'left' }}
                          >
                            <span>{displayName}</span>
                            <span style={{ color: '#9aa4b2', fontSize: 10 }}>{code}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>}
                </div>
              </div>
              <div className="settings-row">
                <div className="settings-row-icon"><Globe size={14} /></div>
                <div className="settings-row-copy"><strong>Language</strong><span>Interface language and formatting.</span></div>
                <select className="filter-select" value={language} onChange={(e) => setLanguage(e.target.value as 'en' | 'fr' | 'ar')} style={{ minWidth: 180 }}>
                  {supportedLanguages.map(lang => <option key={lang.code} value={lang.code}>{lang.nativeName} ({lang.name})</option>)}
                </select>
              </div>
              <div className="settings-row">
                <div className="settings-row-icon"><Bell size={14} /></div>
                <div className="settings-row-copy"><strong>Activity updates</strong><span>Show helpful activity notifications.</span></div>
                <button type="button" className={`toggle ${notifications ? 'on' : ''}`} onClick={() => setNotifications(!notifications)} aria-label="Toggle activity updates" />
              </div>
              <div className="settings-row">
                <div className="settings-row-icon"><Building2 size={14} /></div>
                <div className="settings-row-copy"><strong>Workspace mode</strong><span>{isDemo ? 'Preview data · local only' : 'Live Supabase workspace'}</span></div>
                <span style={{ color: '#2db47a', fontSize: 10, fontWeight: 800 }}>{isDemo ? 'Preview' : 'Active'}</span>
              </div>
              <div className="settings-row">
                <div className="settings-row-icon"><LockKeyhole size={14} /></div>
                <div className="settings-row-copy"><strong>Data protection</strong><span>Database policies restrict records to your account.</span></div>
                <span style={{ color: '#2db47a', fontSize: 10, fontWeight: 800 }}>On</span>
              </div>
            </div>
          </div>
        </section>
      </div>
      <section className="card" style={{ marginTop: 18 }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Account security</h2>
            <p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>Your password and sign-in settings are managed by Supabase Auth.</p>
          </div>
          <UserRound size={17} color="#9ba5b3" />
        </div>
        <div style={{ padding: 20 }}>
          <p style={{ margin: 0, color: '#667385', fontSize: 12, lineHeight: 1.6 }}>Use the password reset flow from the sign-in page if you need to change your password. Sessions are persisted and can be revoked by signing out.</p>
        </div>
      </section>
    </main>
  );
}