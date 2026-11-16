import { NextResponse } from "next/server";
import { z } from "zod";

import { tailoredCvSchema } from "@/lib/ai/fit";
import { applyKeywords, parseStoredKeywords } from "@/lib/ats/cv";
import { cvFileName, renderCvPdf } from "@/lib/cv/pdf";
import { createClient } from "@/lib/supabase/server";
import { profileFromRow } from "@/lib/validation/profile";

/** GET /fit/[id]/cv — download the tailored CV as an ATS-friendly PDF. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const [{ data: analysis }, { data: profileRow }] = await Promise.all([
    supabase
      .from("fit_analyses")
      .select("id, job_title, language, cv, keywords, cover_letter")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, headline, email, phone, location, bio, skills, links, languages, experiences, education, certifications")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!analysis) return new NextResponse("Not found", { status: 404 });
  // Low fits have no CV until the candidate asks for one on the analysis page.
  if (!analysis.cover_letter.trim()) {
    return new NextResponse("Generate the CV from the analysis page first.", { status: 409 });
  }

  const cv = tailoredCvSchema.safeParse(analysis.cv);
  if (!cv.success) return new NextResponse("This CV could not be generated.", { status: 422 });

  const profile = profileFromRow(profileRow);
  const pdf = await renderCvPdf({
    cv: applyKeywords(cv.data, parseStoredKeywords(analysis.keywords)),
    contact: {
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      links: profile.links,
    },
    language: analysis.language,
    jobTitle: analysis.job_title,
  });

  const fileName = cvFileName(profile.fullName, analysis.job_title);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
