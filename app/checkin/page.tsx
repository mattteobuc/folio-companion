"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const MOODS = [
  { value: 1, emoji: "😰" },
  { value: 2, emoji: "😟" },
  { value: 3, emoji: "😐" },
  { value: 4, emoji: "🙂" },
  { value: 5, emoji: "😊" },
] as const;

export default function CheckinPage() {
  const supabase = useMemo(() => createClient(), []);
  const [urlParams] = useState(() =>
    typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search),
  );
  const draft = urlParams.get("draft")?.trim() ?? "";
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [notes, setNotes] = useState(draft.slice(0, 1200));
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const ticker = urlParams.get("ticker")?.trim() ?? "";
  const source = urlParams.get("source")?.trim() ?? "";
  const contextType = urlParams.get("contextType")?.trim() || "free_note";
  const assetId = urlParams.get("assetId")?.trim() || null;
  const portfolioId = urlParams.get("portfolioId")?.trim() || null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedMood) {
      setErrorMessage("Seleziona uno stato d'animo prima di salvare.");
      return;
    }

    setIsSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("Utente non autenticato.");
      }

      const { error } = await supabase.from("checkins").insert({
        user_id: user.id,
        mood: selectedMood,
        notes: notes.trim() ? notes.trim() : null,
        asset_id: assetId,
        portfolio_id: portfolioId,
        context_type: contextType,
      });

      if (error) {
        throw error;
      }

      setNotes("");
      setSelectedMood(null);
      setSuccessMessage("Nota diario salvata. Ottimo lavoro di consapevolezza.");
    } catch (error) {
      console.error("Errore salvataggio diario:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Errore inatteso durante il salvataggio.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex text-sm font-medium text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Torna alla dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Diario del tuo percorso</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Scrivi come ti senti e cosa stai vivendo: queste note aiutano il Mate a darti insight piu empatici e contestuali.
        </p>
        {(ticker || source === "portfolio" || source === "chat") && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
            {ticker
              ? `Stai aggiungendo una nota legata a ${ticker}.`
              : source === "chat"
                ? "Stai salvando una riflessione nata in chat con il Mate."
                : "Stai aggiungendo una nota contestuale dal portafoglio."}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div>
            <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Come ti senti in questo momento?
            </p>
            <div className="flex flex-wrap gap-3">
              {MOODS.map((mood) => {
                const isSelected = selectedMood === mood.value;
                return (
                  <button
                    key={mood.value}
                    type="button"
                    onClick={() => setSelectedMood(mood.value)}
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-full border text-2xl transition ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100 dark:bg-blue-950/50 dark:ring-blue-900/60"
                        : "border-zinc-300 bg-white hover:border-blue-300 dark:border-zinc-700 dark:bg-zinc-950"
                    }`}
                    aria-label={`Mood ${mood.value}`}
                  >
                    {mood.emoji}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="checkin-notes"
              className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Note personali
            </label>
            <textarea
              id="checkin-notes"
              rows={5}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder={ticker
                ? `Esempio: ho acquistato ${ticker} con convinzione, ma oggi mi sento...`
                : "Esempio: oggi mi sento piu tranquillo rispetto al mercato perche..."}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              {successMessage}
            </p>
          ) : null}

          {successMessage ? (
            <Link
              href="/dashboard"
              className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-blue-500 dark:hover:text-blue-400"
            >
              Torna alla dashboard
            </Link>
          ) : null}

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Salvataggio..." : "Salva nel diario"}
          </button>
        </form>

        <Link
          href="/checkin/storia"
          className="mt-6 inline-flex text-sm font-medium text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Vedi le note diario precedenti
        </Link>
      </section>
    </main>
  );
}
