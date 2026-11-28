# Ledgerly Codebase Audit Report

**Date:** 2026-11-27  
**Project:** Ledgerly Business Dashboard  
**Stack:** React 18 + Vite 6 + TypeScript + Tailwind CSS + Supabase

---

## 1. What Ledgerly Already Does Well (Core Workflows)

### Authentication & Multi-Tenant Security
- **Robust auth flow** (`src/context/AuthContext.tsx:44-203`): Supabase-backed with demo mode fallback, password reset, profile management, and proper session persistence
- **Row-level security ready**: All data operations scoped to `user_id` via `useEntity` hook (`src/hooks/useBusinessData.ts:28`)
- **Graceful degradation**: Demo mode works without Supabase config (`src/lib/supabase.ts` checks)

### Unified Data Layer (`useEntity` hook)
- **Single abstraction** for all entities (clients, invoices, expenses, orders) — consistent CRUD, loading, error states
- **Real-time sync**: Custom `ledgerly:data-updated` event bus refreshes all consumers automatically (`src/hooks/useBusinessData.ts:22-24`)
- **Optimistic updates**: Local state updated immediately, then synced

### Complete Entity Management (4 Core Modules)
| Page | Entity | Key Features |
|------|--------|--------------|
| `InvoicesPage.tsx` | Invoices | Status workflow (draft→pending→paid/overdue), search, client linking, modal forms, inline editing, CSV export |
| `ClientsPage.tsx` | Clients | Full CRUD, detail view, company/contact fields, search, inline editing, CSV export |
| `ExpensesPage.tsx` | Expenses | Category filtering, date range, amount tracking, inline editing, CSV export |
| `OrdersPage.tsx` | Orders | Status pipeline, product/quantity/total, client linking, inline editing, CSV export |

### i18n & RTL Support (Morocco/MENA Focus)
- **Three languages**: EN, FR, AR with full RTL support via `document.dir`/`document.lang` (`src/context/PreferencesContext.tsx:76-79`, `src/App.tsx:75-82`)
- **Multi-currency**: Intl.NumberFormat-based formatting with locale-aware currency display (`src/lib/utils.ts:10-35`)
- **Vendor category learning**: Remembers vendor→category mappings for faster expense entry (`src/context/PreferencesContext.tsx`)

### Data Import (Standout Feature)
- **Multi-format support**: CSV, Excel (.xlsx/.xls), JSON via `xlsx` library (`src/pages/app/GoogleSheetsPage.tsx`)
- **Multi-sheet workbook handling**: Parses all sheets, auto-detects entity type per sheet, manages mapping per sheet
- **Smart column matching**: Fuzzy header matching with synonyms, auto-mapping with saved preferences
- **Pre-import hygiene checks**: Validates required fields, dates, amounts, detects duplicates against existing data
- **Import sources tracking**: Records all import batches with ability to decline/reactivate/remove

### Analytics & Dashboards
- **Dashboard** (`DashboardPage.tsx`): 4 KPI cards, 6-month cash flow area chart, recent activity feed, period-over-period comparison
- **Analytics** (`AnalyticsPage.tsx`): 12-month cash flow, expense category bar chart (top 8), receivables aging, period-over-period comparison
- **Transactions** (`TransactionsPage.tsx`): Unified invoice/expense view with search + type filter

### Billing & Trial Gating
- **14-day trial** with clear expiry handling (`src/context/BillingContext.tsx`, `src/lib/billing.ts`)
- **Three pricing tiers**: $24/mo, $240/yr, $149 founding (lifetime)
- **Conservative entitlement engine**: Never grants access on malformed webhooks, provider-agnostic (`src/lib/billing.ts`)
- **Route guards**: Three patterns (ProtectedRoute, CoreRoute, AuthRedirect) with trial/billing gating (`src/App.tsx:36-67`)

### UX Polish
- **Consistent design system**: MetricCard, StatusPill, Modal, LoadingState, PageError, ConfirmDialog components
- **Toast notifications** with offline/online detection (`ToastContext.tsx:20-28`)
- **Empty states** with actionable CTAs throughout
- **Lazy-loaded routes** via `React.lazy` + `Suspense` (`App.tsx:22-37`)
- **Inline editing** on all entity tables with auto-focus, validation, save/cancel

