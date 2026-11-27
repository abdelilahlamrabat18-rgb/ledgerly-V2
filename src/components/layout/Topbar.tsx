import { Bell, Globe, Menu, Search, X, ChevronDown } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePreferences } from '../../context/PreferencesContext';
import type { SupportedLanguage } from '../../context/PreferencesContext';
import { initials } from '../../lib/utils';

const titles: Record<string, string> = { '/app': 'Dashboard', '/app/transactions': 'Transactions', '/app/analytics': 'Analytics', '/app/clients': 'Clients', '/app/invoices': 'Invoices', '/app/expenses': 'Expenses', '/app/orders': 'Orders', '/app/google-sheets': 'Data Import', '/app/settings': 'Settings' };

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const location = useLocation();
  const { isDemo, displayName } = useAuth();
  const { currency, language, setCurrency, setLanguage, supportedCurrencies, supportedLanguages, formatCurrency } = usePreferences();
  const name = isDemo ? 'Demo workspace' : displayName;
  const currentLang = supportedLanguages.find(l => l.code === language) || supportedLanguages[0];
  const currencyDisplayName = new Intl.DisplayNames(language as string, { type: 'currency' }).of(currency) || currency;

  const [openDropdown, setOpenDropdown] = useState<'currency' | 'language' | null>(null);
  const currencyWrapperRef = useRef<HTMLDivElement>(null);
  const languageWrapperRef = useRef<HTMLDivElement>(null);

  const closeDropdown = useCallback(() => setOpenDropdown(null), []);

  const toggleDropdown = useCallback((dropdown: 'currency' | 'language') => {
    setOpenDropdown(prev => prev === dropdown ? null : dropdown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (openDropdown === null) return;
      const target = e.target as Node;
      const wrapperRef = openDropdown === 'currency' ? currencyWrapperRef : languageWrapperRef;
      if (wrapperRef.current && !wrapperRef.current.contains(target)) {
        closeDropdown();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDropdown();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openDropdown, closeDropdown]);

  const handleCurrencySelect = (code: string) => {
    setCurrency(code);
    closeDropdown();
  };

  const handleLanguageSelect = (code: SupportedLanguage) => {
    setLanguage(code);
    closeDropdown();
  };

  const filteredCurrencies = supportedCurrencies.filter(code => {
    const displayName = new Intl.DisplayNames(language as string, { type: 'currency' }).of(code) || code;
    return true;
  });

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
          <div ref={currencyWrapperRef} style={{ position: 'relative' }}>
            <button
              className="icon-button"
              aria-label="Currency"
              aria-expanded={openDropdown === 'currency'}
              aria-haspopup="listbox"
              onClick={() => toggleDropdown('currency')}
              style={{ padding: 6, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Globe size={17} />
              <ChevronDown size={12} style={{ color: '#9aa4b2' }} />
            </button>
            {openDropdown === 'currency' && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 8,
                  background: '#fff',
                  border: '1px solid #e8ebf1',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(20,28,40,0.12)',
                  zIndex: 50,
                  minWidth: 220,
                  maxHeight: 280,
                  overflow: 'auto',
                }}
                role="listbox"
              >
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
                    const isActive = currency === code;
                    return (
                      <button
                        key={code}
                        data-currency={code}
                        onClick={() => handleCurrencySelect(code)}
                        role="option"
                        aria-selected={isActive}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          background: isActive ? '#f2fbf7' : 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: isActive ? '#1e4d36' : '#3d4852',
                          borderRadius: 6,
                          textAlign: 'left',
                          fontWeight: isActive ? 600 : 400,
                        }}
                      >
                        <span>{displayName}</span>
                        <span style={{ color: '#9aa4b2', fontSize: 10 }}>{code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div ref={languageWrapperRef} style={{ position: 'relative' }}>
            <button
              className="icon-button"
              aria-label="Language"
              aria-expanded={openDropdown === 'language'}
              aria-haspopup="listbox"
              onClick={() => toggleDropdown('language')}
              style={{ padding: 6, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: '#3d4852' }}>{currentLang.code.toUpperCase()}</span>
              <ChevronDown size={12} style={{ color: '#9aa4b2' }} />
            </button>
            {openDropdown === 'language' && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 8,
                  background: '#fff',
                  border: '1px solid #e8ebf1',
                  borderRadius: 8,
                  boxShadow: '0 8px 24px rgba(20,28,40,0.12)',
                  zIndex: 50,
                  minWidth: 160,
                }}
                role="listbox"
              >
                {supportedLanguages.map(lang => {
                  const isActive = language === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageSelect(lang.code)}
                      role="option"
                      aria-selected={isActive}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: isActive ? '#f2fbf7' : 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: isActive ? '#1e4d36' : '#3d4852',
                        borderRadius: 6,
                        textAlign: 'left',
                        fontWeight: isActive ? 600 : 400,
                        borderTop: lang.code === supportedLanguages[0].code ? 'none' : '1px solid #f0f2f5',
                      }}
                    >
                      <span>{lang.nativeName}</span>
                      <span style={{ color: '#9aa4b2', fontSize: 10 }}>{lang.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
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
