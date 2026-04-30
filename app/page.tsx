export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="border-b border-zinc-200/70 bg-gradient-to-b from-white via-zinc-50 to-zinc-100/40 dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/50">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
              Folio Mate
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Il tuo mate nelle decisioni di portafoglio.
            </h1>
            <p className="text-base leading-7 text-zinc-600 dark:text-zinc-300 sm:text-lg">
              Folio Mate ti affianca ogni giorno con segnali contestualizzati, notizie spiegate in modo semplice e un diario personale per restare coerente con il tuo metodo.
            </p>
            <p className="rounded-lg border border-zinc-200 bg-white/80 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
              Nessun consiglio di acquisto o vendita. Solo contesto, lucidita e disciplina emotiva.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href="/signup"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Prova Folio Mate
              </a>
              <a
                href="#come-funziona"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                Guarda come funziona
              </a>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/60 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Anteprima esperienza</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-semibold">Segnali del Mate</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">AAPL: notizia da monitorare con impatto sul tuo portafoglio.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-semibold">Parlane col Mate</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Ricevi spiegazioni semplici, scenari concreti e tono empatico.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-semibold">Diario personale</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Annota emozioni e riflessioni per decisioni piu coerenti nel tempo.</p>
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
                description: "Raccogli asset e posizioni in una vista chiara e sempre aggiornabile.",
              },
              {
                step: "Step 2",
                title: "Ricevi contesto rilevante",
                description: "Segnali e notizie contestualizzate ai tuoi titoli, in linguaggio semplice.",
              },
              {
                step: "Step 3",
                title: "Rifletti con Diario + Mate",
                description: "Annota emozioni e confrontati con Mate per restare allineato al tuo metodo.",
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
              description: "Da ogni notizia puoi aprire subito il confronto con Mate in un click.",
              tag: "Benefit: comprensione immediata",
            },
            {
              title: "Segnali del Mate",
              description: "Non alert da trading, ma spunti contestuali per leggere meglio il momento.",
              tag: "Benefit: meno reattivita",
            },
            {
              title: "Diario personale",
              description: "Colleziona riflessioni emotive e motivazioni per migliorare continuita decisionale.",
              tag: "Benefit: disciplina emotiva",
            },
            {
              title: "Analisi portafoglio dedicata",
              description: "Una vista separata per monitorare performance e approfondire con ordine.",
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
            Ti aiuta a leggere il contesto, gestire meglio la componente emotiva e prendere decisioni piu consapevoli.
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
