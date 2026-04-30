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

/** Profilo conversazionale utente (onboarding chat-first, senza form). */
type MateProfileRow = {
  id: string;
  user_id: string;
  primary_goal: string | null;
  time_horizon: string | null;
  volatility_comfort: string | null;
  mate_style: string | null;
  onboarding_status: string;
  last_question_key: string | null;
  source: string | null;
};

type OnboardingFieldKey = "goal" | "horizon" | "volatility" | "style";

function isMissingMateProfileTable(error: { code?: string; message?: string }): boolean {
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01"
    || msg.includes("user_mate_profile")
    || msg.includes("does not exist")
    || msg.includes("schema cache")
  );
}

function isOnboardingSkipMessage(message: string): boolean {
  const t = message.trim().toLowerCase();
  return (
    /\b(salta|skip)\b/i.test(t)
    || /\bpi[uù]\s+tardi\b/i.test(t)
    || /\bnon\s+ora\b/i.test(t)
    || /^stop$/i.test(t)
  );
}

/** Domanda “vera” sul portafoglio/macro: durante onboarding non blocca, ma passa a Claude. */
function isSubstantiveChatDuringOnboarding(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length > 160) return true;
  if (detectPlanIntent(message)) return true;
  const intent = detectUserIntent(message);
  if (intent !== "generale") return true;
  if (
    /\b(portafoglio|etf|obligaz|obbligaz|azione|ticker|bce|fed|inflazione|tassi|prezzo|mercat)/i.test(trimmed)
  ) {
    return true;
  }
  return false;
}

function getNextOnboardingField(profile: MateProfileRow): OnboardingFieldKey | null {
  if (!profile.primary_goal?.trim()) return "goal";
  if (!profile.time_horizon?.trim()) return "horizon";
  if (!profile.volatility_comfort?.trim()) return "volatility";
  if (!profile.mate_style?.trim()) return "style";
  return null;
}

function quickRepliesForOnboardingField(field: OnboardingFieldKey): string[] {
  switch (field) {
    case "goal":
      return ["Crescita", "Reddito", "Stabilità", "Imparare", "Salta per ora"];
    case "horizon":
      return ["<1 anno", "1-3 anni", "3-7 anni", "7+ anni", "Salta per ora"];
    case "volatility":
      return ["Bassa", "Media", "Alta", "Salta per ora"];
    case "style":
      return ["Diretto", "Empatico", "Tecnico semplice", "Salta per ora"];
    default:
      return [];
  }
}

function onboardingQuestionForField(field: OnboardingFieldKey): string {
  switch (field) {
    case "goal":
      return "Dimmi cosa ti sta più a cuore adesso: più crescita nel tempo, reddito/ricavi, stabilità difensiva, o imparare e capire meglio i mercati?";
    case "horizon":
      return "Che orizzonte hai per questo capitale? Corto (sotto 1 anno), medio (1-3 anni), lungo (3-7), oppure molto lungo (oltre 7 anni)?";
    case "volatility":
      return "Come ti senti quando il mercato oscilla forte? Preferisci oscillazioni basse, medie, o sei ok anche con alta volatilità se è dentro il tuo piano?";
    case "style":
      return "Ultima cosa: preferisci che ti parli in modo diretto, più empatico e morbido, o tecnico ma in parole semplici?";
    default:
      return "Ok, continuiamo quando vuoi.";
  }
}

function parseGoalFromText(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (/^crescita$|^crescita\b/i.test(raw.trim())) return "crescita";
  if (/^reddito$|^reddito\b/i.test(raw.trim())) return "reddito";
  if (/^stabilit|^stabilita\b/i.test(t) || /^stabilità$/i.test(raw.trim())) return "stabilita";
  if (/^imparare$|^imparare\b/i.test(raw.trim())) return "imparare";
  if (/(crescita|accumul|lungo termine)/i.test(t) && !/(reddito|stabilit)/i.test(t)) return "crescita";
  if (/(reddito|rendita|cash\s*flow|dividend)/i.test(t)) return "reddito";
  if (/(stabilit|difens|prudent|bassa\s+volat)/i.test(t)) return "stabilita";
  if (/(impar|studio|capire|capisco)/i.test(t)) return "imparare";
  return null;
}

