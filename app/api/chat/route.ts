import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AssetPositionRow = {
  ticker: string;
  quantity: number;
};

const CHAT_SYSTEM_PROMPT_TEMPLATE = `Sei Folio, un compagno finanziario personale — caldo, empatico e competente. Il tuo stile è quello di un amico esperto di finanza che conosce bene il portafoglio dell'utente e si preoccupa genuinamente per il suo benessere finanziario.

Il portafoglio dell'utente è composto da: [PORTFOLIO].

Linee guida:
- Inizia sempre riconoscendo la domanda dell'utente con empatia, specialmente se esprime preoccupazione o incertezza
- Usa il portafoglio specifico dell'utente per personalizzare le risposte (es. "nel tuo caso con AAPL..." o "dato che hai ETF come...")
- NON dare mai consigli diretti di acquisto o vendita. NON usare mai le parole "compra" o "vendi"
- Puoi spiegare pro e contro, contesto storico, fattori di rischio, scenari possibili
- Tono: amichevole, diretto, mai condiscendente. Come un amico esperto, non un robot
- Rispondi sempre in italiano
- Massimo 4-5 frasi per risposta, a meno che la domanda non richieda più dettaglio`;

export async function POST(request: Request) {
  try {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      return NextResponse.json(
        { error: "Variabile ANTHROPIC_API_KEY mancante." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as {
      message?: string;
      history?: ChatMessage[];
    };

    const userMessage = body.message?.trim() ?? "";
    const history = (body.history ?? []).filter(
      (msg): msg is ChatMessage =>
        Boolean(msg?.content?.trim()) && (msg.role === "user" || msg.role === "assistant"),
    );

    if (!userMessage) {
      return NextResponse.json({ error: "Messaggio non valido." }, { status: 400 });
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
    let portfolioContext = "Nessun asset presente.";

    if (portfolioIds.length > 0) {
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select("ticker, quantity")
        .in("portfolio_id", portfolioIds);

      if (assetsError) {
        return NextResponse.json({ error: assetsError.message }, { status: 500 });
      }

      const mergedByTicker = new Map<string, number>();
      ((assets ?? []) as AssetPositionRow[]).forEach((asset) => {
        const ticker = asset.ticker?.trim().toUpperCase();
        if (!ticker) return;
        const prev = mergedByTicker.get(ticker) ?? 0;
        mergedByTicker.set(ticker, prev + Number(asset.quantity ?? 0));
      });

      if (mergedByTicker.size > 0) {
        portfolioContext = Array.from(mergedByTicker.entries())
          .map(([ticker, quantity]) => `${ticker} (${quantity})`)
          .join(", ");
      }
    }

    const systemPrompt = CHAT_SYSTEM_PROMPT_TEMPLATE.replace("[PORTFOLIO]", portfolioContext);
    const messagesForClaude = [
      ...history.map((msg) => ({ role: msg.role, content: msg.content.trim() })),
      { role: "user" as const, content: userMessage },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 320,
        system: systemPrompt,
        messages: messagesForClaude,
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
    const reply =
      data.content?.find((block) => block.type === "text" && block.text)?.text?.trim() ?? "";

    if (!reply) {
      return NextResponse.json(
        { error: "Claude non ha restituito una risposta valida." },
        { status: 500 },
      );
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Errore route /api/chat:", error);
    return NextResponse.json(
      { error: "Errore inatteso durante la chat." },
      { status: 500 },
    );
  }
}