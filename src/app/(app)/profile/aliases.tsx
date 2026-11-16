import { SubmitButton } from "@/components/form-buttons";
import { Card } from "@/components/ui";

import { deleteSkillAlias } from "./actions";

export type SkillAliasRow = { id: string; posting_term: string; profile_term: string };

/**
 * Personal ATS aliases confirmed from an analysis ("It's the same" or
 * "I have it under another name"). Future analyses match them automatically.
 */
export function SkillAliases({ aliases }: { aliases: SkillAliasRow[] }) {
  return (
    <Card
      className="mt-6"
      title={<span id="aliases">ATS aliases</span>}
      description="Names you confirmed mean the same thing. When a posting uses the first name and your profile has the second, the tailored CV uses the posting's wording."
    >
      {aliases.length ? (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {aliases.map((alias) => (
            <li key={alias.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-slate-900">{alias.posting_term}</span>
                <span className="mx-2 text-slate-400" aria-label="matches">
                  =
                </span>
                <span className="text-slate-700">{alias.profile_term}</span>
              </span>
              <form action={deleteSkillAlias}>
                <input type="hidden" name="id" value={alias.id} />
                <SubmitButton variant="dangerLink" pendingLabel="Removing…" className="text-xs">
                  Remove
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          None yet. In a job fit analysis, confirm a related or missing keyword to add one.
        </p>
      )}
    </Card>
  );
}
