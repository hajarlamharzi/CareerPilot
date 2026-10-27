import { NextResponse } from "next/server";

import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Sign out.
 *
 * POST only. A `GET` sign-out would be a (mild) nuisance vulnerability: any page
 * able to embed an image or a link could log the user out. A POST with no body is
 * still cross-site-forgeable in theory, but the only consequence is a logout, and
 * requiring POST keeps it out of prefetching, link scanners and e-mail clients.
 *
 * `scope: "local"` clears this browser's session. `global` would revoke every
 * device's refresh token, which is the right answer for "log me out everywhere"
 * — a deliberate, separate action, not the default one.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();

  if (supabase) {
    await supabase.auth.signOut({ scope: "local" });
  }

  // Always a redirect, even in local demo mode or on failure: the caller's intent
  // is to end up signed out, and the cookie is cleared either way for a real
  // account. Anything else would leave them on a page they asked to leave.
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
