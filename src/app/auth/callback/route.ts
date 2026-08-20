import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=auth-callback", request.url),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const safeError = "Invalid or expired sign-in link";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(safeError)}`, request.url),
    );
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
