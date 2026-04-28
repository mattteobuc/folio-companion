import { createBrowserClient } from "@supabase/ssr";

function normalizeSupabaseUrl(url: string) {
  return url.replace(/\/rest\/v1\/?$/, "");
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Variabili Supabase mancanti: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY sono obbligatorie.",
    );
  }

  // Supabase Auth richiede l'URL base progetto (senza /rest/v1).
  return createBrowserClient(normalizeSupabaseUrl(supabaseUrl.trim()), supabaseAnonKey.trim());
}
