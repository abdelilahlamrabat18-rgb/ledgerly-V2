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
-- SECURITY DEFINER with a fixed search_path prevents search_path injection.
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
) language sql security definer set search_path = public, pg_temp as $$
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
  where auth.uid() is not null
    and auth.uid() = p_user_id
  limit 1;
$$;

-- Authenticated users may read their own safe projection only.
create policy "subscriptions_select_own_safe" on public.subscriptions
  for select using (
    auth.uid() = user_id
    and entitlement in ('trialing', 'active', 'past_due', 'cancelled', 'expired', 'unpaid', 'no_provider')
  );

-- No authenticated INSERT/UPDATE/DELETE policy exists on purpose.
-- All authoritative mutations go through service-role Edge Functions.
revoke all on public.subscriptions from anon;
revoke all on public.subscriptions from authenticated;
revoke all on function public.subscription_safe_view(uuid) from public;
revoke all on function public.subscription_safe_view(uuid) from anon;
grant execute on function public.subscription_safe_view(uuid) to authenticated;
revoke all on function public.subscription_safe_view from public, anon;

-- Server-authoritative trial creation. Runs as SECURITY DEFINER so an
-- authenticated user cannot supply arbitrary timestamps or user IDs.
-- ON CONFLICT DO NOTHING guarantees the trial starts exactly once per user.
create or replace function public.start_trial_if_missing(p_user_id uuid, p_trial_days integer default 14)
returns table (
  user_id uuid,
  entitlement text,
  trial_start timestamptz,
  trial_end timestamptz,
  created boolean
) language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_trial_start timestamptz;
  v_trial_end timestamptz;
  v_existing boolean;
begin
  if p_user_id is null then
    raise exception 'A valid user id is required.';
  end if;
  if p_trial_days is null or p_trial_days <= 0 then
    p_trial_days := 14;
  end if;

  select exists (
    select 1 from public.subscriptions where user_id = p_user_id
  ) into v_existing;

  if v_existing then
    return query
    select s.user_id, s.entitlement, s.trial_start, s.trial_end, false
    from public.subscriptions s
    where s.user_id = p_user_id
    limit 1;
    return;
  end if;

  v_trial_start := now();
  v_trial_end := now() + (p_trial_days || ' days')::interval;

  insert into public.subscriptions (user_id, entitlement, trial_start, trial_end, provider)
  values (p_user_id, 'trialing', v_trial_start, v_trial_end, 'leonsqueezy')
  on conflict (user_id) do nothing;

  return query
  select s.user_id, s.entitlement, s.trial_start, s.trial_end, true
  from public.subscriptions s
  where s.user_id = p_user_id
  limit 1;
end;
$$;

revoke all on function public.start_trial_if_missing(uuid, integer) from public;
revoke all on function public.start_trial_if_missing(uuid, integer) from anon;
revoke all on function public.start_trial_if_missing(uuid, integer) from authenticated;
grant execute on function public.start_trial_if_missing(uuid, integer) to service_role;

-- Keep timestamps server controlled.
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute procedure public.set_updated_at();