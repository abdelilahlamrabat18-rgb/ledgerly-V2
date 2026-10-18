import { Bell, Building2, Check, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export function SettingsPage() {
  const { user, isDemo, displayName, profile, profileLoading, profileError, updateProfile } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(displayName === 'Welcome' ? '' : displayName);
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState(true);

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

  return <main className="page-wrap">
    <div className="page-heading"><div><p className="eyebrow">Your workspace</p><h1 className="page-title">Settings</h1><p className="page-subtitle">Make Ledgerly feel like it belongs to your business.</p></div></div>
    {profileError && <div className="notice" style={{ marginBottom: 18 }}>We couldn’t load your saved profile details. You can still edit and retry saving them.</div>}
    <div className="google-layout">
      <section className="card"><div className="card-header"><div><h2 className="card-title">Profile & business</h2><p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>This is how your workspace identifies you.</p></div></div>
        <form style={{ padding: 20 }} onSubmit={(event) => void save(event)}><div className="form-grid">
          <label className="form-field full"><span className="form-label">Your name</span><input className="form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
          <label className="form-field full"><span className="form-label">Email address</span><div style={{ position: 'relative' }}><Mail size={14} style={{ position: 'absolute', left: 11, top: 11, color: '#9ca5b1' }} /><input className="form-input" style={{ paddingLeft: 32, color: '#8c97a6' }} value={user?.email || (isDemo ? 'Demo workspace' : '')} disabled /></div></label>
          <label className="form-field full"><span className="form-label">Business name</span><input className="form-input" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Your business name" /></label>
        </div><div className="form-actions"><button className="button button-primary" disabled={saving || profileLoading}>{saving ? 'Saving…' : <><Check size={14} /> Save changes</>}</button></div></form>
      </section>
      <section className="card"><div className="card-header"><div><h2 className="card-title">Preferences</h2><p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>Keep your workspace comfortable and useful.</p></div></div><div style={{ padding: '3px 20px 12px' }}><div className="settings-list">
        <div className="settings-row"><div className="settings-row-icon"><Bell size={14} /></div><div className="settings-row-copy"><strong>Activity updates</strong><span>Show helpful activity notifications.</span></div><button type="button" className={`toggle ${notifications ? 'on' : ''}`} onClick={() => setNotifications(!notifications)} aria-label="Toggle activity updates" /></div>
        <div className="settings-row"><div className="settings-row-icon"><Building2 size={14} /></div><div className="settings-row-copy"><strong>Workspace mode</strong><span>{isDemo ? 'Preview data · local only' : 'Live Supabase workspace'}</span></div><span style={{ color: '#2db47a', fontSize: 10, fontWeight: 800 }}>{isDemo ? 'Preview' : 'Active'}</span></div>
        <div className="settings-row"><div className="settings-row-icon"><LockKeyhole size={14} /></div><div className="settings-row-copy"><strong>Data protection</strong><span>Database policies restrict records to your account.</span></div><span style={{ color: '#2db47a', fontSize: 10, fontWeight: 800 }}>On</span></div>
      </div></div></section>
    </div>
    <section className="card" style={{ marginTop: 18 }}><div className="card-header"><div><h2 className="card-title">Account security</h2><p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>Your password and sign-in settings are managed by Supabase Auth.</p></div><UserRound size={17} color="#9ba5b3" /></div><div style={{ padding: 20 }}><p style={{ margin: 0, color: '#667385', fontSize: 12, lineHeight: 1.6 }}>Use the password reset flow from the sign-in page if you need to change your password. Sessions are persisted and can be revoked by signing out.</p></div></section>
  </main>;
}
