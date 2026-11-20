# The 30 generic-design tells

Source list: the "how do I see your design was vibe-coded" reel (see `quality/design-audit.md`). Each tell states what to look for, how to detect it in code and screenshots, and the direction of a brand-derived fix. A tell that the brand defines on purpose is `INTENTIONAL`; it is `TELL` only when it is an unchosen default.

## A. Color & surfaces

### 1. Harsh gradients
- **Look for:** high-contrast multi-stop gradients (purple→pink→orange, blue→violet) on hero backgrounds, buttons, or headline text (`bg-clip-text`).
- **Detect:** `linear-gradient`/`radial-gradient` with 3+ saturated stops; Tailwind `bg-gradient-to-* from-* via-* to-*`; `text-transparent bg-clip-text`.
- **Fix direction:** brand solid colors. If the brand has a gradient, use it subtly (close hues, low contrast) in one place only.

### 3. Pure white background
- **Look for:** `#fff` page background everywhere, with no surface hierarchy.
- **Detect:** `background: #fff/white`, `bg-white` on `body`/layout; no surface or background tokens.
- **Fix direction:** the brand's paper or neutral surface tokens, with 2–3 surface levels for hierarchy. Keep text contrast AA.

### 4. Rainbow coloring
- **Look for:** each card, icon, or feature in a different hue with no meaning.
- **Detect:** sibling elements cycling `blue/green/purple/orange` classes; color maps by index.
- **Fix direction:** one accent plus neutrals. Color only where it carries meaning (status, category the user cares about).

### 20. Purple and black
- **Look for:** the default "AI startup" scheme: near-black background with violet or indigo accents.
- **Detect:** `#0a0a0a`/`zinc-950`/`slate-950` with `violet-*`/`indigo-*`/`purple-*` accents.
- **Fix direction:** the brand palette. If the brand really is dark with violet, mark it INTENTIONAL and check that it's distinctive in use.

### 22. Radial orbs
- **Look for:** blurred glowing blobs behind the hero.
- **Detect:** absolutely positioned elements with `blur-3xl`/`filter: blur(…)` + `radial-gradient` + `opacity`.
- **Fix direction:** remove, or replace with a real brand asset (product, photo, illustration in the brand style).

### 23. Dot grids
- **Look for:** dotted or grid background patterns behind sections.
- **Detect:** `radial-gradient(circle, … 1px, transparent 1px)` with `background-size`; `bg-grid`/`bg-dot` utilities; SVG grid patterns.
- **Fix direction:** plain brand surfaces, or a pattern derived from the brand identity.

### 29. Neon colors
- **Look for:** fully saturated cyan, lime, or magenta accents, glows, and text shadows.
- **Detect:** high-saturation hex values, `drop-shadow`/`text-shadow`/`box-shadow` glows in the accent color.
- **Fix direction:** brand accents at usable saturation; no glows unless they are part of the brand.

### 30. Basic pastel colors
- **Look for:** default framework pastels (`*-100`/`*-50` backgrounds) on badges, cards, and icon chips, with no relation to the brand.
- **Detect:** Tailwind default palette classes (`bg-blue-50`, `bg-green-100`…) instead of brand tokens.
- **Fix direction:** tints derived from the brand tokens.

## B. Depth & effects

### 5. Drop shadows
- **Look for:** soft large shadows on every card, often stacked with borders.
- **Detect:** `shadow-lg/xl/2xl` everywhere, `box-shadow` with large blur on most components.
- **Fix direction:** the brand's elevation scale (often borders or one subtle shadow level); shadows only to express real layering (menus, modals).

### 8. Liquid glass
- **Look for:** frosted translucent panels and navbars with no functional reason.
- **Detect:** `backdrop-filter: blur`, `backdrop-blur-*`, `bg-white/10` + `border-white/20`.
- **Fix direction:** opaque brand surfaces. Glass is acceptable only over real imagery where it aids legibility. Check text contrast on it.

### 19. Soft corner radius
- **Look for:** the same large radius (`rounded-2xl`/`3xl`) on everything regardless of size.
- **Detect:** one radius used across buttons, cards, inputs, and images; no radius tokens.
- **Fix direction:** the brand's radius scale, proportional to element size. Flag only if it's the uniform framework default.

### 25. Animated arrows
- **Look for:** `→` arrows that slide on hover on every link and button.
- **Detect:** `group-hover:translate-x-*` on arrow icons; `ArrowRight` in most CTAs.
- **Fix direction:** keep at most one on the primary CTA if the brand wants motion; elsewhere, clear labels.

### 28. Hover animations
- **Look for:** everything lifting, scaling, or glowing on hover; motion with no feedback purpose.
- **Detect:** `hover:scale-*`, `hover:-translate-y-*`, `transition-all` on most elements; no `prefers-reduced-motion` handling.
- **Fix direction:** hover feedback only on interactive elements, short and subtle, with reduced-motion support. Never remove focus states.

## C. Typography & copy

### 7. Emojis
- **Look for:** emojis as icons in headings, feature lists, buttons, and section labels.
- **Detect:** emoji code points in content and components.
- **Fix direction:** remove, or use the brand's icon set. Emojis are INTENTIONAL only when the brand voice uses them.

