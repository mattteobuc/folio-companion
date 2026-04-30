import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type PurchasePlanGoalType = "accumulo" | "bilanciamento" | "riduzione_volatilita" | "altro";
type PurchasePlanCadence = "settimanale" | "quindicinale" | "mensile";

type CreatePurchasePlanPayload = {
  title?: string;
  ticker?: string | null;
  goal_type?: PurchasePlanGoalType;
  cadence?: PurchasePlanCadence;
  amount?: number;
  start_date?: string;
  monthly_budget_limit?: number | null;
  risk_note?: string | null;
  portfolio_id?: string | null;
  asset_id?: string | null;
};

const GOAL_TYPES: PurchasePlanGoalType[] = ["accumulo", "bilanciamento", "riduzione_volatilita", "altro"];
const CADENCES: PurchasePlanCadence[] = ["settimanale", "quindicinale", "mensile"];

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function normalizeTicker(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNote(value: string | null | undefined): string | null {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });

    const { data, error } = await supabase
      .from("purchase_plans")
      .select("id, user_id, portfolio_id, asset_id, title, ticker, goal_type, cadence, amount, start_date, next_run_date, monthly_budget_limit, status, risk_note, created_at, updated_at")
      .eq("user_id", user.id)
      .order("status", { ascending: true })
      .order("next_run_date", { ascending: true });

    if (error) {
      const errorCode = (error as { code?: string }).code ?? "";
      const errorMessage = (error as { message?: string }).message ?? "";
      const isSchemaMissing = errorCode === "42P01" || errorMessage.toLowerCase().includes("purchase_plans");
      if (isSchemaMissing) {
        return NextResponse.json({ data: [], warning: "schema_missing" });
      }
      return NextResponse.json({ error: "Non sono riuscito a caricare i piani di acquisto." }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error("Errore GET /api/purchase-plans:", error);
    return NextResponse.json({ error: "Errore inatteso durante il caricamento dei piani." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });

    const body = (await request.json()) as CreatePurchasePlanPayload;

    const title = (body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Il titolo del piano è obbligatorio." }, { status: 400 });

    const goalType = body.goal_type;
    if (!goalType || !GOAL_TYPES.includes(goalType)) {
      return NextResponse.json({ error: "Tipo obiettivo non valido." }, { status: 400 });
    }

    const cadence = body.cadence;
    if (!cadence || !CADENCES.includes(cadence)) {
      return NextResponse.json({ error: "Cadenza non valida." }, { status: 400 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Importo non valido. Inserisci un valore maggiore di zero." }, { status: 400 });
    }

    const startDate = (body.start_date ?? "").trim();
    if (!isValidDate(startDate)) {
      return NextResponse.json({ error: "Data di inizio non valida." }, { status: 400 });
    }

    const monthlyBudgetLimit =
      body.monthly_budget_limit == null || body.monthly_budget_limit === 0
        ? null
        : Number(body.monthly_budget_limit);
    if (monthlyBudgetLimit != null && (!Number.isFinite(monthlyBudgetLimit) || monthlyBudgetLimit <= 0)) {
      return NextResponse.json({ error: "Il limite mensile deve essere maggiore di zero." }, { status: 400 });
    }

    const payload = {
      user_id: user.id,
      portfolio_id: body.portfolio_id ?? null,
      asset_id: body.asset_id ?? null,
      title,
      ticker: normalizeTicker(body.ticker),
      goal_type: goalType,
      cadence,
      amount: Number(amount.toFixed(2)),
      start_date: startDate,
      next_run_date: startDate,
      monthly_budget_limit: monthlyBudgetLimit == null ? null : Number(monthlyBudgetLimit.toFixed(2)),
      status: "active",
      risk_note: normalizeOptionalNote(body.risk_note),
    };

    const { data, error } = await supabase
      .from("purchase_plans")
      .insert(payload)
      .select("id, user_id, portfolio_id, asset_id, title, ticker, goal_type, cadence, amount, start_date, next_run_date, monthly_budget_limit, status, risk_note, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Non sono riuscito a creare il piano. Riprova tra poco." }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Errore POST /api/purchase-plans:", error);
    return NextResponse.json({ error: "Errore inatteso durante la creazione del piano." }, { status: 500 });
  }
}
