import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type AssetNewsRow = {
  ticker: string | null;
  name: string | null;
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

type NewsApiArticle = {
  title: string;
  url: string;
  publishedAt: string;
  source?: {
    name?: string;
  };
  description?: string;
  content?: string;
};

type ProviderErrorInfo = {
  provider: "gnews" | "newsapi";
  query: string;
  status?: number;
  message: string;
};

const SUMMARY_SYSTEM_PROMPT =
  "Sei un assistente finanziario. Riassumi questa notizia in massimo 2 frasi in italiano, spiegando perché potrebbe essere rilevante per chi possiede questo asset. Non dare mai consigli di acquisto o vendita. Tono: chiaro, diretto, non allarmistico.";

function normalizeTitleKey(title: string) {
  return title.trim().toLowerCase();
}

function normalizeTicker(ticker: string | null | undefined) {
  return (ticker ?? "").trim().toUpperCase();
}

function normalizeAssetName(name: string | null | undefined) {
  return (name ?? "").trim().replace(/\s+/g, " ");
}

function isLikelyPlaceholderTicker(ticker: string) {
  return (
    ticker.length < 2 ||
    ticker.startsWith("IMP_") ||
    ticker === "N/A" ||
    ticker === "NA" ||
    ticker === "UNKNOWN" ||
    ticker === "TBD"
  );
}

function buildFallbackSummary(input: { ticker: string; title: string; source: string }) {
  // Fallback non bloccante: manteniamo la notizia visibile anche se il provider AI non risponde.
  return `Notizia su ${input.ticker} da ${input.source}: "${input.title}". Considerala come spunto di monitoraggio e confrontala con il tuo orizzonte e il peso dell'asset in portafoglio.`;
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

async function fetchArticlesFromGNews(
  query: string,
  apiKey: string,
): Promise<{ articles: GNewsArticle[]; error: ProviderErrorInfo | null }> {
  const gnewsUrl = new URL("https://gnews.io/api/v4/search");
  gnewsUrl.searchParams.set("q", query);
  gnewsUrl.searchParams.set("lang", "en");
  gnewsUrl.searchParams.set("max", "5");
  gnewsUrl.searchParams.set("apikey", apiKey);

  const gnewsResponse = await fetch(gnewsUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!gnewsResponse.ok) {
    const errorBody = await gnewsResponse.text();
    return {
      articles: [],
      error: {
        provider: "gnews",
        query,
        status: gnewsResponse.status,
        message: errorBody.slice(0, 400),
      },
    };
  }
  const gnewsPayload = (await gnewsResponse.json()) as { articles?: GNewsArticle[] };
  return { articles: gnewsPayload.articles ?? [], error: null };
}

async function fetchArticlesFromNewsApi(
  query: string,
  apiKey: string,
): Promise<{ articles: NewsApiArticle[]; error: ProviderErrorInfo | null }> {
  const newsApiUrl = new URL("https://newsapi.org/v2/everything");
  newsApiUrl.searchParams.set("q", query);
  newsApiUrl.searchParams.set("language", "en");
  newsApiUrl.searchParams.set("sortBy", "publishedAt");
  newsApiUrl.searchParams.set("pageSize", "5");
  newsApiUrl.searchParams.set("apiKey", apiKey);

  const newsApiResponse = await fetch(newsApiUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!newsApiResponse.ok) {
    const errorBody = await newsApiResponse.text();
    return {
      articles: [],
      error: {
        provider: "newsapi",
        query,
        status: newsApiResponse.status,
        message: errorBody.slice(0, 400),
      },
    };
  }
  const newsApiPayload = (await newsApiResponse.json()) as { articles?: NewsApiArticle[] };
  return { articles: newsApiPayload.articles ?? [], error: null };
}

async function fetchArticlesWithProviderFallback(
  query: string,
  gnewsApiKey: string | undefined,
  newsApiKey: string | undefined,
) {
  const providerErrors: ProviderErrorInfo[] = [];
  const gnewsResult = gnewsApiKey
    ? await fetchArticlesFromGNews(query, gnewsApiKey)
    : { articles: [], error: null };
  if (gnewsResult.error) providerErrors.push(gnewsResult.error);

  if (gnewsResult.articles.length > 0 || !newsApiKey) {
    return { articles: gnewsResult.articles, providerErrors };
  }

  const newsApiResult = await fetchArticlesFromNewsApi(query, newsApiKey);
  if (newsApiResult.error) providerErrors.push(newsApiResult.error);

  return {
    articles: newsApiResult.articles.map((article) => ({
      title: article.title,
      url: article.url,
      publishedAt: article.publishedAt,
      source: article.source,
      description: article.description,
      content: article.content,
    })),
    providerErrors,
  };
}

async function handleNewsRequest(cachedSummaries: Record<string, string> = {}) {
  try {
    const gnewsApiKey = process.env.GNEWS_API_KEY;
    const newsApiKey = process.env.NEWS_API_KEY ?? process.env.NEWSAPI_KEY;

    if (!gnewsApiKey && !newsApiKey) {
      return NextResponse.json(
        { error: "Variabili news API mancanti (GNEWS_API_KEY o NEWS_API_KEY)." },
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
      return NextResponse.json({
        news: [],
        meta: {
          hasAssets: false,
          hasValidTickers: false,
          usedNameFallback: false,
          providerDegraded: false,
          providerErrorsCount: 0,
          usedMarketFallback: false,
        },
      });
    }

    const portfolioIds = portfolios.map((portfolio) => portfolio.id);
    const { data: assets, error: assetsError } = await supabase
      .from("assets")
      .select("ticker, name")
      .in("portfolio_id", portfolioIds);

    if (assetsError) {
      return NextResponse.json({ error: assetsError.message }, { status: 500 });
    }

    const assetRows = (assets ?? []) as AssetNewsRow[];
    const normalizedAssets = assetRows.map((asset) => ({
      ticker: normalizeTicker(asset.ticker),
      name: normalizeAssetName(asset.name),
    }));
    const hasAssets = normalizedAssets.length > 0;
    const hasValidTickers = normalizedAssets.some(
      (asset) => asset.ticker.length > 0 && !isLikelyPlaceholderTicker(asset.ticker),
    );

    if (!hasAssets) {
      return NextResponse.json({
        news: [],
        meta: {
          hasAssets: false,
          hasValidTickers: false,
          usedNameFallback: false,
          providerDegraded: false,
          providerErrorsCount: 0,
          usedMarketFallback: false,
        },
      });
    }

    const newsResults: Array<{
      ticker: string;
      titolo: string;
      fonte: string;
      url: string;
      data: string;
      riassunto: string;
    }> = [];
    let usedNameFallback = false;
    let usedMarketFallback = false;
    const seenAssetKeys = new Set<string>();
    const providerErrors: ProviderErrorInfo[] = [];

    for (const asset of normalizedAssets) {
      const assetKey = `${asset.ticker}|${asset.name}`;
      if (seenAssetKeys.has(assetKey)) continue;
      seenAssetKeys.add(assetKey);

      const tickerQuery = asset.ticker && !isLikelyPlaceholderTicker(asset.ticker) ? asset.ticker : null;
      const nameQuery = asset.name || null;
      const searchQueries = [tickerQuery, nameQuery].filter((query, idx, arr): query is string => {
        if (!query) return false;
        return arr.indexOf(query) === idx;
      });

      if (searchQueries.length === 0) continue;

      let mergedArticles: GNewsArticle[] = [];
      let matchedQuery = searchQueries[0];

      for (let index = 0; index < searchQueries.length; index += 1) {
        const query = searchQueries[index];
        const providerResult = await fetchArticlesWithProviderFallback(query, gnewsApiKey, newsApiKey);
        providerErrors.push(...providerResult.providerErrors);
        const currentArticles = providerResult.articles;
        if (currentArticles.length > 0) {
          mergedArticles = currentArticles;
          matchedQuery = query;
          if (index > 0) usedNameFallback = true;
          break;
        }
      }

      if (mergedArticles.length === 0) continue;
      const assetLabel = tickerQuery ?? nameQuery ?? "ASSET";

      for (const article of mergedArticles) {
        try {
          const sourceName = article.source?.name?.trim() || "Fonte non disponibile";
          const cacheKey = normalizeTitleKey(article.title ?? "");
          let summary = cacheKey ? cachedSummaries[cacheKey] : undefined;

          if (!summary) {
            try {
              summary = await summarizeWithClaude({
                ticker: assetLabel,
                title: article.title,
                source: sourceName,
                date: article.publishedAt,
                url: article.url,
                description: article.description ?? "",
                content: article.content ?? "",
              });
            } catch (summaryError) {
              console.error("Errore riassunto notizia (fallback attivo):", {
                ticker: assetLabel,
                query: matchedQuery,
                title: article.title,
                error: summaryError,
              });
              summary = buildFallbackSummary({
                ticker: assetLabel,
                title: article.title,
                source: sourceName,
              });
            }
          }

          newsResults.push({
            ticker: assetLabel,
            titolo: article.title,
            fonte: sourceName,
            url: article.url,
            data: article.publishedAt,
            riassunto: summary,
          });
        } catch (error) {
          console.error("Errore elaborazione notizia:", {
            ticker: assetLabel,
            query: matchedQuery,
            title: article.title,
            error,
          });
        }
      }
    }

    if (newsResults.length === 0 && hasAssets) {
      const marketFallbackQuery = "stock market OR inflation OR interest rates";
      const marketResult = await fetchArticlesWithProviderFallback(marketFallbackQuery, gnewsApiKey, newsApiKey);
      providerErrors.push(...marketResult.providerErrors);
      if (marketResult.articles.length > 0) {
        usedMarketFallback = true;
        for (const article of marketResult.articles) {
          try {
            const sourceName = article.source?.name?.trim() || "Fonte non disponibile";
            const cacheKey = normalizeTitleKey(article.title ?? "");
            let summary = cacheKey ? cachedSummaries[cacheKey] : undefined;
            if (!summary) {
              try {
                summary = await summarizeWithClaude({
                  ticker: "MACRO",
                  title: article.title,
                  source: sourceName,
                  date: article.publishedAt,
                  url: article.url,
                  description: article.description ?? "",
                  content: article.content ?? "",
                });
              } catch {
                summary = buildFallbackSummary({
                  ticker: "MACRO",
                  title: article.title,
                  source: sourceName,
                });
              }
            }
            newsResults.push({
              ticker: "MACRO",
              titolo: article.title,
              fonte: sourceName,
              url: article.url,
              data: article.publishedAt,
              riassunto: summary,
            });
          } catch (error) {
            console.error("Errore elaborazione market fallback:", { title: article.title, error });
          }
        }
      }
    }

    const dedupedNews = Array.from(
      new Map(
        newsResults
          .filter((item) => item.titolo?.trim() && item.url?.trim() && item.data?.trim())
          .map((item) => [item.url, item]),
      ).values(),
    ).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    if (providerErrors.length > 0) {
      console.error("Provider news degradati:", providerErrors);
    }
    return NextResponse.json({
      news: dedupedNews,
      meta: {
        hasAssets,
        hasValidTickers,
        usedNameFallback,
        providerDegraded: providerErrors.length > 0,
        providerErrorsCount: providerErrors.length,
        usedMarketFallback,
      },
    });
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