### 9. Em dashes
- **Look for:** heavy use of "—" in marketing copy (a common LLM writing signal).
- **Detect:** count `—` per page in content files; flag when several appear in hero or section copy.
- **Fix direction:** rewrite in the brand voice with periods, commas, or colons. Content edits need the owner's OK.

### 10. Inter / Geist / Space Grotesk
- **Look for:** the default typefaces of templates and generators as the only typography.
- **Detect:** `font-family`, `next/font` imports, and Tailwind `fontFamily` set to Inter, Geist, or Space Grotesk.
- **Fix direction:** the brand typefaces. If the brand chose one of these deliberately, INTENTIONAL, but check for a real type scale and pairing.

### 15. "It's not X, it's Y"
- **Look for:** formulaic contrast slogans ("It's not a tool, it's a partner"), plus similar LLM patterns: rule-of-three lists, "Unlock / Elevate / Seamless / Supercharge", rhetorical questions in every section.
- **Detect:** regex over content for `not (just )?(a|an|the)? .{1,40}, (it'?s|but)`, and a list of buzzwords.
- **Fix direction:** concrete, specific claims in the brand voice (what the client gets, numbers, real cases).

## D. Icons & decoration

### 2. Lucide icons
- **Look for:** generic stroke icons from the default set on every feature, with no customization.
- **Detect:** `lucide-react`/`lucide` imports used in feature grids; default size and stroke.
- **Fix direction:** a brand icon style (custom or a chosen set with tuned stroke and size), or remove icons that add nothing. Lucide is INTENTIONAL if the design system chose it.

### 11. Colored left stripe
- **Look for:** cards or callouts with a thick colored left border.
- **Detect:** `border-l-4` + color, `border-left: 4px solid`.
- **Fix direction:** the brand's callout pattern, or none.

### 16. Checkmark bullets
- **Look for:** every list using green ✓ icons.
- **Detect:** `Check`/`CheckCircle` icons or ✓/✅ in list items across sections.
- **Fix direction:** reserve checkmarks for real comparisons or completion; use plain or brand bullets elsewhere.

### 24. Sparkle icons
- **Look for:** ✨ or `Sparkles` icons to signal "AI" or "new".
- **Detect:** `Sparkles` imports, ✨ characters.
- **Fix direction:** say what the feature does instead.

## E. Layout & composition

### 6. Three feature cards in a row
- **Look for:** icon + title + two-line text × 3 directly under the hero.
- **Detect:** a 3-column grid of identical cards with the same structure.
- **Fix direction:** structure from the content (a process, a comparison, a case, a real screenshot with callouts). Three cards are fine when there really are three things of equal weight.

### 13. Bento grids
- **Look for:** asymmetric tile grids of mixed sizes, filled with abstract visuals.
- **Detect:** CSS grids with `col-span`/`row-span` variety and decorative tiles.
- **Fix direction:** use it only when the tiles show real product or content; otherwise a simpler layout.

### 14. Terminal window
- **Look for:** fake macOS terminal or code windows (three dots) as hero decoration on non-developer products.
- **Detect:** three colored circles markup, monospace mock blocks.
- **Fix direction:** show the real product or outcome; keep terminals for developer audiences with real commands.

### 17. Three pricing tiers
- **Look for:** Basic / Pro (highlighted "Most popular") / Enterprise by reflex.
- **Detect:** a 3-column pricing grid with a center highlight badge.
- **Fix direction:** reflect the real offer (one price, a quote-based process, packages that actually exist).

## F. Content, trust & states

### 12. Fake testimonials
- **Look for:** quotes with no real name, company, or photo, stock avatars, or generic praise.
- **Detect:** placeholder names, `i.pravatar`/`randomuser`/stock URLs, identical rating stars, no source link.
- **Fix direction:** real, attributable testimonials with permission, or none. **Never invent**: this is a trust and legal risk (misleading advertising).

### 18. No real product demos
- **Look for:** abstract illustrations or mock UI where real screenshots, video, or case results should be.
- **Detect:** no real screenshots or video in hero and features; placeholder images.
- **Fix direction:** real screenshots, a short demo video, or real case outcomes. Ask the owner for the assets.

### 21. No skeleton loaders
- **Look for:** blank areas, spinners, or layout jumps while data loads. Also missing empty and error states.
- **Detect:** async components without loading UI; `Suspense` without a matching fallback; no empty/error states. Check CLS in screenshots or Lighthouse.
- **Fix direction:** skeletons that match the final layout, plus empty and error states. N/A for fully static pages.

### 26. No Terms of Service
- **Look for:** missing terms page or link where there are accounts, purchases, or user content.
- **Detect:** routes and footer links.
- **Fix direction:** add the page and link it. Content goes through `audit-compliance` (#2) and a lawyer. N/A for informational sites (low).

### 27. No privacy policy
- **Look for:** missing privacy policy or footer link when any personal data is collected (a contact form counts).
- **Detect:** routes, footer links, link next to forms.
- **Fix direction:** add and link it. Content goes through `audit-compliance` (#1).
