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

type SessionSummaryRow = {
  title: string | null;
  summary: string | null;
  created_at: string;
};

type DiaryNoteRow = {
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

const CHAT_SYSTEM_PROMPT_TEMPLATE = `Sei Folio, un mate finanziario personale caldo, colloquiale e proattivo. Parli come una persona reale: diretto, umano, rassicurante quando serve, senza tono da consulente formale.

Il portafoglio dell'utente è composto da: [PORTFOLIO].

[MEMORY]

[DIARY]

Linee guida:
- Inizia con una micro-validazione emotiva (1 frase breve), soprattutto se l'utente mostra ansia, dubbio o frustrazione.
- Usa sempre il portafoglio specifico dell'utente per personalizzare la risposta (es. "nel tuo caso con AAPL..." o "dato che hai ETF come...").
- Se la memoria è rilevante, usala per continuità in modo naturale ("riprendendo quello che avevamo visto...").
- Se nel diario ci sono note recenti, usale con sensibilità per entrare in empatia e contestualizzare il tono (senza fare lo psicologo).
- Evita domande di rimbalzo generiche come "cosa vuoi approfondire?" o "a cosa pensavi?".
- Invece di fare domande aperte, sii proattivo: proponi 2-3 letture/alternative/scenari concreti e pratici, con pro/contro e rischi principali.
- NON dare mai consigli diretti di acquisto o vendita. NON usare mai le parole "compra" o "vendi".
- Mantieni tono amichevole e colloquiale, mai condiscendente, mai allarmistico.
- Rispondi sempre in italiano.

Formato risposta preferito:
1) Apertura empatica breve.
2) Due o tre opzioni/scenari pratici (max una riga ciascuno).
3) Chiusura breve orientata all'azione non direttiva (es. "possiamo monitorare X nei prossimi giorni").

Vincoli di lunghezza:
- Default: 4-6 frasi totali.
- Se la domanda è tecnica o complessa, puoi estendere ma resta sintetico e leggibile.`;

// Genera un titolo breve per la sessione basato sul primo messaggio
async function generateSessionTitle(
  anthropicApiKey: string,
  firstMessage: string,
): Promise<string> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 30,
        messages: [{
          role: "user",
          content: `Crea un titolo brevissimo (max 5 parole) per una conversazione che inizia con: "${firstMessage}". Rispondi solo con il titolo, senza virgolette.`,
        }],
      }),
    });
    if (!response.ok) return "Nuova conversazione";
    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    return data.content?.find((b) => b.type === "text")?.text?.trim() ?? "Nuova conversazione";
  } catch {
    return "Nuova conversazione";
  }
}

