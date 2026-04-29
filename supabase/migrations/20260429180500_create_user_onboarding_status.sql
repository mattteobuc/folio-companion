create table if not exists public.user_onboarding_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dashboard_tutorial_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_onboarding_status enable row level security;

create policy "Users can read own onboarding status"
  on public.user_onboarding_status
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own onboarding status"
  on public.user_onboarding_status
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own onboarding status"
  on public.user_onboarding_status
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
