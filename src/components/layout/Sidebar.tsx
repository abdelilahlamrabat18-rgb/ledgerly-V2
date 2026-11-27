import { Activity, ArrowLeftRight, BriefcaseBusiness, FileSpreadsheet, FileText, LayoutDashboard, LogOut, Package, Receipt, Settings, X, AlertTriangle, ChevronRight } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useBilling } from '../../context/BillingContext';
import { useToast } from '../../context/ToastContext';
import { usePreferences } from '../../context/PreferencesContext';
import { initials } from '../../lib/utils';
import { BrandLogo } from '../../components/BrandLogo';

const navItems = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/app/analytics', label: 'Analytics', icon: Activity },
  { to: '/app/clients', label: 'Clients', icon: BriefcaseBusiness },
  { to: '/app/invoices', label: 'Invoices', icon: FileText },
  { to: '/app/expenses', label: 'Expenses', icon: Receipt },
  { to: '/app/orders', label: 'Orders', icon: Package },
  { to: '/app/google-sheets', label: 'Data Import', icon: FileSpreadsheet },
];

function getTrialMessage(language: string, days: number | null, isExpired: boolean): string {
  if (isExpired) {
    switch (language) {
      case 'fr': return 'Votre essai a expiré. Mettez à niveau pour continuer.';
      case 'ar': return 'انتهت فترة تجربتك. قم بالترقية للمتابعة.';
      default: return 'Your trial has expired. Upgrade to continue.';
    }
  }
  if (days === null) return '';
  switch (language) {
    case 'fr': return `Essai gratuit — ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`;
    case 'ar': return `تجربة مجانية — ${days} ${days === 1 ? 'يوم' : 'أيام'} متبق${days === 1 ? 'ي' : 'ون'}`;
    default: return `Free trial — ${days} day${days > 1 ? 's' : ''} left`;
  }
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut, isDemo, displayName } = useAuth();
  const { trialActive, isPaid, trialDaysRemaining, trialEnd } = useBilling();
  const { language } = usePreferences();
  const { toast } = useToast();
  const navigate = useNavigate();
  const name = isDemo ? 'Demo workspace' : displayName;
  const isTrialExpired = trialEnd !== null && trialDaysRemaining === 0;
  const trialMessage = getTrialMessage(language, trialDaysRemaining, isTrialExpired);
  async function handleSignOut() {
    const result = await signOut();
    if (result.error) toast(result.error.message, 'error');
  }
  return <aside className={`app-sidebar ${open ? 'open' : ''}`}>
    <button className="icon-button mobile-menu" onClick={onClose} aria-label="Close navigation"><X size={20} /></button>
    <div className="brand flex items-center gap-2.5">
      <BrandLogo size={20} aria-hidden="true" />
      <span className="whitespace-nowrap">Ledgerly</span>
    </div>
    {!isDemo && !isPaid && trialEnd !== null && (
      <div className="trial-banner" style={{
        padding: '10px 12px',
        margin: '0 8px 16px',
        borderRadius: 8,
        background: isTrialExpired ? '#fef2f2' : '#fefce8',
        border: isTrialExpired ? '1px solid #fecaca' : '1px solid #fde047',
        color: isTrialExpired ? '#c53030' : '#b45309',
        fontSize: 12,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14 }}>{isTrialExpired ? '⚠' : '⏱'}</span>
          <span>{trialMessage}</span>
        </div>
        <NavLink
          to="/app/billing"
          className="button"
          style={{
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            background: isTrialExpired ? '#c53030' : '#f59b64',
            color: '#fff',
            borderRadius: 6,
            whiteSpace: 'nowrap',
          }}
          onClick={onClose}
        >
          {isTrialExpired ? 'Upgrade now' : 'Upgrade'}
        </NavLink>
      </div>
    )}
    <p className="nav-label">Workspace</p>
    <nav className="nav-list">
      {navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}><Icon /><span>{label}</span></NavLink>)}
    </nav>
    <p className="nav-label" style={{ marginTop: 30 }}>Account</p>
    <nav className="nav-list"><NavLink to="/app/billing" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}><Receipt /><span>Billing</span></NavLink><NavLink to="/app/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={onClose}><Settings /><span>Settings</span></NavLink></nav>
    <div className="sidebar-bottom">
      <div className="connection-mini"><span className="connection-dot" /><span>{isDemo ? 'Demo data enabled' : isPaid ? 'Active subscription' : trialActive ? 'Trial active' : 'Workspace secure'}</span></div>
      <div className="sidebar-user"><span className="avatar">{initials(name)}</span><div style={{ minWidth: 0, flex: 1 }}><strong>{name}</strong><span>{isDemo ? 'Preview workspace' : user?.email || 'Account'}</span></div><button className="icon-button" onClick={() => { void handleSignOut(); }} aria-label="Sign out"><LogOut size={15} /></button></div>
    </div>
  </aside>;
}
