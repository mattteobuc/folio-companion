create extension if not exists pgcrypto;

create table if not exists public.purchase_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  asset_id uuid references public.assets(id) on delete set null,
  title text not null,
  ticker text,
  goal_type text not null check (goal_type in ('accumulo', 'bilanciamento', 'riduzione_volatilita', 'altro')),
  cadence text not null check (cadence in ('settimanale', 'quindicinale', 'mensile')),
  amount numeric(12, 2) not null check (amount > 0),
  start_date date not null,
  next_run_date date not null,
  monthly_budget_limit numeric(12, 2) check (monthly_budget_limit is null or monthly_budget_limit > 0),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  risk_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_plans_user_status_idx
  on public.purchase_plans (user_id, status);

create index if not exists purchase_plans_user_next_run_date_idx
  on public.purchase_plans (user_id, next_run_date);

create or replace function public.handle_purchase_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists purchase_plans_set_updated_at on public.purchase_plans;
create trigger purchase_plans_set_updated_at
before update on public.purchase_plans
for each row
execute function public.handle_purchase_plans_updated_at();

alter table public.purchase_plans enable row level security;

drop policy if exists "Users can read own purchase plans" on public.purchase_plans;
create policy "Users can read own purchase plans"
  on public.purchase_plans
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own purchase plans" on public.purchase_plans;
create policy "Users can insert own purchase plans"
  on public.purchase_plans
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own purchase plans" on public.purchase_plans;
create policy "Users can update own purchase plans"
  on public.purchase_plans
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own purchase plans" on public.purchase_plans;
create policy "Users can delete own purchase plans"
  on public.purchase_plans
  for delete
  using (auth.uid() = user_id);
