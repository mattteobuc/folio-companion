import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type DocumentSchema = "positions_with_current_price" | "transactions" | "generic_table";

type ScreenshotCandidate = {
  sourceFile: string;
  name: string;
  ticker: string | null;
  quantity: number | null;
  purchase_price: number | null;
  purchase_date: string | null;
  needs_review: boolean;
  reason: string;
  confidence?: number;
  uncertain_fields?: string[];
  document_type?: DocumentSchema;
};

type RawVisionRow = {
  name?: unknown;
  ticker_candidate?: unknown;
  quantity_candidate?: unknown;
  current_price_candidate?: unknown;
  performance_pct_candidate?: unknown;
  purchase_price_candidate?: unknown;
  purchase_date_candidate?: unknown;
  source_labels?: unknown;
  confidence?: unknown;
  needs_review?: unknown;
  reason?: unknown;
};

type VisionPayload = {
  document_type?: unknown;
  rows?: unknown;
};

type TwelveDataSymbol = {
  symbol?: string;
  instrument_name?: string;
};

const MAX_FILES = 8;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MODEL_TIMEOUT_MS = 25_000;
const AUTO_IMPORT_CONFIDENCE_THRESHOLD = 0.75;

function guessNameFromFileName(fileName: string): string {
  const noExt = fileName.replace(/\.[^/.]+$/, "");
  const sanitized = noExt.replace(/[_-]+/g, " ").trim();
  return sanitized.length > 0 ? sanitized : "Titolo da confermare";
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function parseNumberValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalizedSpace = trimmed.replace(/\s+/g, "");
  const normalized = normalizedSpace
    .replace(/€/g, "")
    .replace(/[A-Za-z]/g, "");
  if (!normalized) return null;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const withoutThousands = normalized.split(thousandsSeparator).join("");
    const decimalNormalized = withoutThousands.replace(decimalSeparator, ".");
    const parsed = Number(decimalNormalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (hasComma) {
    const parsed = Number(normalized.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(normalized.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercentValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace("%", "").trim();
  return parseNumberValue(cleaned);
}

function parseDateValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const slashMatch = normalized.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!slashMatch) return null;
  const day = slashMatch[1].padStart(2, "0");
  const month = slashMatch[2].padStart(2, "0");
  const yearRaw = slashMatch[3];
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return `${year}-${month}-${day}`;
}

function extractJsonPayload(content: string): VisionPayload | null {
  const clean = content.replace(/```json|```/g, "").trim();
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) return null;
  const jsonSlice = clean.slice(firstBrace, lastBrace + 1);
  const parsed = JSON.parse(jsonSlice) as unknown;
  if (typeof parsed !== "object" || parsed == null) return null;
  return parsed as VisionPayload;
}

async function lookupTickerByName(query: string, twelveDataApiKey: string): Promise<string | null> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return null;
  const searchUrl = new URL("https://api.twelvedata.com/symbol_search");
  searchUrl.searchParams.set("symbol", trimmed);
  searchUrl.searchParams.set("apikey", twelveDataApiKey);
  const response = await fetch(searchUrl.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: TwelveDataSymbol[] };
  const rows = payload.data ?? [];
  if (rows.length === 0) return null;

  const normalizedQuery = normalizeIdentifier(trimmed);
  let bestTicker: string | null = null;
  let bestScore = 0;
  for (const row of rows.slice(0, 6)) {
    if (!row.symbol || !row.instrument_name) continue;
    const normalizedName = normalizeIdentifier(row.instrument_name);
    if (!normalizedName) continue;
    let score = 0;
    if (normalizedName === normalizedQuery) score = 1;
    else if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) score = 0.85;
    else {
      const queryTokens = new Set(normalizedQuery.split(" ").filter(Boolean));
      const nameTokens = new Set(normalizedName.split(" ").filter(Boolean));
      const overlap = [...queryTokens].filter((token) => nameTokens.has(token)).length;
      score = queryTokens.size > 0 ? overlap / queryTokens.size : 0;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTicker = row.symbol.trim().toUpperCase();
    }
  }
  return bestScore >= 0.6 ? bestTicker : null;
}

