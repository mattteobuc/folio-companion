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
      `Oggi è ${todayLabel}. Il portafoglio contiene: ${tickerList}.\n\n` +
      "Analizza il contesto macro attuale e restituisci un report strutturato in questo formato esatto:\n\n" +
      "Per ogni topic rilevante (max 3 topic tra: Banche Centrali, Inflazione, Geopolitica, Earnings, Mercati, Crypto, Energia) scrivi:\n\n" +
      "TOPIC: [nome topic]\n" +
      "SENTIMENT: [Positivo / Negativo / Neutro / Misto]\n" +
      "ANALISI: [1-2 frasi secche e informative su cosa sta succedendo e perché è rilevante per il portafoglio]\n\n" +
      "Includi solo i topic effettivamente rilevanti per gli asset in portafoglio.\n" +
      "Non dare mai consigli di acquisto o vendita.\n" +
      "Scrivi in italiano, tono diretto e professionale.\n" +
      "Non aggiungere introduzioni, conclusioni o note finali.";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
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

    // Parsa il testo strutturato in blocchi topic
    const topics: Array<{ topic: string; sentiment: string; analisi: string }> = [];
    const blocks = text.split(/\n(?=TOPIC:)/);

    for (const block of blocks) {
      const topicMatch = block.match(/TOPIC:\s*(.+)/);
      const sentimentMatch = block.match(/SENTIMENT:\s*(.+)/);
      const analisiMatch = block.match(/ANALISI:\s*([\s\S]+?)(?:\n\n|$)/);

      if (topicMatch && sentimentMatch && analisiMatch) {
        topics.push({
          topic: topicMatch[1].trim(),
          sentiment: sentimentMatch[1].trim(),
          analisi: analisiMatch[1].trim(),
        });
      }
    }

    return NextResponse.json({
      testo: text,
      topics: topics.length > 0 ? topics : null,
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