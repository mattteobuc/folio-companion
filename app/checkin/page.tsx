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
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      });

      if (error) {
        throw error;
      }

      setNotes("");
      setSelectedMood(null);
      setSuccessMessage("Check-in salvato! Ci vediamo la prossima settimana.");
    } catch (error) {
      console.error("Errore salvataggio check-in:", error);
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
        <h1 className="text-2xl font-semibold tracking-tight">Come ti senti questa settimana?</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div>
            <p className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Seleziona il tuo stato d&apos;animo
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
              placeholder="Scrivi se vuoi un breve commento su questa settimana..."
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

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving ? "Salvataggio..." : "Salva check-in"}
          </button>
        </form>

        <Link
          href="/checkin/storia"
          className="mt-6 inline-flex text-sm font-medium text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Vedi i tuoi check-in precedenti
        </Link>
      </section>
    </main>
  );
}
