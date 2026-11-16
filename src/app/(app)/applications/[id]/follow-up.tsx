"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/form-buttons";
import { buttonStyles, fieldClass, labelClass } from "@/components/ui";
import { followUpMailto, type FollowUpLanguage, type FollowUpMessage } from "@/lib/reminders/follow-up";

import { markFollowUpSent } from "../actions";

const LANGUAGES: { value: FollowUpLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export function FollowUpCard({
  applicationId,
  days,
  messages,
  defaultLanguage,
  recipient,
}: {
  applicationId: string;
  /** Days since the application or the last status change. */
  days: number;
  messages: Record<FollowUpLanguage, FollowUpMessage>;
  defaultLanguage: FollowUpLanguage;
  recipient: { name: string; email: string | null; linkedinUrl: string | null } | null;
}) {
  const [language, setLanguage] = useState(defaultLanguage);
  const [subject, setSubject] = useState(messages[defaultLanguage].subject);
  const [body, setBody] = useState(messages[defaultLanguage].body);
  const [copied, setCopied] = useState(false);

  const switchLanguage = (next: FollowUpLanguage) => {
    setLanguage(next);
    setSubject(messages[next].subject);
    setBody(messages[next].body);
  };

  const mailto = followUpMailto(recipient?.email ?? null, { subject, body });

  return (
    <section
      aria-labelledby="follow-up-title"
      className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="follow-up-title" className="text-base font-semibold text-slate-900">
            Time to follow up
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {days} days without news.{" "}
            {recipient ? `Here is a message ready to send to ${recipient.name}.` : "Here is a message ready to send."}
          </p>
        </div>
        <div role="group" aria-label="Message language" className="inline-flex rounded-md shadow-sm">
          {LANGUAGES.map((option, index) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={language === option.value}
              onClick={() => switchLanguage(option.value)}
              className={
                "border px-3 py-1.5 text-xs font-medium transition " +
                (index === 0 ? "rounded-l-md " : "-ml-px rounded-r-md ") +
                (language === option.value
                  ? "border-accent-600 bg-accent-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50")
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className={labelClass}>
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Message
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className={`${fieldClass} font-[inherit] leading-relaxed`}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonStyles.secondary}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(body);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy message"}
          </button>
          {mailto ? (
            <a href={mailto} className={buttonStyles.secondary}>
              Open in email
            </a>
          ) : null}
          {recipient?.linkedinUrl ? (
            <a href={recipient.linkedinUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles.secondary}>
              Open LinkedIn ↗
            </a>
          ) : null}
        </div>
        <form action={markFollowUpSent}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <SubmitButton pendingLabel="Saving…">Mark as sent</SubmitButton>
        </form>
      </div>
      {!recipient ? (
        <p className="mt-3 text-xs text-slate-500">
          Link a recruiter in Contacts below to address the message to them by name.
        </p>
      ) : null}
    </section>
  );
}