---

## 2. Top 5 High-Impact Missing Features for Small Businesses (Morocco/MENA Context)

### 1. Recurring Invoices & Invoice Templates
**Why**: Service businesses (agencies, consultants, retainers) bill monthly/quarterly. Manual recreation wastes hours.
**Gap**: No recurring schedule, no template library, no "duplicate to new" action.
**Effort**: Medium — add `recurring_rule` JSON field to invoices, scheduler via Supabase cron or Edge Function.
**MENA relevance**: Common for retainer-based consulting, monthly maintenance contracts.

### 2. Payment Recording & Reconciliation
**Why**: "Paid" status is manual today. No Stripe/PayPal/Square link, no payment reference, no partial payments.
**Gap**: Invoices only track `status`, not `paid_amount`, `payment_date`, `payment_method`, `transaction_id`.
**Effort**: Medium — extend Invoice type, add payment modal, webhook endpoint for providers.
**MENA relevance**: Integration with local payment gateways (CMI, PayPal MENA, Stripe Atlas) needed for Morocco market.

### 3. Client Portal / Public Invoice Links
**Why**: Clients need self-serve: view, download PDF, pay online.
**Gap**: No public routes, no PDF generation, no tokenized invoice access.
**Effort**: High — new public routes, PDF lib (pdfkit/@react-pdf/renderer), signed URLs, payment embed.
**MENA relevance**: Arabic RTL invoice PDFs, French/English variants, local compliance.

### 4. Tax / VAT Reporting (Critical for Morocco)
**Why**: Quarterly filing requires categorized, dated line items with tax rates.
**Gap**: Expenses have `category` but no tax field. Invoices lack line items, tax rates, VAT numbers.
**Effort**: High — schema migration, line-item subtable, tax rate config, report generator (CSV/PDF).
**MENA relevance**: **Morocco VAT (TVA) at 20%**, simplified regime for small businesses, invoice legal mentions required by Moroccan law (ICE, RC, IF).

### 5. Multi-User Workspaces (Team Access)
**Why**: Accountants, partners, staff need controlled access.
**Gap**: Single-user per workspace. No roles (admin/member/viewer), no invite flow, no audit log.
**Effort**: High — Supabase Auth teams/orgs, RLS policies per role, invitation edge function, activity log table.
**MENA relevance**: Family businesses, accounting firms serving multiple clients need workspace separation.

---

## 3. Rough Edges, Edge Cases & Polish Issues

### Data Integrity & Validation
| Location | Issue |
|----------|-------|
| `useBusinessData.ts:28` | `user_id` injected client-side — if auth state races, could orphan rows (mitigated by RLS but still fragile) |
| `InvoicesPage.tsx` | No Zod schema visible — validation only in modal `onSubmit`, not at hook level |
| `GoogleSheetsPage.tsx:59` | Import reports skipped rows but doesn't surface *which* rows failed |
| `AnalyticsPage.tsx:136-140` | Expense categories derived client-side — inconsistent if categories differ by casing ("Travel" vs "travel") |
| `dataService.ts:59` | `listEntity` fetches all records client-side — no pagination, could hit limits with large datasets |

### UX Gaps
- **No keyboard shortcuts** for power users (e.g., `N` = new invoice, `/` = search)
- **No bulk actions**: multi-select → delete, change status, export (checkbox column exists in import UI but not in entity tables)
- **Invoice status workflow** is free-text — no enforced transitions (draft→sent→paid)
- **Date inputs** use native `<input type="date">` — no date picker with presets ("last month", "this quarter")
- **Mobile tables** scroll horizontally but lack card-view fallback
- **No undo toast** after delete (only success toast)
- **Import hygiene details** modal could be overwhelming for 50+ warning rows

### Technical Debt
- **TypeScript `any` leaks**: `data as unknown as UserProfile` (`AuthContext.tsx:104`), `nextProfile as never` (`AuthContext.tsx:190`)
- **Event bus** (`ledgerly:data-updated`) is global `window` — no cleanup guard if multiple tabs open
- **Demo mode** hardcodes `user_id: 'demo'` — conflicts if real user named "demo"
- **No test files** found (`*.test.ts`, `*.spec.ts`) — zero test coverage visible
- **Error boundaries** missing — uncaught errors crash entire page
- **Duplicate logic**: `mapRecord` function duplicated in `GoogleSheetsPage.tsx` (lines 479-511 and 334-366)

