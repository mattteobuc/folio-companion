export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="border-b border-zinc-200/70 bg-gradient-to-b from-white via-zinc-50 to-zinc-100/40 dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/50">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
          <div className="space-y-5">
            <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
              Folio Mate
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Il tuo mate per capire il portafoglio, senza rumore.
            </h1>
            <p className="text-base leading-7 text-zinc-600 dark:text-zinc-300 sm:text-lg">
              Importa da screenshot o CSV, rivedi i dati e conferma solo quando sei pronto.
            </p>
            <p className="rounded-lg border border-zinc-200 bg-white/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
              Nessun consiglio di acquisto o vendita. Solo contesto, metodo e disciplina.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/signup"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Prova Folio Mate
              </a>
              <a
                href="#demo-import"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                Guarda l&apos;import in azione
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Anteprima esperienza</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-semibold">Segnali del Mate</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Notizie e macro contestualizzate ai tuoi titoli.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-semibold">Preview import</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Conferma manuale, warning duplicati, controllo totale.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-semibold">Diario personale</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Tieni il metodo coerente anche nei momenti tesi.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="demo-import" className="border-b border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8">
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Importa da screenshot, senza caos.</h2>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300 sm:text-base">
              Il Mate estrae i dati, ti mostra una preview modificabile e segnala i duplicati prima di salvare.
            </p>
            <div className="space-y-3">
              {[
                { step: "1", title: "Carica screenshot o CSV", detail: "Upload immediato dal broker." },
                { step: "2", title: "Rivedi l'anteprima", detail: "Modifica righe e controlla warning." },
                { step: "3", title: "Conferma importazione", detail: "Salvataggio solo dopo il tuo ok." },
              ].map((item) => (
                <article key={item.step} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Step {item.step}</p>
                  <h3 className="mt-1 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.detail}</p>
                </article>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {["Nessun dato inventato", "Conferma manuale", "Deduplica intelligente"].map((badge) => (
                <span key={badge} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                  {badge}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Prima</p>
              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                Screenshot broker con titoli, quote, prezzi e sezioni non uniformi.
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Dopo</p>
              <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs dark:bg-zinc-900">
                  <span>Bond Governativi 1-3 Anni</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">OK</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs dark:bg-zinc-900">
                  <span>Bond EMU Inflation Linked</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Duplicato</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs dark:bg-zinc-900">
                  <span>Corporate Green Bond</span>
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Da rivedere</span>
                </div>
                <button type="button" className="mt-1 inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">
                  Conferma importazione
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Quando il rumore aumenta, la lucidita cala</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              pain: "Notizie frammentate, senza gerarchia.",
              solution: "Folio Mate filtra e collega le notizie ai titoli che possiedi.",
            },
            {
              pain: "Decisioni prese di impulso nei momenti tesi.",
              solution: "Segnali conversazionali per ragionare prima di reagire.",
            },
            {
              pain: "Poca continuita nel tuo processo mentale.",
              solution: "Diario personale per tenere traccia di emozioni e motivazioni.",
            },
          ].map((item) => (
            <article key={item.pain} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Problema</p>
              <p className="mt-1 text-sm">{item.pain}</p>
              <p className="mt-3 text-sm font-semibold text-blue-700 dark:text-blue-300">Risposta Folio Mate</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{item.solution}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="come-funziona" className="border-y border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Come funziona</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                step: "Step 1",
                title: "Collega il portafoglio",
                description: "Raccogli asset e posizioni in modo ordinato.",
              },
              {
                step: "Step 2",
                title: "Ricevi contesto rilevante",
                description: "Segnali e notizie in linguaggio semplice.",
              },
              {
                step: "Step 3",
                title: "Rifletti con Diario + Mate",
                description: "Mantieni disciplina emotiva nel tempo.",
              },
            ].map((item) => (
              <article key={item.title} className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">{item.step}</p>
                <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Funzioni chiave</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[
            {
              title: "Notizia → conversazione",
              description: "Passi dalla notizia al confronto in un click.",
              tag: "Benefit: comprensione immediata",
            },
            {
              title: "Segnali del Mate",
              description: "Spunti contestuali, non alert da trading.",
              tag: "Benefit: meno reattivita",
            },
            {
              title: "Diario personale",
              description: "Traccia motivazioni e stato emotivo.",
              tag: "Benefit: disciplina emotiva",
            },
            {
              title: "Analisi portafoglio dedicata",
              description: "Monitoraggio ordinato in una vista separata.",
              tag: "Benefit: chiarezza operativa",
            },
          ].map((feature) => (
            <article key={feature.title} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{feature.description}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">{feature.tag}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-100/60 py-14 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="mx-auto w-full max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Trasparenza prima di tutto</h2>
          <p className="mt-4 text-sm leading-7 text-zinc-600 dark:text-zinc-300 sm:text-base">
            Folio Mate non sostituisce le tue decisioni e non fornisce consigli di acquisto o vendita.
            Ti aiuta a leggere il contesto e mantenere coerenza con il tuo metodo.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Inizia oggi con piu lucidita</h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">
            Costruisci un processo decisionale piu coerente con il tuo piano, un passo alla volta.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Prova Folio Mate
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Ho gia un account
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
