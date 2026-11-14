export function fitTone(score: number): string {
  if (score >= 8) return "bg-emerald-50 text-emerald-800 ring-emerald-600/20";
  if (score >= 5) return "bg-amber-50 text-amber-800 ring-amber-600/20";
  return "bg-red-50 text-red-800 ring-red-600/20";
}

export function fitLabel(score: number): string {
  if (score >= 8) return "Strong fit";
  if (score >= 5) return "Partial fit";
  return "Weak fit";
}

/** Compact "7/10" pill for lists. */
export function FitScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${fitTone(score)}`}
      title={fitLabel(score)}
    >
      {score}/10
    </span>
  );
}

/** Large score block for the analysis page. */
export function FitScoreHero({ score }: { score: number }) {
  return (
    <div
      className={`flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl ring-1 ring-inset ${fitTone(score)}`}
    >
      <span className="text-4xl font-bold leading-none">{score}</span>
      <span className="mt-1 text-xs font-medium">of 10</span>
    </div>
  );
}
