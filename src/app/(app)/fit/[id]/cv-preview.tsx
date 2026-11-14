import type { TailoredCv } from "@/lib/ai/fit";
import { cvLabels, formatCvRange, joinParts } from "@/lib/cv/format";

export type CvContact = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  links: { label: string; url: string }[];
};

/** On-screen rendering of the tailored CV, mirroring the PDF layout. */
export function CvPreview({ cv, contact, language }: { cv: TailoredCv; contact: CvContact; language: string }) {
  const labels = cvLabels(language);
  const contactLine = [contact.location, contact.email, contact.phone, ...contact.links.map((l) => l.url)]
    .filter(Boolean)
    .join(" · ");

  const heading = (text: string) => (
    <h3 className="mt-5 border-b border-slate-300 pb-1 text-xs font-bold uppercase tracking-wider text-slate-800">
      {text}
    </h3>
  );

  return (
    <article lang={language} className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-800 sm:p-8">
      <header>
        <h2 className="text-xl font-bold text-slate-900">{contact.fullName || "Your name"}</h2>
        {cv.headline ? <p className="mt-0.5 font-medium text-slate-700">{cv.headline}</p> : null}
        {contactLine ? <p className="mt-1 break-words text-xs text-slate-600">{contactLine}</p> : null}
      </header>

      {cv.summary ? (
        <>
          {heading(labels.summary)}
          <p className="mt-2 leading-relaxed">{cv.summary}</p>
        </>
      ) : null}

      {cv.experiences.length ? (
        <>
          {heading(labels.experience)}
          <div className="mt-2 space-y-4">
            {cv.experiences.map((job, index) => (
              <section key={index}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold text-slate-900">{joinParts([job.title, job.company], " — ")}</p>
                  <p className="text-xs text-slate-600">
                    {joinParts([formatCvRange(job.startDate, job.endDate, job.current, language), job.location], " · ")}
                  </p>
                </div>
                {job.bullets.length ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {job.bullets.map((bullet, i) => (
                      <li key={i}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </>
      ) : null}

      {cv.education.length ? (
        <>
          {heading(labels.education)}
          <div className="mt-2 space-y-2">
            {cv.education.map((item, index) => (
              <div key={index} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p>
                  <span className="font-semibold text-slate-900">{joinParts([item.degree, item.field])}</span>
                  {item.institution ? ` — ${item.institution}` : ""}
                </p>
                <p className="text-xs text-slate-600">{formatCvRange(item.startDate, item.endDate, false, language)}</p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {cv.skills.length ? (
        <>
          {heading(labels.skills)}
          <p className="mt-2">{cv.skills.join(", ")}</p>
        </>
      ) : null}

      {cv.languages.length ? (
        <>
          {heading(labels.languages)}
          <p className="mt-2">
            {cv.languages.map((l) => joinParts([l.language, l.level], " — ")).join(", ")}
          </p>
        </>
      ) : null}

      {cv.certifications.length ? (
        <>
          {heading(labels.certifications)}
          <ul className="mt-2 space-y-0.5">
            {cv.certifications.map((c, i) => (
              <li key={i}>{joinParts([c.name, c.issuer, c.year], " — ")}</li>
            ))}
          </ul>
        </>
      ) : null}
    </article>
  );
}
