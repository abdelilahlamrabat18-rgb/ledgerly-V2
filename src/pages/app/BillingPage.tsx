import React from 'react';
import { useBilling } from '../../context/BillingContext';
import { useAuth } from '../../context/AuthContext';

export function BillingPage() {
  const { isDemo } = useAuth();
  const { state, entitlement, loading, error, startTrial, hasCoreAccess } = useBilling();
  const trial = state?.trial ?? null;

  if (loading) {
    return (
      <main className="page-wrap">
        <div className="page-heading"><div><p className="eyebrow">Membership</p><h1 className="page-title">Billing &amp; subscription</h1></div></div>
        <div className="card" style={{ padding: 24 }}><p>Loading billing state…</p></div>
      </main>
    );
  }

  return (
    <main className="page-wrap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Membership</p>
          <h1 className="page-title">Billing &amp; subscription</h1>
          <p className="page-subtitle">Manage how Ledgerly works for your business.</p>
        </div>
      </div>

      {error && <div className="notice" style={{ marginBottom: 18 }}>{error}</div>}
      {isDemo && <div className="notice" style={{ marginBottom: 18 }}>Demo mode is a local preview. It cannot start a real trial or accept payment.</div>}

      <section className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div className="card-header"><div><h2 className="card-title">Current plan</h2><p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>What your workspace has access to right now.</p></div></div>
        <div style={{ padding: '3px 20px 12px' }}>
          <div className="settings-row">
            <div className="settings-row-copy"><strong>Plan</strong><span>{trial?.plan || 'Business'}</span></div>
            <span style={{ color: '#2db47a', fontSize: 10, fontWeight: 800 }}>{trial?.entitlement || entitlement}</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-copy"><strong>Price</strong><span>{trial ? `${(trial.planPriceCents / 100).toFixed(2)} ${trial.currency}` : '$15.00 USD'} / month</span></div>
            <span style={{ color: '#667385', fontSize: 10 }}>After trial</span>
          </div>
          {trial?.trialEnd && (
            <div className="settings-row">
              <div className="settings-row-copy"><strong>Trial ends</strong><span>{new Date(trial.trialEnd).toLocaleString()}</span></div>
              <span style={{ color: hasCoreAccess ? '#2db47a' : '#e0554a', fontSize: 10, fontWeight: 800 }}>{hasCoreAccess ? 'Access active' : 'Access locked'}</span>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ padding: 20, marginBottom: 18 }}>
        <div className="card-header"><div><h2 className="card-title">Start your 14-day trial</h2><p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>No card required. Cancel anytime.</p></div></div>
        <div style={{ padding: '3px 20px 12px' }}>
          <p style={{ margin: 0, color: '#667385', fontSize: 12, lineHeight: 1.6 }}>
            Ledgerly costs <strong>$15 USD per month</strong> after the trial. Your trial starts once, on the server, and runs for 14 days.
          </p>
          <div style={{ marginTop: 14 }}>
            <button
              className="button button-primary"
              disabled={isDemo || !hasCoreAccess || (trial?.entitlement === 'trialing')}
              onClick={() => void startTrial()}
            >
              {trial?.entitlement === 'trialing' ? 'Trial active' : 'Start free trial'}
            </button>
            <span style={{ marginLeft: 10, color: '#9aa4b2', fontSize: 10 }}>
              Payment provider not yet configured. Checkout will be available once setup is complete.
            </span>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <div className="card-header"><div><h2 className="card-title">Billing actions</h2><p className="page-subtitle" style={{ fontSize: 10, marginTop: 4 }}>These are separate, deliberate actions.</p></div></div>
        <div style={{ padding: '3px 20px 12px' }}>
          <div className="settings-row">
            <div className="settings-row-copy"><strong>Cancel subscription</strong><span>Keeps your account and business data. Access continues through the paid-through date.</span></div>
            <span style={{ color: '#9aa4b2', fontSize: 10, fontWeight: 800 }}>Coming soon</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-copy"><strong>Disconnect Google</strong><span>Removes the Google Sheets connection from Settings. Does not cancel billing.</span></div>
            <span style={{ color: '#9aa4b2', fontSize: 10, fontWeight: 800 }}>See Settings</span>
          </div>
          <div className="settings-row">
            <div className="settings-row-copy"><strong>Delete account</strong><span>Permanently removes your workspace. Separate from cancellation.</span></div>
            <span style={{ color: '#9aa4b2', fontSize: 10, fontWeight: 800 }}>Not implemented</span>
          </div>
        </div>
      </section>
    </main>
  );
}