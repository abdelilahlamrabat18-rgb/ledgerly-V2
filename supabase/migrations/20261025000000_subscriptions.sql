-- Ledgerly billing and subscription lifecycle.
-- Run with: supabase db push (or paste into the Supabase SQL editor).
-- This migration is additive only. It does not touch existing tables.

create extension if not exists pgcrypto;

-- One current subscription record per user. Authoritative fields are
-- mutated only by server-side Edge Functions using the service role.
-- Ordinary authenticated users can read a narrow projection but cannot
-- INSERT, UPDATE, or DELETE their own authoritative subscription row.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,

  -- Provider-agnostic internal entitlement state.
  -- 'trialing' / 'active' are the only states that grant core-feature access.
  -- 'past_due' is governed by the explicit policy in docs/billing-policy.md:
  -- access continues until the provider-confirmed paid-through end.
  entitlement text not null default 'trialing'
    check (entitlement in ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'unpaid', 'no_provider')),

  -- Provider-specific fields. Null until a real provider account is configured.
  provider text not null default 'lemonsqueezy',
  provider_subscription_id text,
  provider_customer_id text,
  provider_order_id text,

  -- Plan metadata.
  plan text not null default 'business',
  plan_price_cents integer not null default 1500 check (plan_price_cents >= 0),
  currency text not null default 'USD',

  -- Server-authoritative lifecycle timestamps (UTC).
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  paid_through timestamptz,

  -- Raw provider status as reported by the provider webhook/API.
  provider_status text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_entitlement_idx on public.subscriptions(entitlement);
create index if not exists subscriptions_provider_sub_id_idx on public.subscriptions(provider_subscription_id);

alter table public.subscriptions enable row level security;

-- Read-only projection for authenticated users: never exposes provider IDs
-- or internal entitlement fields that could be used to spoof access.
-- Must only return data for the caller's own user id and must verify auth.uid().
create or replace function public.subscription_safe_view(p_user_id uuid)
returns table (
  user_id uuid,
  entitlement text,
  plan text,
  plan_price_cents integer,
  currency text,
  trial_start timestamptz,
  trial_end timestamptz,
  current_period_end timestamptz,
  paid_through timestamptz,
  provider text
) language sql security definer
set search_path = public, pg_temp as $$
  select
    s.user_id,
    s.entitlement,
    s.plan,
    s.plan_price_cents,
    s.currency,
    s.trial_start,
    s.trial_end,
    s.current_period_end,
    s.paid_through,
    s.provider
  from public.subscriptions s
  where s.user_id = p_user_id
    and auth.uid() is not null
    and auth.uid() = p_user_id
  limit 1;
$$;

-- Authenticated users may read their own safe projection only via this function
-- with authorization enforced inside the function. Revoke from anon/public
-- and keep authenticated access only under strict checks.
revoke all on function public.subscription_safe_view(uuid) from public;
revoke all on function public.subscription_safe_view(uuid) from anon;
grant execute on function public.subscription_safe_view(uuid) to authenticated;

-- Server-authoritative trial creation. Runs as SECURITY DEFINER so an
-- authenticated user cannot supply arbitrary timestamps or user IDs.
-- Concurrency-safe: use atomic upsert that cannot reset an existing trial.
create or replace function public.start_trial_if_missing(p_user_id uuid, p_trial_days integer default 14)
returns table (
  user_id uuid,
  entitlement text,
  trial_start timestamptz,
  trial_end timestamptz,
  created boolean
) language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_trial_start timestamptz;
  v_trial_end timestamptz;
  v_created boolean := false;
  v_row public.subscriptions%rowtype;
begin
  if p_user_id is null then
    raise exception 'A valid user id is required.';
  end if;
  if p_trial_days is null or p_trial_days <= 0 then
    p_trial_days := 14;
  end if;

  v_trial_start := now();
  v_trial_end := v_trial_start + (p_trial_days || ' days')::interval;

  -- Atomic insert only if missing; do not update existing rows to avoid
  -- resetting or extending an existing trial.
  insert into public.subscriptions (user_id, entitlement, trial_start, trial_end, provider)
  values (p_user_id, 'trialing', v_trial_start, v_trial_end, 'lemonsqueezy')
  on conflict (user_id) do nothing
  returning * into v_row;

  if found then
    v_created := true;
    return query
    select v_row.user_id, v_row.entitlement, v_row.trial_start, v_row.trial_end, v_created;
    return;
  end if;

  -- Row already exists; return it without modification.
  select * into v_row
  from public.subscriptions
  where subscriptions.user_id = p_user_id;

  return query
  select v_row.user_id, v_row.entitlement, v_row.trial_start, v_row.trial_end, false;
  return;
end;
$$;

-- Keep timestamps server controlled. set_updated_at() is defined in initial schema
-- and is SECURITY INVOKER (safe). Ensure trigger exists.
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

-- Explicitly revoke execution of start_trial_if_missing from PUBLIC, anon, authenticated.
-- Grant execution only to service_role (used by Edge Functions).
revoke all on function public.start_trial_if_missing(uuid, integer) from public;
revoke all on function public.start_trial_if_missing(uuid, integer) from anon;
revoke all on function public.start_trial_if_missing(uuid, integer) from authenticated;
grant execute on function public.start_trial_if_missing(uuid, integer) to service_role;