import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type PurchasePlanStatus = "active" | "paused" | "archived";
type PurchasePlanCadence = "settimanale" | "quindicinale" | "mensile";

type UpdatePurchasePlanPayload = {
  status?: PurchasePlanStatus;
  amount?: number;
  cadence?: PurchasePlanCadence;
  risk_note?: string | null;
  next_run_date?: string;
};

const STATUSES: PurchasePlanStatus[] = ["active", "paused", "archived"];
const CADENCES: PurchasePlanCadence[] = ["settimanale", "quindicinale", "mensile"];

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Id piano non valido." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });

    const body = (await request.json()) as UpdatePurchasePlanPayload;
    const updates: Record<string, unknown> = {};

    if (body.status != null) {
      if (!STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Stato non valido." }, { status: 400 });
      }
      updates.status = body.status;
    }

    if (body.amount != null) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "Importo non valido. Inserisci un valore maggiore di zero." }, { status: 400 });
      }
      updates.amount = Number(amount.toFixed(2));
    }

    if (body.cadence != null) {
      if (!CADENCES.includes(body.cadence)) {
        return NextResponse.json({ error: "Cadenza non valida." }, { status: 400 });
      }
      updates.cadence = body.cadence;
    }

    if (body.risk_note !== undefined) {
      const normalized = (body.risk_note ?? "").trim();
      updates.risk_note = normalized.length > 0 ? normalized : null;
    }

    if (body.next_run_date != null) {
      const nextRunDate = body.next_run_date.trim();
      if (!isValidDate(nextRunDate)) {
        return NextResponse.json({ error: "Prossima data non valida." }, { status: 400 });
      }
      updates.next_run_date = nextRunDate;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nessun campo valido da aggiornare." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("purchase_plans")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, user_id, portfolio_id, asset_id, title, ticker, goal_type, cadence, amount, start_date, next_run_date, monthly_budget_limit, status, risk_note, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Non sono riuscito ad aggiornare il piano." }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Errore PATCH /api/purchase-plans/[id]:", error);
    return NextResponse.json({ error: "Errore inatteso durante l'aggiornamento del piano." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Id piano non valido." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) return NextResponse.json({ error: userError.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });

    const { data, error } = await supabase
      .from("purchase_plans")
      .update({ status: "archived" })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, user_id, portfolio_id, asset_id, title, ticker, goal_type, cadence, amount, start_date, next_run_date, monthly_budget_limit, status, risk_note, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Non sono riuscito ad archiviare il piano." }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Errore DELETE /api/purchase-plans/[id]:", error);
    return NextResponse.json({ error: "Errore inatteso durante l'archiviazione del piano." }, { status: 500 });
  }
}
