import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function normalizeSupabaseUrl(url: string) {
  return url.replace(/\/rest\/v1\/?$/, "");
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient(normalizeSupabaseUrl(supabaseUrl.trim()), supabaseAnonKey.trim(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  let user: { id: string } | null = null;
  try {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) {
      const msg = (authError.message ?? "").toLowerCase();
      const invalidRefresh =
        msg.includes("invalid refresh token")
        || msg.includes("refresh token not found")
        || msg.includes("jwt");
      if (invalidRefresh) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("next", request.nextUrl.pathname);
        const redirectResponse = NextResponse.redirect(loginUrl);
        const cookieNamesToClear = request.cookies.getAll().map((cookie) => cookie.name).filter((name) =>
          name.startsWith("sb-"),
        );
        cookieNamesToClear.forEach((name) => {
          redirectResponse.cookies.set(name, "", { maxAge: 0, path: "/" });
        });
        console.warn("Supabase sessione non valida in middleware, cleanup cookie auth.", {
          pathname: request.nextUrl.pathname,
        });
        return redirectResponse;
      }
      console.warn("Errore auth middleware (redirect login):", { message: authError.message });
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    user = authUser as { id: string } | null;
  } catch (error) {
    console.warn("Eccezione auth middleware (redirect login):", { error });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
