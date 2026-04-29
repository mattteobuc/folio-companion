"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type PortfolioRow = { id: string };
type AssetRow = { ticker: string; quantity: number };
type PortfolioHistoryPoint = { date: string; value: number };
type AnalysisTab = "performance" | "allocazione" | "rischio";

export default function AnalisiPortafoglioPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [chartRangeDays, setChartRangeDays] = useState<30 | 90 | 365>(90);
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("performance");

  useEffect(() => {
    const loadAssets = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          router.push("/login");
          router.refresh();
          return;
        }
        const { data: portfolios, error: portfoliosError } = await supabase
          .from("portfolios")
          .select("id")
          .eq("user_id", user.id);
        if (portfoliosError) throw portfoliosError;
        const portfolioIds = (portfolios ?? []).map((portfolio) => (portfolio as PortfolioRow).id);
        if (portfolioIds.length === 0) {
          setAssets([]);
          return;
        }
        const { data: assetsData, error: assetsError } = await supabase
          .from("assets")
          .select("ticker, quantity")
          .in("portfolio_id", portfolioIds);
        if (assetsError) throw assetsError;
        setAssets((assetsData ?? []) as AssetRow[]);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Errore caricamento analisi.");
      } finally {
        setIsLoading(false);
      }
    };
    void loadAssets();
  }, [router, supabase]);

  useEffect(() => {
    if (activeTab !== "performance") return;
    if (assets.length === 0) return;
    const loadPortfolioHistory = async () => {
      setIsChartLoading(true);
      setErrorMessage(null);
      try {
        const uniqueTickers = Array.from(new Set(assets.map((asset) => asset.ticker).filter(Boolean)));
        const response = await fetch("/api/portfolio-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: uniqueTickers, days: chartRangeDays }),
        });
        const payload = (await response.json()) as {
          series?: Record<string, Array<{ date: string; close: number }>>;
          error?: string;
        };
        if (!response.ok || !payload.series) throw new Error(payload.error ?? "Errore caricamento storico.");
        const totalsByDate = new Map<string, number>();
        Object.keys(payload.series).forEach((ticker) => {
          const totalQuantity = assets
            .filter((asset) => asset.ticker === ticker)
            .reduce((acc, asset) => acc + asset.quantity, 0);
          payload.series?.[ticker].forEach((point) => {
            totalsByDate.set(point.date, (totalsByDate.get(point.date) ?? 0) + point.close * totalQuantity);
          });
        });
        const points = Array.from(totalsByDate.entries())
          .map(([date, value]) => ({ date, value }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setPortfolioHistory(points);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Errore storico portafoglio.");
        setPortfolioHistory([]);
      } finally {
        setIsChartLoading(false);
      }
    };
    void loadPortfolioHistory();
  }, [activeTab, assets, chartRangeDays]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);

  const firstValue = portfolioHistory[0]?.value ?? null;
  const lastValue = portfolioHistory[portfolioHistory.length - 1]?.value ?? null;
  const variation = firstValue != null && lastValue != null ? lastValue - firstValue : null;
  const variationPercent = firstValue != null && lastValue != null && firstValue > 0
    ? (variation! / firstValue) * 100
    : null;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Analisi portafoglio</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Vista avanzata dedicata al monitoraggio del tuo portafoglio.</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          >
            Torna alla dashboard
          </Link>
        </div>

        <div className="inline-flex w-full flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {([
            { id: "performance", label: "Performance" },
            { id: "allocazione", label: "Allocazione" },
            { id: "rischio", label: "Rischio" },
          ] as Array<{ id: AnalysisTab; label: string }>).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === tab.id ? "bg-blue-600 text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {errorMessage && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
        )}

        {activeTab === "performance" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs uppercase tracking-wider text-zinc-400">Valore attuale</p>
                <p className="mt-1 text-lg font-semibold">{lastValue != null ? formatCurrency(lastValue) : "—"}</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs uppercase tracking-wider text-zinc-400">Variazione periodo</p>
                <p className={`mt-1 text-lg font-semibold ${variation != null ? (variation >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400") : ""}`}>
                  {variation != null ? `${variation >= 0 ? "+" : ""}${formatCurrency(variation)}` : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs uppercase tracking-wider text-zinc-400">Range attivo</p>
                <p className="mt-1 text-lg font-semibold">{chartRangeDays} giorni</p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight">Andamento portafoglio</h2>
                <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-800/60">
                  {([30, 90, 365] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setChartRangeDays(days)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition ${chartRangeDays === days ? "bg-blue-600 text-white" : "text-zinc-600 hover:text-blue-600 dark:text-zinc-300"}`}
                    >
                      {days}g
                    </button>
                  ))}
                </div>
              </div>
              {isLoading || isChartLoading ? (
                <div className="h-56 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              ) : portfolioHistory.length < 2 ? (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
                  Dati insufficienti per mostrare il grafico in questo intervallo.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="h-56 w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/40">
                    <svg viewBox="0 0 100 100" className="h-full w-full">
                      {(() => {
                        const values = portfolioHistory.map((point) => point.value);
                        const minValue = Math.min(...values);
                        const maxValue = Math.max(...values);
                        const valueSpan = Math.max(maxValue - minValue, 1);
                        const points = portfolioHistory
                          .map((point, index) => {
                            const x = (index / Math.max(portfolioHistory.length - 1, 1)) * 100;
                            const normalized = (point.value - minValue) / valueSpan;
                            const y = 95 - normalized * 90;
                            return `${x.toFixed(2)},${y.toFixed(2)}`;
                          })
                          .join(" ");
                        return (
                          <polyline
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="text-blue-600 dark:text-blue-400"
                            points={points}
                          />
                        );
                      })()}
                    </svg>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{new Date(portfolioHistory[0].date).toLocaleDateString("it-IT")}</span>
                    <span className={`font-semibold ${variationPercent != null ? (variationPercent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400") : "text-zinc-700 dark:text-zinc-200"}`}>
                      {variationPercent != null ? `${variationPercent >= 0 ? "+" : ""}${variationPercent.toFixed(2)}%` : "—"}
                    </span>
                    <span>{new Date(portfolioHistory[portfolioHistory.length - 1].date).toLocaleDateString("it-IT")}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "allocazione" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold tracking-tight">Allocazione</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Modulo in arrivo: distribuzione per asset class, ticker e portafoglio.
            </p>
          </div>
        )}

        {activeTab === "rischio" && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold tracking-tight">Rischio</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Modulo in arrivo: volatilità, drawdown e segnali di concentrazione.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
