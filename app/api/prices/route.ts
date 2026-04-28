import { NextResponse } from "next/server";

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

    // Twelve Data accetta più ticker separati da virgola
    const tickerString = tickers.join(",");
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(tickerString)}&apikey=${apiKey}`;

    const response = await fetch(url, { next: { revalidate: 60 } });
    const data = await response.json();

    // Se c'è un solo ticker la risposta è diversa da più ticker
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

    return NextResponse.json({ prices });
  } catch (error) {
    console.error("Errore API prezzi:", error);
    return NextResponse.json({ error: "Errore nel recupero prezzi" }, { status: 500 });
  }
}