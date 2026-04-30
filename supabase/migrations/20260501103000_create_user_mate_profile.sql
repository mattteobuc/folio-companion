create extension if not exists pgcrypto;

create table if not exists public.user_mate_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  primary_goal text check (
    primary_goal is null
    or primary_goal in ('crescita', 'reddito', 'stabilita', 'imparare')
  ),
  time_horizon text check (
    time_horizon is null
    or time_horizon in ('<1y', '1-3y', '3-7y', '7y+')
  ),
  volatility_comfort text check (
    volatility_comfort is null
    or volatility_comfort in ('basso', 'medio', 'alto')
  ),
  mate_style text check (
    mate_style is null
    or mate_style in ('diretto', 'empatico', 'tecnico-semplice')
  ),
  onboarding_status text not null default 'not_started'
    check (onboarding_status in ('not_started', 'in_progress', 'completed', 'skipped')),
  last_question_key text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_mate_profile_user_id_idx on public.user_mate_profile (user_id);

create or replace function public.handle_user_mate_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_mate_profile_set_updated_at on public.user_mate_profile;
create trigger user_mate_profile_set_updated_at
before update on public.user_mate_profile
for each row
execute function public.handle_user_mate_profile_updated_at();

alter table public.user_mate_profile enable row level security;

drop policy if exists "Users can read own mate profile" on public.user_mate_profile;
create policy "Users can read own mate profile"
  on public.user_mate_profile
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own mate profile" on public.user_mate_profile;
create policy "Users can insert own mate profile"
  on public.user_mate_profile
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own mate profile" on public.user_mate_profile;
create policy "Users can update own mate profile"
  on public.user_mate_profile
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own mate profile" on public.user_mate_profile;
create policy "Users can delete own mate profile"
  on public.user_mate_profile
  for delete
  using (auth.uid() = user_id);
