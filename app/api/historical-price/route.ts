import { NextResponse } from "next/server";

// Suffissi di mercato da provare per ticker europei e internazionali
const MARKET_SUFFIXES = ["", ".MI", ".AS", ".L", ".PA", ".DE", ".F", ".SW", ".MC", ".BR", ".LS"];

// Cerca il prezzo su Yahoo Finance con un ticker specifico e una finestra temporale
async function fetchYahooPrice(
  ticker: string,
  startTimestamp: number,
  endTimestamp: number,
): Promise<{ price: number; date: string } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
        error?: { description?: string };
      };
    };

    const result = data.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close;
    const timestamps = result?.timestamp;

    if (!closes || !timestamps || closes.length === 0) return null;

    const validIndex = closes.findIndex((c) => c !== null && c !== undefined && c > 0);
    if (validIndex === -1) return null;

    const price = closes[validIndex]!;
    const actualDate = new Date(timestamps[validIndex] * 1000).toISOString().split("T")[0];
    return { price, date: actualDate };
  } catch {
    return null;
  }
}

// Prova a trovare il ticker corretto su Yahoo cercando varianti
async function searchYahooTicker(query: string): Promise<string | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=5&newsCount=0`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      quotes?: Array<{ symbol?: string; quoteType?: string }>;
    };
    const quotes = data.quotes ?? [];
    // Preferisci EQUITY o ETF
    const best = quotes.find(
      (q) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"),
    );
    return best?.symbol ?? quotes[0]?.symbol ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { ticker, date } = (await request.json()) as { ticker: string; date: string };

    if (!ticker || !date) {
      return NextResponse.json({ error: "Ticker e data sono obbligatori." }, { status: 400 });
    }

    const dateObj = new Date(date);
    const startTimestamp = Math.floor(dateObj.getTime() / 1000);

    // Finestra di 30 giorni per coprire weekend, festivi e dati mancanti
    const endTimestamp = startTimestamp + 30 * 24 * 60 * 60;

    // ── STEP 1: prova ticker esatto con tutti i suffissi di mercato ──
    for (const suffix of MARKET_SUFFIXES) {
      const candidateTicker = suffix ? `${ticker}${suffix}` : ticker;
      const result = await fetchYahooPrice(candidateTicker, startTimestamp, endTimestamp);
      if (result) {
        return NextResponse.json({ price: result.price, date: result.date, ticker: candidateTicker });
      }
    }

    // ── STEP 2: cerca il ticker corretto tramite Yahoo Search ──
    const foundTicker = await searchYahooTicker(ticker);
    if (foundTicker && foundTicker.toUpperCase() !== ticker.toUpperCase()) {
      const result = await fetchYahooPrice(foundTicker, startTimestamp, endTimestamp);
      if (result) {
        return NextResponse.json({ price: result.price, date: result.date, ticker: foundTicker });
      }
    }

    // ── STEP 3: prova con finestra estesa a 90 giorni prima della data ──
    // Utile per date molto vecchie o mercati con pochi dati
    const wideStart = startTimestamp - 90 * 24 * 60 * 60;
    const wideEnd = startTimestamp + 90 * 24 * 60 * 60;

    for (const suffix of MARKET_SUFFIXES) {
      const candidateTicker = suffix ? `${ticker}${suffix}` : ticker;
      const result = await fetchYahooPrice(candidateTicker, wideStart, wideEnd);
      if (result) {
        return NextResponse.json({
          price: result.price,
          date: result.date,
          ticker: candidateTicker,
          approximate: true,
        });
      }
    }

    // Nessun fallback ha funzionato
    return NextResponse.json(
      {
        error:
          `Prezzo storico non trovato per "${ticker}". Prova a inserire il ticker esatto come appare sul tuo broker (es. IWDA.AS per iShares MSCI World su Euronext Amsterdam).`,
      },
      { status: 404 },
    );
  } catch (error) {
    console.error("Errore API prezzi storici:", error);
    return NextResponse.json(
      { error: "Errore nel recupero del prezzo storico." },
      { status: 500 },
    );
  }
}