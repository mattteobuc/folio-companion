create table if not exists public.chat_plan_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  title text,
  ticker text,
  cadence text check (cadence in ('settimanale', 'quindicinale', 'mensile')),
  amount numeric(12, 2) check (amount > 0),
  start_date date,
  monthly_budget_limit numeric(12, 2) check (monthly_budget_limit is null or monthly_budget_limit > 0),
  risk_note text,
  step text not null default 'title',
  awaiting_confirmation boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_plan_drafts_user_session_idx
  on public.chat_plan_drafts (user_id, session_id);

create or replace function public.handle_chat_plan_drafts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chat_plan_drafts_set_updated_at on public.chat_plan_drafts;
create trigger chat_plan_drafts_set_updated_at
before update on public.chat_plan_drafts
for each row
execute function public.handle_chat_plan_drafts_updated_at();

alter table public.chat_plan_drafts enable row level security;

drop policy if exists "Users can read own chat plan drafts" on public.chat_plan_drafts;
create policy "Users can read own chat plan drafts"
  on public.chat_plan_drafts
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own chat plan drafts" on public.chat_plan_drafts;
create policy "Users can insert own chat plan drafts"
  on public.chat_plan_drafts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own chat plan drafts" on public.chat_plan_drafts;
create policy "Users can update own chat plan drafts"
  on public.chat_plan_drafts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own chat plan drafts" on public.chat_plan_drafts;
create policy "Users can delete own chat plan drafts"
  on public.chat_plan_drafts
  for delete
  using (auth.uid() = user_id);
