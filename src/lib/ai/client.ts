import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

/**
 * AI access for gestjobs.
 *
 * Requests go through the official Anthropic SDK against an
 * Anthropic-Messages-compatible endpoint. By default that is OpenCode
 * (`https://opencode.ai/inference/go/anthropic`), so the model, base URL
 * and key are all configurable:
 *
 *   OPENCODE_API_KEY   required — the gateway API key
 *   AI_BASE_URL        optional — e.g. https://opencode.ai/inference/anthropic for Zen
 *   AI_MODEL           optional — defaults to claude-haiku-5-5
 *
 * Server-only: never import this from a Client Component.
 */

const DEFAULT_BASE_URL = "https://opencode.ai/inference/go/anthropic";
const DEFAULT_MODEL = "claude-haiku-5-5";

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

function config() {
  return {
    apiKey: process.env.OPENCODE_API_KEY?.trim() ?? "",
    baseURL: (process.env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, ""),
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export function isAiConfigured(): boolean {
  return Boolean(config().apiKey);
}

export function aiModel(): string {
  return config().model;
}

let cached: { key: string; client: Anthropic } | null = null;

function client(): Anthropic {
  const { apiKey, baseURL } = config();
  const key = `${baseURL}|${apiKey}`;
  if (cached?.key === key) return cached.client;
  const instance = new Anthropic({
    apiKey,
    baseURL,
    maxRetries: 2,
    timeout: 120_000,
    // OpenCode authenticates with a bearer token and asks clients to
    // identify themselves; x-api-key (sent by apiKey) covers Anthropic-style
    // gateways.
    defaultHeaders: {
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "gestjobs/0.1",
    },
  });
  cached = { key, client: instance };
  return instance;
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "The AI provider rejected the API key. Check OPENCODE_API_KEY.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "The AI usage limit was reached. Try again later.";
  }
  if (error instanceof Anthropic.NotFoundError) {
    return "The AI model or endpoint was not found. Check AI_MODEL and AI_BASE_URL.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach the AI provider. Check your connection and try again.";
  }
  if (error instanceof Anthropic.APIError) {
    return `The AI provider returned an error (${error.status ?? "unknown"}). Try again in a moment.`;
  }
  return "Something went wrong while talking to the AI. Try again in a moment.";
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
  system,
  prompt,
  schema,
  maxTokens = 8_000,
}: {
  system: string;
  prompt: string;
  schema: S;
  maxTokens?: number;
}): Promise<AiResult<z.infer<S>>> {
  if (!isAiConfigured()) {
    return { ok: false, error: "AI is not configured. Add OPENCODE_API_KEY to the environment." };
  }

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];

  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Anthropic.Message;
    try {
      response = await client().messages.create({
        model: config().model,
        max_tokens: maxTokens,
        system,
        messages,
      });
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
