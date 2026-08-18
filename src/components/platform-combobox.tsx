"use client";

/**
 * Platform combobox — accessible single-select with free-text fallback.
 *
 * Spec reference:
 *   openspec/changes/gestjobs-mvp/specs/platforms/spec.md
 *   § Requirement: Searchable Combobox and Manual Fallback
 *
 * Design choices:
 *   - Built with native ARIA (WAI-ARIA APG combobox pattern) rather than
 *     Headless UI / Radix. Keeps the dep surface lean — PR 1 shipped with
 *     five production deps and adding a UI lib for one component would
 *     dwarf PR 2's footprint. The combobox is the only interactive UI in
 *     PR 2; PR 4 / PR 5 will evaluate whether to standardize on a UI lib
 *     when more primitives land.
 *   - Keyboard support: ArrowDown/ArrowUp/Home/End to navigate, Enter to
 *     select, Escape to close, Tab to commit and leave. Matches the
 *     combobox role pattern documented at
 *     https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
 *   - Free-text affordance: when the query has no substring match against
 *     the supplied options, an "Add '<query>' as a new platform" row is
 *     appended at the bottom. Selecting it emits a Platform with
 *     `id: null`, `isCustom: true`, and an empty `hostname` — the parent
 *     form combines that with its URL field (PR 4) to call the
 *     `upsertCustomPlatform` Server Action and persist a normalized row.
 *
 * Props summary:
 *   - `value`       — currently selected platform (controlled).
 *   - `options`     — searchable list; typically `[...seedPlatforms, ...customPlatforms]`.
 *   - `onChange`    — fires with the selected Platform when the user picks
 *                     an existing row OR creates a new one.
 *   - `invalid`     — when true, applies error styling + `aria-invalid`.
 *   - `describedBy` — id of an external element describing the field
 *                     (e.g. a help text node); forwarded to aria-describedby.
 */

import { useId, useMemo, useRef, useState, useCallback, useEffect, KeyboardEvent } from "react";

import { searchPlatforms, type Platform } from "@/lib/platforms/infer";

type PlatformComboboxProps = {
  value: Platform | null;
  options: ReadonlyArray<Platform>;
  onChange: (platform: Platform) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  id?: string;
  name?: string;
};

const CUSTOM_OPTION_ID = "__create_custom__";

