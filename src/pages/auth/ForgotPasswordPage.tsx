import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { useAuth } from '../../context/AuthContext';

export function ForgotPasswordPage() {
  const { sendPasswordReset, isConfigured } = useAuth(); const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(''); setLoading(true); const result = await sendPasswordReset(email); setLoading(false); if (result.error) setError(result.error.message); else setSent(true); }
  return <AuthLayout title="Reset your password" eyebrow="Account recovery"><p className="auth-subtitle">Enter the email you use for Ledgerly and we’ll send a secure reset link.</p>{sent ? <div className="notice">Check your inbox for a password reset link. If you don’t see it, check your spam folder.</div> : <>{!isConfigured && <div className="setup-callout">Password recovery requires your Supabase project to be configured.</div>}{error && <div className="inline-error">{error}</div>}<form className="auth-form" onSubmit={submit}><label className="auth-label">Email address<input className="form-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label><button className="button button-primary" disabled={loading || !isConfigured}>{loading ? 'Sending link…' : 'Send reset link'}</button></form></>}<p className="auth-switch"><Link className="text-link" to="/login">← Back to sign in</Link></p></AuthLayout>;
}
