import Link from "next/link";

export default function PricingPage() {
  const plans = [
    {
      id: "free",
      title: "Piano Free",
      subtitle: "Inizia con le basi essenziali",
      price: "0",
      priceNote: "EUR / mese",
      badge: "Il tuo punto di partenza",
      badgeClassName:
        "border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300",
      points: [
        "Onboarding conversazionale e dashboard base",
        "Notizie contestuali essenziali per il tuo portafoglio",
        "Chat con Mate per lettura del contesto",
        "Diario e check-in personali",
      ],
      ctaLabel: "Scegli Free",
      href: "/signup?plan=free",
      highlighted: false,
    },
    {
      id: "pro",
      title: "Piano PRO",
      subtitle: "Più profondità e strumenti avanzati",
      price: "19",
      priceNote: "EUR / mese · Coming Soon",
      badge: "Coming Soon",
      badgeClassName:
        "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200",
      points: [
        "Approfondimenti premium e priorità contenuti",
        "Personalizzazione avanzata del companion",
        "Automazioni future e strumenti evoluti",
        "Funzionalità avanzate collegate ai piani",
      ],
      ctaLabel: "Scegli PRO (Coming Soon)",
      href: "/signup?plan=pro",
      highlighted: true,
    },
  ] as const;

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="border-b border-zinc-200/70 bg-gradient-to-b from-white via-zinc-50 to-zinc-100/40 dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
              Folio Mate
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              Scegli il piano con cui iniziare
            </h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300 sm:text-base">
              Inizia con Free oggi. PRO è in arrivo con funzionalità avanzate.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-5 md:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`relative overflow-hidden rounded-3xl border p-6 shadow-sm ${
                plan.highlighted
                  ? "border-blue-300 bg-gradient-to-b from-blue-50 to-white dark:border-blue-900/40 dark:from-blue-950/30 dark:to-zinc-900"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              }`}
            >
              {plan.highlighted && (
                <span className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-bl-[2.5rem] bg-blue-200/40 dark:bg-blue-900/30" />
              )}
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight">{plan.title}</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{plan.subtitle}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${plan.badgeClassName}`}>
                  {plan.badge}
                </span>
                <div className="mt-5 flex items-end gap-2">
                  <p className="text-4xl font-semibold leading-none tracking-tight">{plan.price}</p>
                  <p className="pb-1 text-xs text-zinc-500 dark:text-zinc-400">{plan.priceNote}</p>
                </div>
                <ul className="mt-6 space-y-2.5 text-sm text-zinc-700 dark:text-zinc-200">
                  {plan.points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`mt-7 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    plan.highlighted
                      ? "bg-blue-600 text-white hover:bg-blue-500"
                      : "border border-zinc-300 bg-white text-zinc-800 hover:border-blue-300 hover:text-blue-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-blue-700 dark:hover:text-blue-300"
                  }`}
                >
                  {plan.ctaLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Per ora entrambi i percorsi portano alla registrazione. PRO è in arrivo.
        </p>
      </section>
    </main>
  );
}
