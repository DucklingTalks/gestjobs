export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-8 w-48 animate-pulse rounded-md bg-slate-200" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-200" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-200/70" />
        ))}
      </div>
    </main>
  );
}
