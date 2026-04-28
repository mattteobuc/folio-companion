import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { ticker, date } = (await request.json()) as { ticker: string; date: string };

    if (!ticker || !date) {
      return NextResponse.json({ error: "Ticker e data sono obbligatori." }, { status: 400 });
    }

    // Converti la data in timestamp Unix per Yahoo Finance
    const dateObj = new Date(date);
    const startTimestamp = Math.floor(dateObj.getTime() / 1000);
    // Fine periodo = 5 giorni dopo per coprire weekend e festivi
    const endTimestamp = startTimestamp + 5 * 24 * 60 * 60;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Prezzo storico non disponibile per questo ticker." },
        { status: 404 },
      );
    }

    const data = await response.json() as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: {
            quote?: Array<{ close?: (number | null)[] }>;
          };
          meta?: { currency?: string };
        }>;
        error?: { description?: string };
      };
    };

    const result = data.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close;
    const timestamps = result?.timestamp;

    if (!closes || !timestamps || closes.length === 0) {
      return NextResponse.json(
        { error: "Nessun dato disponibile per questa data. Prova una data diversa." },
        { status: 404 },
      );
    }

    // Prendi il primo prezzo di chiusura valido
    const validIndex = closes.findIndex((c) => c !== null && c !== undefined);
    if (validIndex === -1) {
      return NextResponse.json(
        { error: "Prezzo non disponibile per questa data. Prova una data diversa." },
        { status: 404 },
      );
    }

    const price = closes[validIndex]!;
    const actualDate = new Date(timestamps[validIndex] * 1000).toISOString().split("T")[0];

    return NextResponse.json({ price, date: actualDate });

  } catch (error) {
    console.error("Errore API prezzi storici:", error);
    return NextResponse.json(
      { error: "Errore nel recupero del prezzo storico." },
      { status: 500 },
    );
  }
}