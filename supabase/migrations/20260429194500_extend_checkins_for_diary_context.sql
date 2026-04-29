alter table if exists public.checkins
  add column if not exists asset_id uuid references public.assets(id) on delete set null,
  add column if not exists portfolio_id uuid references public.portfolios(id) on delete set null,
  add column if not exists context_type text not null default 'free_note';

create index if not exists checkins_user_created_at_idx
  on public.checkins(user_id, created_at desc);

create index if not exists checkins_asset_context_idx
  on public.checkins(asset_id, context_type);
