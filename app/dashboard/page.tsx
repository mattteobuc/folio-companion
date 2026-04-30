"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/utils/supabase/client";

type AssetRow = {
  id: string; ticker: string; name: string; asset_type: string;
  quantity: number; purchase_price: number; purchase_date: string | null; portfolio_id: string;
  source_platform?: string; external_symbol?: string | null; import_batch_id?: string | null;
};
type PortfolioRow = { id: string; name: string };
type NewsItem = { ticker: string; titolo: string; fonte: string; url: string; data: string; riassunto: string };
type NewsMeta = {
  hasAssets: boolean;
  hasValidTickers: boolean;
  usedNameFallback: boolean;
  providerDegraded: boolean;
  providerErrorsCount: number;
  usedMarketFallback: boolean;
};
type MacroTopic = { topic: string; sentiment: string; analisi: string };
type MacroPayload = { testo: string; topics: MacroTopic[] | null; data: string };
type ChatMessage = { role: "user" | "assistant"; content: string };
type SymbolSearchResult = { ticker: string; name: string; market: string; asset_type: string };
type PricesMap = Record<string, number | null>;
type MobileTab = "portfolio" | "news";
type ChatSession = { id: string; title: string | null; updated_at: string };
type TutorialStep = {
  id: string;
  title: string;
  description: string;
  target: "portfolio" | "insights" | "signals" | "macro" | "news" | "chat" | "import" | "analysis" | "diary" | "purchasePlans";
};

type PurchasePlanCadence = "settimanale" | "quindicinale" | "mensile";
type PurchasePlanStatus = "active" | "paused" | "archived";
type PurchasePlanRow = {
  id: string;
  title: string;
  ticker: string | null;
  goal_type: "accumulo" | "bilanciamento" | "riduzione_volatilita" | "altro";
  cadence: PurchasePlanCadence;
  amount: number;
  start_date: string;
  next_run_date: string;
  monthly_budget_limit: number | null;
  status: PurchasePlanStatus;
  risk_note: string | null;
  created_at: string;
  updated_at: string;
};
type PurchasePlansResponse = { data?: PurchasePlanRow[]; error?: string; warning?: "schema_missing" };

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "chat",
    title: "Mate conversazionale",
    description: "Questa e la tua area di confronto: puoi fare domande, chiarire dubbi e analizzare scenari insieme al mate, senza consigli buy/sell.",
    target: "chat",
  },
  {
    id: "insights",
    title: "Insight rapidi",
    description: "Questi sono i punti chiave del momento in formato super sintetico. Se vuoi, apri la card e vai piu a fondo.",
    target: "insights",
  },
  {
    id: "signals",
    title: "Segnali del mate",
    description: "Qui trovi segnali contestualizzati al tuo portafoglio: niente allarmismi, solo spunti utili per leggere meglio quello che succede.",
    target: "signals",
  },
  {
    id: "portfolio",
    title: "Il tuo portafoglio",
    description: "Qua trovi i tuoi asset: puoi aggiungerli, modificarli e tenerli monitorati giorno per giorno.",
    target: "portfolio",
  },
  {
    id: "import",
    title: "Importa con il Mate",
    description: "Da qui puoi importare CSV o screenshot. Il Mate ti guida, evita duplicati nella stessa piattaforma e portafoglio e ti chiede conferma quando i dati non sono chiari.",
    target: "import",
  },
  {
    id: "analysis",
    title: "Analisi dedicata",
    description: "Qui trovi il pulsante per aprire l'analisi avanzata in una pagina separata. Durante il tutorial lo evidenziamo soltanto.",
    target: "analysis",
  },
  {
    id: "purchase-plans",
    title: "Piani di acquisto",
    description: "Qui imposti il tuo piano ricorrente e controlli se resta in linea con il budget deciso.",
    target: "purchasePlans",
  },
  {
    id: "diary",
    title: "Diario personale",
    description: "Qui salvi emozioni e riflessioni legate alle tue scelte. Il Mate usa queste note per darti insight piu empatici e contestuali.",
    target: "diary",
  },
  {
    id: "macro",
    title: "Contesto di mercato",
    description: "Qua hai una lettura macro in linguaggio semplice, cosi capisci il quadro prima di reagire di impulso.",
    target: "macro",
  },
  {
    id: "news",
    title: "Notizie per te",
    description: "Notizie rilevanti per i tuoi ticker, con riassunti chiari e scorciatoia per parlarne subito con il mate.",
    target: "news",
  },
];
type ConversationalSignal = {
  id: string;
  livello: "attenzione" | "monitoraggio" | "info";
  titolo: string;
  motivo: string;
  prompt: string;
  sourceUrl?: string;
};
type Insight = {
  ticker?: string; titolo?: string; contenuto?: string;
  tipo?: "attenzione" | "opportunità" | "info";
  news_url?: string | null; news_titolo?: string | null;
};
type ImportCandidateRow = {
  name: string;
  ticker: string | null;
  quantity: number | null;
  purchase_price: number | null;
  purchase_date: string | null;
  sourceFile: string;
  needs_review: boolean;
  reason?: string;
  confidence?: number;
  uncertain_fields?: string[];
  document_type?: "positions_with_current_price" | "transactions" | "generic_table";
};
type ImportOutcome = {
  imported: number;
  duplicates: number;
  possibleDuplicatesImported: number;
  needsReview: number;
  reviewRows: ImportCandidateRow[];
  excluded: number;
};
type ImportPreviewRow = ImportCandidateRow & { id: string };

const MACRO_CACHE_KEY = "folio:macro-context:v2";
const MACRO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEWS_SUMMARY_CACHE_KEY = "folio:news-summaries:v1";
const NEWS_CACHE_KEY = "folio:news-cache:v1";
const NEWS_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const INSIGHTS_CACHE_KEY = "folio:insights-cache:v1";
const INSIGHTS_CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const TUTORIAL_COMPLETED_LOCAL_KEY = "folio:tutorial-completed:v1";
const INITIAL_CHAT_MESSAGE = "Ciao! Sono il tuo mate finanziario. Puoi chiedermi tutto sul tuo portafoglio, sulle notizie di mercato o sugli eventi macro. Non ti daro mai consigli diretti di acquisto o vendita, ma ti aiutero a capire meglio il contesto.";
const IMPORT_AUTO_CONFIDENCE_THRESHOLD = 0.75;
const IMPORT_DUPLICATE_FUZZY_THRESHOLD = 0.8;

type PreviewDuplicateKind = "strict-existing" | "strict-intra" | "fuzzy-existing" | "fuzzy-intra";
type PreviewDuplicateInfo = {
  kind: PreviewDuplicateKind;
  message: string;
};

function buildFallbackTicker(name: string): string {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return normalized.length > 0 ? `IMP_${normalized}` : "IMP_IMPORTED_ASSET";
}

function normalizeDedupeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenOverlapScore(a: string, b: string): number {
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const s = sentiment.toLowerCase();
  if (s.includes("positivo")) return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">↑ Positivo</span>;
  if (s.includes("negativo")) return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">↓ Negativo</span>;
  if (s.includes("misto")) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">~ Misto</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">— Neutro</span>;
}