// Genera un riassunto della sessione per la memoria futura
async function generateSessionSummary(
  anthropicApiKey: string,
  messages: ChatMessage[],
): Promise<string> {
  try {
    const conversation = messages
      .map((m) => `${m.role === "user" ? "Utente" : "Folio"}: ${m.content}`)
      .join("\n");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 150,
        messages: [{
          role: "user",
          content: `Riassumi in 2-3 frasi i punti chiave di questa conversazione finanziaria, includendo eventuali titoli discussi, ragionamenti o intenzioni espresse dall'utente:\n\n${conversation}`,
        }],
      }),
    });
    if (!response.ok) return "";
    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    return data.content?.find((b) => b.type === "text")?.text?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  try {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json({ error: "Variabile ANTHROPIC_API_KEY mancante." }, { status: 500 });
    }

    const body = (await request.json()) as {
      message?: string;
      history?: ChatMessage[];
      sessionId?: string | null;
    };

    const userMessage = body.message?.trim() ?? "";
    const history = (body.history ?? []).filter(
      (msg): msg is ChatMessage =>
        Boolean(msg?.content?.trim()) && (msg.role === "user" || msg.role === "assistant"),
    );
    const sessionId = body.sessionId ?? null;

    if (!userMessage) {
      return NextResponse.json({ error: "Messaggio non valido." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });

    // ── Carica portafoglio ──
    const { data: portfolios } = await supabase
      .from("portfolios").select("id").eq("user_id", user.id);
    const portfolioIds = (portfolios ?? []).map((p) => p.id);
    let portfolioContext = "Nessun asset presente.";

    if (portfolioIds.length > 0) {
      const { data: assets } = await supabase
        .from("assets").select("ticker, quantity").in("portfolio_id", portfolioIds);
      const mergedByTicker = new Map<string, number>();
      ((assets ?? []) as AssetPositionRow[]).forEach((asset) => {
        const ticker = asset.ticker?.trim().toUpperCase();
        if (!ticker) return;
        mergedByTicker.set(ticker, (mergedByTicker.get(ticker) ?? 0) + Number(asset.quantity ?? 0));
      });
      if (mergedByTicker.size > 0) {
        portfolioContext = Array.from(mergedByTicker.entries())
          .map(([ticker, qty]) => `${ticker} (${qty})`).join(", ");
      }
    }

    // ── Carica memoria conversazioni passate (ultime 5 sessioni) ──
    let memoryContext = "";
    const { data: pastSessions } = await supabase
      .from("chat_sessions")
      .select("title, summary, created_at")
      .eq("user_id", user.id)
      .not("summary", "is", null)
      .order("updated_at", { ascending: false })
      .limit(5);

    if (pastSessions && pastSessions.length > 0) {
      const summaries = (pastSessions as SessionSummaryRow[])
        .filter((s) => s.summary)
        .map((s) => {
          const date = new Date(s.created_at).toLocaleDateString("it-IT");
          return `- ${date}: ${s.summary}`;
        })
        .join("\n");
      if (summaries) {
        memoryContext = `\nMemoria delle conversazioni recenti:\n${summaries}\n`;
      }
    }

    let diaryContext = "";
    const { data: diaryRows } = await supabase
      .from("checkins")
      .select("notes, mood, created_at, context_type, asset_id")
      .eq("user_id", user.id)
      .not("notes", "is", null)
      .order("created_at", { ascending: false })
      .limit(8);

    const typedDiaryRows = ((diaryRows ?? []) as DiaryNoteRow[]).filter((row) => row.notes?.trim());
    if (typedDiaryRows.length > 0) {
      const assetIds = Array.from(new Set(typedDiaryRows.map((row) => row.asset_id).filter(Boolean))) as string[];
      const assetTickerById = new Map<string, string>();
      if (assetIds.length > 0) {
        const { data: diaryAssets } = await supabase
          .from("assets")
          .select("id, ticker")
          .in("id", assetIds);
        ((diaryAssets ?? []) as DiaryAssetRow[]).forEach((asset) => {
          if (asset.id && asset.ticker) assetTickerById.set(asset.id, asset.ticker);
        });
      }

      const diaryItems = typedDiaryRows.map((row) => {
        const date = new Date(row.created_at).toLocaleDateString("it-IT");
        const mood = row.mood ? `mood ${row.mood}/5` : "mood n/d";
        const ticker = row.asset_id ? assetTickerById.get(row.asset_id) : null;
        const context = row.context_type ?? "free_note";
        const prefix = ticker ? `${ticker} · ${context}` : context;
        return `- ${date} (${prefix}, ${mood}): ${row.notes?.trim()}`;
      }).join("\n");
      diaryContext = `\nEstratti dal diario personale:\n${diaryItems}\n`;
    }

    const systemPrompt = CHAT_SYSTEM_PROMPT_TEMPLATE
      .replace("[PORTFOLIO]", portfolioContext)
      .replace("[MEMORY]", memoryContext)
      .replace("[DIARY]", diaryContext);

    const messagesForClaude = [
      ...history.map((msg) => ({ role: msg.role, content: msg.content.trim() })),
      { role: "user" as const, content: userMessage },
    ];

    // ── Chiama Claude ──
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
      return NextResponse.json({ error: `Errore Claude API (${response.status}): ${errorBody}` }, { status: 500 });
    }

    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const reply = data.content?.find((b) => b.type === "text" && b.text)?.text?.trim() ?? "";
    if (!reply) {
      return NextResponse.json({ error: "Claude non ha restituito una risposta valida." }, { status: 500 });
    }

    // ── Salva sessione e messaggi in background ──
    let currentSessionId = sessionId;
    const isNewSession = !currentSessionId;

    if (isNewSession) {
      // Crea nuova sessione
      const title = await generateSessionTitle(anthropicApiKey, userMessage);
      const { data: newSession } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.id, title })
        .select("id").single();
      currentSessionId = newSession?.id ?? null;
    }

    if (currentSessionId) {
      // Salva messaggio utente e risposta
      await supabase.from("chat_messages").insert([
        { session_id: currentSessionId, role: "user", content: userMessage },
        { session_id: currentSessionId, role: "assistant", content: reply },
      ]);

      // Aggiorna updated_at della sessione
      await supabase.from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", currentSessionId);

      // Se la conversazione ha almeno 3 scambi, aggiorna il summary in background
      const totalMessages = history.length + 2; // +2 per questo scambio
      if (totalMessages >= 6) {
        const allMessages: ChatMessage[] = [
          ...history,
          { role: "user", content: userMessage },
          { role: "assistant", content: reply },
        ];
        // Non awaito — lo facciamo in background per non rallentare la risposta
        void generateSessionSummary(anthropicApiKey, allMessages).then((summary) => {
          if (summary && currentSessionId) {
            void supabase.from("chat_sessions")
              .update({ summary })
              .eq("id", currentSessionId);
          }
        });
      }
    }

    return NextResponse.json({ reply, sessionId: currentSessionId });
  } catch (error) {
    console.error("Errore route /api/chat:", error);
    return NextResponse.json({ error: "Errore inatteso durante la chat." }, { status: 500 });
  }
}