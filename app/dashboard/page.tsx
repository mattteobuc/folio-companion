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
  portfolio_id: string;
};

type PortfolioRow = {
  id: string;
  name: string;
};

type NewsItem = {
  ticker: string;
  titolo: string;
  fonte: string;
  url: string;
  data: string;
  riassunto: string;
};

type MacroTopic = {
  topic: string;
  sentiment: string;
  analisi: string;
};

type MacroPayload = {
  testo: string;
  topics: MacroTopic[] | null;
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

const MACRO_CACHE_KEY = "folio:macro-context:v2";
const MACRO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const NEWS_SUMMARY_CACHE_KEY = "folio:news-summaries:v1";
const INITIAL_CHAT_MESSAGE =
  "Ciao! Sono il tuo compagno finanziario. Puoi chiedermi tutto sul tuo portafoglio, sulle notizie di mercato o sugli eventi macro. Non ti darò mai consigli diretti di acquisto o vendita, ma ti aiuterò a capire meglio il contesto.";

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const s = sentiment.toLowerCase();
  if (s.includes("positivo"))
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">↑ Positivo</span>;
  if (s.includes("negativo"))
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">↓ Negativo</span>;
  if (s.includes("misto"))
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">~ Misto</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">— Neutro</span>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Portafogli
  const [portfolios, setPortfolios] = useState<PortfolioRow[]>([]);
  const [activePortfolioFilter, setActivePortfolioFilter] = useState<string>("all");
  const [isPortfolioMenuOpen, setIsPortfolioMenuOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<PortfolioRow | null>(null);
  const [editingPortfolioName, setEditingPortfolioName] = useState("");
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState("");
  const [portfolioActionLoading, setPortfolioActionLoading] = useState(false);

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

  // Form aggiungi asset
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

  const supabase = useMemo(() => createClient(), []);
  const symbolSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const portfolioMenuRef = useRef<HTMLDivElement | null>(null);

  // Portafogli da mostrare in base al filtro
  const visiblePortfolios = useMemo(() => {
    if (activePortfolioFilter === "all") return portfolios;
    return portfolios.filter((p) => p.id === activePortfolioFilter);
  }, [portfolios, activePortfolioFilter]);

  const getAssetsForPortfolio = (portfolioId: string) =>
    assets.filter((a) => a.portfolio_id === portfolioId);

  const computeTotals = useCallback((assetList: AssetRow[]) =>
    assetList.reduce((acc, asset) => {
      const currentPrice = prices[asset.ticker];
      if (currentPrice == null) return { ...acc, totalCost: acc.totalCost + asset.purchase_price * asset.quantity };
      const currentValue = currentPrice * asset.quantity;
      const costBasis = asset.purchase_price * asset.quantity;
      return {
        totalValue: acc.totalValue + currentValue,
        totalCost: acc.totalCost + costBasis,
        totalGainLoss: acc.totalGainLoss + (currentValue - costBasis),
      };
    }, { totalValue: 0, totalCost: 0, totalGainLoss: 0 }),
  [prices]);

  // Totale complessivo di tutti i portafogli visibili
  const allVisibleAssets = useMemo(() =>
    visiblePortfolios.flatMap((p) => getAssetsForPortfolio(p.id)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [visiblePortfolios, assets]);

  const grandTotals = useMemo(() => computeTotals(allVisibleAssets), [computeTotals, allVisibleAssets]);
  const grandTotalGainLossPercent = grandTotals.totalCost > 0
    ? (grandTotals.totalGainLoss / grandTotals.totalCost) * 100 : 0;

  const openAddAssetModal = (preselectedPortfolioId?: string) => {
    setSelectedPortfolioId(preselectedPortfolioId ?? portfolios[0]?.id ?? "");
    setShowNewPortfolioInput(false);
    setModalNewPortfolioName("");
    setIsAddAssetModalOpen(true);
  };

  const ensureDefaultPortfolio = useCallback(async (userId: string): Promise<PortfolioRow[]> => {
    const { data: existing, error: fetchError } = await supabase
      .from("portfolios").select("id, name").eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (fetchError) throw fetchError;
    if (existing && existing.length > 0) {
      setPortfolios(existing as PortfolioRow[]);
      return existing as PortfolioRow[];
    }
    const { data: newP, error: insertError } = await supabase
      .from("portfolios").insert({ user_id: userId, name: "Portafoglio principale" })
      .select("id, name").single<PortfolioRow>();
    if (insertError) throw insertError;
    setPortfolios([newP]);
    return [newP];
  }, [supabase]);

  const loadAssets = useCallback(async (portfolioIds: string[]): Promise<AssetRow[]> => {
    if (portfolioIds.length === 0) { setAssets([]); return []; }
    const { data, error } = await supabase.from("assets")
      .select("id, ticker, name, asset_type, quantity, purchase_price, purchase_date, portfolio_id")
      .in("portfolio_id", portfolioIds).order("created_at", { ascending: false });
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
          const parsedCache = JSON.parse(rawCachedMacro) as { testo?: string; topics?: MacroTopic[]; data?: string; timestamp?: number };
          const isFresh = Date.now() - (parsedCache.timestamp ?? 0) < MACRO_CACHE_TTL_MS;
          if (isFresh && parsedCache.testo && parsedCache.data) {
            setMacroText(parsedCache.testo); setMacroTopics(parsedCache.topics ?? null); setMacroDate(parsedCache.data); return;
          }
        }
      }
      const response = await fetch("/api/macro", { method: "GET", cache: "no-store" });
      const payload = (await response.json()) as MacroPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Errore durante il recupero del contesto macro.");
      setMacroText(payload.testo || ""); setMacroTopics(payload.topics ?? null); setMacroDate(payload.data || "");
      window.localStorage.setItem(MACRO_CACHE_KEY, JSON.stringify({ testo: payload.testo || "", topics: payload.topics ?? null, data: payload.data || "", timestamp: Date.now() }));
    } catch (error) {
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
      const loadedPortfolios = await ensureDefaultPortfolio(user.id);
      const portfolioIds = loadedPortfolios.map((p) => p.id);
      const loadedAssets = await loadAssets(portfolioIds);
      await Promise.all([loadPrices(loadedAssets), loadMacroContext(), loadNews()]);
    } catch (error) {
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (portfolioMenuRef.current && !portfolioMenuRef.current.contains(event.target as Node))
        setIsPortfolioMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreatePortfolio = async (name: string): Promise<PortfolioRow | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("portfolios").insert({ user_id: user.id, name: name.trim() })
      .select("id, name").single<PortfolioRow>();
    if (error) { setErrorMessage(error.message); return null; }
    setPortfolios((prev) => [...prev, data]);
    return data;
  };

  const handleRenamePortfolio = async () => {
    if (!editingPortfolio || !editingPortfolioName.trim()) return;
    setPortfolioActionLoading(true);
    const { error } = await supabase.from("portfolios")
      .update({ name: editingPortfolioName.trim() }).eq("id", editingPortfolio.id);
    if (error) { setErrorMessage(error.message); }
    else {
      setPortfolios((prev) => prev.map((p) => p.id === editingPortfolio.id ? { ...p, name: editingPortfolioName.trim() } : p));
      setEditingPortfolio(null); setEditingPortfolioName("");
    }
    setPortfolioActionLoading(false);
  };

  const handleDeletePortfolio = async (portfolioId: string) => {
    if (portfolios.length <= 1) { setErrorMessage("Devi avere almeno un portafoglio."); return; }
    if (!confirm("Eliminare questo portafoglio e tutti i suoi asset?")) return;
    setPortfolioActionLoading(true);
    const { error } = await supabase.from("portfolios").delete().eq("id", portfolioId);
    if (error) { setErrorMessage(error.message); }
    else {
      setPortfolios((prev) => prev.filter((p) => p.id !== portfolioId));
      setAssets((prev) => prev.filter((a) => a.portfolio_id !== portfolioId));
      if (activePortfolioFilter === portfolioId) setActivePortfolioFilter("all");
    }
    setPortfolioActionLoading(false); setIsPortfolioMenuOpen(false);
  };

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
      setErrorMessage(error instanceof Error ? error.message : "Errore durante l'eliminazione.");
    } finally { setDeletingAssetId(null); }
  };

  const resetAssetForm = () => {
    setAssetSearchQuery(""); setAssetSearchResults([]); setShowSymbolDropdown(false);
    setSymbolSearchMessage(null); setSelectedAsset(null); setInvestedAmount("");
    setPurchaseDate(""); setHistoricalPriceError(null);
    setShowNewPortfolioInput(false); setModalNewPortfolioName("");
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
    const parsedAmount = Number(investedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { setErrorMessage("Inserisci un importo investito valido maggiore di zero."); return; }
    if (!purchaseDate) { setErrorMessage("Seleziona la data di acquisto."); return; }

    setIsFetchingHistoricalPrice(true); setIsSavingAsset(true);
    try {
      // STEP 1: recupera prezzo storico PRIMA di creare il portafoglio
      const priceResponse = await fetch("/api/historical-price", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: selectedAsset.ticker, date: purchaseDate }),
      });
      const pricePayload = (await priceResponse.json()) as { price?: number; date?: string; ticker?: string; approximate?: boolean; error?: string };

      if (!priceResponse.ok || !pricePayload.price) {
        setHistoricalPriceError(pricePayload.error ?? "Prezzo storico non disponibile. Prova il ticker esatto del tuo broker (es. IWDA.AS per iShares MSCI World).");
        return;
      }
      setIsFetchingHistoricalPrice(false);

      if (pricePayload.approximate) {
        setHistoricalPriceError(`Prezzo esatto non trovato per quella data: uso il più vicino disponibile (${pricePayload.date ?? ""}). Puoi procedere comunque.`);
      }

      const historicalPrice = pricePayload.price;
      const quantity = parsedAmount / historicalPrice;

      // STEP 2: solo ora crea il portafoglio se richiesto
      let targetPortfolioId = selectedPortfolioId;
      if (showNewPortfolioInput) {
        if (!modalNewPortfolioName.trim()) { setErrorMessage("Inserisci il nome del nuovo portafoglio."); return; }
        const newP = await handleCreatePortfolio(modalNewPortfolioName);
        if (!newP) return;
        targetPortfolioId = newP.id;
        setSelectedPortfolioId(newP.id);
      }
      if (!targetPortfolioId) { setErrorMessage("Seleziona un portafoglio."); return; }

      // STEP 3: salva l'asset
      const { error: insertError } = await supabase.from("assets").insert({
        portfolio_id: targetPortfolioId,
        ticker: pricePayload.ticker ?? selectedAsset.ticker,
        name: selectedAsset.name,
        asset_type: selectedAsset.asset_type,
        quantity: Math.round(quantity * 10000) / 10000,
        purchase_price: Math.round(historicalPrice * 100) / 100,
        purchase_date: purchaseDate,
      });
      if (insertError) throw insertError;

      const allPortfolioIds = portfolios.map((p) => p.id);
      const updatedAssets = await loadAssets(allPortfolioIds);
      await loadPrices(updatedAssets); await loadNews();
      resetAssetForm(); setIsAddAssetModalOpen(false);
    } catch (error) {
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
      setChatErrorMessage(error instanceof Error ? error.message : "Errore inatteso durante la chat.");
      setChatMessages(nextMessages);
    } finally { setIsSendingChat(false); }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);

  const getAssetMetrics = (asset: AssetRow) => {
    const currentPrice = prices[asset.ticker];
    if (currentPrice == null) return { currentValue: null, gainLoss: null, gainLossPercent: null };
    const currentValue = currentPrice * asset.quantity;
    const costBasis = asset.purchase_price * asset.quantity;
    const gainLoss = currentValue - costBasis;
    const gainLossPercent = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;
    return { currentValue, gainLoss, gainLossPercent };
  };

  // ── PORTFOLIO GROUP CARD ─────────────────────────────────────────
  const PortfolioGroupCard = ({ portfolio }: { portfolio: PortfolioRow }) => {
    const groupAssets = getAssetsForPortfolio(portfolio.id);
    const totals = computeTotals(groupAssets);
    const gainLossPercent = totals.totalCost > 0 ? (totals.totalGainLoss / totals.totalCost) * 100 : 0;
    const isPositive = totals.totalGainLoss >= 0;

    return (
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header gruppo */}
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">{portfolio.name}</span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{groupAssets.length} asset</span>
          </div>
          <button
            type="button"
            onClick={() => openAddAssetModal(portfolio.id)}
            title={`Aggiungi a ${portfolio.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {groupAssets.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
            Nessun asset. Clicca + per aggiungere il primo.
          </div>
        ) : (
          <>
            {/* Tabella desktop */}
            <div className="hidden lg:block">
              <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    <th className="px-4 py-2.5">Ticker</th>
                    <th className="px-4 py-2.5">Nome</th>
                    <th className="px-4 py-2.5">Tipo</th>
                    <th className="px-4 py-2.5">Quantità</th>
                    <th className="px-4 py-2.5">Investito</th>
                    <th className="px-4 py-2.5">Valore attuale</th>
                    <th className="px-4 py-2.5">Gain/Loss</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/60">
                  {groupAssets.map((asset) => {
                    const { currentValue, gainLoss, gainLossPercent } = getAssetMetrics(asset);
                    const pos = (gainLoss ?? 0) >= 0;
                    return (
                      <tr key={asset.id} className="text-sm transition hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                        <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">{asset.ticker}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{asset.name}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">{asset.asset_type}</span>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{asset.quantity.toFixed(4)}</td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{formatCurrency(asset.purchase_price * asset.quantity)}</td>
                        <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">
                          {isPricesLoading ? <span className="text-zinc-300">...</span> : currentValue != null ? formatCurrency(currentValue) : <span className="text-zinc-300">—</span>}
                        </td>
                        <td className={`px-4 py-3 font-medium ${gainLoss != null ? (pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400") : "text-zinc-300"}`}>
                          {isPricesLoading ? <span className="text-zinc-300">...</span> : gainLoss != null ? `${pos ? "+" : ""}${formatCurrency(gainLoss)} (${pos ? "+" : ""}${gainLossPercent!.toFixed(2)}%)` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => void handleDeleteAsset(asset.id)} disabled={deletingAssetId === asset.id}
                            className="rounded px-2 py-1 text-xs text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-950/20">
                            {deletingAssetId === asset.id ? "..." : "Elimina"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Card mobile */}
            <div className="divide-y divide-zinc-100 lg:hidden dark:divide-zinc-800">
              {groupAssets.map((asset) => {
                const { currentValue, gainLoss, gainLossPercent } = getAssetMetrics(asset);
                const pos = (gainLoss ?? 0) >= 0;
                return (
                  <div key={asset.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{asset.ticker}</span>
                        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-400 dark:bg-zinc-800">{asset.asset_type}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-500">{asset.name}</p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        {isPricesLoading ? "..." : currentValue != null ? formatCurrency(currentValue) : "—"}
                      </p>
                      <p className={`text-xs font-semibold ${gainLoss != null ? (pos ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400") : "text-zinc-300"}`}>
                        {isPricesLoading ? "..." : gainLoss != null ? `${pos ? "+" : ""}${gainLossPercent!.toFixed(1)}%` : "—"}
                      </p>
                    </div>
                    <button type="button" onClick={() => void handleDeleteAsset(asset.id)} disabled={deletingAssetId === asset.id}
                      className="ml-3 rounded px-2 py-1 text-xs text-red-400 transition hover:bg-red-50 disabled:opacity-40">
                      {deletingAssetId === asset.id ? "..." : "✕"}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Footer totale gruppo */}
            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/30">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Totale {portfolio.name}</span>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Investito {formatCurrency(totals.totalCost)}</span>
                {totals.totalValue > 0 && (
                  <>
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">{formatCurrency(totals.totalValue)}</span>
                    <span className={`font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                      {isPositive ? "+" : ""}{gainLossPercent.toFixed(2)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── SEZIONE PORTAFOGLIO ──────────────────────────────────────────
  const PortfolioSection = (
    <div className="space-y-6">
      {/* Contesto di mercato */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Contesto di mercato</h2>
          <button type="button" onClick={() => void loadMacroContext({ forceRefresh: true })} disabled={isMacroLoading}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {isMacroLoading ? "Aggiornamento..." : "Aggiorna"}
          </button>
        </div>
        {macroErrorMessage ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{macroErrorMessage}</p>
        ) : isMacroLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800">
                <div className="mb-2 h-3 w-1/3 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            ))}
          </div>
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
          <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">{macroText || "Nessun contesto disponibile al momento."}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          {macroDate && <p className="text-xs text-zinc-400 dark:text-zinc-500" suppressHydrationWarning>Aggiornato il {macroDate}</p>}
          <p className="text-xs italic text-zinc-400 dark:text-zinc-500">Generato da AI · solo a scopo informativo</p>
        </div>
      </div>

      {/* Header portafoglio */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Il mio portafoglio</h1>
          <button
            type="button"
            onClick={() => openAddAssetModal(activePortfolioFilter !== "all" ? activePortfolioFilter : undefined)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Aggiungi
          </button>
        </div>

        {/* Pill filtro */}
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

          {/* Gestione portafogli */}
          <div className="relative" ref={portfolioMenuRef}>
            <button type="button" onClick={() => setIsPortfolioMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 transition hover:border-zinc-300 hover:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
              title="Gestisci portafogli">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {isPortfolioMenuOpen && (
              <div className="absolute right-0 top-10 z-30 w-64 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">I tuoi portafogli</p>
                <div className="space-y-1">
                  {portfolios.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      {editingPortfolio?.id === p.id ? (
                        <>
                          <input value={editingPortfolioName} onChange={(e) => setEditingPortfolioName(e.target.value)}
                            className="flex-1 rounded border border-zinc-300 px-2 py-0.5 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                          <button type="button" onClick={() => void handleRenamePortfolio()} disabled={portfolioActionLoading} className="text-xs text-blue-600 hover:text-blue-500">✓</button>
                          <button type="button" onClick={() => { setEditingPortfolio(null); setEditingPortfolioName(""); }} className="text-xs text-zinc-400 hover:text-zinc-600">✕</button>
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
                      <input value={newPortfolioName} onChange={(e) => setNewPortfolioName(e.target.value)}
                        placeholder="Nome portafoglio" autoFocus
                        className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                      <button type="button" onClick={async () => { setPortfolioActionLoading(true); await handleCreatePortfolio(newPortfolioName); setNewPortfolioName(""); setIsCreatingPortfolio(false); setPortfolioActionLoading(false); }} disabled={portfolioActionLoading} className="text-xs font-medium text-blue-600 hover:text-blue-500">✓</button>
                      <button type="button" onClick={() => { setIsCreatingPortfolio(false); setNewPortfolioName(""); }} className="text-xs text-zinc-400 hover:text-zinc-600">✕</button>
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

        {errorMessage && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{errorMessage}</p>
        )}

        {isPageLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 h-4 w-1/4 rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {visiblePortfolios.map((portfolio) => (
              <PortfolioGroupCard key={portfolio.id} portfolio={portfolio} />
            ))}

            {/* Totale complessivo — solo se più di un portafoglio visibile e ci sono asset */}
            {visiblePortfolios.length > 1 && allVisibleAssets.length > 0 && (
              <div className="flex items-center justify-between rounded-xl border-2 border-blue-100 bg-blue-50 px-5 py-4 dark:border-blue-900/30 dark:bg-blue-950/20">
                <span className="text-sm font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Totale complessivo</span>
                <div className="flex items-center gap-5 text-sm">
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Investito</p>
                    <p className="font-bold text-zinc-800 dark:text-zinc-100">{formatCurrency(grandTotals.totalCost)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Valore</p>
                    <p className="font-bold text-zinc-800 dark:text-zinc-100">{isPricesLoading ? "..." : formatCurrency(grandTotals.totalValue)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Gain/Loss</p>
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
    </div>
  );

  // ── SEZIONE NOTIZIE ──────────────────────────────────────────────
  const NewsSection = (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Notizie per te</h2>
        <button type="button" onClick={() => void loadNews()} disabled={isNewsLoading}
          className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {isNewsLoading ? "Aggiornamento..." : "Aggiorna"}
        </button>
      </div>
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
      <p className="mt-4 text-xs italic text-zinc-400 dark:text-zinc-500">
        Notizie e riassunti generati da AI · solo a scopo informativo · non costituiscono consulenza finanziaria
      </p>
    </div>
  );

  // ── SEZIONE CHAT ─────────────────────────────────────────────────
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

  // ── MODAL AGGIUNGI ASSET ─────────────────────────────────────────
  const AddAssetModal = isAddAssetModalOpen ? (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/50 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-zinc-200 bg-white p-6 shadow-xl sm:rounded-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Aggiungi asset</h2>
          <button type="button" onClick={() => { setIsAddAssetModalOpen(false); resetAssetForm(); }}
            className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">✕</button>
        </div>
        <form onSubmit={handleAddAsset} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cerca ticker o azienda</label>
            <div className="relative" ref={symbolSearchContainerRef}>
              <input type="text" value={assetSearchQuery}
                onChange={(e) => {
                  const v = e.target.value; setAssetSearchQuery(v); setShowSymbolDropdown(true);
                  if (!selectedAsset || v !== `${selectedAsset.name} (${selectedAsset.ticker})`) setSelectedAsset(null);
                  if (v.trim().length < 3) { setAssetSearchResults([]); setIsSearchingSymbol(false); setSymbolSearchMessage(v.trim().length === 0 ? null : "Inserisci almeno 3 caratteri per cercare."); }
                }}
                required className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="Es. Apple o AAPL" />
              {showSymbolDropdown && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                  {isSearchingSymbol ? <p className="px-3 py-2 text-sm text-zinc-500">Ricerca in corso...</p>
                    : assetSearchResults.length > 0 ? assetSearchResults.map((result) => (
                      <button key={`${result.ticker}-${result.market}`} type="button"
                        onClick={() => { setSelectedAsset(result); setAssetSearchQuery(`${result.name} (${result.ticker})`); setShowSymbolDropdown(false); }}
                        className="block w-full border-b border-zinc-100 px-3 py-2 text-left transition last:border-b-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{result.ticker}</p>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">{result.asset_type}</span>
                        </div>
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
                <select value={selectedPortfolioId} onChange={(e) => setSelectedPortfolioId(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950">
                  {portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewPortfolioInput(true)}
                  className="whitespace-nowrap rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-300">
                  + Nuovo
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input type="text" value={modalNewPortfolioName} onChange={(e) => setModalNewPortfolioName(e.target.value)}
                  placeholder="Es. ETF Europa" autoFocus
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950" />
                <button type="button" onClick={() => { setShowNewPortfolioInput(false); setModalNewPortfolioName(""); }}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700">✕</button>
              </div>
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
            <button type="submit" disabled={isSavingAsset || isFetchingHistoricalPrice || !selectedAsset || !investedAmount || !purchaseDate}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70">
              {isFetchingHistoricalPrice ? "Recupero prezzo..." : isSavingAsset ? "Salvataggio..." : "Salva asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <p className="text-base font-semibold tracking-tight text-blue-700 dark:text-blue-400">Folio Companion</p>
          <div className="flex items-center gap-2">
            <a href="/checkin" className="hidden rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 sm:inline-flex">Check-in</a>
            <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:inline">{userEmail}</span>
            <button type="button" onClick={handleLogout} disabled={isLoggingOut}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {isLoggingOut ? "..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile */}
      <div className="lg:hidden">
        <div className="px-4 py-6 pb-24">
          {mobileTab === "portfolio" && PortfolioSection}
          {mobileTab === "news" && NewsSection}
          {mobileTab === "chat" && <div style={{ height: "calc(100vh - 10rem)" }}>{ChatSection}</div>}
        </div>
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="flex">
            {(["portfolio", "news", "chat"] as MobileTab[]).map((tab) => {
              const icons: Record<MobileTab, React.ReactNode> = {
                portfolio: <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />,
                news: <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />,
                chat: <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />,
              };
              const labels: Record<MobileTab, string> = { portfolio: "Portafoglio", news: "Notizie", chat: "Compagno" };
              return (
                <button key={tab} type="button" onClick={() => setMobileTab(tab)}
                  className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition ${mobileTab === tab ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>{icons[tab]}</svg>
                  {labels[tab]}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Desktop */}
      <section className="mx-auto hidden w-full max-w-6xl px-4 py-8 sm:px-6 lg:block lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:items-start">
          <div className="space-y-8 lg:col-span-3">{PortfolioSection}{NewsSection}</div>
          <aside className="lg:col-span-2 lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)]">{ChatSection}</aside>
        </div>
      </section>

      {AddAssetModal}
    </main>
  );
}
