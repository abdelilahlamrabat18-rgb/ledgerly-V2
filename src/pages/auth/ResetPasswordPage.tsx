import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { useAuth } from '../../context/AuthContext';

export function ResetPasswordPage() {
  const { updatePassword, isConfigured } = useAuth(); const navigate = useNavigate(); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [done, setDone] = useState(false); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setError(''); if (password.length < 8 || password !== confirm) { setError(password.length < 8 ? 'Use at least 8 characters.' : 'Passwords do not match.'); return; } setLoading(true); const result = await updatePassword(password); setLoading(false); if (result.error) setError(result.error.message); else { setDone(true); setTimeout(() => navigate('/login'), 1200); } }
  return <AuthLayout title="Choose a new password" eyebrow="Account recovery"><p className="auth-subtitle">Use a strong password you don’t use anywhere else.</p>{done ? <div className="notice">Password updated. Taking you back to sign in…</div> : <>{error && <div className="inline-error">{error}</div>}<form className="auth-form" onSubmit={submit}><label className="auth-label">New password<input className="form-input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label><label className="auth-label">Confirm password<input className="form-input" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label><button className="button button-primary" disabled={loading || !isConfigured}>{loading ? 'Updating…' : 'Update password'}</button></form></>}<p className="auth-switch"><Link className="text-link" to="/login">← Back to sign in</Link></p></AuthLayout>;
}
