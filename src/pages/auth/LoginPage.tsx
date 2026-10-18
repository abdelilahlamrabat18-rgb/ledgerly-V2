import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export function LoginPage() {
  const { signIn, isConfigured, isDemo } = useAuth(); const navigate = useNavigate(); const location = useLocation(); const { toast } = useToast();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const from = (location.state as { from?: string } | null)?.from || '/app';
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(''); setLoading(true); const result = await signIn(email, password); setLoading(false); if (result.error) setError(result.error.message); else { toast(isDemo ? 'Welcome to the preview workspace.' : 'Welcome back.'); navigate(from, { replace: true }); } }
  return <AuthLayout title="Welcome back"><p className="auth-subtitle">Sign in to see what is happening across your business.</p>{!isConfigured && !isDemo && <div className="setup-callout">Supabase is not configured yet. Add the values from <strong>.env.example</strong> to enable real authentication.</div>}{error && <div className="inline-error">{error}</div>}<form className="auth-form" onSubmit={submit}><label className="auth-label">Email address<input className="form-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label><label className="auth-label"><span className="password-row"><span>Password</span><Link className="text-link" to="/forgot-password">Forgot password?</Link></span><input className="form-input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" /></label><button className="button button-primary" disabled={loading || (!isConfigured && !isDemo)}>{loading ? 'Signing in…' : 'Sign in'}</button></form><p className="auth-switch">New to Ledgerly? <Link className="text-link" to="/signup">Create an account</Link></p></AuthLayout>;
}