export function PlatformCombobox({
  value,
  options,
  onChange,
  placeholder = "Search platforms or type a custom name",
  disabled = false,
  required = false,
  invalid = false,
  describedBy,
  id,
  name,
}: PlatformComboboxProps) {
  const reactId = useId();
  const inputId = id ?? `platform-combobox-input-${reactId}`;
  const listboxId = `platform-combobox-listbox-${reactId}`;
  const optionId = (key: string) => `platform-combobox-option-${reactId}-${key}`;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxRef = useRef<HTMLUListElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value?.name ?? "");
  const [activeIndex, setActiveIndex] = useState(-1);

  // Recompute the dropdown options every time `query` or `options` change.
  // The "Add custom" row is appended when there is no substring match.
  const { matches, customEntry } = useMemo(() => {
    const matches = searchPlatforms(query, options);
    const trimmed = query.trim();
    const exactMatch = matches.some(
      (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const customEntry: Platform | null =
      trimmed && !exactMatch
        ? {
            id: null,
            name: trimmed,
            hostname: "",
            isCustom: true,
          }
        : null;
    return { matches, customEntry };
  }, [query, options]);

  const flattenedOptions = useMemo<Platform[]>(
    () => (customEntry ? [...matches, customEntry] : matches),
    [matches, customEntry],
  );

  // Keep the visible input text in sync with the controlled `value` prop
  // when it changes from outside (e.g. parent clears the form).
  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value]);

  const commitSelection = useCallback(
    (platform: Platform) => {
      onChange(platform);
      setQuery(platform.name);
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
    },
    [onChange],
  );

  const openIfPossible = useCallback(() => {
    if (!disabled) setIsOpen(true);
  }, [disabled]);

  const handleInputChange = useCallback(
    (next: string) => {
      setQuery(next);
      setActiveIndex(-1);
      openIfPossible();
    },
    [openIfPossible],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(flattenedOptions.length > 0 ? 0 : -1);
          return;
        }
        if (flattenedOptions.length === 0) return;
        setActiveIndex((i) => (i + 1) % flattenedOptions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(
            flattenedOptions.length > 0 ? flattenedOptions.length - 1 : -1,
          );
          return;
        }
        if (flattenedOptions.length === 0) return;
        setActiveIndex((i) =>
          i <= 0 ? flattenedOptions.length - 1 : i - 1,
        );
        return;
      }
      if (event.key === "Home") {
        if (!isOpen || flattenedOptions.length === 0) return;
        event.preventDefault();
        setActiveIndex(0);
        return;
      }
      if (event.key === "End") {
        if (!isOpen || flattenedOptions.length === 0) return;
        event.preventDefault();
        setActiveIndex(flattenedOptions.length - 1);
        return;
      }
      if (event.key === "Enter") {
        if (!isOpen) return;
        event.preventDefault();
        const target = flattenedOptions[activeIndex] ?? flattenedOptions[0];
        if (target) commitSelection(target);
        return;
      }
      if (event.key === "Escape") {
        if (!isOpen) return;
        event.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        return;
      }
      if (event.key === "Tab") {
        // Tab commits the active option (or top match) and lets focus leave.
        if (isOpen && flattenedOptions.length > 0) {
          const target = flattenedOptions[activeIndex] ?? flattenedOptions[0];
          if (target) commitSelection(target);
        }
      }
    },
    [activeIndex, commitSelection, flattenedOptions, isOpen],
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      // Delay close so a click on an option still registers.
      const next = event.relatedTarget as HTMLElement | null;
      if (next && listboxRef.current?.contains(next)) return;
      setIsOpen(false);
      setActiveIndex(-1);
    },
    [],
  );

  const activeOptionKey =
    activeIndex >= 0 && activeIndex < flattenedOptions.length
      ? optionId(
          flattenedOptions[activeIndex].isCustom
            ? CUSTOM_OPTION_ID
            : flattenedOptions[activeIndex].hostname,
        )
      : undefined;

  const showListbox = isOpen && flattenedOptions.length > 0;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showListbox}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionKey}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        required={required}
        value={query}
        placeholder={placeholder}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={openIfPossible}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={
          "block w-full rounded-md border bg-white px-3 py-2 text-base text-slate-900 shadow-sm transition focus:outline-none focus:ring-2 " +
          (invalid
            ? "border-red-400 focus:border-red-500 focus:ring-red-400"
            : "border-slate-300 focus:border-accent-500 focus:ring-accent-500") +
          " disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
        }
      />

      {showListbox ? (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {matches.map((platform) => {
            const key = optionId(platform.hostname);
            const isActive =
              activeIndex >= 0 &&
              flattenedOptions[activeIndex]?.hostname === platform.hostname &&
              !flattenedOptions[activeIndex].isCustom;
            return (
              <li
                key={platform.hostname}
                id={key}
                role="option"
                aria-selected={isActive}
                tabIndex={-1}
                onMouseDown={(e) => {
                  // mousedown so the input's blur handler does not steal focus first.
                  e.preventDefault();
                  commitSelection(platform);
                }}
                onMouseEnter={() => {
                  const idx = flattenedOptions.findIndex(
                    (p) => p.hostname === platform.hostname && !p.isCustom,
                  );
                  if (idx >= 0) setActiveIndex(idx);
                }}
                className={
                  "flex cursor-pointer items-center justify-between px-3 py-2 " +
                  (isActive
                    ? "bg-accent-50 text-accent-700"
                    : "text-slate-800 hover:bg-slate-50")
                }
              >
                <span className="font-medium">{platform.name}</span>
                <span className="ml-2 truncate text-xs text-slate-500">
                  {platform.hostname}
                </span>
              </li>
            );
          })}

          {customEntry ? (
            <li
              id={optionId(CUSTOM_OPTION_ID)}
              role="option"
              aria-selected={
                activeIndex === flattenedOptions.length - 1 &&
                flattenedOptions[activeIndex]?.isCustom
              }
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                commitSelection(customEntry);
              }}
              onMouseEnter={() => setActiveIndex(flattenedOptions.length - 1)}
              className={
                "flex cursor-pointer items-center justify-between border-t border-slate-100 px-3 py-2 " +
                (activeIndex === flattenedOptions.length - 1
                  ? "bg-accent-50 text-accent-700"
                  : "text-slate-700 hover:bg-slate-50")
              }
            >
              <span className="font-medium">
                Add “{customEntry.name}” as a new platform
              </span>
              <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">
                Custom
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
