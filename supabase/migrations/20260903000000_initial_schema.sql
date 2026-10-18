-- Ledgerly MVP schema
-- Run with: supabase db push (or paste into the Supabase SQL editor).

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  email text,
  business_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  invoice_number text not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'pending', 'paid', 'overdue', 'cancelled')),
  issue_date date not null default current_date,
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category text not null default 'Other',
  amount numeric(12,2) not null default 0 check (amount >= 0),
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  product text not null,
  quantity integer not null default 1 check (quantity > 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled')),
  order_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

-- Non-secret metadata only. OAuth refresh tokens belong in google_connection_secrets,
-- which is intentionally inaccessible to browser clients and is read by Edge Functions.
create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  connected_email text,
  spreadsheet_id text,
  spreadsheet_name text,
  selected_sheet text,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_connection_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists invoices_status_idx on public.invoices(user_id, status);
create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists expenses_date_idx on public.expenses(user_id, date desc);
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_date_idx on public.orders(user_id, order_date desc);

-- Keep timestamps server controlled.
create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at before update on public.clients for each row execute procedure public.set_updated_at();
drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at before update on public.invoices for each row execute procedure public.set_updated_at();
drop trigger if exists google_connections_set_updated_at on public.google_connections;
create trigger google_connections_set_updated_at before update on public.google_connections for each row execute procedure public.set_updated_at();
drop trigger if exists google_connection_secrets_set_updated_at on public.google_connection_secrets;
create trigger google_connection_secrets_set_updated_at before update on public.google_connection_secrets for each row execute procedure public.set_updated_at();

-- Create a profile when a user signs up. A SECURITY DEFINER function is used only
-- for this insert and has a fixed search_path to avoid search_path injection.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Every user-owned table has explicit tenant isolation.
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.expenses enable row level security;
alter table public.orders enable row level security;
alter table public.google_connections enable row level security;
-- No browser policy is created for the secret table. Service role Edge Functions only.
alter table public.google_connection_secrets enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "clients_all_own" on public.clients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invoices_all_own" on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "expenses_all_own" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "orders_all_own" on public.orders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "google_connections_all_own" on public.google_connections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Defense in depth: even if a role is accidentally granted access later,
-- users still cannot select the secret table through the API.
revoke all on public.google_connection_secrets from anon, authenticated;

-- Storage / API clients get only the intended table privileges. RLS remains authoritative.
grant select, insert, update, delete on public.profiles, public.clients, public.invoices, public.expenses, public.orders, public.google_connections to authenticated;
