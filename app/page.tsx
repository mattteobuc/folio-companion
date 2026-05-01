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
              Il mercato non dorme. Non puoi stare sveglio con lui.
            </h1>
            <p className="mt-3 text-base text-zinc-600 dark:text-zinc-300 sm:text-lg">
              Folio Mate legge le notizie per te, le collega ai titoli che hai in portafoglio e ti spiega cosa sta succedendo — in italiano, senza gergo, senza consigli di acquisto.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <a href="/signup" className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                Inizia gratis
              </a>
              <a href="#come-funziona" className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                Scopri come funziona
              </a>
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Folio Mate
            </p>
          </div>
        </div>
      </section>

      <section id="come-funziona" className="border-b border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tre minuti al giorno per investire con più testa</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">
              Hai un portafoglio. Hai anche un lavoro, una famiglia, una vita.
              Non puoi passare la giornata su Bloomberg.
              Ma quando i mercati si muovono, vuoi capire se devi preoccuparti — o no.
            </p>
          </div>
          <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
              <div className="space-y-3">
                {[
                  { step: "Step 1", title: "Carica il tuo portafoglio", detail: "Aggiungi i titoli che hai. Azioni, ETF, crypto. Folio Mate capisce subito cosa hai e cosa ti riguarda." },
                  { step: "Step 2", title: "Leggi solo quello che conta", detail: "Ogni mattina trovi notizie filtrate per i tuoi asset, già spiegate in due righe. Niente rumore, solo contesto." },
                  { step: "Step 3", title: "Ragiona con il tuo compagno", detail: "Hai una domanda? Hai sentito qualcosa che ti preoccupa? Apri la chat. Folio Mate conosce il tuo portafoglio e risponde in modo specifico per te — non risposte generiche." },
                ].map((item) => (
                  <article key={item.step} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">{item.step}</p>
                    <h3 className="mt-1 text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{item.detail}</p>
                  </article>
                ))}
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Il problema non è la mancanza di informazioni. È il rumore.</p>
                <div className="mt-3 space-y-2">
                  <div className="import-row-anim flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                    <span>Senza: Leggi 10 notizie e non sai quali ti riguardano</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Con: Solo le notizie che impattano i tuoi titoli, già spiegate</span>
                  </div>
                  <div className="import-row-anim-delayed flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                    <span>Senza: Vendi in preda al panico, poi te ne penti</span>
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">Con: Capisci il contesto prima di reagire</span>
                  </div>
                  <div className="import-row-anim-late flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                    <span>Senza: Ogni volta che riapri l&apos;app ricomincia da zero</span>
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Con: Il compagno ricorda le tue conversazioni e la tua storia</span>
                  </div>
                  <div className="import-row-anim-late flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
                    <span>Senza: Nessuno con cui ragionare senza sentirti giudicato</span>
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Con: Un compagno disponibile 24/7, empatico e competente</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Insight personalizzati", "Compagno con memoria", "Notizia → conversazione in un click"].map((badge) => (
                    <span key={badge} className="rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                      {badge}
                    </span>
                  ))}
                </div>
                <button type="button" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
                  Scopri come funziona
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Già usato da investitori autonomi come te</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">Finalmente una lettura semplice e utile, senza rumore.</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="space-y-3">
              <div className="chat-input-anim rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                &quot;Finalmente capisco perché un titolo si muove, senza dover cercare su Google per mezz&apos;ora.&quot;
              </div>
              <div className="chat-user-anim ml-auto max-w-[19rem] rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-xs text-white">
                &quot;Ho smesso di controllare i prezzi ogni due ore. Aspetto il riassunto del mattino e basta.&quot;
              </div>
              <div className="chat-ai-anim max-w-[20rem] rounded-2xl rounded-bl-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
                &quot;La prima volta che ho visto Rocket Lab tra i suggerimenti del compagno ho pensato fosse una cazzata. Oggi è il mio titolo migliore.&quot;
                <span className="insight-highlight mt-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Marco, 38 anni, Milano
                </span>
              </div>
              <div className="chat-tag-anim rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-medium text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
                Sara, 44 anni, Roma · Luca, 41 anni, Torino
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tutto quello che ti serve. Niente di quello che non ti serve.</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">Funzioni concrete, pensate per investitori autonomi.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              { title: "Dentro in 30 secondi", value: "Carica uno screenshot dal tuo broker e Mate riconosce tutti i tuoi titoli automaticamente. Zero inserimenti manuali, zero errori." },
              { title: "Pensa prima di agire", value: "Hai un'idea di investimento? Ragionaci con Mate prima di muoverti. Salva il tuo pensiero nel diario e rileggilo quando il mercato ti mette pressione — spesso è il momento più utile." },
              { title: "Solo quello che ti riguarda", value: "Ogni mattina Mate seleziona le notizie che riguardano i tuoi titoli e te le spiega in due righe. Niente Bloomberg, niente ansia da FOMO." },
              { title: "📊 Portafogli multipli", value: "Hai Fineco, Degiro e un conto crypto? Gestiscili tutti separati o guarda il totale aggregato in un colpo solo." },
              { title: "🌍 Contesto macro ogni giorno", value: "BCE, Fed, geopolitica. Cosa sta succedendo nel mondo e perché potrebbe interessarti — in tre frasi, ogni mattina." },
              { title: "🎯 Piani di investimento con Mate", value: "Dimmi quanto vuoi investire, in quanto tempo e con che profilo di rischio. Mate ti aiuta a costruire un piano coerente, spiegando ogni scelta — senza dirti cosa comprare." },
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
          {["Folio Mate non ti dice cosa fare. Ti aiuta a capire.", "Nessun consiglio di acquisto o vendita. Mai.", "Le decisioni restano tue — più informate e meno emotive."].map((badge) => (
            <span key={badge} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {badge}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Inizia oggi. È gratis.</h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">
            Nessuna carta di credito. Nessun impegno. Solo più chiarezza.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Crea il tuo account
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              Ho già un account — accedi
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}
