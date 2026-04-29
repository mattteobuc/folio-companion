import { NextResponse } from "next/server";

const MARKET_SUFFIXES = ["", ".MI", ".AS", ".L", ".PA", ".DE", ".F", ".SW", ".MC"];

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

async function fetchTickerSeries(symbol: string, period1: number, period2: number) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as YahooChartResponse;
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  if (timestamps.length === 0 || closes.length === 0) return null;
  const points = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().split("T")[0],
      close: closes[index],
    }))
    .filter((point): point is { date: string; close: number } => point.close != null && point.close > 0);
  return points.length > 1 ? points : null;
}

async function fetchSeriesWithFallback(rawTicker: string, period1: number, period2: number) {
  for (const suffix of MARKET_SUFFIXES) {
    const candidate = suffix ? `${rawTicker}${suffix}` : rawTicker;
    const series = await fetchTickerSeries(candidate, period1, period2);
    if (series) return series;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { tickers?: string[]; days?: number };
    const tickers = (body.tickers ?? [])
      .map((ticker) => ticker?.trim().toUpperCase())
      .filter((ticker): ticker is string => Boolean(ticker));
    const days = Math.min(Math.max(Number(body.days ?? 90), 30), 365);
    if (tickers.length === 0) return NextResponse.json({ series: {} });

    const endTimestamp = Math.floor(Date.now() / 1000);
    const startTimestamp = endTimestamp - days * 24 * 60 * 60;
    const seriesEntries = await Promise.all(
      tickers.map(async (ticker) => [ticker, await fetchSeriesWithFallback(ticker, startTimestamp, endTimestamp)] as const),
    );
    const series = Object.fromEntries(seriesEntries.filter((entry): entry is [string, Array<{ date: string; close: number }>] => Array.isArray(entry[1])));
    return NextResponse.json({ series });
  } catch (error) {
    console.error("Errore route /api/portfolio-history:", error);
    return NextResponse.json({ error: "Errore nel recupero dello storico portafoglio." }, { status: 500 });
  }
}
