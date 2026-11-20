"use client";

/**
 * Interview chat, then a review step.
 *
 * The transcript lives only in this component and is sent whole on each
 * turn; nothing is stored until the candidate saves the strengths they keep.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Alert, buttonStyles, Card, fieldClass, labelClass } from "@/components/ui";
import {
  MAX_CANDIDATE_ANSWERS,
  MAX_MESSAGE_LENGTH,
  MIN_ANSWERS_TO_SUMMARIZE,
  type InterviewMessage,
} from "@/lib/validation/interview";
import type { Strength } from "@/lib/validation/profile";

import { nextInterviewTurn, proposeStrengths, saveInterviewStrengths } from "../actions";

type Proposal = Strength & { keep: boolean };

export function InterviewChat() {
  const router = useRouter();
  const [messages, setMessages] = useState<InterviewMessage[]>([]);
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"chat" | "review">("chat");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const answers = messages.filter((message) => message.role === "candidate").length;
  const atLimit = answers >= MAX_CANDIDATE_ANSWERS;
  const awaitingReply = messages.at(-1)?.role === "candidate" || messages.length === 0;
  const canFinish = answers >= MIN_ANSWERS_TO_SUMMARIZE && !pending;

  function requestTurn(transcript: InterviewMessage[]) {
    setError(null);
    startTransition(async () => {
      const result = await nextInterviewTurn(transcript);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessages([...transcript, { role: "interviewer", content: result.turn.reply }]);
      setDone(result.turn.done);
      requestAnimationFrame(() => inputRef.current?.focus());
    });
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    requestTurn([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start the interview once
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  // Warn before leaving with answers that were never turned into strengths.
  useEffect(() => {
    if (saved || answers === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [answers, saved]);

  function send() {
    const content = input.trim();
    if (!content || pending || atLimit || awaitingReply) return;
    const transcript: InterviewMessage[] = [...messages, { role: "candidate", content }];
    setMessages(transcript);
    setInput("");
    requestTurn(transcript);
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const result = await proposeStrengths(messages);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProposals(result.strengths.map((strength) => ({ ...strength, keep: true })));
      setPhase("review");
    });
  }

  function update(index: number, patch: Partial<Proposal>) {
    setProposals((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  const kept = proposals.filter((item) => item.keep && item.name.trim());

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveInterviewStrengths(
        kept.map(({ name, kind, context, evidence }) => ({ name, kind, context, evidence })),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.push("/profile?status=strengths-added#strengths");
    });
  }

  if (phase === "review") {
    return (
      <div className="space-y-6">
        <Card
          title="Proposed strengths"
          description="Built only from your answers. Edit anything that is not accurate and untick what you don't want."
        >
          {proposals.length === 0 ? (
            <p className="text-sm text-slate-600">
              The answers did not have enough concrete examples to propose a strength. Go back and add more detail.
            </p>
          ) : (
            <div className="space-y-4">
              {proposals.map((item, index) => (
                <fieldset
                  key={index}
                  className={`space-y-3 rounded-lg border p-4 ${item.keep ? "border-slate-200" : "border-dashed border-slate-200 opacity-60"}`}
                >
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <input
                      type="checkbox"
                      checked={item.keep}
                      onChange={(e) => update(index, { keep: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Keep
                  </label>
                  <div className="grid gap-3 sm:grid-cols-[1fr_9rem_1fr]">
                    <label className={labelClass}>
                      Name
                      <input
                        value={item.name}
                        onChange={(e) => update(index, { name: e.target.value })}
                        maxLength={80}
                        className={fieldClass}
                      />
                    </label>
                    <label className={labelClass}>
                      Type
                      <select
                        value={item.kind}
                        onChange={(e) => update(index, { kind: e.target.value === "soft" ? "soft" : "technical" })}
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
                        onChange={(e) => update(index, { context: e.target.value })}
                        maxLength={160}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                  <label className={labelClass}>
                    Evidence
                    <textarea
                      value={item.evidence}
                      onChange={(e) => update(index, { evidence: e.target.value })}
                      rows={3}
                      maxLength={1000}
                      className={fieldClass}
                    />
                  </label>
                </fieldset>
              ))}
            </div>
          )}
        </Card>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => setPhase("chat")} disabled={pending} className={buttonStyles.secondary}>
            Back to the interview
          </button>
          <button type="button" onClick={save} disabled={pending || kept.length === 0} className={buttonStyles.primary}>
            {pending ? "Saving…" : `Add ${kept.length} to my profile`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <div role="log" aria-live="polite" aria-label="Interview" className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <div key={index} className={message.role === "candidate" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                message.role === "candidate"
                  ? "rounded-br-sm bg-accent-600 text-white"
                  : "rounded-bl-sm bg-slate-100 text-slate-800"
              }`}
            >
              <span className="sr-only">{message.role === "candidate" ? "You: " : "Interviewer: "}</span>
              {message.content}
            </p>
          </div>
        ))}
        {pending ? (
          <p className="text-sm text-slate-500" aria-live="polite">
            {awaitingReply ? "The interviewer is typing…" : "Reviewing your answers…"}
          </p>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? (
        <div className="mt-4 space-y-2">
          <Alert tone="error">{error}</Alert>
          {awaitingReply ? (
            <button type="button" onClick={() => requestTurn(messages)} className={buttonStyles.secondary}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {done || atLimit ? (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          The interview is complete. Review the strengths it found, or keep answering to add more detail.
        </p>
      ) : null}

      <form
        className="mt-4 space-y-3 border-t border-slate-100 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <label className="sr-only" htmlFor="interview-answer">
          Your answer
        </label>
        <textarea
          id="interview-answer"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          rows={3}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={atLimit}
          placeholder={atLimit ? "You reached the answer limit." : "Your answer… (Enter to send, Shift+Enter for a new line)"}
          className={`${fieldClass} disabled:bg-slate-50`}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {answers}/{MAX_CANDIDATE_ANSWERS} answers · contact details are hidden from the AI
          </span>
          <div className="flex gap-3">
            <button type="button" onClick={finish} disabled={!canFinish} className={buttonStyles.secondary}>
              Finish and review strengths
            </button>
            <button
              type="submit"
              disabled={pending || atLimit || awaitingReply || !input.trim()}
              className={buttonStyles.primary}
            >
              Send
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}
