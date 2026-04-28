import { NextResponse } from "next/server";

type TwelveDataSymbol = {
  symbol?: string;
  instrument_name?: string;
  exchange?: string;
  instrument_type?: string;
};

// Mappa i tipi di Twelve Data ai tipi della nostra app
function mapAssetType(twelveDataType?: string): string {
  if (!twelveDataType) return "Altro";
  const type = twelveDataType.toLowerCase();
  if (type.includes("etf")) return "ETF";
  if (type.includes("common stock") || type.includes("equity")) return "Azione";
  if (type.includes("bond") || type.includes("obbligaz")) return "Obbligazione";
  if (type.includes("crypto") || type.includes("digital")) return "Crypto";
  return "Altro";
}

export async function GET(request: Request) {
  try {
    const twelveDataApiKey = process.env.TWELVE_DATA_API_KEY;
    if (!twelveDataApiKey) {
      return NextResponse.json(
        { error: "Variabile TWELVE_DATA_API_KEY mancante." },
        { status: 500 },
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim() ?? "";

    if (query.length < 3) {
      return NextResponse.json({ data: [] });
    }

    const twelveDataUrl = new URL("https://api.twelvedata.com/symbol_search");
    twelveDataUrl.searchParams.set("symbol", query);
    twelveDataUrl.searchParams.set("apikey", twelveDataApiKey);

    const response = await fetch(twelveDataUrl.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `Errore Twelve Data API (${response.status}): ${errorBody}` },
        { status: 500 },
      );
    }

    const payload = (await response.json()) as { data?: TwelveDataSymbol[] };

    const normalized = (payload.data ?? [])
      .filter((item) => item.symbol && item.instrument_name)
      .map((item) => ({
        ticker: item.symbol?.trim().toUpperCase() ?? "",
        name: item.instrument_name?.trim() ?? "",
        market: item.exchange?.trim() || "Mercato non disponibile",
        asset_type: mapAssetType(item.instrument_type),
      }));

    return NextResponse.json({ data: normalized });
  } catch (error) {
    console.error("Errore route /api/symbol-search:", error);
    return NextResponse.json(
      { error: "Errore inatteso durante la ricerca simboli." },
      { status: 500 },
    );
  }
}