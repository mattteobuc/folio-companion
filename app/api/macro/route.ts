import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type AssetTickerRow = {
  ticker: string;
};

export async function GET() {
  try {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: "Variabile ANTHROPIC_API_KEY mancante." },
        { status: 500 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });
    }

    const { data: portfolios, error: portfoliosError } = await supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", user.id);

    if (portfoliosError) {
      return NextResponse.json({ error: portfoliosError.message }, { status: 500 });
    }

    const portfolioIds = (portfolios ?? []).map((portfolio) => portfolio.id);
    const today = new Date();
    const todayLabel = today.toLocaleDateString("it-IT");

    let tickerList = "Nessun asset presente";

    if (portfolioIds.length > 0) {
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select("ticker")
        .in("portfolio_id", portfolioIds);

      if (assetsError) {
        return NextResponse.json({ error: assetsError.message }, { status: 500 });
      }

      const uniqueTickers = Array.from(
        new Set(
          ((assets ?? []) as AssetTickerRow[])
            .map((asset) => asset.ticker?.trim().toUpperCase())
            .filter((ticker): ticker is string => Boolean(ticker)),
        ),
      );

      if (uniqueTickers.length > 0) {
        tickerList = uniqueTickers.join(", ");
      }
    }

    const prompt =
      "Sei un assistente finanziario. " +
      `Oggi e ${todayLabel}. ` +
      `Ho un portafoglio composto da questi asset: ${tickerList}. ` +
      "Ci sono eventi macro rilevanti recenti (decisioni FED, dati inflazione, earnings, geopolitica) che potrebbero influenzare questi asset? " +
      "Spiegalo in 3-4 frasi semplici in italiano, senza mai dare consigli di acquisto o vendita.";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 260,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `Errore Claude API (${response.status}): ${errorBody}` },
        { status: 500 },
      );
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const text =
      data.content?.find((block) => block.type === "text" && block.text)?.text?.trim() ?? "";

    if (!text) {
      return NextResponse.json(
        { error: "Claude non ha restituito un contenuto valido." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      testo: text,
      data: todayLabel,
      tickers: tickerList,
    });
  } catch (error) {
    console.error("Errore route /api/macro:", error);
    return NextResponse.json(
      { error: "Errore inatteso durante il recupero del contesto macro." },
      { status: 500 },
    );
  }
}
