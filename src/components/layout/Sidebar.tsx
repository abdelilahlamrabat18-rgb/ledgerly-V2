import { Activity, ArrowLeftRight, BarChart3, BriefcaseBusiness, FileSpreadsheet, FileText, LayoutDashboard, LogOut, Package, Receipt, Settings, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { initials } from '../../lib/utils';

const navItems = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/app/analytics', label: 'Analytics', icon: Activity },
  { to: '/app/clients', label: 'Clients', icon: BriefcaseBusiness },
  { to: '/app/invoices', label: 'Invoices', icon: FileText },
  { to: '/app/expenses', label: 'Expenses', icon: Receipt },
  { to: '/app/orders', label: 'Orders', icon: Package },
  { to: '/app/google-sheets', label: 'Google Sheets', icon: FileSpreadsheet },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut, isDemo, displayName } = useAuth();
  const { toast } = useToast();
  const name = isDemo ? 'Demo workspace' : displayName;
  async function handleSignOut() {
    const result = await signOut();
    if (result.error) toast(result.error.message, 'error');
  }
  return <aside className={`app-sidebar ${open ? 'open' : ''}`}>
    <button className="icon-button mobile-menu" onClick={onClose} aria-label="Close navigation"><X size={20} /></button>
    <div className="brand"><span className="brand-mark"><BarChart3 size={17} /></span><span>ledgerly</span></div>
    <p className="nav-label">Workspace</p>
    <nav className="nav-list">
      {navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}><Icon /><span>{label}</span></NavLink>)}
    </nav>
    <p className="nav-label" style={{ marginTop: 30 }}>Account</p>
    <nav className="nav-list"><NavLink to="/app/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}><Settings /><span>Settings</span></NavLink></nav>
    <div className="sidebar-bottom">
      <div className="connection-mini"><span className="connection-dot" /><span>{isDemo ? 'Demo data enabled' : 'Workspace secure'}</span></div>
      <div className="sidebar-user"><span className="avatar">{initials(name)}</span><div style={{ minWidth: 0, flex: 1 }}><strong>{name}</strong><span>{isDemo ? 'Preview workspace' : user?.email || 'Account'}</span></div><button className="icon-button" onClick={() => { void handleSignOut(); }} aria-label="Sign out"><LogOut size={15} /></button></div>
    </div>
  </aside>;
}
