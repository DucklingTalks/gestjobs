# UI backlog

Deferred UI/UX work that is agreed but not scheduled yet.

## Dark mode

**Status:** deferred. The app currently ships a light palette only.

### Current state

- `src/app/globals.css` sets `color-scheme: light`. It previously declared
  `light dark` without any dark styles, which made native controls (date
  pickers, file inputs, scrollbars) render dark on a white page whenever the
  OS was in dark mode. Restore `light dark` only once the dark palette exists.
- Colours are applied with Tailwind utility classes (`bg-white`,
  `text-slate-900`, `border-slate-200`, …) directly in components. The shared
  primitives in `src/components/ui.tsx` (`buttonStyles`, `fieldClass`, `Card`,
  `Alert`, `StatusBadge`, `EmptyState`) concentrate most of them, but page
  files still contain many inline colour classes.
- Brand colour lives in `tailwind.config.ts` under `accent`.

### Suggested approach

1. **Semantic tokens first.** Define CSS variables on `:root` (e.g.
   `--surface`, `--surface-muted`, `--border`, `--text`, `--text-muted`,
   `--accent`) and map them in `tailwind.config.ts`
   (`colors: { surface: "rgb(var(--surface) / <alpha-value>)", … }`).
   Redefine the variables under `@media (prefers-color-scheme: dark)` and
   under a `[data-theme="dark"]` attribute for a manual override.
2. **Migrate the primitives** in `src/components/ui.tsx`, the layout
   (`src/app/(app)/layout.tsx`), nav, mobile menu, and the flash toaster to the
   semantic tokens.
3. **Sweep the pages** (`dashboard`, `applications/*`, `contacts`, `resumes`,
   `login`, landing) replacing `slate-*`/`white` utilities with tokens.
4. **Status badge palette** (`STATUS_TONES` in `ui.tsx`) needs a dark variant
   per status — check contrast (WCAG AA, 4.5:1 for the badge text).
5. **Theme toggle (optional).** System / Light / Dark switch in the sidebar
   footer, persisted in a cookie so the server renders the right
   `data-theme` without a flash of the wrong theme.
6. Switch `color-scheme` back to `light dark` and verify native controls,
   the date input, file input button, and focus rings in both themes.

### Acceptance

- Every page is legible in both themes with no hard-coded light-only colours.
- No flash of the wrong theme on first load.
- Text and badge contrast meets WCAG AA in both themes.
