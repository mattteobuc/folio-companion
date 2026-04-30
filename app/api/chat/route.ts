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

type PurchasePlanRow = {
  title: string;
  ticker: string | null;
  cadence: "settimanale" | "quindicinale" | "mensile";
  amount: number;
  monthly_budget_limit: number | null;
  next_run_date: string;
};

type PlanStep = "title" | "cadence" | "amount" | "start_date" | "confirmation";
type DraftCadence = "settimanale" | "quindicinale" | "mensile";
type PlanDraftRow = {
  id: string;
  user_id: string;
  session_id: string;
  title: string | null;
  ticker: string | null;
  cadence: DraftCadence | null;
  amount: number | null;
  start_date: string | null;
  monthly_budget_limit: number | null;
  risk_note: string | null;
  step: PlanStep;
  awaiting_confirmation: boolean;
};

type PlanDraftValues = {
  title: string | null;
  ticker: string | null;
  cadence: DraftCadence | null;
  amount: number | null;
  start_date: string | null;
  monthly_budget_limit: number | null;
  risk_note: string | null;
};

type EmotionalSignal = "ansia" | "dubbio" | "paura" | "fomo" | "confusione" | "tecnico" | "neutro";
type UserIntent =
  | "analisi_portafoglio"
  | "notizia"
  | "macro"
  | "opportunita"
  | "rischio"
  | "piano_azione"
  | "generale";

const PLAN_INTENT_PATTERNS = [
  /\bcrea(?:re)?\s+(?:un\s+)?piano\b/i,
  /\bnuovo\s+piano\b/i,
  /\bpiano\s+di\s+acquisto\b/i,
  /\bpac\b/i,
  /\bpiano\s+ricorrente\b/i,
];
const PLAN_CANCEL_PATTERNS = [/\bannulla\b/i, /\bcancel\b/i, /\bstop\b/i, /\bferma\b/i];
const PLAN_CONFIRM_PATTERNS = [/\bconfermo\b/i, /\bconferma\b/i, /\bok\b/i, /\bva bene\b/i];
const PLAN_EXPLORATION_PATTERNS = [
  /inflazione/i,
  /protegg/i,
  /rischio/i,
  /volatilit/i,
  /obiettiv/i,
  /lungo periodo/i,
  /breve periodo/i,
  /entrate/i,
  /uscite/i,
];
const DIRECT_ADVICE_PATTERNS = [/\bcompra(?:re|)\b/gi, /\bvendi(?:ta|)\b/gi, /\bacquista(?:re|)\b/gi];

function detectPlanIntent(message: string): boolean {
  return PLAN_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}

function isPlanCancellation(message: string): boolean {
  return PLAN_CANCEL_PATTERNS.some((pattern) => pattern.test(message));
}

function isPlanConfirmation(message: string): boolean {
  return PLAN_CONFIRM_PATTERNS.some((pattern) => pattern.test(message));
}

function needsExploration(message: string): boolean {
  return PLAN_EXPLORATION_PATTERNS.some((pattern) => pattern.test(message));
}

function detectEmotionalSignal(message: string): EmotionalSignal {
  if (/(ansia|agit|preoccup|stress|panic)/i.test(message)) return "ansia";
  if (/(non capisco|confus|non mi e chiaro|spiegami meglio)/i.test(message)) return "confusione";
  if (/(paura|timore|perdere soldi|drawdown|crollo)/i.test(message)) return "paura";
  if (/(fomo|sto perdendo il treno|tutti stanno)/i.test(message)) return "fomo";
  if (/(forse|non so|indecis|dubbio)/i.test(message)) return "dubbio";
  if (/(beta|duration|p\/e|valuation|volatility|var|correlazione|yield)/i.test(message)) return "tecnico";
  return "neutro";
}