function parseHorizonFromText(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (/(^|\b)<\s*1|sotto\s+l('| )?anno|meno\s+di\s+un\s+anno|breve\s+termine|corto\s+termine/i.test(t)) return "<1y";
  if (/1\s*-\s*3|1-3|uno\s+tre|medio\s+termine/i.test(t)) return "1-3y";
  if (/3\s*-\s*7|3-7|lungo\s+termine/i.test(t)) return "3-7y";
  if (/7\s*\+|oltre\s+(il\s+)?7|molto\s+lungo|lunghissim/i.test(t)) return "7y+";
  return null;
}

function parseVolatilityFromText(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (/^bassa$/i.test(raw.trim()) || /(bass[a]|prudent|poca\s+volat)/i.test(t)) return "basso";
  if (/^media$/i.test(raw.trim()) || /\bmedia\b/i.test(t)) return "medio";
  if (/^alta$/i.test(raw.trim()) || /\balta\b|(aggress|alta\s+volat)/i.test(t)) return "alto";
  return null;
}

function parseStyleFromText(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (/^diretto$/i.test(raw.trim()) || /\bdiretto\b/i.test(t)) return "diretto";
  if (/^empatico$/i.test(raw.trim()) || /empatic|rassicur|morbid/i.test(t)) return "empatico";
  if (/tecnico/i.test(t) && /semplic/i.test(t)) return "tecnico-semplice";
  if (/^tecnico semplice$/i.test(raw.trim())) return "tecnico-semplice";
  return null;
}

function parseOnboardingField(field: OnboardingFieldKey, raw: string): string | null {
  switch (field) {
    case "goal":
      return parseGoalFromText(raw);
    case "horizon":
      return parseHorizonFromText(raw);
    case "volatility":
      return parseVolatilityFromText(raw);
    case "style":
      return parseStyleFromText(raw);
    default:
      return null;
  }
}

/** Estrae da messaggi lunghi eventuali preferenze senza forzare il flusso micro-domande. */
function spontaneousProfilePatches(message: string): Partial<MateProfileRow> {
  const patches: Partial<MateProfileRow> = {};
  const g = parseGoalFromText(message);
  const h = parseHorizonFromText(message);
  const v = parseVolatilityFromText(message);
  const s = parseStyleFromText(message);
  if (g) patches.primary_goal = g;
  if (h) patches.time_horizon = h;
  if (v) patches.volatility_comfort = v;
  if (s) patches.mate_style = s;
  return patches;
}

function goalLabelIt(code: string | null): string {
  switch (code) {
    case "crescita":
      return "crescita nel tempo";
    case "reddito":
      return "reddito / rendita";
    case "stabilita":
      return "stabilità difensiva";
    case "imparare":
      return "imparare e capire meglio";
    default:
      return "non specificato";
  }
}

function horizonLabelIt(code: string | null): string {
  switch (code) {
    case "<1y":
      return "sotto 1 anno";
    case "1-3y":
      return "1-3 anni";
    case "3-7y":
      return "3-7 anni";
    case "7y+":
      return "oltre 7 anni";
    default:
      return "non specificato";
  }
}

function volatilityLabelIt(code: string | null): string {
  switch (code) {
    case "basso":
      return "bassa tolleranza alle oscillazioni";
    case "medio":
      return "media tolleranza alle oscillazioni";
    case "alto":
      return "alta tolleranza alle oscillazioni";
    default:
      return "non specificato";
  }
}

function styleLabelIt(code: string | null): string {
  switch (code) {
    case "diretto":
      return "diretto";
    case "empatico":
      return "empatico";
    case "tecnico-semplice":
      return "tecnico in parole semplici";
    default:
      return "non specificato";
  }
}

function formatUserProfilePrompt(profile: MateProfileRow | null): string {
  if (!profile) {
    return "Non disponibile (profilo non caricato). Non insistere con domande da questionario: resta utile e empatico.";
  }
  if (profile.onboarding_status === "skipped") {
    return "L'utente ha saltato la profilazione guidata: non insistere, resta utile e adatta il tono di volta in volta.";
  }
  const parts = [
    `Obiettivo dichiarato: ${goalLabelIt(profile.primary_goal)}.`,
    `Orizzonte dichiarato: ${horizonLabelIt(profile.time_horizon)}.`,
    `Comfort volatilità: ${volatilityLabelIt(profile.volatility_comfort)}.`,
    `Stile conversazione preferito: ${styleLabelIt(profile.mate_style)}.`,
  ];
  return parts.join(" ");
}

function formatMatePolicyWithProfile(
  signal: EmotionalSignal,
  intent: UserIntent,
  radar: string,
  profileBlock: string,
): string {
  const base = formatMatePolicy(signal, intent, radar);
  return `${base}\n\nProfilo utente (rispetta tono e preferenze):\n${profileBlock}`;
}

function buildOnboardingCompletionReply(profile: MateProfileRow): string {
  return [
    "Perfetto, ho salvato il tuo profilo.",
    `- Obiettivo: ${goalLabelIt(profile.primary_goal)}`,
    `- Orizzonte: ${horizonLabelIt(profile.time_horizon)}`,
    `- Oscillazioni: ${volatilityLabelIt(profile.volatility_comfort)}`,
    `- Stile: ${styleLabelIt(profile.mate_style)}`,
    "Da qui ti seguo così. Dimmi pure cosa vuoi guardare nel portafoglio o nel contesto, senza fretta.",
  ].join("\n");
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

Profilo Mate (preferenze utente): [USER_PROFILE]

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

    let mateProfilePersistenceAvailable = true;
    let mateProfileRow: MateProfileRow | null = null;
    const mateProfileSelect =
      "id, user_id, primary_goal, time_horizon, volatility_comfort, mate_style, onboarding_status, last_question_key, source";
    const { data: mateProfileData, error: mateProfileError } = await supabase
      .from("user_mate_profile")
      .select(mateProfileSelect)
      .eq("user_id", user.id)
      .maybeSingle();

    if (mateProfileError) {
      if (isMissingMateProfileTable(mateProfileError)) {
        mateProfilePersistenceAvailable = false;
        console.warn("Profilo Mate: fallback senza persistenza (schema non disponibile).", {
          message: mateProfileError.message,
          code: mateProfileError.code,
        });
      } else {
        return NextResponse.json({ error: mateProfileError.message }, { status: 500 });
      }
    } else {
      mateProfileRow = (mateProfileData as MateProfileRow | null) ?? null;
    }

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

    const mateOnboardingStatus = mateProfileRow?.onboarding_status ?? "not_started";
    const isMateOnboardingActive =
      mateOnboardingStatus === "not_started" || mateOnboardingStatus === "in_progress";

    if (mateProfilePersistenceAvailable && mode === "chat" && userMessage && isMateOnboardingActive) {
      if (isOnboardingSkipMessage(userMessage)) {
        const { error: skipUpsertError } = await supabase.from("user_mate_profile").upsert(
          {
            user_id: user.id,
            onboarding_status: "skipped",
            last_question_key: null,
            source: "chat_onboarding",
          },
          { onConflict: "user_id" },
        );
        if (skipUpsertError && !isMissingMateProfileTable(skipUpsertError)) {
          return NextResponse.json({ error: skipUpsertError.message }, { status: 500 });
        }
        const skipReply =
          "Va bene, saltiamo la profilazione. Ti rispondo comunque su tutto ciò che vuoi esplorare sul portafoglio e sul contesto, al tuo ritmo.";
        await saveChatExchange(skipReply);
        return NextResponse.json({
          reply: skipReply,
          sessionId: currentSessionId,
          quickReplies: [],
          mateOnboarding: "skipped",
        });
      }

      if (isSubstantiveChatDuringOnboarding(userMessage)) {
        const patches = spontaneousProfilePatches(userMessage);
        if (Object.keys(patches).length > 0) {
          if (!mateProfileRow) {
            const { data: insertedProfile, error: insertProfileError } = await supabase
              .from("user_mate_profile")
              .insert({
                user_id: user.id,
                onboarding_status: "in_progress",
                source: "chat_onboarding",
                last_question_key: "goal",
                ...patches,
              })
              .select(mateProfileSelect)
              .single();
            if (insertProfileError) {
              if (isMissingMateProfileTable(insertProfileError)) {
                mateProfilePersistenceAvailable = false;
              } else {
                return NextResponse.json({ error: insertProfileError.message }, { status: 500 });
              }
            } else {
              mateProfileRow = insertedProfile as MateProfileRow;
            }
          } else {
            const { error: patchError } = await supabase
              .from("user_mate_profile")
              .update({ ...patches, onboarding_status: "in_progress" })
              .eq("user_id", user.id);
            if (patchError && !isMissingMateProfileTable(patchError)) {
              return NextResponse.json({ error: patchError.message }, { status: 500 });
            }
            const { data: refreshedProfile } = await supabase
              .from("user_mate_profile")
              .select(mateProfileSelect)
              .eq("user_id", user.id)
              .maybeSingle();
            mateProfileRow = (refreshedProfile as MateProfileRow | null) ?? mateProfileRow;
          }
        }

        if (mateProfileRow && getNextOnboardingField(mateProfileRow) === null) {
          await supabase
            .from("user_mate_profile")
            .update({ onboarding_status: "completed", last_question_key: null })
            .eq("user_id", user.id);
          mateProfileRow = {
            ...mateProfileRow,
            onboarding_status: "completed",
            last_question_key: null,
          };
        }
      } else {
        let profile = mateProfileRow;
        if (!profile) {
          const { data: insertedProfile, error: insertProfileError } = await supabase
            .from("user_mate_profile")
            .insert({
              user_id: user.id,
              onboarding_status: "in_progress",
              source: "chat_onboarding",
              last_question_key: "goal",
            })
            .select(mateProfileSelect)
            .single();
          if (insertProfileError) {
            if (isMissingMateProfileTable(insertProfileError)) {
              mateProfilePersistenceAvailable = false;
            } else {
              return NextResponse.json({ error: insertProfileError.message }, { status: 500 });
            }
          } else {
            profile = insertedProfile as MateProfileRow;
            mateProfileRow = profile;
          }
        }

        if (mateProfilePersistenceAvailable && profile) {
          const field = getNextOnboardingField(profile);
          if (!field) {
            await supabase
              .from("user_mate_profile")
              .update({ onboarding_status: "completed", last_question_key: null })
              .eq("user_id", user.id);
            const completedProfile = { ...profile, onboarding_status: "completed", last_question_key: null };
            mateProfileRow = completedProfile;
            const doneReply = buildOnboardingCompletionReply(completedProfile);
            await saveChatExchange(doneReply);
            return NextResponse.json({
              reply: doneReply,
              sessionId: currentSessionId,
              quickReplies: [],
              mateOnboarding: "completed",
            });
          }

          const parsedValue = parseOnboardingField(field, userMessage);
          if (!parsedValue) {
            const clarifyReply = [
              "Non ho capito bene, riproviamo in modo leggero.",
              onboardingQuestionForField(field),
              "Puoi usare un pulsante rapido oppure rispondere con parole tue.",
            ].join(" ");
            await saveChatExchange(clarifyReply);
            return NextResponse.json({
              reply: clarifyReply,
              sessionId: currentSessionId,
              quickReplies: quickRepliesForOnboardingField(field),
              mateOnboarding: "active",
            });
          }

          const columnName =
            field === "goal"
              ? "primary_goal"
              : field === "horizon"
                ? "time_horizon"
                : field === "volatility"
                  ? "volatility_comfort"
                  : "mate_style";

          const mergedProfile = { ...profile, [columnName]: parsedValue } as MateProfileRow;
          const nextField = getNextOnboardingField(mergedProfile);
          const onboardingCompleted = nextField === null;

          const { error: progressError } = await supabase
            .from("user_mate_profile")
            .update({
              [columnName]: parsedValue,
              onboarding_status: onboardingCompleted ? "completed" : "in_progress",
              last_question_key: onboardingCompleted ? null : nextField,
            })
            .eq("user_id", user.id);

          if (progressError) {
            return NextResponse.json({ error: progressError.message }, { status: 500 });
          }

          const nextMateProfile = {
            ...mergedProfile,
            onboarding_status: onboardingCompleted ? "completed" : "in_progress",
            last_question_key: onboardingCompleted ? null : nextField,
          } as MateProfileRow;
          mateProfileRow = nextMateProfile;

          if (onboardingCompleted) {
            const doneReply = buildOnboardingCompletionReply(nextMateProfile);
            await saveChatExchange(doneReply);
            return NextResponse.json({
              reply: doneReply,
              sessionId: currentSessionId,
              quickReplies: [],
              mateOnboarding: "completed",
            });
          }

          const stepReply = onboardingQuestionForField(nextField);
          await saveChatExchange(stepReply);
          return NextResponse.json({
            reply: stepReply,
            sessionId: currentSessionId,
            quickReplies: quickRepliesForOnboardingField(nextField),
            mateOnboarding: "active",
          });
        }
      }
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

    let mateProfileForPrompt: MateProfileRow | null = mateProfileRow;
    if (mateProfilePersistenceAvailable) {
      const { data: freshMateProfile } = await supabase
        .from("user_mate_profile")
        .select(mateProfileSelect)
        .eq("user_id", user.id)
        .maybeSingle();
      mateProfileForPrompt = (freshMateProfile as MateProfileRow | null) ?? mateProfileRow;
    }

    const profilePromptText = formatUserProfilePrompt(mateProfileForPrompt);
    const matePolicy = formatMatePolicyWithProfile(emotionalSignal, userIntent, proactiveRadar, profilePromptText);

    const systemPrompt = CHAT_SYSTEM_PROMPT_TEMPLATE
      .replace("[PORTFOLIO]", portfolioContext)
      .replace("[PLANS]", plansContext)
      .replace("[MEMORY]", memoryContext)
      .replace("[DIARY]", diaryContext)
      .replace("[USER_PROFILE]", profilePromptText)
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

    let followUpQuickReplies: string[] = [];
    let mateOnboardingFlag: "active" | "completed" | "skipped" | "idle" = "idle";
    if (mateProfilePersistenceAvailable && mateProfileForPrompt) {
      const profileState = mateProfileForPrompt.onboarding_status;
      if (profileState === "not_started" || profileState === "in_progress") {
        const pendingField = getNextOnboardingField(mateProfileForPrompt);
        if (pendingField) {
          followUpQuickReplies = quickRepliesForOnboardingField(pendingField);
          mateOnboardingFlag = "active";
        }
      } else if (profileState === "skipped") {
        mateOnboardingFlag = "skipped";
      } else if (profileState === "completed") {
        mateOnboardingFlag = "completed";
      }
    }

    return NextResponse.json({
      reply,
      sessionId: currentSessionId,
      quickReplies: followUpQuickReplies,
      mateOnboarding: mateOnboardingFlag,
    });
  } catch (error) {
    console.error("Errore route /api/chat:", error);
    return NextResponse.json({ error: "Errore inatteso durante la chat." }, { status: 500 });
  }
}