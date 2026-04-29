import { NextResponse } from "next/server";

async function fetchYahooCurrentPrice(ticker: string): Promise<number | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const fiveDaysAgo = now - 5 * 24 * 60 * 60;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${fiveDaysAgo}&period2=${now}&interval=1d`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      chart?: {
        result?: Array<{
          meta?: { regularMarketPrice?: number };
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
      };
    };
    const result = data.chart?.result?.[0];
    // Prima prova regularMarketPrice dal meta (più aggiornato)
    if (result?.meta?.regularMarketPrice) return result.meta.regularMarketPrice;
    // Fallback: ultimo close disponibile
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const lastClose = [...closes].reverse().find((c) => c !== null && c !== undefined && c > 0);
    return lastClose ?? null;
  } catch {
    return null;
  }
}

// Prova varianti di mercato europee per ticker non trovati
const MARKET_SUFFIXES = ["", ".MI", ".AS", ".L", ".PA", ".DE", ".F", ".SW", ".MC"];

async function fetchYahooWithFallback(ticker: string): Promise<number | null> {
  for (const suffix of MARKET_SUFFIXES) {
    const candidate = suffix ? `${ticker}${suffix}` : ticker;
    const price = await fetchYahooCurrentPrice(candidate);
    if (price !== null) return price;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const { tickers } = (await request.json()) as { tickers: string[] };
    if (!tickers || tickers.length === 0) {
      return NextResponse.json({ prices: {} });
    }

    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key mancante" }, { status: 500 });
    }

    // ── STEP 1: Twelve Data per tutti i ticker ──
    const tickerString = tickers.join(",");
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(tickerString)}&apikey=${apiKey}`;
    const response = await fetch(url, { next: { revalidate: 60 } });
    const data = await response.json();

    const prices: Record<string, number | null> = {};

    if (tickers.length === 1) {
      const ticker = tickers[0];
      prices[ticker] = data.price ? parseFloat(data.price) : null;
    } else {
      for (const ticker of tickers) {
        const entry = data[ticker];
        prices[ticker] = entry?.price ? parseFloat(entry.price) : null;
      }
    }

    // ── STEP 2: fallback Yahoo Finance per i ticker che Twelve Data non ha trovato ──
    const missingTickers = tickers.filter((t) => prices[t] === null || prices[t] === undefined);

    if (missingTickers.length > 0) {
      await Promise.all(
        missingTickers.map(async (ticker) => {
          const yahooPrice = await fetchYahooWithFallback(ticker);
          if (yahooPrice !== null) {
            prices[ticker] = yahooPrice;
          }
        }),
      );
    }

    return NextResponse.json({ prices });
  } catch (error) {
    console.error("Errore API prezzi:", error);
    return NextResponse.json({ error: "Errore nel recupero prezzi" }, { status: 500 });
  }
}