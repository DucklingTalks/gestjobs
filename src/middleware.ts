import { type NextRequest, NextResponse } from "next/server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Refreshes the Supabase auth session on every request that matches the
 * matcher below. Required so Server Components see an up-to-date user.
 *
 * The middleware cannot import the generated Database type until PR 6
 * runs `supabase gen types typescript`, so the client is intentionally
 * untyped here. Application code that reads/writes the database uses the
 * typed clients in src/lib/supabase/client.ts and server.ts.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as CookieOptions);
          });
        },
      },
    },
  );

  // Refresh the session — this triggers Supabase to set new cookies if the
  // access token is near expiry. We deliberately do not branch on the
  // result; failures here mean the user is signed out, which is safe.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and the favicon. Everything else
    // (pages, route handlers, server actions) needs a fresh session.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};