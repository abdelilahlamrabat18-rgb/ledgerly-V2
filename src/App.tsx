import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { useAuth } from './context/AuthContext';

const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })));
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import('./pages/auth/SignupPage').then((module) => ({ default: module.SignupPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const DashboardPage = lazy(() => import('./pages/app/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const TransactionsPage = lazy(() => import('./pages/app/TransactionsPage').then((module) => ({ default: module.TransactionsPage })));
const AnalyticsPage = lazy(() => import('./pages/app/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const ClientsPage = lazy(() => import('./pages/app/ClientsPage').then((module) => ({ default: module.ClientsPage })));
const InvoicesPage = lazy(() => import('./pages/app/InvoicesPage').then((module) => ({ default: module.InvoicesPage })));
const ExpensesPage = lazy(() => import('./pages/app/ExpensesPage').then((module) => ({ default: module.ExpensesPage })));
const OrdersPage = lazy(() => import('./pages/app/OrdersPage').then((module) => ({ default: module.OrdersPage })));
const GoogleSheetsPage = lazy(() => import('./pages/app/GoogleSheetsPage').then((module) => ({ default: module.GoogleSheetsPage })));
const SettingsPage = lazy(() => import('./pages/app/SettingsPage').then((module) => ({ default: module.SettingsPage })));

function RouteLoading() {
  return <div className="loading-page" role="status" aria-label="Loading page"><div className="spinner" /></div>;
}

function LazyBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

function ProtectedRoute() {
  const { user, loading, isDemo } = useAuth();
  const location = useLocation();
  if (loading) return <RouteLoading />;
  if (!user && !isDemo) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <AppShell><Outlet /></AppShell>;
}

function AuthRedirect() {
  const { user, loading, isDemo } = useAuth();
  if (loading) return <RouteLoading />;
  return user || isDemo ? <Navigate to="/app" replace /> : <Outlet />;
}

export default function App() {
  return <LazyBoundary><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route element={<AuthRedirect />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </Route>
    <Route element={<ProtectedRoute />}>
      <Route path="/app" element={<DashboardPage />} />
      <Route path="/app/transactions" element={<TransactionsPage />} />
      <Route path="/app/analytics" element={<AnalyticsPage />} />
      <Route path="/app/clients" element={<ClientsPage />} />
      <Route path="/app/invoices" element={<InvoicesPage />} />
      <Route path="/app/expenses" element={<ExpensesPage />} />
      <Route path="/app/orders" element={<OrdersPage />} />
      <Route path="/app/google-sheets" element={<GoogleSheetsPage />} />
      <Route path="/app/settings" element={<SettingsPage />} />
    </Route>
    <Route path="/transactions" element={<Navigate to="/app/transactions" replace />} />
    <Route path="/analytics" element={<Navigate to="/app/analytics" replace />} />
    <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></LazyBoundary>;
}
