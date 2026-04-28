import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type AssetTickerRow = {
  ticker: string;
};

type GNewsArticle = {
  title: string;
  url: string;
  publishedAt: string;
  source?: {
    name?: string;
  };
  description?: string;
  content?: string;
};

const SUMMARY_SYSTEM_PROMPT =
  "Sei un assistente finanziario. Riassumi questa notizia in massimo 2 frasi in italiano, spiegando perché potrebbe essere rilevante per chi possiede questo asset. Non dare mai consigli di acquisto o vendita. Tono: chiaro, diretto, non allarmistico.";

function normalizeTitleKey(title: string) {
  return title.trim().toLowerCase();
}

async function summarizeWithClaude(input: {
  ticker: string;
  title: string;
  source: string;
  date: string;
  url: string;
  description: string;
  content: string;
}) {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    throw new Error("Variabile ANTHROPIC_API_KEY mancante.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 220,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `Ticker: ${input.ticker}\n` +
            `Titolo: ${input.title}\n` +
            `Fonte: ${input.source}\n` +
            `Data: ${input.date}\n` +
            `URL: ${input.url}\n` +
            `Descrizione: ${input.description}\n` +
            `Contenuto: ${input.content}\n`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Errore Claude API (${response.status}): ${errorBody}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const summaryText =
    data.content?.find((block) => block.type === "text" && block.text)?.text?.trim() ?? "";

  if (!summaryText) {
    throw new Error("Claude non ha restituito un riassunto valido.");
  }

  return summaryText;
}

async function handleNewsRequest(cachedSummaries: Record<string, string> = {}) {
  try {
    const gnewsApiKey = process.env.GNEWS_API_KEY;

    if (!gnewsApiKey) {
      return NextResponse.json(
        { error: "Variabile GNEWS_API_KEY mancante." },
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

    if (!portfolios || portfolios.length === 0) {
      return NextResponse.json({ news: [] });
    }

    const portfolioIds = portfolios.map((portfolio) => portfolio.id);
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

    if (uniqueTickers.length === 0) {
      return NextResponse.json({ news: [] });
    }

    const newsResults: Array<{
      ticker: string;
      titolo: string;
      fonte: string;
      url: string;
      data: string;
      riassunto: string;
    }> = [];

    for (const ticker of uniqueTickers) {
      const gnewsUrl = new URL("https://gnews.io/api/v4/search");
      gnewsUrl.searchParams.set("q", `${ticker} stock`);
      gnewsUrl.searchParams.set("lang", "en");
      gnewsUrl.searchParams.set("max", "3");
      gnewsUrl.searchParams.set("apikey", gnewsApiKey);

      const gnewsResponse = await fetch(gnewsUrl.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!gnewsResponse.ok) {
        const errorBody = await gnewsResponse.text();
        console.error("Errore GNews API:", { ticker, status: gnewsResponse.status, errorBody });
        continue;
      }

      const gnewsPayload = (await gnewsResponse.json()) as { articles?: GNewsArticle[] };
      const articles = gnewsPayload.articles ?? [];

      for (const article of articles) {
        try {
          const sourceName = article.source?.name?.trim() || "Fonte non disponibile";
          const cacheKey = normalizeTitleKey(article.title ?? "");
          let summary = cacheKey ? cachedSummaries[cacheKey] : undefined;

          if (!summary) {
            summary = await summarizeWithClaude({
              ticker,
              title: article.title,
              source: sourceName,
              date: article.publishedAt,
              url: article.url,
              description: article.description ?? "",
              content: article.content ?? "",
            });
          }

          newsResults.push({
            ticker,
            titolo: article.title,
            fonte: sourceName,
            url: article.url,
            data: article.publishedAt,
            riassunto: summary,
          });
        } catch (error) {
          console.error("Errore riassunto notizia:", { ticker, title: article.title, error });
        }
      }
    }

    return NextResponse.json({ news: newsResults });
  } catch (error) {
    console.error("Errore route /api/news:", error);
    return NextResponse.json(
      { error: "Errore inatteso durante il recupero delle notizie." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return handleNewsRequest();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      cachedSummaries?: Record<string, string>;
    };

    return handleNewsRequest(body.cachedSummaries ?? {});
  } catch {
    return handleNewsRequest();
  }
}
