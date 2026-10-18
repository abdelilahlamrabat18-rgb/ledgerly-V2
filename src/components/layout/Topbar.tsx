import { Bell, Menu, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../lib/utils';

const titles: Record<string, string> = { '/app': 'Dashboard', '/app/transactions': 'Transactions', '/app/analytics': 'Analytics', '/app/clients': 'Clients', '/app/invoices': 'Invoices', '/app/expenses': 'Expenses', '/app/orders': 'Orders', '/app/google-sheets': 'Google Sheets', '/app/settings': 'Settings' };

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const location = useLocation(); const { isDemo, displayName } = useAuth();
  const name = isDemo ? 'Demo workspace' : displayName;
  return <header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button><span className="eyebrow" style={{ margin: 0 }}>{titles[location.pathname] || 'Workspace'}</span><div className="search-box"><Search size={15} /><input aria-label="Search workspace" placeholder="Search anything..." /></div></div><div className="topbar-actions"><button className="icon-button" aria-label="Notifications"><Bell size={17} /></button><div className="topbar-profile"><span className="avatar">{initials(name)}</span><span className="topbar-profile-name">{name}</span></div></div></header>;
}
