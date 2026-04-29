import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type ScreenshotCandidate = {
  sourceFile: string;
  name: string;
  ticker: string | null;
  quantity: number | null;
  purchase_price: number | null;
  purchase_date: string | null;
  needs_review: boolean;
  reason: string;
};

function guessNameFromFileName(fileName: string): string {
  const noExt = fileName.replace(/\.[^/.]+$/, "");
  const sanitized = noExt.replace(/[_-]+/g, " ").trim();
  return sanitized.length > 0 ? sanitized : "Titolo da confermare";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Utente non autenticato." }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ rows: [] as ScreenshotCandidate[] });
    }

    // MVP: placeholder strutturato. Non inventa dati non leggibili dalle immagini.
    const rows: ScreenshotCandidate[] = files.map((file) => ({
      sourceFile: file.name,
      name: guessNameFromFileName(file.name),
      ticker: null,
      quantity: null,
      purchase_price: null,
      purchase_date: null,
      needs_review: true,
      reason: "Dati da confermare manualmente dal Mate (ticker/quantita/prezzo non estratti in modo affidabile).",
    }));

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("Errore route /api/import-screenshot:", error);
    return NextResponse.json({ error: "Errore durante l'analisi degli screenshot." }, { status: 500 });
  }
}