function InsightIcon({ tipo }: { tipo?: string }) {
  if (tipo === "attenzione") return <span className="text-base">⚠️</span>;
  if (tipo === "opportunità") return <span className="text-base">💡</span>;
  return <span className="text-base">📊</span>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "oggi";
  if (days === 1) return "ieri";
  if (days < 7) return `${days}g fa`;
  if (days < 30) return `${Math.floor(days / 7)}w fa`;
  return `${Math.floor(days / 30)}m fa`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const [activePortfolioFilter, setActivePortfolioFilter] = useState<string>("all");
  const [isPortfolioMenuOpen, setIsPortfolioMenuOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<PortfolioRow | null>(null);
  const [editingPortfolioName, setEditingPortfolioName] = useState("");
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [portfolioActionLoading, setPortfolioActionLoading] = useState(false);
  const [collapsedPortfolios, setCollapsedPortfolios] = useState<Record<string, boolean>>({});
  const [allCollapsed, setAllCollapsed] = useState(false);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [prices, setPrices] = useState<PricesMap>({});
  const [isPricesLoading, setIsPricesLoading] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  const [macroText, setMacroText] = useState("");
  const [macroTopics, setMacroTopics] = useState<MacroTopic[] | null>(null);
  const [macroDate, setMacroDate] = useState("");
  const [isMacroLoading, setIsMacroLoading] = useState(false);
  const [macroErrorMessage, setMacroErrorMessage] = useState<string | null>(null);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsMeta, setNewsMeta] = useState<NewsMeta>({
    hasAssets: false,
    hasValidTickers: false,
    usedNameFallback: false,
    providerDegraded: false,
    providerErrorsCount: 0,
    usedMarketFallback: false,
  });
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [newsErrorMessage, setNewsErrorMessage] = useState<string | null>(null);

  const [insights, setInsights] = useState<Insight[]>([]);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);
  const [expandedInsightIds, setExpandedInsightIds] = useState<Record<number, boolean>>({});

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ role: "assistant", content: INITIAL_CHAT_MESSAGE }]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatErrorMessage, setChatErrorMessage] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [isTutorialSaving, setIsTutorialSaving] = useState(false);
  const [hasTutorialAutostartChecked, setHasTutorialAutostartChecked] = useState(false);

  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("portfolio");

  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetSearchResults, setAssetSearchResults] = useState<SymbolSearchResult[]>([]);
  const [isSearchingSymbol, setIsSearchingSymbol] = useState(false);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [symbolSearchMessage, setSymbolSearchMessage] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<SymbolSearchResult | null>(null);
  const [investedAmount, setInvestedAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [isFetchingHistoricalPrice, setIsFetchingHistoricalPrice] = useState(false);
  const [historicalPriceError, setHistoricalPriceError] = useState<string | null>(null);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("");
  const [showNewPortfolioInput, setShowNewPortfolioInput] = useState(false);
  const [modalNewPortfolioName, setModalNewPortfolioName] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importPlatform, setImportPlatform] = useState("");
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importDestinationType, setImportDestinationType] = useState<"existing" | "new">("existing");
  const [importPortfolioId, setImportPortfolioId] = useState("");
  const [importNewPortfolioName, setImportNewPortfolioName] = useState("");
  const [isImportingAssets, setIsImportingAssets] = useState(false);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [importReport, setImportReport] = useState<ImportOutcome | null>(null);
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [selectedPreviewRowIds, setSelectedPreviewRowIds] = useState<string[]>([]);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [importPreviewPortfolioId, setImportPreviewPortfolioId] = useState("");
  const [importPreviewSourcePlatform, setImportPreviewSourcePlatform] = useState("unknown");
  const [purchasePlans, setPurchasePlans] = useState<PurchasePlanRow[]>([]);
  const [isPurchasePlansLoading, setIsPurchasePlansLoading] = useState(false);
  const [purchasePlanErrorMessage, setPurchasePlanErrorMessage] = useState<string | null>(null);
  const [purchasePlanActionId, setPurchasePlanActionId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const symbolSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const portfolioMenuRef = useRef<HTMLDivElement | null>(null);
  const portfolioRef = useRef<HTMLDivElement | null>(null);
  const insightsRef = useRef<HTMLDivElement | null>(null);
  const signalsRef = useRef<HTMLDivElement | null>(null);
  const macroRef = useRef<HTMLDivElement | null>(null);
  const newsRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesRef = useRef<ChatMessage[]>([{ role: "assistant", content: INITIAL_CHAT_MESSAGE }]);
  const currentSessionIdRef = useRef<string | null>(null);
  const assetsRef = useRef<AssetRow[]>([]);
  const newsRefState = useRef<NewsItem[]>([]);
  const purchasePlansRef = useRef<HTMLDivElement | null>(null);
  const diaryButtonRef = useRef<HTMLAnchorElement | null>(null);
  const importButtonRef = useRef<HTMLButtonElement | null>(null);
  const analysisButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => {
    newsRefState.current = news;
  }, [news]);

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tutorialSteps = TUTORIAL_STEPS;
  const currentTutorialTarget = isTutorialOpen ? tutorialSteps[tutorialStepIndex]?.target : null;
  const getTutorialTargetClass = (target: TutorialStep["target"]) =>
    isTutorialOpen && currentTutorialTarget === target
      ? "relative z-[65] rounded-xl ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950"
      : "";

  const visiblePortfolios = useMemo(() =>
    activePortfolioFilter === "all" ? portfolios : portfolios.filter((p) => p.id === activePortfolioFilter),
  [portfolios, activePortfolioFilter]);

  const getAssetsForPortfolio = useCallback((portfolioId: string) =>
    assets.filter((a) => a.portfolio_id === portfolioId), [assets]);

  const computeTotals = useCallback((assetList: AssetRow[]) =>
    assetList.reduce((acc, asset) => {
      const cp = prices[asset.ticker];
      if (cp == null) return { ...acc, totalCost: acc.totalCost + asset.purchase_price * asset.quantity };
      const cv = cp * asset.quantity; const cb = asset.purchase_price * asset.quantity;
      return { totalValue: acc.totalValue + cv, totalCost: acc.totalCost + cb, totalGainLoss: acc.totalGainLoss + (cv - cb) };
    }, { totalValue: 0, totalCost: 0, totalGainLoss: 0 }),
  [prices]);

  const allVisibleAssets = useMemo(() =>
    visiblePortfolios.flatMap((p) => getAssetsForPortfolio(p.id)),
  [visiblePortfolios, getAssetsForPortfolio]);

  const grandTotals = useMemo(() => computeTotals(allVisibleAssets), [computeTotals, allVisibleAssets]);
  const grandTotalGainLossPercent = grandTotals.totalCost > 0 ? (grandTotals.totalGainLoss / grandTotals.totalCost) * 100 : 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);

  const getAssetMetrics = useCallback((asset: AssetRow) => {
    const cp = prices[asset.ticker];
    if (cp == null) return { currentValue: null, gainLoss: null, gainLossPercent: null };
    const cv = cp * asset.quantity; const cb = asset.purchase_price * asset.quantity; const gl = cv - cb;
    return { currentValue: cv, gainLoss: gl, gainLossPercent: cb > 0 ? (gl / cb) * 100 : 0 };
  }, [prices]);

  const openAddAssetModal = (preselectedPortfolioId?: string) => {
    setSelectedPortfolioId(preselectedPortfolioId ?? portfolios[0]?.id ?? "");
    setShowNewPortfolioInput(false); setModalNewPortfolioName(""); setIsAddAssetModalOpen(true);
  };

  const togglePortfolioCollapsed = (portfolioId: string) => {
    setCollapsedPortfolios((prev) => ({ ...prev, [portfolioId]: !prev[portfolioId] }));
  };

  const toggleAllCollapsed = () => {
    const next = !allCollapsed;
    setAllCollapsed(next);
    const newState: Record<string, boolean> = {};
    portfolios.forEach((p) => { newState[p.id] = next; });
    setCollapsedPortfolios(newState);
  };

  const ensureDefaultPortfolio = useCallback(async (userId: string): Promise<PortfolioRow[]> => {
    const { data: existing, error } = await supabase.from("portfolios").select("id, name").eq("user_id", userId).order("created_at", { ascending: true });
    if (error) throw error;
    if (existing && existing.length > 0) { setPortfolios(existing as PortfolioRow[]); return existing as PortfolioRow[]; }
    const { data: newP, error: insertError } = await supabase.from("portfolios").insert({ user_id: userId, name: "Portafoglio principale" }).select("id, name").single<PortfolioRow>();
    if (insertError) throw insertError;
    setPortfolios([newP]); return [newP];
  }, [supabase]);

  const loadAssets = useCallback(async (portfolioIds: string[]): Promise<AssetRow[]> => {
    if (portfolioIds.length === 0) { setAssets([]); return []; }
    const invalidateNewsAndInsightsCache = () => {
      window.localStorage.removeItem(NEWS_CACHE_KEY);
      window.localStorage.removeItem(INSIGHTS_CACHE_KEY);
    };
    const hasAssetSetChanged = (nextRows: AssetRow[]) => {
      const prevIds = new Set(assetsRef.current.map((asset) => asset.id));
      const nextIds = new Set(nextRows.map((asset) => asset.id));
      if (prevIds.size !== nextIds.size) return true;
      for (const id of prevIds) {
        if (!nextIds.has(id)) return true;
      }
      return false;
    };
    const latestSelect = "id, ticker, name, asset_type, quantity, purchase_price, purchase_date, portfolio_id, source_platform, external_symbol, import_batch_id";
    const legacySelect = "id, ticker, name, asset_type, quantity, purchase_price, purchase_date, portfolio_id";
    const latestResult = await supabase.from("assets").select(latestSelect).in("portfolio_id", portfolioIds).order("created_at", { ascending: false });
    if (!latestResult.error) {
      const rows = (latestResult.data ?? []) as AssetRow[];
      if (hasAssetSetChanged(rows)) invalidateNewsAndInsightsCache();
      setAssets(rows);
      return rows;
    }

    // Fallback compatibile con DB non ancora migrato alle nuove colonne import.
    const legacyResult = await supabase.from("assets").select(legacySelect).in("portfolio_id", portfolioIds).order("created_at", { ascending: false });
    if (legacyResult.error) throw latestResult.error;
    const rows = (legacyResult.data ?? []) as AssetRow[];
    if (hasAssetSetChanged(rows)) invalidateNewsAndInsightsCache();
    setAssets(rows);
    return rows;
  }, [supabase]);

  const loadPrices = useCallback(async (assetList: AssetRow[]) => {
    if (assetList.length === 0) return;
    setIsPricesLoading(true);
    try {
      const tickers = [...new Set(assetList.map((a) => a.ticker))];
      const res = await fetch("/api/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickers }) });
      const payload = (await res.json()) as { prices?: PricesMap };
      if (res.ok && payload.prices) setPrices(payload.prices);
    } catch (e) { console.error(e); } finally { setIsPricesLoading(false); }
  }, []);

  const getNewsSummaryCache = () => {
    try {
      const rawCache = window.localStorage.getItem(NEWS_SUMMARY_CACHE_KEY);
      if (!rawCache) return {};
      const parsedCache = JSON.parse(rawCache) as unknown;
      if (!parsedCache || typeof parsedCache !== "object" || Array.isArray(parsedCache)) {
        window.localStorage.removeItem(NEWS_SUMMARY_CACHE_KEY);
        return {};
      }
      return Object.fromEntries(
        Object.entries(parsedCache as Record<string, unknown>).filter(
          ([key, value]) => typeof key === "string" && typeof value === "string",
        ),
      ) as Record<string, string>;
    } catch {
      window.localStorage.removeItem(NEWS_SUMMARY_CACHE_KEY);
      return {};
    }
  };

  const loadNews = useCallback(async (options?: { forceRefresh?: boolean }) => {
    setIsNewsLoading(true); setNewsErrorMessage(null);
    try {
      if (!options?.forceRefresh) {
        const cachedNewsRaw = window.localStorage.getItem(NEWS_CACHE_KEY);
        if (cachedNewsRaw) {
          const cachedNewsPayload = JSON.parse(cachedNewsRaw) as {
            news?: NewsItem[];
            meta?: NewsMeta;
            timestamp?: number;
          };
          const isFresh = Date.now() - (cachedNewsPayload.timestamp ?? 0) < NEWS_CACHE_TTL_MS;
          if (isFresh && Array.isArray(cachedNewsPayload.news)) {
            setNews(cachedNewsPayload.news);
            if (cachedNewsPayload.meta) setNewsMeta(cachedNewsPayload.meta);
            return cachedNewsPayload.news;
          }
        }
      }
      const sc = getNewsSummaryCache();
      const res = await fetch("/api/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cachedSummaries: sc }) });
      const payload = (await res.json()) as { news?: NewsItem[]; error?: string; meta?: NewsMeta };
      if (!res.ok) throw new Error(payload.error ?? "Non sono riuscito a recuperare le notizie.");
      const nextNews = (payload.news ?? [])
        .filter((item) => item && item.titolo && item.url && item.data)
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setNews(nextNews);
      setNewsMeta(payload.meta ?? {
        hasAssets: false,
        hasValidTickers: false,
        usedNameFallback: false,
        providerDegraded: false,
        providerErrorsCount: 0,
        usedMarketFallback: false,
      });
      const nc = { ...sc }; nextNews.forEach((item) => { const k = item.titolo.trim().toLowerCase(); if (k && item.riassunto) nc[k] = item.riassunto; });
      window.localStorage.setItem(NEWS_SUMMARY_CACHE_KEY, JSON.stringify(nc));
      window.localStorage.setItem(
        NEWS_CACHE_KEY,
        JSON.stringify({
          news: nextNews,
          meta: payload.meta ?? {
            hasAssets: false,
            hasValidTickers: false,
            usedNameFallback: false,
            providerDegraded: false,
            providerErrorsCount: 0,
            usedMarketFallback: false,
          },
          timestamp: Date.now(),
        }),
      );
      return nextNews;
    } catch (e) { setNewsErrorMessage(e instanceof Error ? e.message : "Errore inatteso."); return []; }
    finally { setIsNewsLoading(false); }
  }, []);

  const loadMacroContext = useCallback(async (options?: { forceRefresh?: boolean }) => {
    setIsMacroLoading(true); setMacroErrorMessage(null);
    try {
      if (!options?.forceRefresh) {
        const cached = window.localStorage.getItem(MACRO_CACHE_KEY);
        if (cached) {
          const p = JSON.parse(cached) as { testo?: string; topics?: MacroTopic[]; data?: string; timestamp?: number };
          if (Date.now() - (p.timestamp ?? 0) < MACRO_CACHE_TTL_MS && p.testo && p.data) { setMacroText(p.testo); setMacroTopics(p.topics ?? null); setMacroDate(p.data); return; }
        }
      }
      const res = await fetch("/api/macro", { method: "GET", cache: "no-store" });
      const payload = (await res.json()) as MacroPayload & { error?: string };
      if (!res.ok) throw new Error(payload.error);
      setMacroText(payload.testo || ""); setMacroTopics(payload.topics ?? null); setMacroDate(payload.data || "");
      window.localStorage.setItem(MACRO_CACHE_KEY, JSON.stringify({ testo: payload.testo || "", topics: payload.topics ?? null, data: payload.data || "", timestamp: Date.now() }));
    } catch (e) { setMacroErrorMessage(e instanceof Error ? e.message : "Errore inatteso."); }
    finally { setIsMacroLoading(false); }
  }, []);

  const loadInsights = useCallback(async (options?: { forceRefresh?: boolean }) => {
    setIsInsightsLoading(true);
    try {
      if (!options?.forceRefresh) {
        const cachedInsightsRaw = window.localStorage.getItem(INSIGHTS_CACHE_KEY);
        if (cachedInsightsRaw) {
          const cachedInsightsPayload = JSON.parse(cachedInsightsRaw) as { insights?: Insight[]; timestamp?: number };
          const isFresh = Date.now() - (cachedInsightsPayload.timestamp ?? 0) < INSIGHTS_CACHE_TTL_MS;
          if (isFresh && Array.isArray(cachedInsightsPayload.insights)) {
            setInsights(cachedInsightsPayload.insights);
            setExpandedInsightIds({});
            return;
          }
        }
      }
      const res = await fetch("/api/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ news: newsRefState.current }) });
      const payload = (await res.json()) as { insights?: Insight[] };
      if (res.ok && payload.insights) {
        setInsights(payload.insights);
        setExpandedInsightIds({});
        window.localStorage.setItem(
          INSIGHTS_CACHE_KEY,
          JSON.stringify({
            insights: payload.insights,
            timestamp: Date.now(),
          }),
        );
      }
    } catch (e) { console.error(e); } finally { setIsInsightsLoading(false); }
  }, []);

  const loadPurchasePlans = useCallback(async () => {
    setIsPurchasePlansLoading(true);
    setPurchasePlanErrorMessage(null);
    try {
      const response = await fetch("/api/purchase-plans", { method: "GET", cache: "no-store" });
      const payload = (await response.json()) as PurchasePlansResponse;
      if (payload.warning === "schema_missing") {
        // Fallback non bloccante: mostra empty state anche se migration non applicata.
        setPurchasePlans([]);
        return;
      }
      if (!response.ok) throw new Error(payload.error ?? "Non sono riuscito a caricare i piani di acquisto.");
      setPurchasePlans(payload.data ?? []);
    } catch (error) {
      setPurchasePlanErrorMessage(error instanceof Error ? error.message : "Errore inatteso nel caricamento dei piani.");
    } finally {
      setIsPurchasePlansLoading(false);
    }
  }, []);

  const toggleInsightExpanded = (index: number) => {
    setExpandedInsightIds((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const loadChatSessions = useCallback(async () => {
    const { data } = await supabase.from("chat_sessions").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(20);
    setChatSessions((data ?? []) as ChatSession[]);
  }, [supabase]);

  const getTutorialCompleted = useCallback(async (userId: string): Promise<boolean> => {
    const getLocalTutorialStatus = () => {
      if (typeof window === "undefined") return false;
      return window.localStorage.getItem(TUTORIAL_COMPLETED_LOCAL_KEY) === "true";
    };
    const { data, error } = await supabase
      .from("user_onboarding_status")
      .select("dashboard_tutorial_completed")
      .eq("user_id", userId)
      .maybeSingle<{ dashboard_tutorial_completed: boolean }>();
    if (error) {
      // Fallback non bloccante: se la tabella non esiste o non è accessibile usiamo stato locale.
      console.warn("Errore lettura onboarding tutorial (fallback locale attivo):", {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return getLocalTutorialStatus();
    }
    return data?.dashboard_tutorial_completed ?? getLocalTutorialStatus();
  }, [supabase]);

  const markTutorialCompleted = useCallback(async () => {
    if (!currentUserId) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TUTORIAL_COMPLETED_LOCAL_KEY, "true");
    }
    setIsTutorialSaving(true);
    try {
      const { error } = await supabase.from("user_onboarding_status").upsert(
        { user_id: currentUserId, dashboard_tutorial_completed: true, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    } catch (error) {
      console.warn("Errore salvataggio onboarding tutorial (persistito localmente):", error);
    } finally {
      setIsTutorialSaving(false);
    }
  }, [currentUserId, supabase]);

  const openChatFromNews = (item: NewsItem) => {
    const prefilledMessage = `Ho letto questa notizia su ${item.ticker}: "${item.titolo}". Mi aiuti a capire in modo semplice i possibili scenari per il mio portafoglio e cosa osservare nei prossimi giorni?`;
    setIsChatMinimized(false);
    setIsChatExpanded(true);
    setChatInput(prefilledMessage);
    window.requestAnimationFrame(() => {
      chatInputRef.current?.focus();
      chatInputRef.current?.setSelectionRange(prefilledMessage.length, prefilledMessage.length);
    });
  };

  const openChatFromPrompt = (prompt: string) => {
    setIsChatMinimized(false);
    setIsChatExpanded(true);
    setChatInput(prompt);
    window.requestAnimationFrame(() => {
      chatInputRef.current?.focus();
      chatInputRef.current?.setSelectionRange(prompt.length, prompt.length);
    });
  };

  const openTutorial = () => {
    setIsChatMinimized(false);
    setIsTutorialOpen(true);
    setTutorialStepIndex(0);
  };

  const goToTutorialStep = (nextIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(nextIndex, tutorialSteps.length - 1));
    const target = tutorialSteps[boundedIndex]?.target;
    if (target === "news") setMobileTab("news");
    else setMobileTab("portfolio");
    setTutorialStepIndex(boundedIndex);
  };

  const closeTutorial = async (markAsCompleted: boolean) => {
    setIsTutorialOpen(false);
    setTutorialStepIndex(0);
    if (markAsCompleted) {
      await markTutorialCompleted();
    }
  };

  const conversationalSignals = useMemo<ConversationalSignal[]>(() => {
    const signals: ConversationalSignal[] = [];

    // Segnale 1: movimento marcato rispetto al prezzo medio di carico.
    for (const asset of allVisibleAssets) {
      const metrics = getAssetMetrics(asset);
      if (metrics.gainLossPercent == null) continue;
      const absMove = Math.abs(metrics.gainLossPercent);
      if (absMove < 12) continue;
      const direction = metrics.gainLossPercent >= 0 ? "salita" : "discesa";
      signals.push({
        id: `price-${asset.id}`,
        livello: absMove >= 20 ? "attenzione" : "monitoraggio",
        titolo: `${asset.ticker}: movimento in ${direction}`,
        motivo: `${asset.ticker} si è mosso del ${metrics.gainLossPercent.toFixed(1)}% rispetto al tuo prezzo medio di carico. Potrebbe cambiare il peso emotivo e di rischio della posizione.`,
        prompt: `Ho visto il movimento di ${asset.ticker} (${metrics.gainLossPercent.toFixed(1)}% vs mio prezzo medio). Mi aiuti a leggere il contesto in modo semplice e a capire cosa monitorare nei prossimi giorni?`,
      });
      if (signals.length >= 2) break;
    }

    // Segnale 2: notizia rilevante su ticker in portafoglio.
    const portfolioTickers = new Set(allVisibleAssets.map((asset) => asset.ticker));
    const newsSignal = news.find((item) => portfolioTickers.has(item.ticker));
    if (newsSignal) {
      signals.push({
        id: `news-${newsSignal.ticker}-${newsSignal.url}`,
        livello: "monitoraggio",
        titolo: `${newsSignal.ticker}: notizia da monitorare`,
        motivo: `È uscita una notizia potenzialmente rilevante per ${newsSignal.ticker}. Vale la pena contestualizzarla rispetto al tuo portafoglio.`,
        prompt: `Questa notizia su ${newsSignal.ticker} ("${newsSignal.titolo}") quanto è davvero importante nel mio caso? Puoi spiegarmi gli scenari in linguaggio semplice?`,
        sourceUrl: newsSignal.url,
      });
    }

    // Segnale 3: concentrazione su singolo ticker.
    if (allVisibleAssets.length > 0) {
      const valueByTicker = new Map<string, number>();
      let totalValue = 0;
      allVisibleAssets.forEach((asset) => {
        const currentPrice = prices[asset.ticker];
        const value = (currentPrice ?? asset.purchase_price) * asset.quantity;
        valueByTicker.set(asset.ticker, (valueByTicker.get(asset.ticker) ?? 0) + value);
        totalValue += value;
      });
      if (totalValue > 0) {
        const [topTicker, topValue] = Array.from(valueByTicker.entries()).sort((a, b) => b[1] - a[1])[0];
        const concentration = (topValue / totalValue) * 100;
        if (concentration >= 45) {
          signals.push({
            id: `concentration-${topTicker}`,
            livello: concentration >= 60 ? "attenzione" : "monitoraggio",
            titolo: `Concentrazione elevata su ${topTicker}`,
            motivo: `${topTicker} rappresenta circa il ${concentration.toFixed(1)}% del valore totale. Una concentrazione alta può amplificare la volatilità percepita.`,
            prompt: `Vedo che ${topTicker} pesa circa il ${concentration.toFixed(1)}% nel mio portafoglio. Mi aiuti a capire pro/contro di questa concentrazione e cosa osservare senza cambiare approccio in modo impulsivo?`,
          });
        }
      }
    }

    return signals.slice(0, 3);
  }, [allVisibleAssets, getAssetMetrics, news, prices]);

  const loadDashboardData = useCallback(async () => {
    setErrorMessage(null); setIsPageLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) { router.push("/login"); router.refresh(); return; }
      setCurrentUserId(user.id);
      setUserEmail(user.email ?? "");
      const loadedPortfolios = await ensureDefaultPortfolio(user.id);
      const portfolioIds = loadedPortfolios.map((p) => p.id);
      const loadedAssets = await loadAssets(portfolioIds);
      await Promise.all([loadNews(), loadPrices(loadedAssets), loadMacroContext(), loadChatSessions(), loadPurchasePlans()]);
      void loadInsights();

      if (!hasTutorialAutostartChecked) {
        const tutorialCompleted = await getTutorialCompleted(user.id);
        if (!tutorialCompleted) {
          setIsTutorialOpen(true);
          setTutorialStepIndex(0);
        }
        setHasTutorialAutostartChecked(true);
      }
    } catch (e) { setErrorMessage(e instanceof Error ? e.message : "Errore inatteso."); }
    finally { setIsPageLoading(false); }
  }, [ensureDefaultPortfolio, loadAssets, loadPrices, loadMacroContext, loadNews, loadChatSessions, loadInsights, hasTutorialAutostartChecked, getTutorialCompleted, router, supabase, loadPurchasePlans]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => { void loadDashboardData(); });
    return () => { window.cancelAnimationFrame(id); };
  }, [loadDashboardData]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (portfolioMenuRef.current && !portfolioMenuRef.current.contains(e.target as Node)) setIsPortfolioMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!isChatExpanded) return;
    // Evita doppi scroll quando la chat è in modalità overlay.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isChatExpanded]);

  useEffect(() => {
    if (!isTutorialOpen) return;
    const step = tutorialSteps[tutorialStepIndex];
    if (!step) return;
    const getTargetNode = () => {
      if (step.target === "chat") return chatRef.current;
      if (step.target === "analysis") return analysisButtonRef.current;
      if (step.target === "import") return importButtonRef.current;
      if (step.target === "diary") return diaryButtonRef.current;
      const refMap: Record<Exclude<TutorialStep["target"], "chat" | "analysis" | "import" | "diary">, React.RefObject<HTMLDivElement | null>> = {
        portfolio: portfolioRef,
        insights: insightsRef,
        signals: signalsRef,
        macro: macroRef,
        news: newsRef,
        purchasePlans: purchasePlansRef,
      };
      return refMap[step.target]?.current ?? null;
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        getTargetNode()?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }, [isTutorialOpen, tutorialStepIndex, tutorialSteps, portfolioRef, insightsRef, signalsRef, macroRef, newsRef, purchasePlansRef]);

  const handleCreatePortfolio = async (name: string): Promise<PortfolioRow | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from("portfolios").insert({ user_id: user.id, name: name.trim() }).select("id, name").single<PortfolioRow>();
    if (error) { setErrorMessage(error.message); return null; }
    setPortfolios((prev) => [...prev, data]); return data;
  };

  const handleRenamePortfolio = async () => {
    if (!editingPortfolio || !editingPortfolioName.trim()) return;
    setPortfolioActionLoading(true);
    const { error } = await supabase.from("portfolios").update({ name: editingPortfolioName.trim() }).eq("id", editingPortfolio.id);
    if (error) setErrorMessage(error.message);
    else { setPortfolios((prev) => prev.map((p) => p.id === editingPortfolio.id ? { ...p, name: editingPortfolioName.trim() } : p)); setEditingPortfolio(null); setEditingPortfolioName(""); }
    setPortfolioActionLoading(false);
  };

  const handleDeletePortfolio = async (portfolioId: string) => {
    if (portfolios.length <= 1) { setErrorMessage("Devi avere almeno un portafoglio."); return; }
    if (!confirm("Eliminare questo portafoglio e tutti i suoi asset?")) return;
    setPortfolioActionLoading(true);
    const { error } = await supabase.from("portfolios").delete().eq("id", portfolioId);
    if (error) setErrorMessage(error.message);
    else { setPortfolios((prev) => prev.filter((p) => p.id !== portfolioId)); setAssets((prev) => prev.filter((a) => a.portfolio_id !== portfolioId)); if (activePortfolioFilter === portfolioId) setActivePortfolioFilter("all"); }
    setPortfolioActionLoading(false); setIsPortfolioMenuOpen(false);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { const { error } = await supabase.auth.signOut(); if (error) { setErrorMessage(error.message); return; } router.push("/login"); router.refresh(); }
    catch (e) { setErrorMessage(e instanceof Error ? e.message : "Errore logout."); }
    finally { setIsLoggingOut(false); }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("Eliminare questo asset?")) return;
    setDeletingAssetId(assetId);
    try { const { error } = await supabase.from("assets").delete().eq("id", assetId); if (error) throw error; setAssets((c) => c.filter((a) => a.id !== assetId)); }
    catch (e) { setErrorMessage(e instanceof Error ? e.message : "Errore eliminazione."); }
    finally { setDeletingAssetId(null); }
  };

  const resetAssetForm = () => {
    setAssetSearchQuery(""); setAssetSearchResults([]); setShowSymbolDropdown(false);
    setSymbolSearchMessage(null); setSelectedAsset(null); setInvestedAmount("");
    setPurchaseDate(""); setHistoricalPriceError(null); setShowNewPortfolioInput(false); setModalNewPortfolioName("");
  };

  const resetImportForm = () => {
    setImportPlatform("");
    setImportFiles([]);
    setImportDestinationType("existing");
    setImportPortfolioId(portfolios[0]?.id ?? "");
    setImportNewPortfolioName("");
  };

  const closeImportPreview = () => {
    setIsImportPreviewOpen(false);
    setImportPreviewRows([]);
    setSelectedPreviewRowIds([]);
    setImportPreviewPortfolioId("");
    setImportPreviewSourcePlatform("unknown");
  };

  const openImportModal = () => {
    resetImportForm();
    setImportPortfolioId(portfolios[0]?.id ?? "");
    setIsImportModalOpen(true);
  };

  const normalizeIdentifier = useCallback((value: string | null | undefined) =>
    (value ?? "").trim().toUpperCase().replace(/\s+/g, " "), []);

  const parseNumberValue = (raw: string | undefined): number | null => {
    if (!raw) return null;
    const normalized = raw.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parseDateValue = (raw: string | undefined): string | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parts = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
    if (!parts) return null;
    const day = parts[1].padStart(2, "0");
    const month = parts[2].padStart(2, "0");
    const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
    return `${year}-${month}-${day}`;
  };

  const parseCsvRows = async (file: File): Promise<ImportCandidateRow[]> => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const separator = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(separator).map((header) => header.trim().toLowerCase());
    const getIndex = (aliases: string[]) =>
      headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
    const nameIndex = getIndex(["nome", "name", "titolo", "strumento", "asset"]);
    const tickerIndex = getIndex(["ticker", "symbol", "simbolo", "isin"]);
    const quantityIndex = getIndex(["quant", "qty", "shares", "pezzi"]);
    const purchasePriceIndex = getIndex(["prezzo medio", "avg", "prezzo", "carico", "cost"]);
    const purchaseDateIndex = getIndex(["data", "date"]);

    return lines.slice(1).map((line) => {
      const cols = line.split(separator).map((col) => col.trim());
      const name = nameIndex >= 0 ? cols[nameIndex] ?? "" : "";
      const ticker = tickerIndex >= 0 ? cols[tickerIndex] ?? "" : "";
      const quantity = quantityIndex >= 0 ? parseNumberValue(cols[quantityIndex]) : null;
      const purchasePrice = purchasePriceIndex >= 0 ? parseNumberValue(cols[purchasePriceIndex]) : null;
      const purchaseDate = purchaseDateIndex >= 0 ? parseDateValue(cols[purchaseDateIndex]) : null;
      const needsReview = !name || !quantity || !purchasePrice;
      return {
        sourceFile: file.name,
        name: name || "Titolo da confermare",
        ticker: ticker ? normalizeIdentifier(ticker) : null,
        quantity,
        purchase_price: purchasePrice,
        purchase_date: purchaseDate,
        needs_review: needsReview,
        reason: needsReview ? "Dati incompleti nel CSV: servono nome, quantita e prezzo medio." : undefined,
      };
    });
  };

  const previewDuplicateMap = useMemo(() => {
    if (!isImportPreviewOpen || !importPreviewPortfolioId) return new Map<string, PreviewDuplicateInfo>();
    const map = new Map<string, PreviewDuplicateInfo>();
    const sourcePlatformNorm = normalizeIdentifier(importPreviewSourcePlatform || "unknown");
    const existingAssets = assets.filter((asset) => asset.portfolio_id === importPreviewPortfolioId).map((asset) => ({
      id: asset.id,
      tickerNorm: normalizeDedupeText(asset.ticker),
      nameNorm: normalizeDedupeText(asset.name),
      platformNorm: normalizeIdentifier(asset.source_platform ?? "unknown"),
    }));

    const seenStrictKeys = new Set<string>();
    const processedPreviewRows: Array<{ id: string; tickerNorm: string; nameNorm: string }> = [];

    for (const row of importPreviewRows) {
      const rowTickerNorm = normalizeDedupeText(row.ticker);
      const rowNameNorm = normalizeDedupeText(row.name);
      const rowBase = rowTickerNorm || rowNameNorm;
      const strictKey = `${rowBase}::${sourcePlatformNorm}`;
      let duplicateInfo: PreviewDuplicateInfo | null = null;

      if (rowBase) {
        for (const existing of existingAssets) {
          const existingBase = existing.tickerNorm || existing.nameNorm;
          if (!existingBase || existingBase !== rowBase) continue;
          const platformCompatible =
            existing.platformNorm === sourcePlatformNorm
            || existing.platformNorm === "UNKNOWN"
            || sourcePlatformNorm === "UNKNOWN";
          if (platformCompatible) {
            duplicateInfo = {
              kind: "strict-existing",
              message: "Gia presente nel portafoglio.",
            };
            break;
          }
        }
      }

      if (!duplicateInfo && seenStrictKeys.has(strictKey) && rowBase) {
        duplicateInfo = {
          kind: "strict-intra",
          message: "Duplicato nella selezione corrente.",
        };
      }
      if (rowBase) seenStrictKeys.add(strictKey);

      if (!duplicateInfo) {
        const canUseFuzzy = rowNameNorm.length > 0;
        if (canUseFuzzy) {
          for (const existing of existingAssets) {
            if (!existing.nameNorm) continue;
            if (rowTickerNorm && existing.tickerNorm && rowTickerNorm !== existing.tickerNorm) continue;
            const score = tokenOverlapScore(rowNameNorm, existing.nameNorm);
            if (score >= IMPORT_DUPLICATE_FUZZY_THRESHOLD) {
              duplicateInfo = {
                kind: "fuzzy-existing",
                message: "Verifica: titolo molto simile a uno gia presente.",
              };
              break;
            }
          }
          if (!duplicateInfo) {
            for (const processed of processedPreviewRows) {
              if (!processed.nameNorm) continue;
              if (rowTickerNorm && processed.tickerNorm && rowTickerNorm !== processed.tickerNorm) continue;
              const score = tokenOverlapScore(rowNameNorm, processed.nameNorm);
              if (score >= IMPORT_DUPLICATE_FUZZY_THRESHOLD) {
                duplicateInfo = {
                  kind: "fuzzy-intra",
                  message: "Verifica: titolo molto simile a un'altra riga selezionata.",
                };
                break;
              }
            }
          }
        }
      }

      if (duplicateInfo) map.set(row.id, duplicateInfo);
      processedPreviewRows.push({ id: row.id, tickerNorm: rowTickerNorm, nameNorm: rowNameNorm });
    }
    return map;
  }, [assets, importPreviewPortfolioId, importPreviewRows, importPreviewSourcePlatform, isImportPreviewOpen, normalizeIdentifier]);

  const askMateForReviewRows = (rows: ImportCandidateRow[]) => {
    if (rows.length === 0) return;
    const sample = rows.slice(0, 3).map((row) => row.name).join(", ");
    setChatInput(`Mate, ho importato alcuni titoli ma mancano dati da confermare (${sample}). Mi aiuti a verificare ticker, quantita e prezzo medio senza inventare nulla?`);
    setIsChatMinimized(false);
    setIsChatExpanded(true);
    setTimeout(() => chatInputRef.current?.focus(), 120);
  };

  const handleImportAssets = async () => {
    setErrorMessage(null);
    setImportReport(null);
    if (importFiles.length === 0) {
      setErrorMessage("Carica almeno un file CSV o screenshot.");
      return;
    }
    const sourcePlatform = importPlatform.trim() || "unknown";
    setIsImportingAssets(true);
    try {
      let targetPortfolioId = importPortfolioId;
      if (importDestinationType === "new") {
        if (!importNewPortfolioName.trim()) {
          setErrorMessage("Inserisci il nome del nuovo portafoglio.");
          return;
        }
        const created = await handleCreatePortfolio(importNewPortfolioName.trim());
        if (!created) return;
        targetPortfolioId = created.id;
      }
      if (!targetPortfolioId) {
        setErrorMessage("Seleziona un portafoglio di destinazione.");
        return;
      }

      const csvFiles = importFiles.filter((file) => file.name.toLowerCase().endsWith(".csv"));
      const screenshotFiles = importFiles.filter((file) => !file.name.toLowerCase().endsWith(".csv"));

      const csvRows = (await Promise.all(csvFiles.map((file) => parseCsvRows(file)))).flat();
      let screenshotRows: ImportCandidateRow[] = [];
      if (screenshotFiles.length > 0) {
        const formData = new FormData();
        screenshotFiles.forEach((file) => formData.append("files", file));
        const screenshotRes = await fetch("/api/import-screenshot", { method: "POST", body: formData });
        const screenshotPayload = (await screenshotRes.json()) as { rows?: ImportCandidateRow[]; error?: string };
        if (!screenshotRes.ok) {
          throw new Error(screenshotPayload.error ?? "Non sono riuscito ad analizzare gli screenshot. Riprova con immagini piu nitide o inquadra meno righe per schermata.");
        }
        screenshotRows = screenshotPayload.rows ?? [];
      }

      const allRows = [...csvRows, ...screenshotRows];
      if (allRows.length === 0) {
        setErrorMessage("Non ho trovato righe importabili nei file caricati.");
        return;
      }
      const previewRows: ImportPreviewRow[] = allRows.map((row, index) => ({
        ...row,
        id: `${row.sourceFile}-${index}-${crypto.randomUUID()}`,
      }));
      setImportPreviewRows(previewRows);
      setSelectedPreviewRowIds(previewRows.map((row) => row.id));
      setImportPreviewPortfolioId(targetPortfolioId);
      setImportPreviewSourcePlatform(sourcePlatform);
      setIsImportModalOpen(false);
      setIsImportPreviewOpen(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Import non completato: il database non è ancora allineato. Applica le migration e riprova.",
      );
    } finally {
      setIsImportingAssets(false);
    }
  };

  const togglePreviewRowSelection = (rowId: string) => {
    setSelectedPreviewRowIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]);
  };

  const removePreviewRow = (rowId: string) => {
    setImportPreviewRows((prev) => prev.filter((row) => row.id !== rowId));
    setSelectedPreviewRowIds((prev) => prev.filter((id) => id !== rowId));
  };

  const updatePreviewRow = (rowId: string, patch: Partial<ImportPreviewRow>) => {
    setImportPreviewRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const handleConfirmImportPreview = async () => {
    setErrorMessage(null);
    if (!importPreviewPortfolioId) {
      setErrorMessage("Seleziona un portafoglio di destinazione.");
      return;
    }
    const selectedRows = importPreviewRows.filter((row) => selectedPreviewRowIds.includes(row.id));
    if (selectedRows.length === 0) {
      setErrorMessage("Seleziona almeno una riga da importare.");
      return;
    }

    setIsConfirmingImport(true);
    try {
      const reviewRows: ImportCandidateRow[] = [];
      const rowsToInsert: Array<{
        portfolio_id: string;
        ticker: string;
        name: string;
        asset_type: string;
        quantity: number;
        purchase_price: number;
        purchase_date: string;
        source_platform: string;
        external_symbol: string | null;
        import_batch_id: string;
      }> = [];
      const legacyRowsToInsert: Array<{
        portfolio_id: string;
        ticker: string;
        name: string;
        asset_type: string;
        quantity: number;
        purchase_price: number;
        purchase_date: string;
      }> = [];
      let duplicates = 0;
      let possibleDuplicatesImported = 0;
      const importBatchId = crypto.randomUUID();

      for (const row of selectedRows) {
        const duplicateInfo = previewDuplicateMap.get(row.id);
        if (duplicateInfo && duplicateInfo.kind.startsWith("strict")) {
          duplicates += 1;
          continue;
        }
        const parsedQuantity = typeof row.quantity === "number" ? row.quantity : null;
        const parsedPurchasePrice = typeof row.purchase_price === "number" ? row.purchase_price : null;
        const isValid = Boolean(row.name?.trim()) && parsedQuantity != null && parsedQuantity > 0 && parsedPurchasePrice != null && parsedPurchasePrice > 0;
        const confidence = typeof row.confidence === "number" ? row.confidence : 0;
        const lowConfidence = confidence > 0 && confidence < IMPORT_AUTO_CONFIDENCE_THRESHOLD;
        if (row.needs_review || !isValid || lowConfidence) {
          reviewRows.push({
            ...row,
            reason: row.reason ?? "Riga da rivedere prima della conferma.",
          });
          continue;
        }

        const normalizedTicker = row.ticker ? normalizeIdentifier(row.ticker) : buildFallbackTicker(row.name);
        const normalizedName = row.name.trim();
        const normalizedQuantity = Number(parsedQuantity.toFixed(6));
        const normalizedPurchasePrice = Number(parsedPurchasePrice.toFixed(6));
        const normalizedPurchaseDate = row.purchase_date ?? new Date().toISOString().slice(0, 10);

        rowsToInsert.push({
          portfolio_id: importPreviewPortfolioId,
          ticker: normalizedTicker,
          name: normalizedName,
          asset_type: "imported",
          quantity: normalizedQuantity,
          purchase_price: normalizedPurchasePrice,
          purchase_date: normalizedPurchaseDate,
          source_platform: importPreviewSourcePlatform,
          external_symbol: row.ticker,
          import_batch_id: importBatchId,
        });
        if (duplicateInfo?.kind.startsWith("fuzzy")) {
          possibleDuplicatesImported += 1;
        }
        legacyRowsToInsert.push({
          portfolio_id: importPreviewPortfolioId,
          ticker: normalizedTicker,
          name: normalizedName,
          asset_type: "imported",
          quantity: normalizedQuantity,
          purchase_price: normalizedPurchasePrice,
          purchase_date: normalizedPurchaseDate,
        });
      }

      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from("assets").insert(rowsToInsert);
        if (error) {
          const message = error.message.toLowerCase();
          const details = (error.details ?? "").toLowerCase();
          const isSchemaCompatibilityError =
            message.includes("pgrst204")
            || message.includes("column")
            || message.includes("source_platform")
            || message.includes("external_symbol")
            || message.includes("import_batch_id")
            || details.includes("column")
            || details.includes("source_platform")
            || details.includes("external_symbol")
            || details.includes("import_batch_id");

          if (!isSchemaCompatibilityError) throw error;
          console.info("[import] fallback insert legacy attivato");
          const { error: legacyError } = await supabase.from("assets").insert(legacyRowsToInsert);
          if (legacyError) throw new Error("Import non completato: il database non è ancora allineato. Applica le migration e riprova.");
        } else {
          console.info("[import] insert schema nuovo ok");
        }
      }

      const updatedAssets = await loadAssets(portfolios.map((p) => p.id));
      await loadPrices(updatedAssets);
      await loadNews({ forceRefresh: true });

      const excluded = importPreviewRows.length - selectedRows.length;
      setImportReport({
        imported: rowsToInsert.length,
        duplicates,
        possibleDuplicatesImported,
        needsReview: reviewRows.length,
        reviewRows,
        excluded,
      });
      closeImportPreview();
      resetImportForm();
      if (reviewRows.length > 0) askMateForReviewRows(reviewRows);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Import non completato: il database non è ancora allineato. Applica le migration e riprova.",
      );
    } finally {
      setIsConfirmingImport(false);
    }
  };

  const handleTogglePurchasePlanStatus = async (plan: PurchasePlanRow) => {
    setPurchasePlanErrorMessage(null);
    setPurchasePlanActionId(plan.id);
    try {
      const nextStatus: PurchasePlanStatus = plan.status === "active" ? "paused" : "active";
      const response = await fetch(`/api/purchase-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json()) as { data?: PurchasePlanRow; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Non sono riuscito ad aggiornare lo stato del piano.");
      }
      setPurchasePlans((prev) => prev.map((item) => (item.id === plan.id ? payload.data! : item)));
    } catch (error) {
      setPurchasePlanErrorMessage(error instanceof Error ? error.message : "Errore inatteso nell'aggiornamento del piano.");
    } finally {
      setPurchasePlanActionId(null);
    }
  };

  const handleArchivePurchasePlan = async (planId: string) => {
    setPurchasePlanErrorMessage(null);
    setPurchasePlanActionId(planId);
    try {
      const response = await fetch(`/api/purchase-plans/${planId}`, { method: "DELETE" });
      const payload = (await response.json()) as { data?: PurchasePlanRow; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Non sono riuscito ad archiviare il piano.");
      }
      setPurchasePlans((prev) => prev.map((item) => (item.id === planId ? payload.data! : item)));
    } catch (error) {
      setPurchasePlanErrorMessage(error instanceof Error ? error.message : "Errore inatteso nell'archiviazione del piano.");
    } finally {
      setPurchasePlanActionId(null);
    }
  };

  useEffect(() => {
    if (!isAddAssetModalOpen) return;
    const handler = (e: MouseEvent) => { if (!symbolSearchContainerRef.current?.contains(e.target as Node)) setShowSymbolDropdown(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isAddAssetModalOpen]);

  useEffect(() => {
    if (!isAddAssetModalOpen) return;
    const query = assetSearchQuery.trim();
    if (query.length < 3) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        setIsSearchingSymbol(true); setSymbolSearchMessage(null); setShowSymbolDropdown(true);
        try {
          const res = await fetch(`/api/symbol-search?query=${encodeURIComponent(query)}`);
          const payload = (await res.json()) as { data?: SymbolSearchResult[]; error?: string };
          if (!res.ok) throw new Error(payload.error);
          const results = payload.data ?? []; setAssetSearchResults(results);
          setSymbolSearchMessage(results.length === 0 ? "Nessun risultato trovato" : null);
        } catch (e) { setAssetSearchResults([]); setSymbolSearchMessage(e instanceof Error ? e.message : "Errore ricerca."); }
        finally { setIsSearchingSymbol(false); }
      })();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [assetSearchQuery, isAddAssetModalOpen]);

  const handleAddAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setErrorMessage(null); setHistoricalPriceError(null);
    if (!selectedAsset) { setErrorMessage("Seleziona un asset."); return; }
    const parsedAmount = Number(investedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { setErrorMessage("Importo non valido."); return; }
    if (!purchaseDate) { setErrorMessage("Seleziona la data."); return; }
    setIsFetchingHistoricalPrice(true); setIsSavingAsset(true);
    try {
      const priceRes = await fetch("/api/historical-price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticker: selectedAsset.ticker, date: purchaseDate }) });
      const pricePayload = (await priceRes.json()) as { price?: number; date?: string; ticker?: string; approximate?: boolean; error?: string };
      if (!priceRes.ok || !pricePayload.price) { setHistoricalPriceError(pricePayload.error ?? "Prezzo storico non disponibile."); return; }
      setIsFetchingHistoricalPrice(false);
      if (pricePayload.approximate) setHistoricalPriceError(`Prezzo approssimato al ${pricePayload.date ?? ""}. Puoi procedere.`);
      const quantity = parsedAmount / pricePayload.price;
      let targetPortfolioId = selectedPortfolioId;
      if (showNewPortfolioInput) {
        if (!modalNewPortfolioName.trim()) { setErrorMessage("Inserisci il nome del portafoglio."); return; }
        const newP = await handleCreatePortfolio(modalNewPortfolioName);
        if (!newP) return; targetPortfolioId = newP.id;
      }
      if (!targetPortfolioId) { setErrorMessage("Seleziona un portafoglio."); return; }
      const { error } = await supabase.from("assets").insert({ portfolio_id: targetPortfolioId, ticker: pricePayload.ticker ?? selectedAsset.ticker, name: selectedAsset.name, asset_type: selectedAsset.asset_type, quantity: Math.round(quantity * 10000) / 10000, purchase_price: Math.round(pricePayload.price * 100) / 100, purchase_date: purchaseDate });
      if (error) throw error;
      const updatedAssets = await loadAssets(portfolios.map((p) => p.id));
      await loadPrices(updatedAssets); await loadNews({ forceRefresh: true });
      resetAssetForm(); setIsAddAssetModalOpen(false);
    } catch (e) { setErrorMessage(e instanceof Error ? e.message : "Errore salvataggio."); }
    finally { setIsSavingAsset(false); setIsFetchingHistoricalPrice(false); }
  };

  const sendUserMessage = useCallback(async (rawInput: string, options?: { historyOverride?: ChatMessage[]; sessionIdOverride?: string | null }) => {
    const trimmedInput = rawInput.trim();
    if (!trimmedInput || isSendingChat) return;
    setChatErrorMessage(null);
    setIsSendingChat(true);
    const sourceHistory = options?.historyOverride ?? chatMessagesRef.current;
    const historyForApi = sourceHistory.filter((m) => m.content !== INITIAL_CHAT_MESSAGE || m.role !== "assistant");
    const sessionIdForApi = options?.sessionIdOverride !== undefined ? options.sessionIdOverride : currentSessionIdRef.current;
    setChatMessages((prev) => [...prev, { role: "user", content: trimmedInput }]);
    setChatInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedInput, history: historyForApi, sessionId: sessionIdForApi }),
      });
      const payload = (await res.json()) as { reply?: string; sessionId?: string; error?: string };
      if (!res.ok || !payload.reply) throw new Error(payload.error);
      setChatMessages((prev) => [...prev, { role: "assistant", content: payload.reply! }]);
      if (payload.sessionId && !currentSessionIdRef.current) {
        setCurrentSessionId(payload.sessionId);
        currentSessionIdRef.current = payload.sessionId;
        void loadChatSessions();
      }
      void loadPurchasePlans();
    } catch (e) {
      setChatErrorMessage(e instanceof Error ? e.message : "Errore chat.");
    } finally {
      setIsSendingChat(false);
    }
  }, [isSendingChat, loadChatSessions, loadPurchasePlans]);

  const startPlanMode = useCallback(async () => {
    if (isSendingChat) return;
    setChatErrorMessage(null);
    setIsSendingChat(true);
    const cleanHistory: ChatMessage[] = [];
    setChatMessages(cleanHistory);
    chatMessagesRef.current = cleanHistory;
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "plan_start", history: cleanHistory, sessionId: null }),
      });
      const payload = (await res.json()) as { reply?: string; sessionId?: string; error?: string };
      if (!res.ok || !payload.reply) throw new Error(payload.error);
      const firstAssistantMessage: ChatMessage = { role: "assistant", content: payload.reply };
      setChatMessages([firstAssistantMessage]);
      chatMessagesRef.current = [firstAssistantMessage];
      if (payload.sessionId) {
        setCurrentSessionId(payload.sessionId);
        currentSessionIdRef.current = payload.sessionId;
        void loadChatSessions();
      }
      void loadPurchasePlans();
    } catch (e) {
      setChatMessages([{ role: "assistant", content: INITIAL_CHAT_MESSAGE }]);
      chatMessagesRef.current = [{ role: "assistant", content: INITIAL_CHAT_MESSAGE }];
      setChatErrorMessage(e instanceof Error ? e.message : "Errore chat.");
    } finally {
      setIsSendingChat(false);
    }
  }, [isSendingChat, loadChatSessions, loadPurchasePlans]);

  const handleSendChatMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendUserMessage(chatInput);
  };

  const handleLoadSession = async (sessionId: string) => {
    setIsLoadingSession(true); setIsHistoryOpen(false);
    try {
      const { data, error } = await supabase.from("chat_messages").select("role, content").eq("session_id", sessionId).order("created_at", { ascending: true });
      if (error) throw error;
      const messages = (data ?? []) as ChatMessage[];
      setChatMessages(messages.length > 0 ? messages : [{ role: "assistant", content: INITIAL_CHAT_MESSAGE }]);
      chatMessagesRef.current = messages.length > 0 ? messages : [{ role: "assistant", content: INITIAL_CHAT_MESSAGE }];
      setCurrentSessionId(sessionId);
      currentSessionIdRef.current = sessionId;
      setChatErrorMessage(null);
    } catch (e) { setChatErrorMessage(e instanceof Error ? e.message : "Errore caricamento."); }
    finally { setIsLoadingSession(false); }
  };

  const handleNewChat = () => {
    setChatMessages([{ role: "assistant", content: INITIAL_CHAT_MESSAGE }]);
    chatMessagesRef.current = [{ role: "assistant", content: INITIAL_CHAT_MESSAGE }];
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    setChatErrorMessage(null);
    setIsHistoryOpen(false);
  };

  const openPurchasePlanChat = () => {
    setIsChatMinimized(false);
    setIsChatExpanded(true);
    setIsHistoryOpen(false);
    void startPlanMode();
    window.requestAnimationFrame(() => {
      chatInputRef.current?.focus();
    });
  };

  const handleMinimizeChat = () => {
    setIsChatExpanded(false);
    setIsHistoryOpen(false);
    setIsChatMinimized(true);
  };

  const handleRestoreChat = () => {
    setIsChatMinimized(false);
  };

  const openDiaryFromChat = () => {
    const latestUserMessage = [...chatMessages].reverse().find((message) => message.role === "user")?.content?.trim() ?? "";
    const latestAssistantMessage = [...chatMessages].reverse().find((message) => message.role === "assistant")?.content?.trim() ?? "";
    const draftSeed = chatInput.trim() || latestUserMessage;
    const sanitizedAssistant = latestAssistantMessage
      .replace(/[#>*`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 280);
    if (!draftSeed && !sanitizedAssistant) {
      setChatErrorMessage("Scrivi prima un pensiero da salvare nel diario.");
      return;
    }
    const draft = [
      "Riassunto rapido dal confronto con Mate:",
      draftSeed ? `- Tema emerso: ${draftSeed.slice(0, 220)}` : "- Tema emerso:",
      sanitizedAssistant ? `- Spunto utile di Mate: ${sanitizedAssistant}` : "- Spunto utile di Mate:",
      "- Come mi sento adesso:",
      "- Cosa voglio monitorare nei prossimi giorni:",
      "- Micro-passo concreto (non impulsivo):",
    ].join("\n");
    const params = new URLSearchParams({
      source: "chat",
      contextType: "chat_reflection",
      draft: draft.slice(0, 1200),
    });
    router.push(`/checkin?${params.toString()}`);
  };

  // ── PORTFOLIO GROUP CARD ──────────────────────────────────────
  const PortfolioGroupCard = ({ portfolio }: { portfolio: PortfolioRow }) => {
    const isCollapsed = collapsedPortfolios[portfolio.id] ?? false;
    const groupAssets = getAssetsForPortfolio(portfolio.id);
    const totals = computeTotals(groupAssets);
    const glp = totals.totalCost > 0 ? (totals.totalGainLoss / totals.totalCost) * 100 : 0;
    const pos = totals.totalGainLoss >= 0;
    return (
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/60">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button type="button" onClick={() => togglePortfolioCollapsed(portfolio.id)}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700">
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <span className="font-semibold text-zinc-800 dark:text-zinc-100 truncate">{portfolio.name}</span>
            <span className="text-xs text-zinc-400 flex-shrink-0">{groupAssets.length} asset</span>
            {isCollapsed && totals.totalValue > 0 && (
              <div className="ml-2 flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{formatCurrency(totals.totalValue)}</span>
                <span className={`text-sm font-bold ${pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>{pos ? "+" : ""}{glp.toFixed(1)}%</span>
              </div>
            )}
          </div>
          <button type="button" onClick={() => openAddAssetModal(portfolio.id)} title={`Aggiungi a ${portfolio.name}`}
            className="ml-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-blue-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          </button>
        </div>
        {!isCollapsed && (
          <>
            {groupAssets.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-400">Nessun asset. Clicca + per aggiungere.</div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800">
                    <thead><tr className="text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
                      <th className="px-4 py-2.5">Ticker</th><th className="px-4 py-2.5">Nome</th><th className="px-4 py-2.5">Tipo</th>
                      <th className="px-4 py-2.5">Quantità</th><th className="px-4 py-2.5">Investito</th>
                      <th className="px-4 py-2.5">Valore</th><th className="px-4 py-2.5">Gain/Loss</th><th className="px-4 py-2.5" />
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                      {groupAssets.map((asset) => {
                        const { currentValue, gainLoss, gainLossPercent } = getAssetMetrics(asset);
                        const p = (gainLoss ?? 0) >= 0;
                        return (
                          <tr key={asset.id} className="text-sm hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                            <td className="px-4 py-3 font-semibold">{asset.ticker}</td>
                            <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{asset.name}</td>
                            <td className="px-4 py-3"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{asset.asset_type}</span></td>
                            <td className="px-4 py-3 text-zinc-600">{asset.quantity.toFixed(4)}</td>
                            <td className="px-4 py-3 text-zinc-600">{formatCurrency(asset.purchase_price * asset.quantity)}</td>
                            <td className="px-4 py-3">{isPricesLoading ? <span className="text-zinc-300">...</span> : currentValue != null ? formatCurrency(currentValue) : <span className="text-zinc-300">—</span>}</td>
                            <td className={`px-4 py-3 font-medium ${gainLoss != null ? (p ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400") : "text-zinc-300"}`}>
                              {isPricesLoading ? "..." : gainLoss != null ? `${p ? "+" : ""}${formatCurrency(gainLoss)} (${p ? "+" : ""}${gainLossPercent!.toFixed(2)}%)` : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/checkin?source=portfolio&contextType=purchase_reflection&ticker=${encodeURIComponent(asset.ticker)}&assetId=${encodeURIComponent(asset.id)}&portfolioId=${encodeURIComponent(asset.portfolio_id)}`}
                                  className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                                >
                                  Nota diario
                                </Link>
                                <button type="button" onClick={() => void handleDeleteAsset(asset.id)} disabled={deletingAssetId === asset.id}
                                  className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40">
                                  {deletingAssetId === asset.id ? "..." : "Elimina"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-zinc-100 lg:hidden dark:divide-zinc-800">
                  {groupAssets.map((asset) => {
                    const { currentValue, gainLoss, gainLossPercent } = getAssetMetrics(asset);
                    const p = (gainLoss ?? 0) >= 0;
                    return (
                      <div key={asset.id} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{asset.ticker}</span>
                            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-400 dark:bg-zinc-800">{asset.asset_type}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-zinc-400">{asset.name}</p>
                        </div>
                        <div className="ml-4 text-right">
                          <p className="text-sm font-medium">{isPricesLoading ? "..." : currentValue != null ? formatCurrency(currentValue) : "—"}</p>
                          <p className={`text-xs font-semibold ${gainLoss != null ? (p ? "text-emerald-600" : "text-red-500") : "text-zinc-300"}`}>
                            {isPricesLoading ? "..." : gainLoss != null ? `${p ? "+" : ""}${gainLossPercent!.toFixed(1)}%` : "—"}
                          </p>
                        </div>
                        <div className="ml-3 flex items-center gap-1">
                          <Link
                            href={`/checkin?source=portfolio&contextType=purchase_reflection&ticker=${encodeURIComponent(asset.ticker)}&assetId=${encodeURIComponent(asset.id)}&portfolioId=${encodeURIComponent(asset.portfolio_id)}`}
                            className="rounded px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                          >
                            Diario
                          </Link>
                          <button type="button" onClick={() => void handleDeleteAsset(asset.id)} disabled={deletingAssetId === asset.id}
                            className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-50 disabled:opacity-40">
                            {deletingAssetId === asset.id ? "..." : "✕"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/30">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Totale {portfolio.name}</span>
                  <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
                    <span className="text-zinc-500">Investito {formatCurrency(totals.totalCost)}</span>
                    {totals.totalValue > 0 && <>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-200">{formatCurrency(totals.totalValue)}</span>
                      <span className={`font-bold ${pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>{pos ? "+" : ""}{glp.toFixed(2)}%</span>
                    </>}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  };

  // ── SECTIONS ──────────────────────────────────────────────────
  const PortfolioSection = (
    <div ref={portfolioRef} className={`scroll-mt-20 ${getTutorialTargetClass("portfolio")}`}>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Il mio portafoglio</h1>
        <div className="flex items-center gap-2">
          {portfolios.length > 1 && (
            <button type="button" onClick={toggleAllCollapsed} title={allCollapsed ? "Espandi tutti" : "Minimizza tutti"}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 transition hover:border-zinc-300 hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {allCollapsed
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5M3.75 3.75L9 9M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                }
              </svg>
            </button>
          )}
          <button type="button" onClick={() => openAddAssetModal(activePortfolioFilter !== "all" ? activePortfolioFilter : undefined)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Aggiungi
          </button>
          <button
            type="button"
            ref={importButtonRef}
            onClick={openImportModal}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 ${getTutorialTargetClass("import")}`}
          >
            Importa con Mate
          </button>
          <button
            ref={analysisButtonRef}
            type="button"
            onClick={() => router.push("/dashboard/analisi")}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 ${getTutorialTargetClass("analysis")}`}
          >
            Apri analisi
          </button>
        </div>
      </div>

      {/* Filtro pill */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <button type="button" onClick={() => setActivePortfolioFilter("all")}
            className={`rounded-full px-3 py-1 text-sm font-medium transition ${activePortfolioFilter === "all" ? "bg-blue-600 text-white shadow-sm" : "border border-zinc-200 bg-white text-zinc-600 hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}>
            Tutti
          </button>
          {portfolios.map((p) => (
            <button key={p.id} type="button" onClick={() => setActivePortfolioFilter(p.id)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${activePortfolioFilter === p.id ? "bg-blue-600 text-white shadow-sm" : "border border-zinc-200 bg-white text-zinc-600 hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}>
              {p.name}
            </button>
          ))}
        </div>
        <div className="relative" ref={portfolioMenuRef}>
          <button type="button" onClick={() => setIsPortfolioMenuOpen((v) => !v)} title="Gestisci portafogli"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 transition hover:border-zinc-300 hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
          {isPortfolioMenuOpen && (
            <div className="absolute right-0 top-10 z-30 w-64 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">I tuoi portafogli</p>
              <div className="space-y-1">
                {portfolios.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    {editingPortfolio?.id === p.id ? (
                      <>
                        <input value={editingPortfolioName} onChange={(e) => setEditingPortfolioName(e.target.value)} className="flex-1 rounded border border-zinc-300 px-2 py-0.5 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                        <button type="button" onClick={() => void handleRenamePortfolio()} disabled={portfolioActionLoading} className="text-xs text-blue-600">✓</button>
                        <button type="button" onClick={() => { setEditingPortfolio(null); setEditingPortfolioName(""); }} className="text-xs text-zinc-400">✕</button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate text-sm text-zinc-700 dark:text-zinc-200">{p.name}</span>
                        <button type="button" onClick={() => { setEditingPortfolio(p); setEditingPortfolioName(p.name); }} className="text-zinc-400 hover:text-zinc-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" /></svg>
                        </button>
                        {portfolios.length > 1 && (
                          <button type="button" onClick={() => void handleDeletePortfolio(p.id)} disabled={portfolioActionLoading} className="text-red-400 hover:text-red-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                {isCreatingPortfolio ? (
                  <div className="flex items-center gap-2">
                    <input value={newPortfolioName} onChange={(e) => setNewPortfolioName(e.target.value)} placeholder="Nome portafoglio" autoFocus className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                    <button type="button" onClick={async () => { setPortfolioActionLoading(true); await handleCreatePortfolio(newPortfolioName); setNewPortfolioName(""); setIsCreatingPortfolio(false); setPortfolioActionLoading(false); }} disabled={portfolioActionLoading} className="text-xs font-medium text-blue-600">✓</button>
                    <button type="button" onClick={() => { setIsCreatingPortfolio(false); setNewPortfolioName(""); }} className="text-xs text-zinc-400">✕</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setIsCreatingPortfolio(true)} className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    Nuovo portafoglio
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {errorMessage && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}
      {importReport && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">Report importazione guidata dal Mate</h3>
            <button
              type="button"
              onClick={() => setImportReport(null)}
              className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-900/40 dark:bg-zinc-900 dark:text-blue-300 dark:hover:bg-blue-900/20"
              aria-label="Chiudi report importazione"
            >
              Chiudi
            </button>
          </div>
          <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
            Importati: {importReport.imported} · Duplicati ignorati: {importReport.duplicates} · Possibili duplicati importati: {importReport.possibleDuplicatesImported} · Righe da rivedere: {importReport.needsReview} · Escluse: {importReport.excluded}
          </p>
          {importReport.imported === 0 && importReport.needsReview > 0 && (
            <p className="mt-2 rounded-lg border border-blue-200 bg-white/80 px-3 py-2 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-zinc-900/70 dark:text-blue-300">
              Import completato: servono conferme manuali, nessun asset aggiunto automaticamente.
            </p>
          )}
          {importReport.imported === 0 && importReport.duplicates > 0 && (
            <p className="mt-2 rounded-lg border border-blue-200 bg-white/80 px-3 py-2 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-zinc-900/70 dark:text-blue-300">
              Nessuna nuova riga importata: le selezionate risultano gia presenti.
            </p>
          )}
          {importReport.reviewRows.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-blue-700/80 dark:text-blue-300/80">Rivedi righe non chiare</p>
              <div className="space-y-1">
                {importReport.reviewRows.slice(0, 5).map((row, index) => (
                  <div key={`${row.sourceFile}-${row.name}-${index}`} className="rounded-lg bg-white/80 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200">
                    <span className="font-semibold">{row.name}</span> · {row.reason ?? "Dati incompleti"}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => askMateForReviewRows(importReport.reviewRows)}
                className="inline-flex items-center rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-700 dark:bg-zinc-900 dark:text-blue-300"
              >
                Rivedi col Mate
              </button>
            </div>
          )}
        </div>
      )}

      {isPageLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><div className="mb-3 h-4 w-1/4 rounded bg-zinc-200 dark:bg-zinc-700" /><div className="h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800" /></div>)}</div>
      ) : (
        <div className="space-y-4">
          {visiblePortfolios.map((portfolio) => <PortfolioGroupCard key={portfolio.id} portfolio={portfolio} />)}
          {visiblePortfolios.length > 1 && allVisibleAssets.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border-2 border-blue-100 bg-blue-50 px-5 py-4 dark:border-blue-900/30 dark:bg-blue-950/20">
              <span className="text-sm font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Totale complessivo</span>
              <div className="flex items-center gap-5 text-sm">
                <div className="text-right"><p className="text-xs text-zinc-500">Investito</p><p className="font-bold text-zinc-800 dark:text-zinc-100">{formatCurrency(grandTotals.totalCost)}</p></div>
                <div className="text-right"><p className="text-xs text-zinc-500">Valore</p><p className="font-bold text-zinc-800 dark:text-zinc-100">{isPricesLoading ? "..." : formatCurrency(grandTotals.totalValue)}</p></div>
                <div className="text-right"><p className="text-xs text-zinc-500">Gain/Loss</p>
                  <p className={`font-bold text-base ${grandTotals.totalGainLoss >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                    {isPricesLoading ? "..." : `${grandTotals.totalGainLoss >= 0 ? "+" : ""}${grandTotalGainLossPercent.toFixed(2)}%`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const PurchasePlansSection = (
    <div
      ref={purchasePlansRef}
      className={`scroll-mt-20 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${getTutorialTargetClass("purchasePlans")}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Piani di acquisto</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            I piani nascono in dialogo col Mate e qui puoi monitorarli in un colpo d&apos;occhio.
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            Il piano ti aiuta a mantenere metodo, non a prevedere il mercato.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openPurchasePlanChat}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Crea piano con Mate
          </button>
          <button
            type="button"
            onClick={() => void loadPurchasePlans()}
            disabled={isPurchasePlansLoading}
            className="inline-flex min-h-11 items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {isPurchasePlansLoading ? "Aggiornamento..." : "Aggiorna"}
          </button>
        </div>
      </div>

      {purchasePlanErrorMessage && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {purchasePlanErrorMessage}
        </p>
      )}

      {isPurchasePlansLoading ? (
        <div className="space-y-2">
          {[1, 2].map((item) => (
            <div key={item} className="animate-pulse rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
              <div className="mb-2 h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3 w-64 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
          ))}
        </div>
      ) : purchasePlans.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
          Nessun piano ancora. Crea il primo piano per avere un ritmo coerente e meno impulsivo.
        </p>
      ) : (
        <div className="space-y-3">
          {purchasePlans.map((plan) => {
            const isAttention = plan.monthly_budget_limit != null && Number(plan.amount) > Number(plan.monthly_budget_limit);
            const statusLabel = plan.status === "active" ? "Attivo" : plan.status === "paused" ? "In pausa" : "Archiviato";
            return (
              <article key={plan.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      {plan.title}
                      {plan.ticker && <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{plan.ticker}</span>}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {plan.cadence} · {formatCurrency(Number(plan.amount))} · prossima data {new Date(plan.next_run_date).toLocaleDateString("it-IT")}
                    </p>
                    {plan.risk_note && (
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-300">
                        Nota: {plan.risk_note}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${plan.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : plan.status === "paused" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"}`}>
                      {statusLabel}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isAttention ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"}`}>
                      {isAttention ? "Attenzione" : "In linea"}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {plan.status !== "archived" && (
                    <button
                      type="button"
                      onClick={() => void handleTogglePurchasePlanStatus(plan)}
                      disabled={purchasePlanActionId === plan.id}
                      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    >
                      {purchasePlanActionId === plan.id ? "Salvataggio..." : plan.status === "active" ? "Metti in pausa" : "Riattiva"}
                    </button>
                  )}
                  {plan.status !== "archived" && (
                    <button
                      type="button"
                      onClick={() => void handleArchivePurchasePlan(plan.id)}
                      disabled={purchasePlanActionId === plan.id}
                      className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/50 dark:bg-zinc-900 dark:text-red-300"
                    >
                      Archivia
                    </button>
                  )}
                  {plan.monthly_budget_limit != null && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      Limite mensile: {formatCurrency(Number(plan.monthly_budget_limit))}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Puoi mettere in pausa quando il contesto personale cambia.
      </p>
    </div>
  );

  const MacroSection = (
    <div ref={macroRef} className={`scroll-mt-20 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${getTutorialTargetClass("macro")}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Contesto di mercato</h2>
        <button type="button" onClick={() => void loadMacroContext({ forceRefresh: true })} disabled={isMacroLoading}
          className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {isMacroLoading ? "Aggiornamento..." : "Aggiorna"}
        </button>
      </div>
      {macroErrorMessage ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{macroErrorMessage}</p>
      ) : isMacroLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800"><div className="mb-2 h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700" /><div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-700" /></div>)}</div>
      ) : macroTopics && macroTopics.length > 0 ? (
        <div className="space-y-3">
          {macroTopics.map((item, i) => (
            <div key={i} className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{item.topic}</span>
                <SentimentBadge sentiment={item.sentiment} />
              </div>
              <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.analisi}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">{macroText || "Nessun contesto disponibile."}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {macroDate && <p className="text-xs text-zinc-400" suppressHydrationWarning>Aggiornato il {macroDate}</p>}
        <p className="text-xs italic text-zinc-400">Generato da AI · solo a scopo informativo</p>
      </div>
    </div>
  );

  const NewsSection = (
    <div ref={newsRef} className={`scroll-mt-20 ${getTutorialTargetClass("news")}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Notizie per te</h2>
        <button type="button" onClick={() => void loadNews({ forceRefresh: true })} disabled={isNewsLoading}
          className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {isNewsLoading ? "Aggiornamento..." : "Aggiorna"}
        </button>
      </div>
      {newsErrorMessage && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{newsErrorMessage}</p>}
      {isNewsLoading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">Caricamento notizie...</div>
      ) : news.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {!newsMeta.hasAssets
            ? "Aggiungi un asset per vedere notizie contestuali."
            : !newsMeta.hasValidTickers
              ? "Notizie non trovate con i ticker importati. Verifica i ticker o completa i dati asset."
              : newsMeta.providerDegraded
                ? "Le fonti notizie sono temporaneamente instabili. Riprova tra poco."
              : "Nessuna notizia rilevante trovata ora. Riprova tra poco."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {news.map((item, index) => (
            <article key={`${item.ticker}-${item.url}-${index}`} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{item.ticker}</div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{item.titolo}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.riassunto}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
                <span>{item.fonte}</span><span>{new Date(item.data).toLocaleDateString("it-IT")}</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">Leggi articolo</a>
                <button
                  type="button"
                  onClick={() => openChatFromNews(item)}
                  className="inline-flex rounded-lg border border-blue-300 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
                >
                  Parlane col mate
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs italic text-zinc-400">Notizie e riassunti generati da AI · solo a scopo informativo · non costituiscono consulenza finanziaria</p>
    </div>
  );

  const InsightsSection = (
    <div ref={insightsRef} className={`rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${getTutorialTargetClass("insights")}`}>
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold tracking-tight">Insight del mate</h2>
        <button type="button" onClick={() => void loadInsights({ forceRefresh: true })} disabled={isInsightsLoading}
          className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {isInsightsLoading ? "Aggiornamento..." : "Aggiorna"}
        </button>
      </div>
      <div className="p-3">
        {isInsightsLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="animate-pulse rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800"><div className="mb-1.5 h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700" /><div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-700" /></div>)}</div>
        ) : insights.length === 0 ? (
          <p className="px-1 py-4 text-center text-sm text-zinc-400">Nessun insight. Clicca Aggiorna per generarli.</p>
        ) : (
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <article key={i} className={`rounded-lg border ${insight.tipo === "attenzione" ? "border-amber-100 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/20" : insight.tipo === "opportunità" ? "border-blue-100 bg-blue-50 dark:border-blue-900/30 dark:bg-blue-950/20" : "border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50"}`}>
                <button
                  type="button"
                  onClick={() => toggleInsightExpanded(i)}
                  aria-expanded={Boolean(expandedInsightIds[i])}
                  aria-controls={`insight-content-${i}`}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  <InsightIcon tipo={insight.tipo} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{insight.titolo}</span>
                      {insight.ticker && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{insight.ticker}</span>}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {expandedInsightIds[i] ? "Riduci" : "Dettagli"}
                  </span>
                </button>
                {expandedInsightIds[i] && (
                  <div id={`insight-content-${i}`} className="border-t border-zinc-200/70 px-3 pb-3 pt-2 dark:border-zinc-700/60">
                    <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-300">{insight.contenuto}</p>
                    {insight.news_url && (
                      <a href={insight.news_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                        {insight.news_titolo ?? "Apri fonte"}
                      </a>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const SignalsSection = (
    <div ref={signalsRef} className={`rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${getTutorialTargetClass("signals")}`}>
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold tracking-tight">Segnali del mate</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Alert narrativi e contestualizzati al tuo portafoglio, non semplici soglie tecniche.
        </p>
      </div>
      <div className="space-y-2 p-3">
        {conversationalSignals.length === 0 ? (
          <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
            Nessun segnale urgente al momento. Il mate continuera a monitorare il contesto per te.
          </p>
        ) : (
          conversationalSignals.map((signal) => (
            <article key={signal.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{signal.titolo}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${signal.livello === "attenzione" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : signal.livello === "monitoraggio" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"}`}>
                  {signal.livello}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{signal.motivo}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500">
                <span>{new Date().toLocaleDateString("it-IT")}</span>
                {signal.sourceUrl && (
                  <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400">
                    Fonte
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => openChatFromPrompt(signal.prompt)}
                className="mt-3 inline-flex rounded-lg border border-blue-300 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
              >
                Parliamone
              </button>
            </article>
          ))
        )}
      </div>
    </div>
  );

  // ── COMPANION PANEL ───────────────────────────────────────────
  const CompanionPanel = (
    <div ref={chatRef} className={`flex flex-col gap-4 ${currentTutorialTarget === "chat" ? "rounded-xl ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950" : ""}`}>

      <div
        className={`fixed ${isTutorialOpen && currentTutorialTarget === "chat" ? "z-[65]" : "z-50"} flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900 ${isChatExpanded ? "inset-4 shadow-2xl" : "bottom-[calc(5rem+env(safe-area-inset-bottom))] left-2 right-2 h-[58vh] max-h-[620px] sm:bottom-4 sm:left-auto sm:right-4 sm:h-[560px] sm:w-[420px]"}`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => setIsHistoryOpen((v) => !v)} title="Storico"
              className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${isHistoryOpen ? "border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-700 dark:bg-blue-900/20" : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
            </button>
            <h2 className="truncate text-sm font-semibold">Mate</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {!isChatExpanded && (
              <button type="button" onClick={handleMinimizeChat} title="Minimizza"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 transition hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
              </button>
            )}
            {isChatExpanded && (
              <button
                type="button"
                onClick={() => setIsChatExpanded(false)}
                aria-label="Riduci la chat"
                className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
              >
                Riduci
              </button>
            )}
            <button type="button" onClick={handleNewChat} title="Nuova chat"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 transition hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </button>
            {!isChatExpanded && (
              <button type="button" onClick={() => setIsChatExpanded(true)} title="Espandi"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-400 transition hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {isHistoryOpen && (
            <div className="flex w-48 flex-shrink-0 flex-col border-r border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div className="flex-1 overflow-y-auto p-2">
                <button type="button" onClick={handleNewChat}
                  className="mb-2 flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Nuova chat
                </button>
                {chatSessions.length === 0
                  ? <p className="px-2 py-3 text-xs text-zinc-400">Nessuna conversazione.</p>
                  : <div className="space-y-0.5">
                    {chatSessions.map((session) => (
                      <button key={session.id} type="button" onClick={() => void handleLoadSession(session.id)}
                        className={`w-full rounded-lg px-2 py-2 text-left transition ${currentSessionId === session.id ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
                        <p className="truncate text-xs font-medium">{session.title ?? "Conversazione"}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">{timeAgo(session.updated_at)}</p>
                      </button>
                    ))}
                  </div>
                }
              </div>
            </div>
          )}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {isLoadingSession
                ? <div className="flex items-center justify-center py-8 text-sm text-zinc-400">Caricamento...</div>
                : chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    data-testid={message.role === "user" ? "chat-message-user" : "chat-message-assistant"}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"}`}>
                      {message.role === "assistant"
                        ? <div className="[&_p]:my-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold"><ReactMarkdown>{message.content}</ReactMarkdown></div>
                        : message.content}
                    </div>
                  </div>
                ))
              }
              {isSendingChat && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-2.5 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Sto scrivendo...</div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
            <div className="border-t border-zinc-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-zinc-800">
              {chatErrorMessage && <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{chatErrorMessage}</p>}
              <button
                type="button"
                onClick={openDiaryFromChat}
                className="mb-2 inline-flex rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                Salva nel diario
              </button>
              <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
                <input ref={chatInputRef} type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Scrivi un messaggio..."
                  className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950" />
                <button type="submit" disabled={isSendingChat || !chatInput.trim()}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      {isChatExpanded && <div className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-sm" onClick={() => setIsChatExpanded(false)} />}
    </div>
  );

  const ChatLauncher = (
    <button
      type="button"
      onClick={handleRestoreChat}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-50 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-500 sm:bottom-4 sm:right-4"
      aria-label="Apri il mate"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
      Mate
    </button>
  );

  const importPreviewSummary = useMemo(() => {
    const selectedRows = importPreviewRows.filter((row) => selectedPreviewRowIds.includes(row.id));
    const strictDuplicates = selectedRows.filter((row) => previewDuplicateMap.get(row.id)?.kind.startsWith("strict")).length;
    const possibleDuplicates = selectedRows.filter((row) => previewDuplicateMap.get(row.id)?.kind.startsWith("fuzzy")).length;
    const needsReview = selectedRows.filter((row) => row.needs_review).length;
    const ready = selectedRows.length - strictDuplicates - needsReview;
    return {
      extracted: importPreviewRows.length,
      selected: selectedRows.length,
      strictDuplicates,
      possibleDuplicates,
      needsReview,
      ready: Math.max(0, ready),
    };
  }, [importPreviewRows, previewDuplicateMap, selectedPreviewRowIds]);

  const ImportPreviewModal = isImportPreviewOpen ? (
    <div className="fixed inset-0 z-[72] flex items-end justify-center bg-zinc-950/60 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold">Anteprima importazione</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Rivedi le righe prima di confermare: i dati verranno salvati solo dopo conferma.
            </p>
          </div>
          <button
            type="button"
            onClick={closeImportPreview}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
            aria-label="Chiudi anteprima importazione"
          >
            ✕
          </button>
        </div>
        <div className="grid gap-2 border-b border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 sm:grid-cols-6 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300">
          <span>Estratte: <strong>{importPreviewSummary.extracted}</strong></span>
          <span>Selezionate: <strong>{importPreviewSummary.selected}</strong></span>
          <span>Duplicate: <strong>{importPreviewSummary.strictDuplicates}</strong></span>
          <span>Possibili dup.: <strong>{importPreviewSummary.possibleDuplicates}</strong></span>
          <span>Da rivedere: <strong>{importPreviewSummary.needsReview}</strong></span>
          <span>Pronte: <strong>{importPreviewSummary.ready}</strong></span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 p-3 dark:border-zinc-800">
          <button type="button" onClick={() => setSelectedPreviewRowIds(importPreviewRows.map((row) => row.id))} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
            Seleziona tutto
          </button>
          <button type="button" onClick={() => setSelectedPreviewRowIds([])} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
            Deseleziona tutto
          </button>
        </div>
        <div className="max-h-[52vh] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2">Includi</th>
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Ticker</th>
                <th className="px-3 py-2">Quantita</th>
                <th className="px-3 py-2">Prezzo acquisto</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {importPreviewRows.map((row) => {
                const isSelected = selectedPreviewRowIds.includes(row.id);
                const duplicateInfo = previewDuplicateMap.get(row.id);
                const statusLabel = duplicateInfo
                  ? duplicateInfo.kind.startsWith("strict")
                    ? "Duplicato"
                    : "Possibile duplicato"
                  : row.needs_review
                    ? "Da rivedere"
                    : "OK";
                return (
                  <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-3 py-2 align-top">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => togglePreviewRowSelection(row.id)}
                        aria-label={`Includi ${row.name}`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <p className="font-medium">{row.name}</p>
                      {row.reason && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{row.reason}</p>}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input value={row.ticker ?? ""} onChange={(e) => updatePreviewRow(row.id, { ticker: e.target.value || null })} className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950" />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input type="number" step="any" value={row.quantity ?? ""} onChange={(e) => updatePreviewRow(row.id, { quantity: e.target.value ? Number(e.target.value) : null })} className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950" />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input type="number" step="any" value={row.purchase_price ?? ""} onChange={(e) => updatePreviewRow(row.id, { purchase_price: e.target.value ? Number(e.target.value) : null })} className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950" />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input type="date" value={row.purchase_date ?? ""} onChange={(e) => updatePreviewRow(row.id, { purchase_date: e.target.value || null })} className="w-36 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950" />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusLabel === "OK" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : statusLabel === "Duplicato" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : statusLabel === "Possibile duplicato" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"}`}>
                        {statusLabel}
                      </span>
                      {duplicateInfo && <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">{duplicateInfo.message}</p>}
                      {typeof row.confidence === "number" && (
                        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Conf: {row.confidence.toFixed(2)}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <button type="button" onClick={() => removePreviewRow(row.id)} className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-900/40 dark:text-red-300">
                        Elimina
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
          <button type="button" onClick={closeImportPreview} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
            Annulla
          </button>
          <button type="button" onClick={() => void handleConfirmImportPreview()} disabled={isConfirmingImport} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {isConfirmingImport ? "Conferma in corso..." : "Conferma importazione"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const ImportAssetsModal = isImportModalOpen ? (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 sm:items-center">
      <div className="w-full max-w-xl rounded-t-2xl border border-zinc-200 bg-white p-6 shadow-xl sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Import guidato dal Mate</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Carica CSV o screenshot. Deduplico in automatico i titoli uguali nella stessa piattaforma e portafoglio.
            </p>
          </div>
          <button type="button" onClick={() => { setIsImportModalOpen(false); resetImportForm(); }} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Piattaforma di origine</label>
            <input
              type="text"
              value={importPlatform}
              onChange={(e) => setImportPlatform(e.target.value)}
              placeholder="Es. Fineco, eToro, Degiro"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <p className="mt-1 text-xs text-zinc-500">Serve per evitare duplicati sbagliati tra piattaforme diverse.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">File (CSV o screenshot)</label>
            <input
              type="file"
              accept=".csv,image/*"
              multiple
              onChange={(e) => setImportFiles(Array.from(e.target.files ?? []))}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-blue-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <p className="mt-1 text-xs text-zinc-500">{importFiles.length > 0 ? `${importFiles.length} file selezionati` : "Nessun file selezionato"}</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Dove vuoi importare?</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setImportDestinationType("existing")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${importDestinationType === "existing" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}
              >
                Aggiungi a esistente
              </button>
              <button
                type="button"
                onClick={() => setImportDestinationType("new")}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${importDestinationType === "new" ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}
              >
                Crea nuovo portafoglio
              </button>
            </div>
          </div>

          {importDestinationType === "existing" ? (
            <select
              value={importPortfolioId}
              onChange={(e) => setImportPortfolioId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={importNewPortfolioName}
              onChange={(e) => setImportNewPortfolioName(e.target.value)}
              placeholder="Es. Portafoglio da screenshot"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950"
            />
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            Se un dato non e chiaro dagli screenshot, il Mate te lo chiede: non viene inventato nulla.
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setIsImportModalOpen(false); resetImportForm(); }} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Annulla</button>
            <button type="button" onClick={() => void handleImportAssets()} disabled={isImportingAssets} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70">
              {isImportingAssets ? "Import in corso..." : "Importa"}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // ── ADD ASSET MODAL ───────────────────────────────────────────
  const AddAssetModal = isAddAssetModalOpen ? (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:max-h-[88vh] sm:rounded-2xl sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Aggiungi asset</h2>
          <button type="button" onClick={() => { setIsAddAssetModalOpen(false); resetAssetForm(); }} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700">✕</button>
        </div>
        <form onSubmit={handleAddAsset} className="space-y-4 overflow-y-auto pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cerca ticker o azienda</label>
            <div className="relative" ref={symbolSearchContainerRef}>
              <input type="text" value={assetSearchQuery}
                onChange={(e) => { const v = e.target.value; setAssetSearchQuery(v); setShowSymbolDropdown(true); if (!selectedAsset || v !== `${selectedAsset.name} (${selectedAsset.ticker})`) setSelectedAsset(null); if (v.trim().length < 3) { setAssetSearchResults([]); setIsSearchingSymbol(false); setSymbolSearchMessage(v.trim().length === 0 ? null : "Inserisci almeno 3 caratteri."); } }}
                required className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950" placeholder="Es. Apple o AAPL" />
              {showSymbolDropdown && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {isSearchingSymbol ? <p className="px-3 py-2 text-sm text-zinc-500">Ricerca in corso...</p>
                    : assetSearchResults.length > 0 ? assetSearchResults.map((result) => (
                      <button key={`${result.ticker}-${result.market}`} type="button"
                        onClick={() => { setSelectedAsset(result); setAssetSearchQuery(`${result.name} (${result.ticker})`); setShowSymbolDropdown(false); }}
                        className="block w-full border-b border-zinc-100 px-3 py-2 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800">
                        <div className="flex items-center justify-between"><p className="text-sm font-semibold">{result.ticker}</p><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">{result.asset_type}</span></div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">{result.name}</p>
                        <p className="text-xs text-zinc-400">{result.market}</p>
                      </button>
                    )) : <p className="px-3 py-2 text-sm text-zinc-500">{symbolSearchMessage || "Nessun risultato trovato"}</p>}
                </div>
              )}
            </div>
            {selectedAsset && <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">✓ {selectedAsset.name} · {selectedAsset.asset_type} · {selectedAsset.market}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Portafoglio</label>
            {!showNewPortfolioInput ? (
              <div className="flex items-center gap-2">
                <select value={selectedPortfolioId} onChange={(e) => setSelectedPortfolioId(e.target.value)} className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950">
                  {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewPortfolioInput(true)} className="min-h-11 whitespace-nowrap rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-300">+ Nuovo</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input type="text" value={modalNewPortfolioName} onChange={(e) => setModalNewPortfolioName(e.target.value)} placeholder="Es. ETF Europa" autoFocus className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950" />
                <button type="button" onClick={() => { setShowNewPortfolioInput(false); setModalNewPortfolioName(""); }} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700">✕</button>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Quanto hai investito (€)</label>
            <input type="number" step="any" min="0.01" value={investedAmount} onChange={(e) => setInvestedAmount(e.target.value)} required className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950" placeholder="Es. 500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Quando hai comprato</label>
            <input type="date" value={purchaseDate} onChange={(e) => { setPurchaseDate(e.target.value); setHistoricalPriceError(null); }} required max={new Date().toISOString().split("T")[0]} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-200 dark:border-zinc-700 dark:bg-zinc-950" />
          </div>
          {historicalPriceError && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">⚠ {historicalPriceError}</p>}
          {errorMessage && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>}
          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-zinc-100 bg-white pt-3 dark:border-zinc-800 dark:bg-zinc-900">
            <button type="button" onClick={() => { setIsAddAssetModalOpen(false); resetAssetForm(); }} className="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Annulla</button>
            <button type="submit" disabled={isSavingAsset || isFetchingHistoricalPrice || !selectedAsset || !investedAmount || !purchaseDate} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70">
              {isFetchingHistoricalPrice ? "Recupero prezzo..." : isSavingAsset ? "Salvataggio..." : "Salva asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">

      {/* ── HEADER con nav centrale ── */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">

          {/* Logo — fisso a sinistra */}
          <p className="min-w-0 flex-1 text-base font-semibold tracking-tight text-blue-700 dark:text-blue-400 lg:w-40 lg:flex-none">
            Folio Mate
          </p>

          {/* Nav centrale — solo desktop */}
          <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
            <button type="button" onClick={() => scrollTo(portfolioRef)}
              className="rounded-lg px-4 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
              Portafoglio
            </button>
            <button type="button" onClick={() => scrollTo(macroRef)}
              className="rounded-lg px-4 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
              Mercato
            </button>
            <button type="button" onClick={() => scrollTo(purchasePlansRef)}
              className="rounded-lg px-4 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
              Piani
            </button>
            <button type="button" onClick={() => scrollTo(newsRef)}
              className="rounded-lg px-4 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
              Notizie
            </button>
          </nav>

          {/* Azioni destra */}
          <div className="flex flex-shrink-0 items-center justify-end gap-2">
            <a
              ref={diaryButtonRef}
              href="/checkin"
              className={`hidden rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 sm:inline-flex ${getTutorialTargetClass("diary")}`}
            >
              Diario
            </a>
            <button
              type="button"
              onClick={openTutorial}
              className="hidden rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 sm:inline-flex"
            >
              Tutorial
            </button>
            <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 lg:inline">{userEmail}</span>
            <button type="button" onClick={handleLogout} disabled={isLoggingOut}
              className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {isLoggingOut ? "..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile */}
      <div className="lg:hidden">
        <div className="px-4 py-6 pb-28">
          {mobileTab === "portfolio" && (
            <div className="space-y-6">
              {InsightsSection}
              {SignalsSection}
              {PortfolioSection}
              {PurchasePlansSection}
              {MacroSection}
              {NewsSection}
            </div>
          )}
          {mobileTab === "news" && NewsSection}
        </div>
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex">
            {(["portfolio", "news"] as MobileTab[]).map((tab) => {
              const icons: Record<MobileTab, React.ReactNode> = {
                portfolio: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />,
                news: <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />,
              };
              const labels: Record<MobileTab, string> = { portfolio: "Portafoglio", news: "Notizie" };
              return (
                <button key={tab} type="button" onClick={() => setMobileTab(tab)}
                  className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium transition ${mobileTab === tab ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>{icons[tab]}</svg>
                  {labels[tab]}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Desktop — niente anchor menu esterno, è già nell'header */}
      <section className="mx-auto hidden w-full max-w-6xl px-4 py-8 pb-[620px] sm:px-6 lg:block lg:px-8">
        <div className="space-y-8">
          {InsightsSection}
          {SignalsSection}
          {PortfolioSection}
          {PurchasePlansSection}
          {MacroSection}
          {NewsSection}
        </div>
      </section>

      {isChatMinimized ? ChatLauncher : CompanionPanel}

      {isTutorialOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-zinc-950/55 backdrop-blur-sm" />
          <div className="fixed inset-x-3 bottom-3 z-[70] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[420px]">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Tutorial {tutorialStepIndex + 1}/{tutorialSteps.length}
                </p>
                <button
                  type="button"
                  onClick={() => { void closeTutorial(true); }}
                  disabled={isTutorialSaving}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-700 disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Salta
                </button>
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {tutorialSteps[tutorialStepIndex]?.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {tutorialSteps[tutorialStepIndex]?.description}
              </p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => goToTutorialStep(tutorialStepIndex - 1)}
                  disabled={tutorialStepIndex === 0}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
                >
                  Indietro
                </button>
                {tutorialStepIndex === tutorialSteps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => { void closeTutorial(true); }}
                    disabled={isTutorialSaving}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                  >
                    {isTutorialSaving ? "Salvataggio..." : "Fine"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => goToTutorialStep(tutorialStepIndex + 1)}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-500"
                  >
                    Avanti
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {ImportAssetsModal}
      {ImportPreviewModal}
      {AddAssetModal}
    </main>
  );
}
