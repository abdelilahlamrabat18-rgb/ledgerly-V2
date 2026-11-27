import { Bell, Globe, Menu, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import { initials } from '../../lib/utils';

const titles: Record<string, string> = { '/app': 'Dashboard', '/app/transactions': 'Transactions', '/app/analytics': 'Analytics', '/app/clients': 'Clients', '/app/invoices': 'Invoices', '/app/expenses': 'Expenses', '/app/orders': 'Orders', '/app/google-sheets': 'Data Import', '/app/settings': 'Settings' };

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const location = useLocation();
  const { isDemo, displayName } = useAuth();
  const { currency, language, setCurrency, setLanguage, supportedCurrencies, supportedLanguages, formatCurrency } = usePreferences();
  const name = isDemo ? 'Demo workspace' : displayName;
  const currentLang = supportedLanguages.find(l => l.code === language) || supportedLanguages[0];
  const currencyDisplayName = new Intl.DisplayNames(language, { type: 'currency' }).of(currency) || currency;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
        <span className="eyebrow" style={{ margin: 0 }}>{titles[location.pathname] || 'Workspace'}</span>
        <div className="search-box"><Search size={15} /><input aria-label="Search workspace" placeholder="Search anything..." /></div>
      </div>
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Notifications"><Bell size={17} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <button className="icon-button" aria-label="Currency" onClick={() => {}} style={{ padding: 6 }}>
              <Globe size={17} />
            </button>
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: '#fff', border: '1px solid #e8ebf1', borderRadius: 8, boxShadow: '0 8px 24px rgba(20,28,40,0.12)', zIndex: 50, minWidth: 220, maxHeight: 280, overflow: 'auto' }}>
              <div style={{ padding: 8 }}>
                <input
                  type="text"
                  placeholder="Search currencies..."
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e8ebf1', borderRadius: 6, fontSize: 12, marginBottom: 8, outline: 'none' }}
                  onInput={(e) => {
                    const filter = (e.target as HTMLInputElement).value.toLowerCase();
                    const items = document.querySelectorAll('[data-currency]');
                    items.forEach(item => {
                      const code = (item as HTMLElement).dataset.currency || '';
                      const name = (item as HTMLElement).textContent || '';
                      (item as HTMLElement).style.display = code.toLowerCase().includes(filter) || name.toLowerCase().includes(filter) ? 'flex' : 'none';
                    });
                  }}
                />
                {supportedCurrencies.map(code => {
                  const displayName = new Intl.DisplayNames(language, { type: 'currency' }).of(code) || code;
                  return (
                    <button
                      key={code}
                      data-currency={code}
                      onClick={() => setCurrency(code)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#3d4852', borderRadius: 6, textAlign: 'left' }}
                    >
                      <span>{displayName}</span>
                      <span style={{ color: '#9aa4b2', fontSize: 10 }}>{code}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <button className="icon-button" aria-label="Language" onClick={() => {}} style={{ padding: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#3d4852' }}>{currentLang.code.toUpperCase()}</span>
            </button>
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: '#fff', border: '1px solid #e8ebf1', borderRadius: 8, boxShadow: '0 8px 24px rgba(20,28,40,0.12)', zIndex: 50, minWidth: 160 }}>
              {supportedLanguages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#3d4852', borderRadius: 6, textAlign: 'left', borderTop: lang.code === supportedLanguages[0].code ? 'none' : '1px solid #f0f2f5' }}
                >
                  <span>{lang.nativeName}</span>
                  <span style={{ color: '#9aa4b2', fontSize: 10 }}>{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="topbar-profile">
          <span className="avatar">{initials(name)}</span>
          <span className="topbar-profile-name">{name}</span>
        </div>
      </div>
    </header>
  );
}