function asDocumentSchema(value: unknown): DocumentSchema {
  if (value === "positions_with_current_price") return value;
  if (value === "transactions") return value;
  return "generic_table";
}

async function normalizeRows(
  fileName: string,
  rawRows: RawVisionRow[],
  documentType: DocumentSchema,
  twelveDataApiKey: string,
): Promise<ScreenshotCandidate[]> {
  if (rawRows.length === 0) {
    return [{
      sourceFile: fileName,
      name: guessNameFromFileName(fileName),
      ticker: null,
      quantity: null,
      purchase_price: null,
      purchase_date: null,
      needs_review: true,
      reason: "Nessuna riga estratta con confidenza sufficiente dallo screenshot.",
      confidence: 0,
      uncertain_fields: ["all"],
      document_type: documentType,
    }];
  }

  const normalizedRows: ScreenshotCandidate[] = [];
  for (const row of rawRows) {
    const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : guessNameFromFileName(fileName);
    const tickerCandidate = typeof row.ticker_candidate === "string" && row.ticker_candidate.trim()
      ? row.ticker_candidate.trim().toUpperCase()
      : null;
    const quantity = parseNumberValue(row.quantity_candidate);
    const currentPrice = parseNumberValue(row.current_price_candidate);
    const explicitPurchasePrice = parseNumberValue(row.purchase_price_candidate);
    const performancePct = parsePercentValue(row.performance_pct_candidate);
    const purchaseDate = parseDateValue(row.purchase_date_candidate);
    const explicitlyNeedsReview = row.needs_review === true;
    const extractedConfidence = typeof row.confidence === "number" ? clamp01(row.confidence) : 0.85;

    let derivedPurchasePrice: number | null = explicitPurchasePrice;
    if (documentType === "positions_with_current_price" && derivedPurchasePrice == null && currentPrice != null && performancePct != null && performancePct > -99.9) {
      derivedPurchasePrice = currentPrice / (1 + performancePct / 100);
    }

    let ticker = tickerCandidate;
    let tickerFromLookup = false;
    if (!ticker && name) {
      ticker = await lookupTickerByName(name, twelveDataApiKey);
      tickerFromLookup = Boolean(ticker);
    }

    const uncertainFields: string[] = [];
    if (!ticker) uncertainFields.push("ticker");
    if (quantity == null) uncertainFields.push("quantity");
    if (derivedPurchasePrice == null) uncertainFields.push("purchase_price");
    if (!purchaseDate) uncertainFields.push("purchase_date");

    let confidence = extractedConfidence;
    if (tickerFromLookup) confidence = Math.max(confidence, 0.78);
    if (documentType === "positions_with_current_price" && explicitPurchasePrice == null && derivedPurchasePrice != null) {
      confidence -= 0.08;
    }
    confidence = clamp01(confidence);

    const hasRequiredFields = Boolean(name.trim()) && quantity != null && derivedPurchasePrice != null;
    const reason = typeof row.reason === "string" && row.reason.trim()
      ? row.reason.trim()
      : "Dati incompleti o poco leggibili nello screenshot.";
    const lowConfidenceCore = confidence < AUTO_IMPORT_CONFIDENCE_THRESHOLD;
    const onlyNonBlockingUncertainFields = uncertainFields.every((field) => field === "ticker" || field === "purchase_date");
    const modelReviewOverride = explicitlyNeedsReview
      && hasRequiredFields
      && !lowConfidenceCore
      && onlyNonBlockingUncertainFields;
    const needsReview = !hasRequiredFields || lowConfidenceCore || (explicitlyNeedsReview && !modelReviewOverride);
    const detailedReason = needsReview
      ? [reason, uncertainFields.length > 0 ? `Campi incerti: ${uncertainFields.join(", ")}.` : "", lowConfidenceCore ? `Confidenza ${confidence.toFixed(2)} sotto soglia.` : ""]
        .filter(Boolean)
        .join(" ")
      : "";

    normalizedRows.push({
      sourceFile: fileName,
      name,
      ticker,
      quantity,
      purchase_price: derivedPurchasePrice != null ? Number(derivedPurchasePrice.toFixed(6)) : null,
      purchase_date: purchaseDate,
      needs_review: needsReview,
      reason: detailedReason,
      confidence,
      uncertain_fields: uncertainFields,
      document_type: documentType,
    });
  }
  return normalizedRows;
}

