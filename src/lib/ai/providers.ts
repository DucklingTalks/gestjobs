/**
 * AI providers a user can bring their own key for. All of them speak the
 * Anthropic Messages API, so one SDK client works with a different base URL.
 * Client-safe: no secrets, no server imports.
 */

export const AI_PROVIDERS = ["opencode-go", "opencode-zen", "anthropic"] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_MODEL = "claude-haiku-5-5";

export const PROVIDER_INFO: Record<
  AiProvider,
  { label: string; baseURL: string; keyHelp: string; keyUrl: string; keyPlaceholder: string }
> = {
  "opencode-go": {
    label: "OpenCode Go",
    baseURL: "https://opencode.ai/inference/go/anthropic",
    keyHelp: "Your OpenCode Go subscription key.",
    keyUrl: "https://opencode.ai",
    keyPlaceholder: "Paste your OpenCode key",
  },
  "opencode-zen": {
    label: "OpenCode Zen (pay as you go)",
    baseURL: "https://opencode.ai/inference/anthropic",
    keyHelp: "Your OpenCode Zen key.",
    keyUrl: "https://opencode.ai",
    keyPlaceholder: "Paste your OpenCode key",
  },
  anthropic: {
    label: "Anthropic",
    baseURL: "https://api.anthropic.com",
    keyHelp: "An API key from the Claude Console.",
    keyUrl: "https://platform.claude.com/settings/keys",
    keyPlaceholder: "sk-ant-…",
  },
};

export function isAiProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && (AI_PROVIDERS as readonly string[]).includes(value);
}

/** Last 4 characters, shown instead of the key. */
export function keyHint(apiKey: string): string {
  return apiKey.trim().slice(-4);
}
