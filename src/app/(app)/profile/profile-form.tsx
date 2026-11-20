"use client";

/**
 * Profile editor.
 *
 * Fully controlled: the whole profile lives in one state object and is
 * submitted as JSON (`payload`). Controlled fields survive a server-side
 * validation error, and the resume import can replace the state in one go
 * before the user reviews and saves.
 */

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { SubmitButton } from "@/components/form-buttons";
import { Alert, buttonStyles, Card, fieldClass, labelClass } from "@/components/ui";
import type { Profile } from "@/lib/validation/profile";

import { saveProfile, type ProfileFormState } from "./actions";
import { ImportResume } from "./import-resume";

const initialState: ProfileFormState = { error: null };

type ListKey = "experiences" | "education" | "links" | "languages" | "certifications" | "strengths";

const BLANK: { [K in ListKey]: Profile[K][number] } = {
  experiences: {
    company: "",
    title: "",
    location: "",
    startDate: "",
    endDate: "",
    current: false,
    description: "",
  },
  education: { institution: "", degree: "", field: "", startDate: "", endDate: "", description: "" },
  links: { label: "", url: "" },
  languages: { language: "", level: "" },
  certifications: { name: "", issuer: "", year: "" },
  strengths: { name: "", kind: "technical", context: "", evidence: "" },
};