function detectUserIntent(message: string): UserIntent {
  if (/(portafoglio|allocazione|peso|diversific)/i.test(message)) return "analisi_portafoglio";
  if (/(notizia|news|articolo|headline)/i.test(message)) return "notizia";
  if (/(macro|inflazione|tassi|fed|bce|pil|occupazione)/i.test(message)) return "macro";
  if (/(opportunit|settore|mercato da seguire|watchlist|cosa studiare)/i.test(message)) return "opportunita";
  if (/(rischio|volatilit|drawdown|copertura|protegg)/i.test(message)) return "rischio";
  if (/(cosa faccio|prossimi passi|piano d'azione|azione concreta)/i.test(message)) return "piano_azione";
  return "generale";
}

function buildProactiveRadar(portfolioTickers: string[], news: string): string {
  const seedTicker = portfolioTickers[0] ?? "MSCI World";
  const seedNewsLabel = news.includes("Nessuna") ? "assenza di news forti" : "ultime notizie di mercato";
  return [
    `- Mercato/tema: tassi reali e inflazione attesa (rilevante per valutazioni growth vs value).`,
    `- Settore da osservare: tecnologia quality e industriali europei, per capire rotazione rischio.`,
    `- Ticker da studiare: ${seedTicker} e un ETF difensivo obbligazionario globale (solo studio, non operativita).`,
    `- Perche ora: ${seedNewsLabel}, fase utile per monitorare correlazioni e non reagire impulsivamente.`,
  ].join("\n");
}

function formatMatePolicy(signal: EmotionalSignal, intent: UserIntent, radar: string): string {
  return [
    `Segnale emotivo rilevato: ${signal}.`,
    `Intent principale: ${intent}.`,
    "",
    "Struttura risposta OBBLIGATORIA:",
    "1) Apertura empatica (1 frase, concreta).",
    "2) 2-3 scenari o opzioni pratiche (bullet brevi, non generiche).",
    "3) Cosa monitorare nei prossimi giorni (almeno 1 bullet).",
    "4) Radar proattivo (mercato, settore, 1-2 ticker da studiare) con motivazione.",
    "5) Chiusura non direttiva orientata a processo.",
    "",
    "Guardrail:",
    "- Vietato linguaggio di consiglio diretto buy/sell.",
    "- Evita frasi vaghe tipo 'dimmi cosa vuoi approfondire'.",
    "- Se manca un dato, fai solo una domanda guidata e specifica.",
    "",
    "Radar proattivo suggerito:",
    radar,
  ].join("\n");
}

function sanitizeDirectAdvice(text: string): string {
  return DIRECT_ADVICE_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, "valuta"), text);
}

function normalizeNumber(raw: string): number | null {
  const normalized = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIsoDate(raw: string): string | null {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (!parts) return null;
  const day = parts[1].padStart(2, "0");
  const month = parts[2].padStart(2, "0");
  const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
  return `${year}-${month}-${day}`;
}

function parseDraftUpdates(message: string): Partial<PlanDraftValues> {
  const updates: Partial<PlanDraftValues> = {};
  const trimmed = message.trim();

  const tickerMatch = trimmed.match(/\b[A-Z]{2,6}\b/);
  if (tickerMatch) updates.ticker = tickerMatch[0];

  if (/\bsettimanal/i.test(trimmed)) updates.cadence = "settimanale";
  if (/\bquindicinal/i.test(trimmed)) updates.cadence = "quindicinale";
  if (/\bmensil/i.test(trimmed)) updates.cadence = "mensile";

  const amountMatch = trimmed.match(/(?:€|\beuro\b|\binvest(?:o|ire)\b|\bimporto\b)?\s*(\d{1,6}(?:[.,]\d{1,2})?)/i);
  if (amountMatch) {
    const amount = normalizeNumber(amountMatch[1]);
    if (amount && amount > 0) updates.amount = Number(amount.toFixed(2));
  }

  const budgetMatch = trimmed.match(/(?:limite|budget)[^\d]*(\d{1,6}(?:[.,]\d{1,2})?)/i);
  if (budgetMatch) {
    const budget = normalizeNumber(budgetMatch[1]);
    if (budget && budget > 0) updates.monthly_budget_limit = Number(budget.toFixed(2));
  }

  const isoDateMatch = trimmed.match(/\d{4}-\d{2}-\d{2}/);
  if (isoDateMatch) updates.start_date = isoDateMatch[0];
  const localDateMatch = trimmed.match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/);
  if (!updates.start_date && localDateMatch) updates.start_date = normalizeIsoDate(localDateMatch[0]);

  const titlePattern = trimmed.match(/(?:titolo|chiamalo|nome piano)\s*[:\-]?\s*(.+)$/i);
  if (titlePattern?.[1]?.trim()) updates.title = titlePattern[1].trim();

  const riskNotePattern = trimmed.match(/(?:nota|regola|rischio)\s*[:\-]?\s*(.+)$/i);
  if (riskNotePattern?.[1]?.trim()) updates.risk_note = riskNotePattern[1].trim();

  return updates;
}

