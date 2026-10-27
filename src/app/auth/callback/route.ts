import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Auth callback.
 *
 * Supabase confirmation and recovery e-mails point here with a one-time `code`.
 * The exchange has to happen on the server so the session cookies are written by
 * the response as HttpOnly — doing it in the browser would put tokens somewhere
 * JavaScript can read them.
 */
export const dynamic = "force-dynamic";

/** Same-origin relative paths only; anything else falls back to the dashboard. */
function safeNext(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createServerSupabase();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Supabase also redirects here with `error` / `error_description` when a link
  // is expired or already used; both paths get the same actionable page.
  return NextResponse.redirect(`${origin}/login?error=link`);
}
