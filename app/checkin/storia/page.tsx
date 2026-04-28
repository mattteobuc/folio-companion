"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type CheckinRow = {
  id: string;
  mood: number;
  notes: string | null;
  created_at: string;
};

const MOOD_EMOJI: Record<number, string> = {
  1: "😰",
  2: "😟",
  3: "😐",
  4: "🙂",
  5: "😊",
};

export default function CheckinHistoryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      void (async () => {
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

          const { data, error } = await supabase
            .from("checkins")
            .select("id, mood, notes, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (error) {
            throw error;
          }

          setCheckins((data ?? []) as CheckinRow[]);
        } catch (error) {
          console.error("Errore caricamento storico check-in:", error);
          setErrorMessage(
            error instanceof Error ? error.message : "Errore inatteso durante il caricamento.",
          );
        } finally {
          setIsLoading(false);
        }
      })();
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Storico check-in</h1>

        {errorMessage ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 space-y-3">
          {isLoading ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              Caricamento check-in...
            </div>
          ) : checkins.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              Nessun check-in disponibile.
            </div>
          ) : (
            checkins.map((entry) => (
              <article
                key={entry.id}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {new Date(entry.created_at).toLocaleDateString("it-IT")}
                  </p>
                  <span className="text-2xl">{MOOD_EMOJI[entry.mood] ?? "🙂"}</span>
                </div>
                {entry.notes ? (
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {entry.notes}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>

        <Link
          href="/checkin"
          className="mt-6 inline-flex text-sm font-medium text-blue-600 transition hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Torna al check-in settimanale
        </Link>
      </section>
    </main>
  );
}