function getNextPlanStep(draft: PlanDraftValues): Exclude<PlanStep, "confirmation"> | null {
  if (!draft.title?.trim()) return "title";
  if (!draft.cadence) return "cadence";
  if (!draft.amount || draft.amount <= 0) return "amount";
  if (!draft.start_date) return "start_date";
  return null;
}

function getPlanQuestion(step: Exclude<PlanStep, "confirmation">): string {
  if (step === "title") return "Creiamo il tuo nuovo piano. Partiamo dal titolo: come vuoi chiamarlo? Mi serve per ritrovarlo subito in dashboard.";
  if (step === "cadence") return "Perfetto. Che cadenza preferisci: settimanale, quindicinale o mensile? Mi serve per impostare il ritmo.";
  if (step === "amount") return "Ottimo. Qual è l'importo ricorrente? Mi serve per capire la sostenibilità del piano.";
  return "Ci siamo. Da quale data vuoi far partire il piano? Puoi scriverla come GG/MM/AAAA o YYYY-MM-DD.";
}

function buildPlanSummary(draft: PlanDraftValues): string {
  return [
    "Creiamo il tuo nuovo piano. Ecco il riepilogo:",
    `- Titolo: ${draft.title}`,
    `- Cadenza: ${draft.cadence}`,
    `- Importo: ${draft.amount} EUR`,
    `- Data inizio: ${draft.start_date}`,
    `- Ticker: ${draft.ticker ?? "non impostato"}`,
    `- Limite mensile: ${draft.monthly_budget_limit != null ? `${draft.monthly_budget_limit} EUR` : "non impostato"}`,
    `- Nota rischio: ${draft.risk_note ?? "non impostata"}`,
    "Confermi questo piano?",
  ].join("\n");
}

function assistantAskedForConfirmation(content: string): boolean {
  return /confermi/i.test(content) && /piano/i.test(content);
}