### Accessibility
- Toast uses `aria-live="polite"` but error toasts should be `assertive`
- StatusPill uses color-only for status — no text label for screen readers
- Modals trap focus? Not verified
- Charts (Recharts) lack `aria-label` / data table fallback
- Inline edit inputs lack `aria-label` associations

### Morocco/MENA-Specific Gaps
- **No Dirham (MAD) currency** in default currency list — requires manual entry
- **No Moroccan legal invoice fields**: ICE (Identifiant Commun de l'Entreprise), RC (Registre de Commerce), IF (Identifiant Fiscal)
- **No Arabic number formatting** (Eastern Arabic numerals) option
- **No hijri calendar** date picker option alongside Gregorian
- **No French/Arabic invoice templates** with legal mentions

---

## 4. Recommended Next 3 Tasks (Ranked by Effort × Impact)

### 🥇 Task 1: Invoice Status Workflow + Validation (Low Effort, High Impact)
**Files**: `src/types/index.ts`, `src/pages/app/InvoicesPage.tsx`, `src/hooks/useBusinessData.ts`, `src/lib/utils.ts`
- Add Zod schema for Invoice with enum status: `draft | sent | paid | overdue | void`
- Enforce transitions in `update` (e.g., cannot set `paid` from `void`)
- Add `paid_at`, `paid_amount` fields to Invoice type
- Show transition buttons in UI (Send → Mark Paid → Void)
- **Estimate**: 2–3 days

### 🥈 Task 2: Bulk Actions + Keyboard Shortcuts (Low Effort, High Impact)
**Files**: `src/pages/app/*.tsx` (Invoices, Clients, Expenses, Orders), `src/components/shared/`
- Add checkbox column + header "select all" to all tables (pattern from `GoogleSheetsPage.tsx:1267`)
- Bulk toolbar: Delete, Export CSV, Change Status (invoices/orders)
- Global shortcuts: `N` new, `/` search, `Esc` close modal
- **Estimate**: 2–3 days

### 🥉 Task 3: Payment Recording on Invoices (Medium Effort, High Impact)
**Files**: `src/types/index.ts`, `supabase/migrations/`, `src/pages/app/InvoicesPage.tsx`, new `PaymentModal.tsx`
- Migration: add `paid_amount`, `payment_method`, `payment_ref`, `paid_at` to invoices
- "Record Payment" modal with partial payment support
- Update KPI: "Outstanding" = sum(amount - paid_amount) where status ≠ paid
- **Estimate**: 4–5 days

---

## Bonus: Quick Wins for Morocco/MENA Market (1-2 days each)
1. **Add MAD to currency list** with proper formatting (Dirham symbol, Arabic numerals option)
2. **Add Arabic number formatting toggle** in Preferences
3. **Invoice PDF export** with RTL Arabic layout using `@react-pdf/renderer`
4. **Date picker presets** in Arabic/French labels
5. **Vendor category learning** already exists — expose as "Import vendors from CSV" in Settings

---

## Appendix: Key File Reference

| Area | Files |
|------|-------|
| Routing & Providers | `src/App.tsx`, `src/main.tsx` |
| Auth | `src/context/AuthContext.tsx`, `src/lib/supabase.ts` |
| Data Hooks | `src/hooks/useBusinessData.ts`, `src/services/dataService.ts` |
| Core Pages | `src/pages/app/{Dashboard,Invoices,Clients,Expenses,Orders,Transactions,Analytics,Settings,GoogleSheets}Page.tsx` |
| Shared UI | `src/components/shared/{MetricCard,StatusPill,Modal,LoadingState,PageError,ConfirmDialog}.tsx` |
| Analytics Lib | `src/lib/analytics.ts`, `src/lib/utils.ts` |
| Billing | `src/context/BillingContext.tsx`, `src/lib/billing.ts`, `src/services/billing.ts` |
| i18n/RTL | `src/context/PreferencesContext.tsx` |
| Types | `src/types/index.ts` |