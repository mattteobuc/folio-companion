export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold tracking-[0.18em] text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200 sm:text-base">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            FOLIO MATE
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 sm:px-4 sm:text-sm"
            >
              Login
            </a>
            <a
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:px-4 sm:text-sm"
            >
              Sign up
            </a>
          </div>
        </div>
      </header>
      <section className="border-b border-zinc-200/70 bg-gradient-to-b from-white via-zinc-50 to-zinc-100/40 dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
              Folio Mate
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
              Importa il portafoglio in 60 secondi. Poi decidi con piu lucidita.
            </h1>
            <p className="mt-3 text-base text-zinc-600 dark:text-zinc-300 sm:text-lg">
              Screenshot o CSV, revisione manuale e deduplica. Il Mate ti accompagna nelle scelte senza fare buy/sell.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <a href="/signup" className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                Prova gratis
              </a>
              <a href="#import-reale" className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                Guarda import reale
              </a>
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Non e una trading app. Controllo utente su ogni conferma.
            </p>
          </div>
        </div>
      </section>

      <section id="import-reale" className="border-b border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Qui sta il valore: import guidato e pulito.</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">
              Carichi, rivedi, confermi. Nessun dato inventato, duplicati segnalati, decisione finale sempre tua.
            </p>
          </div>
          <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
              <div className="space-y-3">
                {[
                  { step: "Step 1", title: "Upload screenshot o CSV", detail: "Import rapido dal broker." },
                  { step: "Step 2", title: "Preview editabile", detail: "Puoi correggere ticker, quantita e prezzo." },
                  { step: "Step 3", title: "Warning automatici", detail: "Duplicati e righe incerte evidenziati." },
                  { step: "Step 4", title: "Conferma finale", detail: "Salva solo dopo il tuo ok." },
                ].map((item) => (
                  <article key={item.step} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">{item.step}</p>
                    <h3 className="mt-1 text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{item.detail}</p>
                  </article>
                ))}
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Preview import</p>
                <div className="mt-3 space-y-2">
                  <div className="import-row-anim flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                    <span>iShares Core S&amp;P 500</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">OK</span>
                  </div>
                  <div className="import-row-anim-delayed flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                    <span>Invesco Nasdaq 100</span>
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">Possibile duplicato</span>
                  </div>
                  <div className="import-row-anim-late flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                    <span>ETF Europa Small Cap</span>
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Da rivedere</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Nessun dato inventato", "Deduplica automatica", "Conferma manuale"].map((badge) => (
                    <span key={badge} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                      {badge}
                    </span>
                  ))}
                </div>
                <button type="button" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
                  Conferma importazione
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Il Mate non ti dice cosa comprare: ti aiuta a decidere meglio.</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">Analizza il contesto del tuo portafoglio e ti propone alternative ragionate.</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="space-y-3">
              <div className="chat-input-anim rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                Ho aumentato S&P 500 e Nasdaq: rischio troppa esposizione USA?
              </div>
              <div className="chat-user-anim ml-auto max-w-[19rem] rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-xs text-white">
                Ho aumentato S&amp;P 500 e Nasdaq: rischio troppa esposizione USA?
              </div>
              <div className="chat-ai-anim max-w-[20rem] rounded-2xl rounded-bl-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                Si, stai sommando lo stesso fattore di rischio: mega-cap USA.
                <span className="insight-highlight mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Insight: concentrazione su un unico driver
                </span>
              </div>
              <div className="chat-tag-anim rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-medium text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
                Vuoi valutare un riequilibrio graduale o impostare una soglia di attenzione?
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Prima confusione. Dopo processo chiaro.</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">Meno reattivita, piu coerenza con il tuo piano.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              { title: "Prima", value: "Dati sparsi su app diverse" },
              { title: "Dopo", value: "Portafoglio importato e pulito" },
              { title: "Con Mate", value: "Segnali contestuali prima di decidere" },
            ].map((item) => (
              <article key={item.title} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{item.title}</p>
                <p className="mt-2 text-sm font-medium">{item.value}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-100/60 py-10 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-2 px-4 sm:px-6 lg:px-8">
          {["Non e robo-advisor", "Nessun consiglio buy/sell", "Controllo utente su ogni conferma"].map((badge) => (
            <span key={badge} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {badge}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Inizia oggi con un processo piu lucido.</h2>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Prova gratis
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Login
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}
