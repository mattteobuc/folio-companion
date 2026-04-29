alter table if exists public.assets
  add column if not exists source_platform text not null default 'unknown',
  add column if not exists external_symbol text,
  add column if not exists import_batch_id uuid;

create unique index if not exists assets_unique_portfolio_platform_ticker_idx
  on public.assets (portfolio_id, source_platform, ticker)
  where ticker is not null and length(trim(ticker)) > 0;

create unique index if not exists assets_unique_portfolio_platform_name_when_no_ticker_idx
  on public.assets (portfolio_id, source_platform, lower(name))
  where (ticker is null or length(trim(ticker)) = 0);
