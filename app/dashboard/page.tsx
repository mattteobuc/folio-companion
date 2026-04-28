"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/utils/supabase/client";

type AssetRow = {
  id: string;
  ticker: string;
  name: string;
  asset_type: string;
  quantity: number;
  purchase_price: number;
  purchase_date: string | null;
};

type PortfolioRow = {
  id: string;
};

type NewsItem = {
  ticker: string;
  titolo: string;
  fonte: string;
  url: string;
  data: string;
  riassunto: string;
};

type MacroPayload = {
  testo: string;
  data: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type SymbolSearchResult = {
  ticker: string;
  name: string;
  market: string;
  asset_type: string;
};

type PricesMap = Record<string, number | null>;
type MobileTab = "portfolio" | "news" | "chat";

const ASSET_TYPES = ["Azione", "ETF", "Obbligazione", "Crypto", "Altro"] as const;
const MACRO_CACHE_KEY = "folio:macro-context:v1";
const MACRO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEWS_SUMMARY_CACHE_KEY = "folio:news-summaries:v1";
const INITIAL_CHAT_MESSAGE =
  "Ciao! Sono il tuo compagno finanziario. Puoi chiedermi tutto sul tuo portafoglio, sulle notizie di mercato o sugli eventi macro. Non ti darò mai consigli diretti di acquisto o vendita, ma ti aiuterò a capire meglio il contesto.";

export default function DashboardPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [prices, setPrices] = useState<PricesMap>({});
  const [isPricesLoading, setIsPricesLoading] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [macroText, setMacroText] = useState("");
  const [macroDate, setMacroDate] = useState("");
  const [isMacroLoading, setIsMacroLoading] = useState(false);
  const [macroErrorMessage, setMacroErrorMessage] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [newsErrorMessage, setNewsErrorMessage] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: INITIAL_CHAT_MESSAGE },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatErrorMessage, setChatErrorMessage] = useState<string | null>(null);
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

  const supabase = useMemo(() => createClient(), []);
  const symbolSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const ensureDefaultPortfolio = useCallback(async (userId: string) => {
    const { data: existingPortfolio, error: portfolioFetchError } = await supabase
      .from("portfolios").select("id").eq("user_id", userId)
      .order("created_at", { ascending: true }).limit(1).maybeSingle<PortfolioRow>();
    if (portfolioFetchError) throw portfolioFetchError;
    if (existingPortfolio?.id) return existingPortfolio.id;
    const { data: newPortfolio, error: portfolioInsertError } = await supabase
      .from("portfolios").insert({ user_id: userId, name: "Portafoglio principale" })
      .select("id").single<PortfolioRow>();
    if (portfolioInsertError) throw portfolioInsertError;
    return newPortfolio.id;
  }, [supabase]);

  const loadAssets = useCallback(async (currentPortfolioId: string): Promise<AssetRow[]> => {
    const { data, error } = await supabase.from("assets")
      .select("id, ticker, name, asset_type, quantity, purchase_price, purchase_date")
      .eq("portfolio_id", currentPortfolioId).order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as AssetRow[];
    setAssets(rows);
    return rows;
  }, [supabase]);

  const loadPrices = useCallback(async (assetList: AssetRow[]) => {
    if (assetList.length === 0) return;
    setIsPricesLoading(true);
    try {
      const tickers = [...new Set(assetList.map((a) => a.ticker))];
      const response = await fetch("/api/prices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });
      const payload = (await response.json()) as { prices?: PricesMap; error?: string };
      if (response.ok && payload.prices) setPrices(payload.prices);
    } catch (error) { console.error("Errore caricamento prezzi:", error); }
    finally { setIsPricesLoading(false); }
  }, []);

  const getNewsSummaryCache = () => {
    try {
      const rawValue = window.localStorage.getItem(NEWS_SUMMARY_CACHE_KEY);
      if (!rawValue) return {} as Record<string, string>;
      const parsed = JSON.parse(rawValue) as Record<string, string>;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch { return {} as Record<string, string>; }
  };

  const loadNews = useCallback(async () => {
    setIsNewsLoading(true); setNewsErrorMessage(null);
    try {
      const summaryCache = getNewsSummaryCache();
      const response = await fetch("/api/news", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cachedSummaries: summaryCache }),
      });
      const payload = (await response.json()) as { news?: NewsItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Errore durante il recupero delle notizie.");
      const nextNews = payload.news ?? [];
      setNews(nextNews);
      const nextSummaryCache = { ...summaryCache };
      nextNews.forEach((item) => {
        const cacheKey = item.titolo.trim().toLowerCase();
        if (cacheKey && item.riassunto) nextSummaryCache[cacheKey] = item.riassunto;
      });
      window.localStorage.setItem(NEWS_SUMMARY_CACHE_KEY, JSON.stringify(nextSummaryCache));
    } catch (error) {
      console.error("Errore caricamento notizie:", error);
      setNewsErrorMessage(error instanceof Error ? error.message : "Errore inatteso.");
    } finally { setIsNewsLoading(false); }
  }, []);

  const loadMacroContext = useCallback(async (options?: { forceRefresh?: boolean }) => {
    const shouldForceRefresh = Boolean(options?.forceRefresh);
    setIsMacroLoading(true); setMacroErrorMessage(null);
    try {
      if (!shouldForceRefresh) {
        const rawCachedMacro = window.localStorage.getItem(MACRO_CACHE_KEY);
        if (rawCachedMacro) {
          const parsedCache = JSON.parse(rawCachedMacro) as { testo?: string; data?: string; timestamp?: number };
          const isFresh = Date.now() - (parsedCache.timestamp ?? 0) < MACRO_CACHE_TTL_MS;
          if (isFresh && parsedCache.testo && parsedCache.data) {
            setMacroText(parsedCache.testo); setMacroDate(parsedCache.data); return;
          }
        }
      }
      const response = await fetch("/api/macro", { method: "GET", cache: "no-store" });
      const payload = (await response.json()) as MacroPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Errore durante il recupero del contesto macro.");
      setMacroText(payload.testo || ""); setMacroDate(payload.data || "");
      window.localStorage.setItem(MACRO_CACHE_KEY, JSON.stringify({ testo: payload.testo || "", data: payload.data || "", timestamp: Date.now() }));
    } catch (error) {
      console.error("Errore caricamento contesto macro:", error);
      setMacroErrorMessage(error instanceof Error ? error.message : "Errore inatteso.");
    } finally { setIsMacroLoading(false); }
  }, []);

  const loadDashboardData = useCallback(async () => {
    setErrorMessage(null); setIsPageLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) { router.push("/login"); router.refresh(); return; }
      setUserEmail(user.email ?? "");
      const currentPortfolioId = await ensureDefaultPortfolio(user.id);
      setPortfolioId(currentPortfolioId);
      const loadedAssets = await loadAssets(currentPortfolioId);
      await Promise.all([loadPrices(loadedAssets), loadMacroContext(), loadNews()]);
    } catch (error) {
      console.error("Errore caricamento dashboard:", error);
      setErrorMessage(error instanceof Error ? error.message : "Errore inatteso durante il caricamento.");
    } finally { setIsPageLoading(false); }
  }, [ensureDefaultPortfolio, loadAssets, loadPrices, loadMacroContext, loadNews, router, supabase]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => { void loadDashboardData(); });
    return () => { window.cancelAnimationFrame(id); };
  }, [loadDashboardData]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleLogout = async () => {
    setIsLoggingOut(true); setErrorMessage(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) { setErrorMessage(error.message); return; }
      router.push("/login"); router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Errore inatteso durante il logout.");
    } finally { setIsLoggingOut(false); }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo asset?")) return;
    setDeletingAssetId(assetId);
    try {
      const { error } = await supabase.from("assets").delete().eq("id", assetId);
      if (error) throw error;
      setAssets((current) => current.filter((a) => a.id !== assetId));
    } catch (error) {
      console.error("Errore eliminazione asset:", error);
      setErrorMessage(error instanceof Error ? error.message : "Errore durante l'eliminazione.");
    } finally { setDeletingAssetId(null); }
  };

  const resetAssetForm = () => {
    setAssetSearchQuery(""); setAssetSearchResults([]); setShowSymbolDropdown(false);
    setSymbolSearchMessage(null); setSelectedAsset(null); setInvestedAmount("");
    setPurchaseDate(""); setHistoricalPriceError(null);
  };

  useEffect(() => {
    if (!isAddAssetModalOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!symbolSearchContainerRef.current) return;
      if (!symbolSearchContainerRef.current.contains(event.target as Node)) setShowSymbolDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [isAddAssetModalOpen]);

  useEffect(() => {
    if (!isAddAssetModalOpen) return;
    const query = assetSearchQuery.trim();
    if (query.length < 3) return;
    const debounceTimer = window.setTimeout(() => {
      void (async () => {
        setIsSearchingSymbol(true); setSymbolSearchMessage(null); setShowSymbolDropdown(true);
        try {
          const response = await fetch(`/api/symbol-search?query=${encodeURIComponent(query)}`, { method: "GET" });
          const payload = (await response.json()) as { data?: SymbolSearchResult[]; error?: string };
          if (!response.ok) throw new Error(payload.error || "Errore durante la ricerca simboli.");
          const results = payload.data ?? [];
          setAssetSearchResults(results);
          setSymbolSearchMessage(results.length === 0 ? "Nessun risultato trovato" : null);
        } catch (error) {
          console.error("Errore ricerca ticker:", error);
          setAssetSearchResults([]);
          setSymbolSearchMessage(error instanceof Error ? error.message : "Errore inatteso durante la ricerca.");
        } finally { setIsSearchingSymbol(false); }
      })();
    }, 400);
    return () => { window.clearTimeout(debounceTimer); };
  }, [assetSearchQuery, isAddAssetModalOpen]);

  const handleAddAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setErrorMessage(null); setHistoricalPriceError(null);
    if (!selectedAsset) { setErrorMessage("Seleziona un asset dalla ricerca."); return; }
    if (!portfolioId) { setErrorMessage("Portfolio non disponibile. Riprova tra qualche secondo."); return; }
    const parsedAmount = Number(investedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { setErrorMessage("Inserisci un importo investito valido maggiore di zero."); return; }
    if (!purchaseDate) { setErrorMessage("Seleziona la data di acquisto."); return; }
    setIsFetchingHistoricalPrice(true); setIsSavingAsset(true);
    try {
      const priceResponse = await fetch("/api/historical-price", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: selectedAsset.ticker, date: purchaseDate }),
      });
      const pricePayload = (await priceResponse.json()) as { price?: number; date?: string; error?: string };
      if (!priceResponse.ok || !pricePayload.price) {
        setHistoricalPriceError(pricePayload.error || "Prezzo storico non disponibile per questa data. Prova una data diversa.");
        setIsFetchingHistoricalPrice(false); setIsSavingAsset(false); return;
      }
      setIsFetchingHistoricalPrice(false);
      const historicalPrice = pricePayload.price;
      const quantity = parsedAmount / historicalPrice;
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) { router.push("/login"); router.refresh(); return; }
      const effectivePortfolioId = portfolioId ?? (await ensureDefaultPortfolio(user.id));
      const { error } = await supabase.from("assets").insert({
        portfolio_id: effectivePortfolioId,
        ticker: selectedAsset.ticker, name: selectedAsset.name,
        asset_type: selectedAsset.asset_type,
        quantity: Math.round(quantity * 10000) / 10000,
        purchase_price: Math.round(historicalPrice * 100) / 100,
        purchase_date: purchaseDate,
      });
      if (error) throw error;
      const updatedAssets = await loadAssets(effectivePortfolioId);
      await loadPrices(updatedAssets); await loadNews();
      resetAssetForm(); setIsAddAssetModalOpen(false);
    } catch (error) {
      console.error("Errore salvataggio asset:", error);
      setErrorMessage(error instanceof Error ? error.message : "Errore inatteso durante il salvataggio asset.");
    } finally { setIsSavingAsset(false); setIsFetchingHistoricalPrice(false); }
  };

  const handleSendChatMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedInput = chatInput.trim();
    if (!trimmedInput || isSendingChat) return;
    setChatErrorMessage(null); setIsSendingChat(true);
    const userMessage: ChatMessage = { role: "user", content: trimmedInput };
    const historyForApi = chatMessages.filter((msg) => msg.content !== INITIAL_CHAT_MESSAGE || msg.role !== "assistant");
    const nextMessages = [...chatMessages, userMessage];
    setChatMessages(nextMessages); setChatInput("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmedInput, history: historyForApi }),
      });
      const payload = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) throw new Error(payload.error || "Errore durante la generazione della risposta.");
      setChatMessages((current) => [...current, { role: "assistant", content: payload.reply ?? "Non sono riuscito a rispondere in questo momento." }]);
    } catch (error) {
      console.error("Errore invio messaggio chat:", error);
      setChatErrorMessage(error instanceof Error ? error.message : "Errore inatteso durante la chat.");
      setChatMessages(nextMessages);
    } finally { setIsSendingChat(false); }
  };

  const getAssetMetrics = (asset: AssetRow) => {
    const currentPrice = prices[asset.ticker];
    if (currentPrice === null || currentPrice === undefined) return { currentValue: null, gainLoss: null, gainLossPercent: null };
    const currentValue = currentPrice * asset.quantity;
    const costBasis = asset.purchase_price * asset.quantity;
    const gainLoss = currentValue - costBasis;
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
    return { currentValue, gainLoss, gainLossPercent };
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);

  const portfolioTotals = assets.reduce((acc, asset) => {
    const { currentValue, gainLoss } = getAssetMetrics(asset);
    return {
      totalValue: acc.totalValue + (currentValue ?? 0),
      totalCost: acc.totalCost + asset.purchase_price * asset.quantity,
      totalGainLoss: acc.totalGainLoss + (gainLoss ?? 0),
    };
  }, { totalValue: 0, totalCost: 0, totalGainLoss: 0 });

  const totalGainLossPercent = portfolioTotals.totalCost > 0
    ? (portfolioTotals.totalGainLoss / portfolioTotals.totalCost) * 100 : 0;

  const isSaveButtonDisabled = isSavingAsset || isFetchingHistoricalPrice || !selectedAsset || !investedAmount || !purchaseDate;

  // Sezione portafoglio condivisa tra mobile e desktop
  const PortfolioSection = (
    <div className="space-y-6">
      {/* Contesto di mercato */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Contesto di mercato</h2>
          <button type="button" onClick={() => void loadMacroContext({ forceRefresh: true })} disabled={isMacroLoading}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {isMacroLoading ? "Aggiornamento..." : "Aggiorna"}
          </button>
        </div>
        {macroDate && (
          <p className="mb-3 inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span aria-hidden>📅</span><span suppressHydrationWarning>{macroDate}</span>
          </p>
        )}
        {macroErrorMessage ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{macroErrorMessage}</p>
        ) : (
          <p className="text-sm leading-7 text-zinc-700 dark:text-zinc-300">{macroText || "Nessun contesto disponibile al momento."}</p>
        )}
      </div>

      {/* Tabella asset */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Il mio portafoglio</h1>
          <button type="button" onClick={() => setIsAddAssetModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500">
            + Aggiungi
          </button>
        </div>
        {errorMessage && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{errorMessage}</p>
        )}

        {/* Card view su mobile, tabella su desktop */}
        <div className="lg:hidden space-y-3">
          {isPageLoading ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">Caricamento dati...</div>
          ) : assets.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">Nessun asset presente. Tocca + Aggiungi per iniziare.</div>
          ) : (
            <>
              {assets.map((asset) => {
                const { currentValue, gainLoss, gainLossPercent } = getAssetMetrics(asset);
                const isPositive = (gainLoss ?? 0) >= 0;
                const invested = asset.purchase_price * asset.quantity;
                return (
                  <div key={asset.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">{asset.ticker}</span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{asset.asset_type}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{asset.name}</p>
                      </div>
                      <button type="button" onClick={() => void handleDeleteAsset(asset.id)} disabled={deletingAssetId === asset.id}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30">
                        {deletingAssetId === asset.id ? "..." : "Elimina"}
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">Investito</p>
                        <p className="font-medium text-zinc-700 dark:text-zinc-200">{formatCurrency(invested)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">Valore</p>
                        <p className="font-medium text-zinc-700 dark:text-zinc-200">
                          {isPricesLoading ? "..." : currentValue !== null ? formatCurrency(currentValue) : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">Gain/Loss</p>
                        <p className={`font-semibold ${gainLoss !== null ? (isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : "text-zinc-400"}`}>
                          {isPricesLoading ? "..." : gainLoss !== null ? `${isPositive ? "+" : ""}${gainLossPercent!.toFixed(1)}%` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* Totale mobile */}
              <div className="rounded-xl border-2 border-blue-100 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Totale portafoglio</p>
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500">Investito</p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(portfolioTotals.totalCost)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Valore attuale</p>
                    <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{isPricesLoading ? "..." : formatCurrency(portfolioTotals.totalValue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Gain/Loss</p>
                    <p className={`text-lg font-bold ${portfolioTotals.totalGainLoss >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {isPricesLoading ? "..." : `${portfolioTotals.totalGainLoss >= 0 ? "+" : ""}${totalGainLossPercent.toFixed(1)}%`}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tabella desktop */}
        <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm lg:block dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-100/70 dark:bg-zinc-800/50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Quantità</th>
                  <th className="px-4 py-3">Investito</th>
                  <th className="px-4 py-3">Valore attuale</th>
                  <th className="px-4 py-3">Gain/Loss</th>
                  <th className="px-4 py-3">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {isPageLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-500">Caricamento dati...</td></tr>
                ) : assets.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-500">Nessun asset presente. Aggiungi il primo asset per iniziare.</td></tr>
                ) : (
                  assets.map((asset) => {
                    const { currentValue, gainLoss, gainLossPercent } = getAssetMetrics(asset);
                    const isPositive = (gainLoss ?? 0) >= 0;
                    const invested = asset.purchase_price * asset.quantity;
                    return (
                      <tr key={asset.id} className="text-sm">
                        <td className="px-4 py-3 font-semibold">{asset.ticker}</td>
                        <td className="px-4 py-3">{asset.name}</td>
                        <td className="px-4 py-3">{asset.asset_type}</td>
                        <td className="px-4 py-3">{asset.quantity.toFixed(4)}</td>
                        <td className="px-4 py-3">{formatCurrency(invested)}</td>
                        <td className="px-4 py-3">
                          {isPricesLoading ? <span className="text-zinc-400">...</span> : currentValue !== null ? formatCurrency(currentValue) : <span className="text-zinc-400">—</span>}
                        </td>
                        <td className={`px-4 py-3 font-medium ${gainLoss !== null ? (isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : "text-zinc-400"}`}>
                          {isPricesLoading ? <span className="text-zinc-400">...</span> : gainLoss !== null ? `${isPositive ? "+" : ""}${formatCurrency(gainLoss)} (${isPositive ? "+" : ""}${gainLossPercent!.toFixed(2)}%)` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => void handleDeleteAsset(asset.id)} disabled={deletingAssetId === asset.id}
                            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30">
                            {deletingAssetId === asset.id ? "..." : "Elimina"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {assets.length > 0 && !isPageLoading && (
                <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <tr className="text-sm font-semibold">
                    <td colSpan={4} className="px-4 py-3 text-zinc-700 dark:text-zinc-200">Totale portafoglio</td>
                    <td className="px-4 py-3">{formatCurrency(portfolioTotals.totalCost)}</td>
                    <td className="px-4 py-3">{isPricesLoading ? <span className="text-zinc-400">...</span> : formatCurrency(portfolioTotals.totalValue)}</td>
                    <td className={`px-4 py-3 ${portfolioTotals.totalGainLoss >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {isPricesLoading ? <span className="text-zinc-400">...</span> : `${portfolioTotals.totalGainLoss >= 0 ? "+" : ""}${formatCurrency(portfolioTotals.totalGainLoss)} (${portfolioTotals.totalGainLoss >= 0 ? "+" : ""}${totalGainLossPercent.toFixed(2)}%)`}
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  // Sezione notizie condivisa
  const NewsSection = (
    <div>
      <h2 className="mb-4 text-xl font-semibold tracking-tight">Notizie per te</h2>
      {newsErrorMessage && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{newsErrorMessage}</p>
      )}
      {isNewsLoading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">Caricamento notizie...</div>
      ) : news.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">Nessuna notizia disponibile al momento per i tuoi asset.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {news.map((item, index) => (
            <article key={`${item.ticker}-${item.url}-${index}`} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{item.ticker}</div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{item.titolo}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.riassunto}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>{item.fonte}</span>
                <span>{new Date(item.data).toLocaleDateString("it-IT")}</span>
              </div>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-sm font-medium text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                Leggi articolo
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );

  // Sezione chat condivisa
  const ChatSection = (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-xl font-semibold tracking-tight">Parla con il tuo compagno</h2>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
        {chatMessages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"}`}>
              {message.role === "assistant" ? (
                <div className="[&_p]:my-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : message.content}
            </div>
          </div>
        ))}
        {isSendingChat && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-2.5 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">Sto scrivendo...</div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>
      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
        {chatErrorMessage && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{chatErrorMessage}</p>
        )}
        <form onSubmit={handleSendChatMessage} className="flex items-center gap-2">
          <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Scrivi un messaggio..."
            className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950" />
          <button type="submit" disabled={isSendingChat || !chatInput.trim()}
            className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70">
            Invia
          </button>
        </form>
      </div>
    </div>
  );

  // Modal aggiunta asset
  const AddAssetModal = isAddAssetModalOpen ? (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-zinc-200 bg-white p-6 shadow-xl sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Aggiungi asset</h2>
          <button type="button" onClick={() => { setIsAddAssetModalOpen(false); resetAssetForm(); }}
            className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200" aria-label="Chiudi modal">✕</button>
        </div>
        <form onSubmit={handleAddAsset} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cerca ticker o azienda</label>
            <div className="relative" ref={symbolSearchContainerRef}>
              <input type="text" value={assetSearchQuery}
                onChange={(e) => {
                  const v = e.target.value; setAssetSearchQuery(v); setShowSymbolDropdown(true);
                  if (!selectedAsset || v !== `${selectedAsset.name} (${selectedAsset.ticker})`) setSelectedAsset(null);
                  if (v.trim().length < 3) {
                    setAssetSearchResults([]); setIsSearchingSymbol(false);
                    setSymbolSearchMessage(v.trim().length === 0 ? null : "Inserisci almeno 3 caratteri per cercare.");
                  }
                }}
                required className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="Es. Apple o AAPL" />
              {showSymbolDropdown && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {isSearchingSymbol ? (
                    <p className="px-3 py-2 text-sm text-zinc-500">Ricerca in corso...</p>
                  ) : assetSearchResults.length > 0 ? (
                    assetSearchResults.map((result) => (
                      <button key={`${result.ticker}-${result.market}`} type="button"
                        onClick={() => { setSelectedAsset(result); setAssetSearchQuery(`${result.name} (${result.ticker})`); setShowSymbolDropdown(false); }}
                        className="block w-full border-b border-zinc-100 px-3 py-2 text-left transition last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.ticker}</p>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">{result.asset_type}</span>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">{result.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{result.market}</p>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-sm text-zinc-500">{symbolSearchMessage || "Nessun risultato trovato"}</p>
                  )}
                </div>
              )}
            </div>
            {selectedAsset && (
              <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">✓ {selectedAsset.name} · {selectedAsset.asset_type} · {selectedAsset.market}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Quanto hai investito (€)</label>
            <input type="number" step="any" min="0.01" value={investedAmount} onChange={(e) => setInvestedAmount(e.target.value)} required
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Es. 500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Quando hai comprato</label>
            <input type="date" value={purchaseDate} onChange={(e) => { setPurchaseDate(e.target.value); setHistoricalPriceError(null); }}
              required max={new Date().toISOString().split("T")[0]}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950" />
          </div>
          {historicalPriceError && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">⚠ {historicalPriceError}</p>
          )}
          {errorMessage && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{errorMessage}</p>
          )}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setIsAddAssetModalOpen(false); resetAssetForm(); }}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">Annulla</button>
            <button type="submit" disabled={isSaveButtonDisabled}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70">
              {isFetchingHistoricalPrice ? "Recupero prezzo storico..." : isSavingAsset ? "Salvataggio..." : "Salva asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-base font-semibold tracking-tight text-blue-700 dark:text-blue-400">Folio Companion</p>
          <div className="flex items-center gap-2">
            <a href="/checkin" className="hidden rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 sm:inline-flex">
              Check-in
            </a>
            <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:inline">{userEmail}</span>
            <button type="button" onClick={handleLogout} disabled={isLoggingOut}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {isLoggingOut ? "..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      {/* Layout mobile con tab */}
      <div className="lg:hidden">
        <div className="px-4 py-6 pb-24">
          {mobileTab === "portfolio" && PortfolioSection}
          {mobileTab === "news" && NewsSection}
          {mobileTab === "chat" && (
            <div style={{ height: "calc(100vh - 10rem)" }}>
              {ChatSection}
            </div>
          )}
        </div>

        {/* Tab bar mobile fissa in basso */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex">
            <button type="button" onClick={() => setMobileTab("portfolio")}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition ${mobileTab === "portfolio" ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Portafoglio
            </button>
            <button type="button" onClick={() => setMobileTab("news")}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition ${mobileTab === "news" ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
              </svg>
              Notizie
            </button>
            <button type="button" onClick={() => setMobileTab("chat")}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition ${mobileTab === "chat" ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              Compagno
            </button>
          </div>
        </nav>
      </div>

      {/* Layout desktop */}
      <section className="mx-auto hidden w-full max-w-6xl px-4 py-8 sm:px-6 lg:block lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:items-start">
          <div className="space-y-8 lg:col-span-3">
            {PortfolioSection}
            {NewsSection}
          </div>
          <aside className="lg:col-span-2 lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)]">
            {ChatSection}
          </aside>
        </div>
      </section>

      {AddAssetModal}
    </main>
  );
}