async function extractRowsFromImage(
  file: File,
  anthropicApiKey: string,
  twelveDataApiKey: string,
): Promise<ScreenshotCandidate[]> {
  const mediaType = file.type || "image/png";
  const bytes = Buffer.from(await file.arrayBuffer());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);

  try {
    const prompt =
      "Analizza lo screenshot e classifica il documento in uno schema tra:\n" +
      "- positions_with_current_price\n" +
      "- transactions\n" +
      "- generic_table\n" +
      "Rispondi SOLO con JSON valido in questo formato:\n" +
      "{\n" +
      '  "document_type": "positions_with_current_price|transactions|generic_table",\n' +
      '  "rows": [\n' +
      "    {\n" +
      '      "name": "string",\n' +
      '      "ticker_candidate": "string|null",\n' +
      '      "quantity_candidate": "number|string|null",\n' +
      '      "current_price_candidate": "number|string|null",\n' +
      '      "performance_pct_candidate": "number|string|null",\n' +
      '      "purchase_price_candidate": "number|string|null",\n' +
      '      "purchase_date_candidate": "string|null",\n' +
      '      "source_labels": ["string"],\n' +
      '      "confidence": 0.0,\n' +
      '      "needs_review": true,\n' +
      '      "reason": "string"\n' +
      "    }\n" +
      "  ]\n" +
      "}\n" +
      "Regole:\n" +
      "- Non inventare dati non leggibili.\n" +
      "- Se un campo non e chiaro metti null e needs_review=true.\n" +
      "- Se la data non e visibile metti null.\n" +
      "- quantity_candidate deve essere il numero quote/pezzi se visibile.\n" +
      "- current_price_candidate deve essere prezzo corrente, non prezzo medio di carico.\n" +
      "- performance_pct_candidate deve essere solo percentuale numerica se visibile.\n" +
      "- confidence tra 0 e 1.\n";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 900,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: bytes.toString("base64"),
              },
            },
          ],
        }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Errore OCR screenshot (${response.status}): ${errorBody}`);
    }

    const payload = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = payload.content?.find((block) => block.type === "text")?.text?.trim() ?? "{}";
    let parsedPayload: VisionPayload | null = null;
    try {
      parsedPayload = extractJsonPayload(text);
    } catch {
      parsedPayload = null;
    }
    const documentType = asDocumentSchema(parsedPayload?.document_type);
    const rows = Array.isArray(parsedPayload?.rows) ? parsedPayload?.rows as RawVisionRow[] : [];
    return normalizeRows(file.name, rows, documentType, twelveDataApiKey);
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? "Timeout durante l'analisi dello screenshot."
      : "Errore durante l'estrazione OCR: conferma manuale richiesta.";
    return [{
      sourceFile: file.name,
      name: guessNameFromFileName(file.name),
      ticker: null,
      quantity: null,
      purchase_price: null,
      purchase_date: null,
      needs_review: true,
      reason,
      confidence: 0,
      uncertain_fields: ["all"],
      document_type: "generic_table",
    }];
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  try {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return NextResponse.json({ error: "Variabile ANTHROPIC_API_KEY mancante." }, { status: 500 });
    }
    const twelveDataApiKey = process.env.TWELVE_DATA_API_KEY;
    if (!twelveDataApiKey) {
      return NextResponse.json({ error: "Variabile TWELVE_DATA_API_KEY mancante." }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Puoi caricare al massimo ${MAX_FILES} screenshot per volta.` }, { status: 422 });
    }
    if (files.length === 0) {
      return NextResponse.json({ rows: [] as ScreenshotCandidate[] });
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: `Il file ${file.name} non e un'immagine valida.` }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: `Il file ${file.name} supera il limite di 8MB.` }, { status: 413 });
      }
    }

    const extractedByFile = await Promise.all(
      files.map((file) => extractRowsFromImage(file, anthropicApiKey, twelveDataApiKey)),
    );
    const rows = extractedByFile.flat();

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Errore route /api/import-screenshot:", error);
    return NextResponse.json({ error: "Errore durante l'analisi degli screenshot." }, { status: 500 });
  }
}
