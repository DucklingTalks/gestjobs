import { cookies } from "next/headers";

import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Server-side Supabase client bound to the current request cookies.
 *
 * Use inside Server Components, Server Actions, and Route Handlers. Always
 * call this inside the request scope (do not module-cache the returned
 * client) so it reflects the active user's session.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as CookieOptions),
            );
          } catch {
            // Server Components cannot set cookies. The middleware
            // handles session refresh, so this is safe to swallow here.
          }
        },
      },
    },
  );
}