# Ledgerly — Business Management SaaS MVP

Ledgerly is an independent React + TypeScript + Vite SaaS for small businesses that currently manage clients, invoices, expenses, and orders in Google Sheets.

It is intentionally built as a real application rather than a visual mockup:

- React, TypeScript, Vite, Tailwind CSS, and custom CSS design tokens
- Supabase Auth with persistent sessions and password reset
- PostgreSQL schema with Row Level Security on every user-owned table
- Google OAuth + Sheets/Drive integration through Supabase Edge Functions
- Secure server-side refresh-token storage (encrypted; never exposed to the browser)
- CRUD workflows for clients, invoices, expenses, and orders
- Responsive dashboard with metrics, cash-flow chart, recent activity, empty/error/loading states
- Route-level code splitting for app pages, with dedicated Dashboard, Transactions, Analytics, Clients, Invoices, Expenses, Orders, Google Sheets, and Settings views
- Profile-aware user greetings with metadata/email fallbacks; no dashboard user name or chart totals are hardcoded
- Dashboard and Analytics charts are calculated from the signed-in user’s RLS-scoped invoice and expense records; empty charts show an explicit no-data state

## Run locally

```bash
cd business-dashboard
cp .env.example .env.local
# add your Supabase URL and anon key
pnpm install
pnpm dev
```

The default is **not** a fake auth mode. Without Supabase credentials, the auth buttons are disabled and the setup message explains what is missing.

For UI exploration only, explicitly set:

```env
VITE_DEMO_MODE=true
```

Demo mode provides seeded local sample records but is not a replacement for production authentication and should never be enabled for a deployed customer environment.

## Supabase setup

1. Create a Supabase project.
2. Install the Supabase CLI and link the project.
3. Apply the migration:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration at `supabase/migrations/20260903000000_initial_schema.sql` creates:

- `profiles`
- `clients`
- `invoices`
- `expenses`
- `orders`
- `google_connections` (non-secret connection metadata)
- `google_connection_secrets` (encrypted refresh-token ciphertext; no browser select policy)

Every business table uses `user_id` plus `auth.uid()` policies. The API client never trusts a user-provided ID for authorization; Supabase RLS is the enforcement boundary.

The frontend values in `.env.local` are compile-time browser configuration and must use only the public anon key:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_DEMO_MODE=false
```

The Edge Functions intentionally do **not** read `VITE_` variables. Supabase injects server-side `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and (where needed) `SUPABASE_SERVICE_ROLE_KEY`; configure Google secrets with `supabase secrets set`. This keeps service-role and OAuth credentials out of the browser bundle.

The app routes include `/`, protected `/app/*` views, and shortcut redirects for `/transactions`, `/analytics`, and `/settings`.

## Google Sheets setup

The Google integration is implemented through three Supabase Edge Functions:

- `google-oauth-start` creates a signed, expiring OAuth state and authorization URL.
- `google-oauth-callback` exchanges the code, encrypts the refresh token with AES-GCM, and stores it in the server-only secrets table.
- `google-sheets` refreshes access tokens server-side, lists spreadsheets/tabs, previews headers, and validates/imports mapped rows.

Create a Google Cloud OAuth **Web application** client. Add this authorized redirect URI:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/google-oauth-callback
```

Deploy the functions:

```bash
supabase functions deploy google-oauth-start
supabase functions deploy google-oauth-callback --no-verify-jwt
supabase functions deploy google-sheets
```

Set the following as Supabase function secrets. `GOOGLE_TOKEN_ENCRYPTION_KEY_B64` must decode to exactly 32 random bytes:

```bash
supabase secrets set \
  GOOGLE_CLIENT_ID=... \
  GOOGLE_CLIENT_SECRET=... \
  GOOGLE_STATE_SECRET=$(openssl rand -hex 32) \
  GOOGLE_TOKEN_ENCRYPTION_KEY_B64=$(openssl rand -base64 32) \
  APP_URL=https://your-production-app.example.com
```

The OAuth flow requests only the scopes needed for the MVP: `drive.readonly` to list the user’s spreadsheets, `spreadsheets.readonly` to read spreadsheet values, and `openid email` for the connection identity. The app never asks the user for a Google password.

If a user cancels authorization, loses permissions, uses a deleted spreadsheet, selects an empty tab, or has an expired token, the functions return explicit errors and the UI shows a retryable message. Imports are capped at 5,000 data rows for the MVP and the first row is treated as headers.

## Deployment

The frontend is a static Vite build and can be deployed to Cloudflare Pages, Netlify, Vercel, or any static host:

```bash
pnpm build
```

Build output is `dist/`. Configure the host with:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_DEMO_MODE=false
```

For SPA routing, configure your host to serve `index.html` as the fallback for `/login`, `/signup`, and `/app/*` paths. Configure Supabase Auth URL settings with the production site URL and password-reset redirect URL:

```text
https://your-production-app.example.com/reset-password
```

## Validation and verification

```bash
# type-check
./node_modules/.bin/tsc -b

# production build
./node_modules/.bin/vite build
```

The app has no Hercules or proprietary app-builder dependency. All frontend code, SQL, Edge Functions, and deployment configuration live in this repository.

## Scope intentionally left for later

Team roles, billing/subscriptions, receipts/file storage, advanced automations, and AI features are not part of this MVP. The data layer and Edge Function boundary leave room to add them without coupling the core app to a single AI provider.
