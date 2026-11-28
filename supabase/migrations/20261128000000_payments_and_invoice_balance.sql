-- Payment recording and invoice balance tracking
-- Run with: supabase db push (or paste into the Supabase SQL editor).

-- Add amount_paid and balance_due columns to invoices
alter table if exists public.invoices
  add column if not exists amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  add column if not exists balance_due numeric(12,2) not null default 0 check (balance_due >= 0);

-- Initialize balance_due for existing invoices
update public.invoices
set balance_due = case
  when status = 'paid' then 0
  else amount
end
where balance_due = 0 and amount_paid = 0;

-- Create payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer', 'cash', 'card', 'check', 'other')),
  reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for payments
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_invoice_id_idx on public.payments(invoice_id);
create index if not exists payments_date_idx on public.payments(user_id, payment_date desc);

-- Trigger for updated_at on payments
drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments for each row execute procedure public.set_updated_at();

-- RLS for payments
alter table public.payments enable row level security;

create policy "payments_all_own" on public.payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.payments to authenticated;

-- Function to update invoice balance and status after payment insert/update/delete
create or replace function public.recalculate_invoice_balance()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  v_invoice_id uuid;
  v_total_paid numeric(12,2);
  v_amount numeric(12,2);
  v_new_balance numeric(12,2);
  v_new_status text;
begin
  -- Determine which invoice was affected
  if TG_OP = 'DELETE' then
    v_invoice_id = OLD.invoice_id;
  else
    v_invoice_id = NEW.invoice_id;
  end if;

  -- Calculate total paid for this invoice
  select coalesce(sum(amount), 0) into v_total_paid
  from public.payments
  where invoice_id = v_invoice_id;

  -- Get invoice amount
  select amount into v_amount
  from public.invoices
  where id = v_invoice_id;

  v_new_balance = v_amount - v_total_paid;
  if v_new_balance < 0 then v_new_balance = 0; end if;

  -- Determine new status
  if v_new_balance = 0 then
    v_new_status = 'paid';
  else
    v_new_status = 'partial';
  end if;

  -- Update invoice
  update public.invoices
  set amount_paid = v_total_paid,
      balance_due = v_new_balance,
      status = case
        when v_new_status = 'paid' then 'paid'
        when v_new_status = 'partial' then 'partial'
        when status in ('draft', 'sent', 'pending', 'overdue', 'cancelled') then status
        else 'pending'
      end
  where id = v_invoice_id;

  return null;
end;
$$;

-- Trigger on payments insert
drop trigger if exists payments_update_invoice_balance_insert on public.payments;
create trigger payments_update_invoice_balance_insert
after insert on public.payments
for each row execute procedure public.recalculate_invoice_balance();

-- Trigger on payments update
drop trigger if exists payments_update_invoice_balance_update on public.payments;
create trigger payments_update_invoice_balance_update
after update on public.payments
for each row execute procedure public.recalculate_invoice_balance();

-- Trigger on payments delete
drop trigger if exists payments_update_invoice_balance_delete on public.payments;
create trigger payments_update_invoice_balance_delete
after delete on public.payments
for each row execute procedure public.recalculate_invoice_balance();