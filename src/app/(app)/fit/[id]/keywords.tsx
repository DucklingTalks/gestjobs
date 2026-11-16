import { SubmitButton } from "@/components/form-buttons";
import { Card, fieldClass } from "@/components/ui";
import type { StoredKeyword } from "@/lib/ats/cv";
import { coverage } from "@/lib/ats/keywords";

import { confirmKeywordAlias, toggleKeywordRename } from "../actions";

const statusStyles = {
  exact: { label: "Match", className: "bg-emerald-50 text-emerald-800 ring-emerald-600/20" },
  renamed: { label: "Renamed", className: "bg-accent-50 text-accent-700 ring-accent-600/20" },
  related: { label: "Related", className: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  missing: { label: "Missing", className: "bg-slate-100 text-slate-600 ring-slate-500/20" },
} as const;

/** Missing first (most actionable), then suggestions and renames, then plain matches. */
const statusOrder = { missing: 0, related: 1, renamed: 2, exact: 3 } as const;

export function KeywordsCard({
  analysisId,
  keywords,
  profileTerms,
}: {
  analysisId: string;
  keywords: StoredKeyword[];
  /** Profile skills, certifications and languages, suggested when confirming an alias. */
  profileTerms: string[];
}) {
  const stats = coverage(keywords);
  const rows = keywords
    .map((keyword, index) => ({ keyword, index }))
    .sort(
      (a, b) =>
        statusOrder[a.keyword.status] - statusOrder[b.keyword.status] ||
        Number(b.keyword.required) - Number(a.keyword.required),
    );

  return (
    <Card
      title={<span id="keywords">ATS keywords</span>}
      description="Terms from the posting a recruiter may search for, and how your CV covers them."
    >
      <p className="text-sm text-slate-700">
        <span className="text-2xl font-semibold text-slate-900">
          {stats.covered}/{stats.total}
        </span>{" "}
        keywords covered
        {stats.requiredTotal ? (
          <span className="text-slate-500">
            {" "}
            · required {stats.requiredCovered}/{stats.requiredTotal}
          </span>
        ) : null}
      </p>

      <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
        {rows.map(({ keyword, index }) => {
          const style = statusStyles[keyword.status];
          return (
            <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <span
                className={`inline-flex w-20 shrink-0 justify-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}
              >
                {style.label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium text-slate-900">{keyword.term}</span>
                {keyword.required ? <span className="ml-1.5 text-xs text-slate-500">required</span> : null}
                <KeywordDetail keyword={keyword} />
              </span>
              {keyword.status === "renamed" ? (
                <form action={toggleKeywordRename}>
                  <input type="hidden" name="id" value={analysisId} />
                  <input type="hidden" name="index" value={index} />
                  <SubmitButton variant="link" pendingLabel="Updating…" className="text-xs">
                    {keyword.applied ? `Use “${keyword.profileTerm}”` : `Use “${keyword.term}”`}
                  </SubmitButton>
                </form>
              ) : null}
              {keyword.status === "related" && keyword.profileTerm ? (
                <form action={confirmKeywordAlias}>
                  <input type="hidden" name="id" value={analysisId} />
                  <input type="hidden" name="index" value={index} />
                  <input type="hidden" name="profileTerm" value={keyword.profileTerm} />
                  <SubmitButton variant="link" pendingLabel="Saving…" className="text-xs">
                    It&apos;s the same
                  </SubmitButton>
                </form>
              ) : null}
              {keyword.status === "missing" ? (
                <details className="w-full pl-[5.75rem] text-xs">
                  <summary className="cursor-pointer font-medium text-accent-700">
                    I have it under another name
                  </summary>
                  <form action={confirmKeywordAlias} className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={analysisId} />
                    <input type="hidden" name="index" value={index} />
                    <label className="min-w-48 flex-1 text-slate-600">
                      The name in your profile
                      <input
                        name="profileTerm"
                        required
                        maxLength={160}
                        list="keyword-profile-terms"
                        className={fieldClass}
                        placeholder="e.g. a skill or certification"
                      />
                    </label>
                    <SubmitButton variant="secondary" pendingLabel="Saving…" className="py-1.5 text-xs">
                      Save
                    </SubmitButton>
                  </form>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
      <datalist id="keyword-profile-terms">
        {profileTerms.map((term) => (
          <option key={term} value={term} />
        ))}
      </datalist>
      <p className="mt-3 text-xs text-slate-500">
        Pairs you confirm are saved to your profile and matched automatically in future analyses.
      </p>
    </Card>
  );
}

function KeywordDetail({ keyword }: { keyword: StoredKeyword }) {
  const detail = (() => {
    switch (keyword.status) {
      case "renamed":
        return keyword.applied
          ? `Your profile says “${keyword.profileTerm}”; the CV uses the posting's wording.`
          : `The CV keeps your wording, “${keyword.profileTerm}”.`;
      case "related":
        return `Not the same, but related to “${keyword.profileTerm}”. Mention it only if you have used it.`;
      case "missing":
        return "Not in your profile.";
      default:
        return null;
    }
  })();
  return detail ? <span className="block text-xs text-slate-500">{detail}</span> : null;
}