function splitSkills(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

export function ProfileForm({ initial, aiEnabled }: { initial: Profile; aiEnabled: boolean }) {
  const [profile, setProfile] = useState<Profile>(initial);
  const [skillsText, setSkillsText] = useState(initial.skills.join(", "));
  const [state, formAction, isPending] = useActionState(saveProfile, initialState);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

  const replace = useCallback((next: Profile) => {
    setProfile(next);
    setSkillsText(next.skills.join(", "));
  }, []);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setProfile((prev) => ({ ...prev, [key]: value }));

  function updateItem<K extends ListKey>(key: K, index: number, patch: Partial<Profile[K][number]>) {
    setProfile((prev) => {
      const list = [...prev[key]] as Profile[K][number][];
      list[index] = { ...list[index], ...patch };
      return { ...prev, [key]: list };
    });
  }

  function addItem(key: ListKey) {
    setProfile((prev) => ({ ...prev, [key]: [...prev[key], { ...BLANK[key] }] }));
  }

  function removeItem(key: ListKey, index: number) {
    setProfile((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  }

  function moveItem(key: ListKey, index: number, delta: -1 | 1) {
    setProfile((prev) => {
      const list = [...prev[key]];
      const target = index + delta;
      if (target < 0 || target >= list.length) return prev;
      [list[index], list[target]] = [list[target], list[index]];
      return { ...prev, [key]: list };
    });
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("payload", JSON.stringify({ ...profile, skills: splitSkills(skillsText) }));
    startTransition(() => formAction(formData));
  };

  const rowControls = (key: ListKey, index: number, length: number) => (
    <div className="flex items-center gap-3 text-xs">
      <button
        type="button"
        onClick={() => moveItem(key, index, -1)}
        disabled={index === 0}
        className="text-slate-500 hover:text-slate-800 disabled:opacity-30"
        aria-label="Move up"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => moveItem(key, index, 1)}
        disabled={index === length - 1}
        className="text-slate-500 hover:text-slate-800 disabled:opacity-30"
        aria-label="Move down"
      >
        ↓
      </button>
      <button type="button" onClick={() => removeItem(key, index)} className={buttonStyles.dangerLink}>
        Remove
      </button>
    </div>
  );

  const addButton = (key: ListKey, label: string) => (
    <button type="button" onClick={() => addItem(key)} className={buttonStyles.secondary}>
      + {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <ImportResume
        current={{ ...profile, skills: splitSkills(skillsText) }}
        onImported={replace}
        aiEnabled={aiEnabled}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {state.error ? (
          <div ref={errorRef}>
            <Alert tone="error">{state.error}</Alert>
          </div>
        ) : null}

        <Card
          title="Personal details"
          description="Email, phone and links are only printed on your CV. They are never sent to the AI."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Full name
              <input
                value={profile.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                className={fieldClass}
                autoComplete="name"
              />
            </label>
            <label className={labelClass}>
              Headline
              <input
                value={profile.headline}
                onChange={(e) => set("headline", e.target.value)}
                placeholder="Senior Frontend Engineer"
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Email
              <input
                type="email"
                value={profile.email}
                onChange={(e) => set("email", e.target.value)}
                className={fieldClass}
                autoComplete="email"
              />
            </label>
            <label className={labelClass}>
              Phone
              <input
                value={profile.phone}
                onChange={(e) => set("phone", e.target.value)}
                className={fieldClass}
                autoComplete="tel"
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Location
              <input
                value={profile.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Montevideo, Uruguay"
                className={fieldClass}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                City and country only. It is shared with the AI to judge location fit.
              </span>
            </label>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Links</h3>
            {profile.links.map((link, index) => (
              <div key={index} className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
                <label className={labelClass}>
                  Label
                  <input
                    value={link.label}
                    onChange={(e) => updateItem("links", index, { label: e.target.value })}
                    placeholder="LinkedIn"
                    className={fieldClass}
                  />
                </label>
                <label className={labelClass}>
                  URL
                  <input
                    value={link.url}
                    onChange={(e) => updateItem("links", index, { url: e.target.value })}
                    placeholder="https://linkedin.com/in/…"
                    className={fieldClass}
                  />
                </label>
                <div className="pb-2">{rowControls("links", index, profile.links.length)}</div>
              </div>
            ))}
            {addButton("links", "Add link")}
          </div>
        </Card>

        <Card title="About you" description="A short professional summary in your own words.">
          <textarea
            value={profile.bio}
            onChange={(e) => set("bio", e.target.value)}
            rows={5}
            className={fieldClass}
            aria-label="Professional summary"
          />
        </Card>

        <Card title="Experience" description="Most recent first. Use the arrows to reorder.">
          <div className="space-y-6">
            {profile.experiences.map((job, index) => (
              <fieldset key={index} className="space-y-4 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <legend className="text-sm font-semibold text-slate-900">
                    {job.title || job.company || `Experience ${index + 1}`}
                  </legend>
                  {rowControls("experiences", index, profile.experiences.length)}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Job title
                    <input
                      value={job.title}
                      onChange={(e) => updateItem("experiences", index, { title: e.target.value })}
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Company
                    <input
                      value={job.company}
                      onChange={(e) => updateItem("experiences", index, { company: e.target.value })}
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Location
                    <input
                      value={job.location}
                      onChange={(e) => updateItem("experiences", index, { location: e.target.value })}
                      className={fieldClass}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={labelClass}>
                      Start
                      <input
                        type="month"
                        value={job.startDate}
                        onChange={(e) => updateItem("experiences", index, { startDate: e.target.value })}
                        placeholder="YYYY-MM"
                        className={fieldClass}
                      />
                    </label>
                    <label className={labelClass}>
                      End
                      <input
                        type="month"
                        value={job.current ? "" : job.endDate}
                        disabled={job.current}
                        onChange={(e) => updateItem("experiences", index, { endDate: e.target.value })}
                        placeholder="YYYY-MM"
                        className={`${fieldClass} disabled:bg-slate-50`}
                      />
                    </label>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={job.current}
                    onChange={(e) =>
                      updateItem("experiences", index, {
                        current: e.target.checked,
                        endDate: e.target.checked ? "" : job.endDate,
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  I currently work here
                </label>
                <label className={labelClass}>
                  What you did
                  <textarea
                    value={job.description}
                    onChange={(e) => updateItem("experiences", index, { description: e.target.value })}
                    rows={4}
                    placeholder="Responsibilities, achievements, technologies. One per line works well."
                    className={fieldClass}
                  />
                </label>
              </fieldset>
            ))}
            {addButton("experiences", "Add experience")}
          </div>
        </Card>

        <Card title="Education">
          <div className="space-y-6">
            {profile.education.map((item, index) => (
              <fieldset key={index} className="space-y-4 rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <legend className="text-sm font-semibold text-slate-900">
                    {item.degree || item.institution || `Education ${index + 1}`}
                  </legend>
                  {rowControls("education", index, profile.education.length)}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Institution
                    <input
                      value={item.institution}
                      onChange={(e) => updateItem("education", index, { institution: e.target.value })}
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Degree
                    <input
                      value={item.degree}
                      onChange={(e) => updateItem("education", index, { degree: e.target.value })}
                      placeholder="BSc, Diploma, Bootcamp…"
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Field of study
                    <input
                      value={item.field}
                      onChange={(e) => updateItem("education", index, { field: e.target.value })}
                      className={fieldClass}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={labelClass}>
                      Start
                      <input
                        type="month"
                        value={item.startDate}
                        onChange={(e) => updateItem("education", index, { startDate: e.target.value })}
                        placeholder="YYYY-MM"
                        className={fieldClass}
                      />
                    </label>
                    <label className={labelClass}>
                      End
                      <input
                        type="month"
                        value={item.endDate}
                        onChange={(e) => updateItem("education", index, { endDate: e.target.value })}
                        placeholder="YYYY-MM"
                        className={fieldClass}
                      />
                    </label>
                  </div>
                </div>
                <label className={labelClass}>
                  Notes
                  <textarea
                    value={item.description}
                    onChange={(e) => updateItem("education", index, { description: e.target.value })}
                    rows={2}
                    className={fieldClass}
                  />
                </label>
              </fieldset>
            ))}
            {addButton("education", "Add education")}
          </div>
        </Card>

        <Card title="Skills" description="Separate with commas or new lines.">
          <textarea
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            rows={3}
            placeholder="TypeScript, React, Next.js, PostgreSQL"
            className={fieldClass}
            aria-label="Skills"
          />
        </Card>

        <div id="strengths" className="scroll-mt-20">
          <Card
            title="Strengths"
            description="Qualities you can back with a real example, like algorithmic thinking or mentoring. Fit analyses and tailored CVs use them as facts."
            actions={
              aiEnabled ? (
                <Link href="/profile/interview" className={buttonStyles.secondary}>
                  Interview me with AI
                </Link>
              ) : null
            }
          >
            <div className="space-y-6">
              {profile.strengths.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {aiEnabled
                    ? "No strengths yet. Add them by hand, or let the AI interview you to find experience your profile is missing. Save your profile first if you have unsaved changes."
                    : "No strengths yet."}
                </p>
              ) : null}
              {profile.strengths.map((item, index) => (
                <fieldset key={index} className="space-y-4 rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <legend className="text-sm font-semibold text-slate-900">
                      {item.name || `Strength ${index + 1}`}
                    </legend>
                    {rowControls("strengths", index, profile.strengths.length)}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-[1fr_9rem_1fr]">
                    <label className={labelClass}>
                      Name
                      <input
                        value={item.name}
                        onChange={(e) => updateItem("strengths", index, { name: e.target.value })}
                        placeholder="Algorithmic thinking"
                        className={fieldClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Type
                      <select
                        value={item.kind}
                        onChange={(e) =>
                          updateItem("strengths", index, { kind: e.target.value === "soft" ? "soft" : "technical" })
                        }
                        className={fieldClass}
                      >
                        <option value="technical">Technical</option>
                        <option value="soft">Soft</option>
                      </select>
                    </label>
                    <label className={labelClass}>
                      Where
                      <input
                        value={item.context}
                        onChange={(e) => updateItem("strengths", index, { context: e.target.value })}
                        placeholder="Frontend Lead at Acme"
                        className={fieldClass}
                      />
                    </label>
                  </div>
                  <label className={labelClass}>
                    Evidence
                    <textarea
                      value={item.evidence}
                      onChange={(e) => updateItem("strengths", index, { evidence: e.target.value })}
                      rows={3}
                      placeholder="A concrete example: the problem, what you did and the result."
                      className={fieldClass}
                    />
                  </label>
                </fieldset>
              ))}
              {addButton("strengths", "Add strength")}
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Languages">
            <div className="space-y-3">
              {profile.languages.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr] gap-3">
                  <label className={labelClass}>
                    Language
                    <input
                      value={item.language}
                      onChange={(e) => updateItem("languages", index, { language: e.target.value })}
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Level
                    <input
                      value={item.level}
                      onChange={(e) => updateItem("languages", index, { level: e.target.value })}
                      placeholder="Native, C1, Fluent…"
                      className={fieldClass}
                    />
                  </label>
                  <div className="col-span-2">{rowControls("languages", index, profile.languages.length)}</div>
                </div>
              ))}
              {addButton("languages", "Add language")}
            </div>
          </Card>

          <Card title="Certifications">
            <div className="space-y-3">
              {profile.certifications.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_5rem] gap-3">
                  <label className={labelClass}>
                    Name
                    <input
                      value={item.name}
                      onChange={(e) => updateItem("certifications", index, { name: e.target.value })}
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Issuer
                    <input
                      value={item.issuer}
                      onChange={(e) => updateItem("certifications", index, { issuer: e.target.value })}
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Year
                    <input
                      value={item.year}
                      onChange={(e) => updateItem("certifications", index, { year: e.target.value })}
                      inputMode="numeric"
                      className={fieldClass}
                    />
                  </label>
                  <div className="col-span-3">
                    {rowControls("certifications", index, profile.certifications.length)}
                  </div>
                </div>
              ))}
              {addButton("certifications", "Add certification")}
            </div>
          </Card>
        </div>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <SubmitButton pending={isPending} pendingLabel="Saving profile…">
            Save profile
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
