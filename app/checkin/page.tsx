"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const MOODS = [
  { value: 1, emoji: "😰" },
  { value: 2, emoji: "😟" },
  { value: 3, emoji: "😐" },
  { value: 4, emoji: "🙂" },
  { value: 5, emoji: "😊" },
] as const;

type CheckinRow = {
  id: string;
  mood: number | null;
  notes: string | null;
  created_at: string;
  context_type: string | null;
  asset_id: string | null;
  portfolio_id: string | null;
};

type SupabaseLikeError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

function deriveNoteTitle(note: string) {
  const firstLine = note.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "Nota senza titolo";
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

function normalizeSupabaseError(error: unknown): SupabaseLikeError {
  if (error instanceof Error) {
    return { message: error.message };
  }
  if (error && typeof error === "object") {
    const candidate = error as SupabaseLikeError;
    return {
      message: candidate.message ?? "Errore inatteso.",
      code: candidate.code,
      details: candidate.details,
      hint: candidate.hint,
    };
  }
  return { message: "Errore inatteso." };
}

function CheckinPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const draft = (searchParams.get("draft") ?? "").trim().slice(0, 1200);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [notes, setNotes] = useState(draft.slice(0, 1200));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [deletingCheckinId, setDeletingCheckinId] = useState<string | null>(null);
  const [editingCheckinId, setEditingCheckinId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isNotesDirty, setIsNotesDirty] = useState(false);

  const ticker = searchParams.get("ticker")?.trim() ?? "";
  const source = searchParams.get("source")?.trim() ?? "";
  const contextType = searchParams.get("contextType")?.trim() || "free_note";
  const assetId = searchParams.get("assetId")?.trim() || null;
  const portfolioId = searchParams.get("portfolioId")?.trim() || null;

  useEffect(() => {
    // Prefill affidabile: aggiorna il draft quando cambia la querystring
    // solo se l'utente non sta modificando una nota esistente e non ha testo manuale non salvato.
    if (editingCheckinId !== null) return;
    if (isNotesDirty && notes.trim().length > 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(draft);
    setIsNotesDirty(false);
  }, [draft, editingCheckinId, isNotesDirty, notes]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Utente non autenticato.");

      const fullResult = await supabase
        .from("checkins")
        .select("id, mood, notes, created_at, context_type, asset_id, portfolio_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);
      if (!fullResult.error) {
        setCheckins((fullResult.data ?? []) as CheckinRow[]);
        return;
      }

      const normalizedError = normalizeSupabaseError(fullResult.error);
      const isSchemaMismatch = normalizedError.code === "42703" || /column|context_type|asset_id|portfolio_id/i.test(normalizedError.message ?? "");
      if (!isSchemaMismatch) throw fullResult.error;

      // Fallback compat mode per ambienti con schema checkins legacy.
      const legacyResult = await supabase
        .from("checkins")
        .select("id, mood, notes, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);
      if (legacyResult.error) throw legacyResult.error;
      const legacyRows = ((legacyResult.data ?? []) as Array<Pick<CheckinRow, "id" | "mood" | "notes" | "created_at">>)
        .map((row) => ({
          ...row,
          context_type: null,
          asset_id: null,
          portfolio_id: null,
        }));
      setCheckins(legacyRows);
    } catch (error) {
      const normalizedError = normalizeSupabaseError(error);
      console.error("Errore caricamento diario:", {
        message: normalizedError.message,
        code: normalizedError.code,
        details: normalizedError.details,
        hint: normalizedError.hint,
      });
      setErrorMessage(normalizedError.message ?? "Errore inatteso durante il caricamento del diario.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      void loadHistory();
    });
    return () => window.cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      const payload = {
        mood: selectedMood,
        notes: notes.trim() ? notes.trim() : null,
        asset_id: assetId,
        portfolio_id: portfolioId,
        context_type: contextType,
      };
      const { error } = editingCheckinId
        ? await supabase.from("checkins").update(payload).eq("id", editingCheckinId).eq("user_id", user.id)
        : await supabase.from("checkins").insert({
          user_id: user.id,
          ...payload,
        });

      if (error) {
        throw error;
      }

      setNotes(editingCheckinId ? notes : "");
      setSelectedMood(editingCheckinId ? selectedMood : null);
      setSuccessMessage(editingCheckinId ? "Nota aggiornata correttamente." : "Nota diario salvata. Ottimo lavoro di consapevolezza.");
      if (!editingCheckinId) {
        setEditingCheckinId(null);
      }
      await loadHistory();
    } catch (error) {
      console.error("Errore salvataggio diario:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Errore inatteso durante il salvataggio.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCheckin = async (checkinId: string) => {
    if (deletingCheckinId) return;
    const isConfirmed = window.confirm("Vuoi eliminare questa nota dal taccuino?");
    if (!isConfirmed) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setDeletingCheckinId(checkinId);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Utente non autenticato.");

      const { error } = await supabase
        .from("checkins")
        .delete()
        .eq("id", checkinId)
        .eq("user_id", user.id);

      if (error) throw error;

      setCheckins((prev) => prev.filter((entry) => entry.id !== checkinId));
      if (editingCheckinId === checkinId) {
        setEditingCheckinId(null);
        setSelectedMood(null);
        setNotes(draft.slice(0, 1200));
        setIsNotesDirty(false);
      }
      setSuccessMessage("Nota eliminata correttamente.");
    } catch (error) {
      const normalizedError = normalizeSupabaseError(error);
      setErrorMessage(normalizedError.message ?? "Errore inatteso durante l'eliminazione della nota.");
    } finally {
      setDeletingCheckinId(null);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Taccuino</h2>
            <button
              type="button"
              onClick={() => {
                setEditingCheckinId(null);
                setSelectedMood(null);
                setNotes(draft.slice(0, 1200));
                setIsNotesDirty(false);
                setSuccessMessage(null);
                setErrorMessage(null);
              }}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 transition hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Nuova nota
            </button>
          </div>
          <div className="max-h-[68vh] space-y-2 overflow-y-auto pr-1">
            {isLoadingHistory ? (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                Caricamento note...
              </p>
            ) : checkins.length === 0 ? (
              <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                Ancora nessuna nota. Inizia dal blocco a destra con un pensiero rapido.
              </p>
            ) : (
              checkins.map((entry) => {
                const noteText = (entry.notes ?? "").trim();
                const title = deriveNoteTitle(noteText || "Nota senza contenuto");
                const preview = noteText.length > 90 ? `${noteText.slice(0, 87)}...` : noteText;
                const isActive = editingCheckinId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`w-full rounded-xl border px-3 py-2 transition ${
                      isActive
                        ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
                        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCheckinId(entry.id);
                        setSelectedMood(entry.mood ?? null);
                        setNotes(noteText.slice(0, 1200));
                        setIsNotesDirty(false);
                        setSuccessMessage(null);
                        setErrorMessage(null);
                      }}
                      className="w-full text-left"
                    >
                      <p className="text-xs text-zinc-400" suppressHydrationWarning>
                        {new Date(entry.created_at).toLocaleDateString("it-IT")}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-100">{title}</p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{preview || "Nota senza testo"}</p>
                    </button>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleDeleteCheckin(entry.id)}
                        disabled={deletingCheckinId === entry.id}
                        aria-label="Elimina nota"
                        title="Elimina nota"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                      >
                        {deletingCheckinId === entry.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 7.5h15M9 7.5v-.75A1.75 1.75 0 0110.75 5h2.5A1.75 1.75 0 0115 6.75v.75m-7.5 0v10.25A1.75 1.75 0 009.25 19.5h5.5a1.75 1.75 0 001.75-1.75V7.5M10 11v5m4-5v5" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex text-sm font-medium text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Torna alla dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Diario del tuo percorso</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Un blocco note per fissare emozioni, contesto e prossimi passi. Il Mate usera queste note per risposte piu umane e utili.
        </p>
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          <p className="font-medium">Suggerimento rapido</p>
          <p className="mt-1 text-xs leading-5">
            Parti da: cosa e successo, come ti ha fatto sentire, cosa vuoi osservare nei prossimi giorni.
          </p>
        </div>
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
              Foglio nota
            </label>
            <textarea
              id="checkin-notes"
              rows={10}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setIsNotesDirty(true);
              }}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-mono text-sm leading-6 outline-none ring-blue-200 transition focus:border-blue-500 focus:ring-4 dark:border-zinc-700 dark:bg-zinc-950"
              placeholder={ticker
                ? `Esempio: ho acquistato ${ticker} con convinzione, ma oggi mi sento...`
                : "Esempio:\n- Oggi mi sento...\n- Il trigger e stato...\n- Nei prossimi giorni voglio monitorare..."}
            />
            <p className="mt-1 text-xs text-zinc-400">{notes.length}/1200 caratteri</p>
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
            {isSaving ? "Salvataggio..." : editingCheckinId ? "Aggiorna nota" : "Salva nel diario"}
          </button>
        </form>
      </section>
      </section>
    </main>
  );
}

export default function CheckinPage() {
  return (
    <Suspense fallback={<div className="px-6 py-10 text-sm text-zinc-500">Carico il diario...</div>}>
      <CheckinPageContent />
    </Suspense>
  );
}
