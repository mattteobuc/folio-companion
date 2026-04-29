create table if not exists public.asset_alert_thresholds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  positive_threshold numeric,
  negative_threshold numeric,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_alert_thresholds_positive_check check (positive_threshold is null or positive_threshold >= 0),
  constraint asset_alert_thresholds_negative_check check (negative_threshold is null or negative_threshold >= 0),
  constraint asset_alert_thresholds_unique_user_asset unique (user_id, asset_id)
);

create index if not exists asset_alert_thresholds_user_id_idx
  on public.asset_alert_thresholds(user_id);

create index if not exists asset_alert_thresholds_asset_id_idx
  on public.asset_alert_thresholds(asset_id);

alter table public.asset_alert_thresholds enable row level security;

create policy "Users can read own alert thresholds"
  on public.asset_alert_thresholds
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own alert thresholds"
  on public.asset_alert_thresholds
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own alert thresholds"
  on public.asset_alert_thresholds
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own alert thresholds"
  on public.asset_alert_thresholds
  for delete
  using (auth.uid() = user_id);
