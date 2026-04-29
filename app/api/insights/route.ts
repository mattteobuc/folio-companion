import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type AssetTickerRow = { ticker: string };
type NewsItem = {
  ticker: string;
  titolo: string;
  fonte: string;
  url: string;
  data: string;
  riassunto: string;
};

export async function POST(request: Request) {
  try {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY mancante." }, { status: 500 });
    }

    const body = (await request.json()) as { news?: NewsItem[] };
    const news = body.news ?? [];

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });

    // Carica portafoglio
    const { data: portfolios } = await supabase
      .from("portfolios").select("id").eq("user_id", user.id);
    const portfolioIds = (portfolios ?? []).map((p) => p.id);

    if (portfolioIds.length === 0) return NextResponse.json({ insights: [] });

    const { data: assets } = await supabase
      .from("assets").select("ticker").in("portfolio_id", portfolioIds);
    const tickers = Array.from(new Set(
      ((assets ?? []) as AssetTickerRow[])
        .map((a) => a.ticker?.trim().toUpperCase())
        .filter(Boolean),
    ));

    if (tickers.length === 0) return NextResponse.json({ insights: [] });

    // Costruisci contesto notizie rilevanti
    const relevantNews = news.filter((n) => tickers.includes(n.ticker?.toUpperCase()));
    const newsContext = relevantNews.length > 0
      ? relevantNews.map((n) =>
          `Ticker: ${n.ticker}\nTitolo: ${n.titolo}\nRiassunto: ${n.riassunto}\nURL: ${n.url}`
        ).join("\n\n")
      : "Nessuna notizia recente disponibile.";

    const prompt =
      `Il portafoglio contiene: ${tickers.join(", ")}.\n\n` +
      `Notizie recenti rilevanti:\n${newsContext}\n\n` +
      `Genera esattamente 2-3 insight proattivi per l'investitore. Ogni insight deve:\n` +
      `- Essere diretto e specifico (menziona il ticker)\n` +
      `- Spiegare perché è rilevante ADESSO\n` +
      `- Essere scritto come un amico esperto che ti avvisa di qualcosa\n` +
      `- NON dare mai consigli di acquisto o vendita\n\n` +
      `Rispondi SOLO con un array JSON valido in questo formato:\n` +
      `[\n` +
      `  {\n` +
      `    "ticker": "AAPL",\n` +
      `    "titolo": "Titolo breve insight (max 6 parole)",\n` +
      `    "contenuto": "Testo dell'insight in 2 frasi max",\n` +
      `    "tipo": "attenzione" | "opportunità" | "info",\n` +
      `    "news_url": "url della notizia correlata o null",\n` +
      `    "news_titolo": "titolo della notizia correlata o null"\n` +
      `  }\n` +
      `]\n` +
      `Nessun testo prima o dopo il JSON.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Errore Claude API" }, { status: 500 });
    }

    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((b) => b.type === "text")?.text?.trim() ?? "[]";

    let insights: unknown[] = [];
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      insights = JSON.parse(clean) as unknown[];
    } catch {
      insights = [];
    }

    // Salva gli insight su Supabase (sostituisce i precedenti)
    await supabase.from("companion_insights").delete().eq("user_id", user.id);
    if (insights.length > 0) {
      await supabase.from("companion_insights").insert(
        (insights as Array<{
          ticker?: string;
          titolo?: string;
          contenuto?: string;
          tipo?: string;
          news_url?: string;
          news_titolo?: string;
        }>).map((ins) => ({
          user_id: user.id,
          content: ins.contenuto ?? "",
          ticker: ins.ticker ?? null,
          news_url: ins.news_url ?? null,
          news_title: ins.news_titolo ?? null,
          titolo: ins.titolo ?? null,
          tipo: ins.tipo ?? "info",
        })),
      );
    }

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("Errore route /api/insights:", error);
    return NextResponse.json({ error: "Errore inatteso." }, { status: 500 });
  }
}