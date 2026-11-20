import { randomUUID } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

import { DEFAULT_MODEL, PROVIDER_INFO, type AiProvider } from "./providers";

/**
 * AI access for gestjobs.
 *
 * Requests go through the official Anthropic SDK against an
 * Anthropic-Messages-compatible endpoint: OpenCode (Go or Zen) or Anthropic
 * itself. Each user brings their own key (see `./access`); the deployment
 * key below is only used for the emails listed in AI_SHARED_KEY_EMAILS.
 *
 *   OPENCODE_API_KEY   deployment key (shared with the allowlisted emails)
 *   AI_BASE_URL        optional — base URL for the deployment key
 *   AI_MODEL           optional — model for the deployment key
 *
 * Server-only: never import this from a Client Component.
 */

export type AiConfig = {
  provider: AiProvider | "custom";
  apiKey: string;
  baseURL: string;
  model: string;
};

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** The deployment's own key from the environment, or null when unset. */
export function deploymentAiConfig(): AiConfig | null {
  const apiKey = process.env.OPENCODE_API_KEY?.trim() ?? "";
  if (!apiKey) return null;
  const baseURL = process.env.AI_BASE_URL?.trim();
  return {
    provider: baseURL ? "custom" : "opencode-go",
    apiKey,
    baseURL: (baseURL || PROVIDER_INFO["opencode-go"].baseURL).replace(/\/$/, ""),
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

/** Config for a key the user saved for one of the supported providers. */
export function providerAiConfig(provider: AiProvider, apiKey: string): AiConfig {
  return { provider, apiKey, baseURL: PROVIDER_INFO[provider].baseURL, model: DEFAULT_MODEL };
}

const isAnthropic = (config: AiConfig) => config.provider === "anthropic";

const clients = new Map<string, Anthropic>();

function client(config: AiConfig): Anthropic {
  const key = `${config.provider}|${config.baseURL}|${config.apiKey}`;
  const cached = clients.get(key);
  if (cached) return cached;
  const instance = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    maxRetries: 2,
    timeout: 120_000,
    // The SDK sends the key as x-api-key, which is what Anthropic expects.
    // OpenCode authenticates with a bearer token and asks clients to identify
    // themselves.
    defaultHeaders: isAnthropic(config)
      ? undefined
      : { Authorization: `Bearer ${config.apiKey}`, "User-Agent": "gestjobs/0.1" },
  });
  // Many users each bring a key: keep the cache small.
  if (clients.size >= 50) clients.delete(clients.keys().next().value as string);
  clients.set(key, instance);
  return instance;
}

/** OpenCode routes by conversation and rejects requests without a session header. */
function requestHeaders(config: AiConfig, session: string): Record<string, string> | undefined {
  return isAnthropic(config) ? undefined : { "x-opencode-session": session };
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "The AI provider rejected your API key. Check it in Settings.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "The AI usage limit was reached. Try again later.";
  }
  if (error instanceof Anthropic.NotFoundError) {
    return "The AI model or endpoint was not found. Check the provider in Settings.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach the AI provider. Check your connection and try again.";
  }
  if (error instanceof Anthropic.APIError) {
    return `The AI provider returned an error (${error.status ?? "unknown"}). Try again in a moment.`;
  }
  return "Something went wrong while talking to the AI. Try again in a moment.";
}

export type KeyCheck = { ok: true } | { ok: false; error: string };

/** One tiny request to confirm the key works before saving it. */
export async function verifyAiKey(config: AiConfig): Promise<KeyCheck> {
  try {
    await client(config).messages.create(
      { model: config.model, max_tokens: 16, messages: [{ role: "user", content: "Reply with OK." }] },
      { headers: requestHeaders(config, randomUUID()), maxRetries: 0, timeout: 30_000 },
    );
    return { ok: true };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, error: "The provider rejected this key. Check that you copied it whole and chose the right provider." };
    }
    console.error("[ai] key check failed", error instanceof Error ? error.message : error);
    return { ok: false, error: `Couldn't verify the key: ${describeError(error)}` };
  }
}

/** Pull the first JSON object out of a reply, tolerating code fences or prose. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SyntaxError("No JSON object in reply.");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Ask for a JSON object matching `schema`.
 *
 * The reply is parsed and validated locally rather than with the API's
 * structured-output parameter, which a third-party gateway may not forward.
 * One repair turn is attempted if the first reply is not valid.
 */
export async function generateJson<S extends z.ZodTypeAny>({
  ai,
  system,
  prompt,
  schema,
  maxTokens = 8_000,
}: {
  ai: AiConfig;
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
}): Promise<AiResult<z.infer<S>>> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  // The repair turn below reuses the same session.
  const session = randomUUID();

  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Anthropic.Message;
    try {
      response = await client(ai).messages.create(
        { model: ai.model, max_tokens: maxTokens, system, messages },
        { headers: requestHeaders(ai, session) },
      );
    } catch (error) {
      console.error("[ai] request failed", error instanceof Error ? error.message : error);
      return { ok: false, error: describeError(error) };
    }

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "The AI declined to process this request." };
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    if (response.stop_reason === "max_tokens") {
      return { ok: false, error: "The AI reply was too long and got cut off. Try with a shorter input." };
    }

    let problem: string;
    try {
      const parsed = schema.safeParse(extractJson(text));
      if (parsed.success) return { ok: true, data: parsed.data };
      problem = parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
    } catch (error) {
      problem = error instanceof Error ? error.message : "Invalid JSON.";
    }

    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: `Your reply could not be used (${problem}). Reply again with only the corrected JSON object, no other text.`,
      },
    );
  }

  return { ok: false, error: "The AI returned an unexpected format. Try again." };
}