function deriveDraftFromHistory(history: ChatMessage[]): { draft: PlanDraftValues; awaitingConfirmation: boolean } {
  const draft: PlanDraftValues = {
    title: null,
    ticker: null,
    cadence: null,
    amount: null,
    start_date: null,
    monthly_budget_limit: null,
    risk_note: null,
  };
  let awaitingConfirmation = false;

  for (const message of history) {
    if (message.role === "assistant") {
      if (assistantAskedForConfirmation(message.content)) {
        awaitingConfirmation = true;
      }
      continue;
    }

    const userText = message.content.trim();
    if (!userText) continue;
    if (isPlanCancellation(userText)) {
      awaitingConfirmation = false;
      continue;
    }
    if (awaitingConfirmation && isPlanConfirmation(userText)) {
      awaitingConfirmation = false;
      continue;
    }

    const parsed = parseDraftUpdates(userText);
    if (!parsed.title && !detectPlanIntent(userText) && !isPlanConfirmation(userText) && !isPlanCancellation(userText) && !draft.title) {
      parsed.title = userText;
    }
    Object.assign(draft, parsed);
  }

  return { draft, awaitingConfirmation };
}
const CHAT_SYSTEM_PROMPT_TEMPLATE = `Sei Folio, un mate finanziario personale caldo, colloquiale e proattivo. Parli come una persona reale: diretto, umano, rassicurante quando serve, senza tono da consulente formale.

Il portafoglio dell'utente è composto da: [PORTFOLIO].

[PLANS]

[MEMORY]

[DIARY]

[MATE_POLICY]

Linee guida:
- Inizia con una micro-validazione emotiva (1 frase breve), soprattutto se l'utente mostra ansia, dubbio o frustrazione.
- Usa sempre il portafoglio specifico dell'utente per personalizzare la risposta (es. "nel tuo caso con AAPL..." o "dato che hai ETF come...").
- Se la memoria è rilevante, usala per continuità in modo naturale ("riprendendo quello che avevamo visto...").
- Se nel diario ci sono note recenti, usale con sensibilità per entrare in empatia e contestualizzare il tono (senza fare lo psicologo).
- Se ci sono piani di acquisto attivi, usali per mantenere coerenza e disciplina del processo: evidenzia eventuali incoerenze tra piano e comportamento corrente.
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
      mode?: "chat" | "plan_start";
    };

    const mode = body.mode ?? "chat";
    const isPlanStart = mode === "plan_start";
    const userMessage = body.message?.trim() ?? "";
    const history = (body.history ?? []).filter(
      (msg): msg is ChatMessage =>
        Boolean(msg?.content?.trim()) && (msg.role === "user" || msg.role === "assistant"),
    );
    const sessionId = body.sessionId ?? null;

    if (!isPlanStart && !userMessage) {
      return NextResponse.json({ error: "Messaggio non valido." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });

    let currentSessionId = sessionId;

    const ensureChatSession = async (preferredTitle?: string): Promise<string | null> => {
      if (currentSessionId) return currentSessionId;
      const title = preferredTitle || await generateSessionTitle(anthropicApiKey, userMessage);
      const { data: newSession } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.id, title })
        .select("id")
        .single();
      currentSessionId = newSession?.id ?? null;
      return currentSessionId;
    };

    const saveChatExchange = async (replyContent: string) => {
      const ensuredSessionId = await ensureChatSession("Nuova conversazione");
      if (!ensuredSessionId) return;
      await supabase.from("chat_messages").insert([
        { session_id: ensuredSessionId, role: "user", content: userMessage },
        { session_id: ensuredSessionId, role: "assistant", content: replyContent },
      ]);
      await supabase.from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ensuredSessionId);
    };

    const saveAssistantMessage = async (replyContent: string, forcedSessionId?: string) => {
      const ensuredSessionId = forcedSessionId ?? await ensureChatSession("Creazione piano");
      if (!ensuredSessionId) return;
      await supabase.from("chat_messages").insert([
        { session_id: ensuredSessionId, role: "assistant", content: replyContent },
      ]);
      await supabase.from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ensuredSessionId);
    };

    let activeDraft: PlanDraftRow | null = null;
    let draftPersistenceAvailable = true;
    if (currentSessionId) {
      const { data: draftRow, error: draftError } = await supabase
        .from("chat_plan_drafts")
        .select("id, user_id, session_id, title, ticker, cadence, amount, start_date, monthly_budget_limit, risk_note, step, awaiting_confirmation")
        .eq("session_id", currentSessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (draftError) {
        const errorCode = (draftError as { code?: string }).code ?? "";
        const errorMessage = (draftError as { message?: string }).message ?? "";
        const isMissingTable = errorCode === "42P01" || errorMessage.toLowerCase().includes("chat_plan_drafts");
        if (!isMissingTable) {
          return NextResponse.json({ error: "Errore nel recupero della bozza piano." }, { status: 500 });
        }
        draftPersistenceAvailable = false;
      }
      activeDraft = (draftRow as PlanDraftRow | null) ?? null;
    }

    if (isPlanStart && !activeDraft && draftPersistenceAvailable) {
      const { data: latestDraft, error: latestDraftError } = await supabase
        .from("chat_plan_drafts")
        .select("id, user_id, session_id, title, ticker, cadence, amount, start_date, monthly_budget_limit, risk_note, step, awaiting_confirmation")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestDraftError) {
        const errorCode = (latestDraftError as { code?: string }).code ?? "";
        const errorMessage = (latestDraftError as { message?: string }).message ?? "";
        const isMissingTable = errorCode === "42P01" || errorMessage.toLowerCase().includes("chat_plan_drafts");
        if (!isMissingTable) {
          return NextResponse.json({ error: "Errore nel recupero della bozza piano." }, { status: 500 });
        }
        draftPersistenceAvailable = false;
      } else if (latestDraft) {
        currentSessionId = latestDraft.session_id;
        activeDraft = latestDraft as PlanDraftRow;
      }
    }

    const shouldEnterPlanMode = isPlanStart || Boolean(activeDraft) || detectPlanIntent(userMessage);

    if (shouldEnterPlanMode) {
      const ensuredSessionId = await ensureChatSession("Creazione piano");
      if (!ensuredSessionId) {
        return NextResponse.json({ error: "Non sono riuscito ad avviare la sessione del piano." }, { status: 500 });
      }

      if (!activeDraft && draftPersistenceAvailable) {
        const { data: draftRow, error: draftError } = await supabase
          .from("chat_plan_drafts")
          .select("id, user_id, session_id, title, ticker, cadence, amount, start_date, monthly_budget_limit, risk_note, step, awaiting_confirmation")
          .eq("session_id", ensuredSessionId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (draftError) {
          const errorCode = (draftError as { code?: string }).code ?? "";
          const errorMessage = (draftError as { message?: string }).message ?? "";
          const isMissingTable = errorCode === "42P01" || errorMessage.toLowerCase().includes("chat_plan_drafts");
          if (!isMissingTable) {
            return NextResponse.json({ error: "Errore nel recupero della bozza piano." }, { status: 500 });
          }
          draftPersistenceAvailable = false;
        }
        activeDraft = (draftRow as PlanDraftRow | null) ?? null;
      }

      if (isPlanCancellation(userMessage) && activeDraft) {
        await supabase.from("chat_plan_drafts").delete().eq("id", activeDraft.id);
        const reply = "Va bene, piano annullato. Quando vuoi ripartire, scrivimi e lo ricreiamo insieme in pochi passaggi.";
        await saveChatExchange(reply);
        return NextResponse.json({ reply, sessionId: ensuredSessionId });
      }

      const draftValues: PlanDraftValues = draftPersistenceAvailable
        ? {
          title: activeDraft?.title ?? null,
          ticker: activeDraft?.ticker ?? null,
          cadence: activeDraft?.cadence ?? null,
          amount: activeDraft?.amount ?? null,
          start_date: activeDraft?.start_date ?? null,
          monthly_budget_limit: activeDraft?.monthly_budget_limit ?? null,
          risk_note: activeDraft?.risk_note ?? null,
        }
        : deriveDraftFromHistory(history).draft;

      const parsedUpdates = parseDraftUpdates(userMessage);
      if (
        !isPlanStart
        &&
        !parsedUpdates.title
        && !detectPlanIntent(userMessage)
        && !isPlanConfirmation(userMessage)
        && !isPlanCancellation(userMessage)
        && !draftValues.title
      ) {
        parsedUpdates.title = userMessage.trim();
      }

      const mergedDraft: PlanDraftValues = {
        ...draftValues,
        ...parsedUpdates,
      };

      const nextStep = getNextPlanStep(mergedDraft);
      let reply = "";
      let awaitingConfirmation = draftPersistenceAvailable
        ? activeDraft?.awaiting_confirmation ?? false
        : deriveDraftFromHistory(history).awaitingConfirmation;

      if (isPlanStart) {
        if (nextStep) {
          awaitingConfirmation = false;
          reply = getPlanQuestion(nextStep);
        } else {
          awaitingConfirmation = true;
          reply = buildPlanSummary(mergedDraft);
        }
      } else if (awaitingConfirmation && isPlanConfirmation(userMessage)) {
        if (nextStep) {
          awaitingConfirmation = false;
          reply = `Perfetto, prima della conferma mi manca ancora un dato. ${getPlanQuestion(nextStep)}`;
        } else {
          const { error: insertError } = await supabase.from("purchase_plans").insert({
            user_id: user.id,
            title: mergedDraft.title!,
            ticker: mergedDraft.ticker,
            goal_type: "accumulo",
            cadence: mergedDraft.cadence!,
            amount: Number((mergedDraft.amount ?? 0).toFixed(2)),
            start_date: mergedDraft.start_date!,
            next_run_date: mergedDraft.start_date!,
            monthly_budget_limit: mergedDraft.monthly_budget_limit,
            risk_note: mergedDraft.risk_note,
            status: "active",
          });
          if (insertError) {
            const errorCode = (insertError as { code?: string }).code ?? "";
            const errorMessage = (insertError as { message?: string }).message ?? "";
            const isMissingTable = errorCode === "42P01" || errorMessage.toLowerCase().includes("purchase_plans");
            if (isMissingTable) {
              return NextResponse.json({ error: "I piani non sono ancora attivi in questo ambiente. Applica le migration Supabase e riprova." }, { status: 503 });
            }
            return NextResponse.json({ error: "Non sono riuscito a salvare il piano. Riproviamo tra un attimo." }, { status: 500 });
          }
          if (activeDraft) {
            await supabase.from("chat_plan_drafts").delete().eq("id", activeDraft.id);
          }
          reply = `Perfetto, piano creato ✅\nProssima data: ${mergedDraft.start_date}\nSe il contesto personale cambia puoi metterlo in pausa: l'obiettivo è mantenere metodo, non forzarti.`;
          await saveChatExchange(reply);
          return NextResponse.json({ reply, sessionId: ensuredSessionId });
        }
      } else if (awaitingConfirmation && isPlanCancellation(userMessage)) {
        if (activeDraft) {
          await supabase.from("chat_plan_drafts").delete().eq("id", activeDraft.id);
        }
        reply = "Ricevuto, niente salvataggio. Se vuoi lo riapriamo quando ti senti pronto.";
        await saveChatExchange(reply);
        return NextResponse.json({ reply, sessionId: ensuredSessionId });
      } else if (nextStep) {
        awaitingConfirmation = false;
        if (nextStep === "title" && needsExploration(userMessage)) {
          reply = "Perfetto, prima del titolo facciamo 1 passo utile: vuoi più stabilità, più crescita nel tempo o proteggerti da uno scenario specifico? Così impostiamo un piano coerente, senza partire subito dal ticker.";
        } else {
          reply = getPlanQuestion(nextStep);
        }
      } else {
        awaitingConfirmation = true;
        reply = buildPlanSummary(mergedDraft);
      }

      if (draftPersistenceAvailable) {
        const nextDraftPayload = {
          user_id: user.id,
          session_id: ensuredSessionId,
          title: mergedDraft.title,
          ticker: mergedDraft.ticker,
          cadence: mergedDraft.cadence,
          amount: mergedDraft.amount,
          start_date: mergedDraft.start_date,
          monthly_budget_limit: mergedDraft.monthly_budget_limit,
          risk_note: mergedDraft.risk_note,
          step: nextStep ?? "confirmation",
          awaiting_confirmation: awaitingConfirmation,
        };

        if (activeDraft) {
          const { error: draftUpdateError } = await supabase.from("chat_plan_drafts").update(nextDraftPayload).eq("id", activeDraft.id);
          if (draftUpdateError) {
            const errorCode = (draftUpdateError as { code?: string }).code ?? "";
            const errorMessage = (draftUpdateError as { message?: string }).message ?? "";
            const isMissingTable = errorCode === "42P01" || errorMessage.toLowerCase().includes("chat_plan_drafts");
            if (!isMissingTable) {
              return NextResponse.json({ error: "Errore aggiornamento bozza piano." }, { status: 500 });
            }
          }
        } else {
          const { error: draftInsertError } = await supabase.from("chat_plan_drafts").insert(nextDraftPayload);
          if (draftInsertError) {
            const errorCode = (draftInsertError as { code?: string }).code ?? "";
            const errorMessage = (draftInsertError as { message?: string }).message ?? "";
            const isMissingTable = errorCode === "42P01" || errorMessage.toLowerCase().includes("chat_plan_drafts");
            if (!isMissingTable) {
              return NextResponse.json({ error: "Errore salvataggio bozza piano." }, { status: 500 });
            }
          }
        }
      }

      if (isPlanStart) {
        await saveAssistantMessage(reply, ensuredSessionId);
      } else {
        await saveChatExchange(reply);
      }
      return NextResponse.json({ reply, sessionId: ensuredSessionId });
    }

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

    let plansContext = "\nPiani di acquisto attivi: nessun piano configurato.\n";
    const { data: purchasePlans } = await supabase
      .from("purchase_plans")
      .select("title, ticker, cadence, amount, monthly_budget_limit, next_run_date")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("next_run_date", { ascending: true })
      .limit(5);
    const typedPurchasePlans = (purchasePlans ?? []) as PurchasePlanRow[];
    if (typedPurchasePlans.length > 0) {
      const plansItems = typedPurchasePlans.map((plan) => {
        const tickerLabel = plan.ticker?.trim() ? `${plan.ticker.trim().toUpperCase()} · ` : "";
        const budgetLabel = plan.monthly_budget_limit != null
          ? plan.amount > plan.monthly_budget_limit
            ? `ATTENZIONE budget (${plan.amount} > ${plan.monthly_budget_limit})`
            : `budget ok (${plan.amount}/${plan.monthly_budget_limit})`
          : "budget non impostato";
        return `- ${tickerLabel}${plan.title}: ${plan.cadence}, importo ${plan.amount}, prossima data ${plan.next_run_date}, ${budgetLabel}`;
      }).join("\n");
      plansContext = `\nPiani di acquisto attivi:\n${plansItems}\n`;
    }

    const emotionalSignal = detectEmotionalSignal(userMessage);
    const userIntent = detectUserIntent(userMessage);
    const proactiveRadar = buildProactiveRadar(
      portfolioContext === "Nessun asset presente."
        ? []
        : portfolioContext.split(",").map((item) => item.split(" ")[0]).filter(Boolean),
      plansContext,
    );
    const matePolicy = formatMatePolicy(emotionalSignal, userIntent, proactiveRadar);

    const systemPrompt = CHAT_SYSTEM_PROMPT_TEMPLATE
      .replace("[PORTFOLIO]", portfolioContext)
      .replace("[PLANS]", plansContext)
      .replace("[MEMORY]", memoryContext)
      .replace("[DIARY]", diaryContext)
      .replace("[MATE_POLICY]", matePolicy);

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
    const rawReply = data.content?.find((b) => b.type === "text" && b.text)?.text?.trim() ?? "";
    const reply = sanitizeDirectAdvice(rawReply);
    if (!reply) {
      return NextResponse.json({ error: "Claude non ha restituito una risposta valida." }, { status: 500 });
    }

    // ── Salva sessione e messaggi in background ──
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