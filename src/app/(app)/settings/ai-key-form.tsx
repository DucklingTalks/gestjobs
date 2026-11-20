"use client";

import { useActionState, useState } from "react";

import { SubmitButton } from "@/components/form-buttons";
import { Alert, buttonStyles, fieldClass, labelClass } from "@/components/ui";
import { AI_PROVIDERS, PROVIDER_INFO, type AiProvider } from "@/lib/ai/providers";

import { saveAiKey, type AiKeyFormState } from "./actions";

const initialState: AiKeyFormState = { error: null };

export function AiKeyForm({ initialProvider, replacing }: { initialProvider: AiProvider; replacing: boolean }) {
  const [provider, setProvider] = useState<AiProvider>(initialProvider);
  const [state, formAction] = useActionState(saveAiKey, initialState);
  const info = PROVIDER_INFO[provider];

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}

      <fieldset>
        <legend className={labelClass}>Provider</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {AI_PROVIDERS.map((id) => (
            <label
              key={id}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                provider === id ? "border-accent-500 bg-accent-50 text-slate-900" : "border-slate-300 text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="provider"
                value={id}
                checked={provider === id}
                onChange={() => setProvider(id)}
                className="h-4 w-4"
              />
              {PROVIDER_INFO[id].label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={labelClass}>
        API key
        <input
          type="password"
          name="apiKey"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder={info.keyPlaceholder}
          className={fieldClass}
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          {info.keyHelp}{" "}
          <a href={info.keyUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles.link}>
            Get a key ↗
          </a>
        </span>
      </label>

      <SubmitButton pendingLabel="Checking the key…">{replacing ? "Replace key" : "Save key"}</SubmitButton>
    </form>
  );
}
