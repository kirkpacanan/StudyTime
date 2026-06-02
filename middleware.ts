import {
  resolveSupabasePublicKey,
  resolveSupabaseUrl,
} from "@/lib/supabase/resolve-env";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side auth gate for the authenticated app routes. Only enforces when
 * Supabase is configured (cookie-based session); in local/demo mode the client
 * AppShell handles redirects, so middleware stays out of the way.
 */
export async function middleware(request: NextRequest) {
  const url = resolveSupabaseUrl();
  const key = resolveSupabasePublicKey();

  // Not configured (demo mode) or secret key misuse: skip server enforcement.
  if (!url || !key || key.startsWith("sb_secret_")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/session/:path*",
    "/feed/:path*",
    "/friends/:path*",
    "/leaderboard/:path*",
    "/reports/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/u/:path*",
  ],
};
