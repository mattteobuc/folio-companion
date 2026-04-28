"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

const ASSET_TYPES = ["Azione", "ETF", "Obbligazione", "Crypto", "Altro"] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSavingAsset, setIsSavingAsset] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ticker, setTicker] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<(typeof ASSET_TYPES)[number]>("Azione");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");

  const supabase = useMemo(() => createClient(), []);

  // Garantisce che l'utente abbia sempre un portfolio di default e restituisce il suo id.
  const ensureDefaultPortfolio = useCallback(async (userId: string) => {
    const { data: existingPortfolio, error: portfolioFetchError } = await supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<PortfolioRow>();

    if (portfolioFetchError) {
      throw portfolioFetchError;
    }

    if (existingPortfolio?.id) {
      return existingPortfolio.id;
    }

    const { data: newPortfolio, error: portfolioInsertError } = await supabase
      .from("portfolios")
      .insert({
        user_id: userId,
        name: "Portafoglio principale",
      })
      .select("id")
      .single<PortfolioRow>();

    if (portfolioInsertError) {
      throw portfolioInsertError;
    }

    return newPortfolio.id;
  }, [supabase]);

  // Carica utente, crea portfolio di default se manca, poi carica gli asset.
  const loadAssets = useCallback(
    async (currentPortfolioId: string) => {
      const { data, error } = await supabase
        .from("assets")
        .select("id, ticker, name, asset_type, quantity, purchase_price, purchase_date")
        .eq("portfolio_id", currentPortfolioId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setAssets((data ?? []) as AssetRow[]);
    },
    [supabase],
  );

  const loadDashboardData = useCallback(async () => {
    setErrorMessage(null);
    setIsPageLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.push("/login");
        router.refresh();
        return;
      }

      setUserEmail(user.email ?? "");

      const currentPortfolioId = await ensureDefaultPortfolio(user.id);

      setPortfolioId(currentPortfolioId);
      await loadAssets(currentPortfolioId);
    } catch (error) {
      console.error("Errore caricamento dashboard:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Errore inatteso durante il caricamento.",
      );
    } finally {
      setIsPageLoading(false);
    }
  }, [ensureDefaultPortfolio, loadAssets, router, supabase]);

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      void loadDashboardData();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [loadDashboardData]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      router.push("/login");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Errore inatteso durante il logout.",
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  const resetAssetForm = () => {
    setTicker("");
    setAssetName("");
    setAssetType("Azione");
    setQuantity("");
    setPurchasePrice("");
    setPurchaseDate("");
  };

  const handleAddAsset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!portfolioId) {
      setErrorMessage("Portfolio non disponibile. Riprova tra qualche secondo.");
      return;
    }

    const parsedQuantity = Number(quantity);
    const parsedPurchasePrice = Number(purchasePrice);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      setErrorMessage("La quantita deve essere un numero valido maggiore o uguale a 0.");
      return;
    }

    if (!Number.isFinite(parsedPurchasePrice) || parsedPurchasePrice < 0) {
      setErrorMessage("Il prezzo di carico deve essere un numero valido maggiore o uguale a 0.");
      return;
    }

    setIsSavingAsset(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.push("/login");
        router.refresh();
        return;
      }

      const effectivePortfolioId = portfolioId ?? (await ensureDefaultPortfolio(user.id));
      setPortfolioId(effectivePortfolioId);

      const { error } = await supabase.from("assets").insert({
        portfolio_id: effectivePortfolioId,
        ticker: ticker.trim().toUpperCase(),
        name: assetName.trim(),
        asset_type: assetType,
        quantity: parsedQuantity,
        purchase_price: parsedPurchasePrice,
        purchase_date: purchaseDate || null,
      });

      if (error) {
        throw error;
      }

      await loadAssets(effectivePortfolioId);
      resetAssetForm();
      setIsAddAssetModalOpen(false);
    } catch (error) {
      console.error("Errore salvataggio asset:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Errore inatteso durante il salvataggio asset.",
      );
    } finally {
      setIsSavingAsset(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-lg font-semibold tracking-tight text-blue-700 dark:text-blue-400">
            Folio Companion
          </p>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-zinc-600 dark:text-zinc-300 sm:inline">
              {userEmail || "Utente"}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
            >
              {isLoggingOut ? "Logout..." : "Logout"}
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Il mio portafoglio</h1>
          <button
            type="button"
            onClick={() => setIsAddAssetModalOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Aggiungi asset
          </button>
        </div>

        {errorMessage ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {errorMessage}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-100/70 dark:bg-zinc-800/50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Quantita</th>
                  <th className="px-4 py-3">Prezzo di carico</th>
                  <th className="px-4 py-3">Valore attuale</th>
                  <th className="px-4 py-3">Gain/Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {isPageLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500">
                      Caricamento dati...
                    </td>
                  </tr>
                ) : assets.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-500">
                      Nessun asset presente. Aggiungi il primo asset per iniziare.
                    </td>
                  </tr>
                ) : (
                  assets.map((asset) => (
                    <tr key={asset.id} className="text-sm">
                      <td className="px-4 py-3 font-semibold">{asset.ticker}</td>
                      <td className="px-4 py-3">{asset.name}</td>
                      <td className="px-4 py-3">{asset.asset_type}</td>
                      <td className="px-4 py-3">{asset.quantity}</td>
                      <td className="px-4 py-3">
                        {new Intl.NumberFormat("it-IT", {
                          style: "currency",
                          currency: "EUR",
                        }).format(asset.purchase_price)}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">—</td>
                      <td className="px-4 py-3 text-zinc-500">—</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {isAddAssetModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Aggiungi asset</h2>
              <button
                type="button"
                onClick={() => {
                  setIsAddAssetModalOpen(false);
                  resetAssetForm();
                }}
                className="rounded-md p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                aria-label="Chiudi modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddAsset} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Ticker
                  </label>
                  <input
                    type="text"
                    value={ticker}
                    onChange={(event) => setTicker(event.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="AAPL"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(event) => setAssetName(event.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="Apple Inc."
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tipo asset
                </label>
                <select
                  value={assetType}
                  onChange={(event) => setAssetType(event.target.value as (typeof ASSET_TYPES)[number])}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  {ASSET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Quantita
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="10"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Prezzo di carico
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={purchasePrice}
                    onChange={(event) => setPurchasePrice(event.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950"
                    placeholder="120.50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Data acquisto
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddAssetModalOpen(false);
                    resetAssetForm();
                  }}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSavingAsset}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingAsset ? "Salvataggio..." : "Salva asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
