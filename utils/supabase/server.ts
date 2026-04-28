import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function normalizeSupabaseUrl(url: string) {
  return url.replace(/\/rest\/v1\/?$/, "");
}

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Variabili Supabase mancanti: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY sono obbligatorie.",
    );
  }

  return createServerClient(
    normalizeSupabaseUrl(supabaseUrl.trim()),
    supabaseAnonKey.trim(),
    {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // In alcuni contesti server (es. Server Component) la scrittura cookie non è consentita.
        }
      },
    },
  });
}
