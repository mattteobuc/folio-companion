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

type DiaryRow = {
  notes: string | null;
  mood: number | null;
  created_at: string;
  context_type: string | null;
  asset_id: string | null;
};

type DiaryAssetRow = {
  id: string;
  ticker: string;
};

type PurchasePlanRow = {
  title: string;
  ticker: string | null;
  cadence: "settimanale" | "quindicinale" | "mensile";
  amount: number;
  monthly_budget_limit: number | null;
  next_run_date: string;
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

    const { data: diaryRows } = await supabase
      .from("checkins")
      .select("notes, mood, created_at, context_type, asset_id")
      .eq("user_id", user.id)
      .not("notes", "is", null)
      .order("created_at", { ascending: false })
      .limit(6);
    const typedDiaryRows = ((diaryRows ?? []) as DiaryRow[]).filter((row) => row.notes?.trim());
    let diaryContext = "Nessuna nota diario recente.";
    if (typedDiaryRows.length > 0) {
      const assetIds = Array.from(new Set(typedDiaryRows.map((row) => row.asset_id).filter(Boolean))) as string[];
      const assetTickerById = new Map<string, string>();
      if (assetIds.length > 0) {
        const { data: assetRows } = await supabase
          .from("assets")
          .select("id, ticker")
          .in("id", assetIds);
        ((assetRows ?? []) as DiaryAssetRow[]).forEach((asset) => {
          if (asset.id && asset.ticker) assetTickerById.set(asset.id, asset.ticker);
        });
      }
      diaryContext = typedDiaryRows.map((row) => {
        const date = new Date(row.created_at).toLocaleDateString("it-IT");
        const mood = row.mood ? `${row.mood}/5` : "n/d";
        const ticker = row.asset_id ? assetTickerById.get(row.asset_id) : null;
        const contextLabel = row.context_type ?? "free_note";
        return `- ${date} | mood ${mood} | ${ticker ? `${ticker} | ` : ""}${contextLabel}: ${row.notes?.trim()}`;
      }).join("\n");
    }

    const { data: purchasePlanRows } = await supabase
      .from("purchase_plans")
      .select("title, ticker, cadence, amount, monthly_budget_limit, next_run_date")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("next_run_date", { ascending: true })
      .limit(5);
    const typedPurchasePlanRows = (purchasePlanRows ?? []) as PurchasePlanRow[];
    const plansContext = typedPurchasePlanRows.length > 0
      ? typedPurchasePlanRows.map((plan) => {
          const tickerLabel = plan.ticker?.trim() ? `${plan.ticker.trim().toUpperCase()} · ` : "";
          const budgetLabel = plan.monthly_budget_limit != null
            ? plan.amount > plan.monthly_budget_limit
              ? "attenzione budget"
              : "budget in linea"
            : "budget non impostato";
          return `- ${tickerLabel}${plan.title}: ${plan.cadence}, importo ${plan.amount}, prossima data ${plan.next_run_date}, ${budgetLabel}`;
        }).join("\n")
      : "Nessun piano di acquisto attivo.";

    const prompt =
      `Il portafoglio contiene: ${tickers.join(", ")}.\n\n` +
      `Notizie recenti rilevanti:\n${newsContext}\n\n` +
      `Piani di acquisto attivi:\n${plansContext}\n\n` +
      `Estratti dal diario personale:\n${diaryContext}\n\n` +
      `Genera esattamente 2-3 insight proattivi per l'investitore. Ogni insight deve:\n` +
      `- Essere diretto e specifico (menziona il ticker)\n` +
      `- Spiegare perché è rilevante ADESSO\n` +
      `- Essere scritto come un amico esperto che ti avvisa di qualcosa\n` +
      `- Tenere conto del tono emotivo emerso dal diario per essere empatico ma non paternalista\n` +
      `- Tenere conto dei piani di acquisto attivi e segnalare eventuali incoerenze di processo con alternative comportamentali (es. ridurre frequenza/importo, pausa)\n` +
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