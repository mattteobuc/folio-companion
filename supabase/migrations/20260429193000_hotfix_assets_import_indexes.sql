alter table if exists public.assets
  add column if not exists source_platform text not null default 'unknown',
  add column if not exists external_symbol text,
  add column if not exists import_batch_id uuid;

drop index if exists public.assets_unique_portfolio_platform_ticker_idx;
drop index if exists public.assets_unique_portfolio_platform_name_when_no_ticker_idx;

create index if not exists assets_portfolio_platform_ticker_idx
  on public.assets (portfolio_id, source_platform, ticker);

create index if not exists assets_portfolio_platform_name_idx
  on public.assets (portfolio_id, source_platform, lower(name));
