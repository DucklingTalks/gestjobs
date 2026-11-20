import { afterEach, describe, expect, it, vi } from "vitest";

import { canUseSharedKey, sharedKeyEmails } from "@/lib/ai/access";
import { deploymentAiConfig, providerAiConfig } from "@/lib/ai/client";
import { isAiProvider, keyHint, PROVIDER_INFO } from "@/lib/ai/providers";
import { decryptSecret, encryptSecret } from "@/lib/ai/secret-box";

const SECRET = "a".repeat(40);
const USER = "6f1c2a4e-1111-4b9a-9c1d-000000000001";
const OTHER = "6f1c2a4e-1111-4b9a-9c1d-000000000002";

describe("secret box", () => {
  it("round-trips a key for the same user", () => {
    const sealed = encryptSecret("sk-ant-api03-secret", USER, SECRET);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("sk-ant");
    expect(decryptSecret(sealed, USER, SECRET)).toBe("sk-ant-api03-secret");
  });

  it("uses a fresh IV every time", () => {
    expect(encryptSecret("same", USER, SECRET)).not.toBe(encryptSecret("same", USER, SECRET));
  });

  it("refuses another user's ciphertext, a wrong secret and tampered data", () => {
    const sealed = encryptSecret("sk-ant-api03-secret", USER, SECRET);
    expect(decryptSecret(sealed, OTHER, SECRET)).toBeNull();
    expect(decryptSecret(sealed, USER, "b".repeat(40))).toBeNull();
    const [v, iv, tag, data] = sealed.split(".");
    const flipped = `${data[0] === "A" ? "B" : "A"}${data.slice(1)}`;
    expect(decryptSecret([v, iv, tag, flipped].join("."), USER, SECRET)).toBeNull();
    expect(decryptSecret("garbage", USER, SECRET)).toBeNull();
  });

  it("requires a secret of at least 32 characters", () => {
    expect(() => encryptSecret("x", USER, "short")).toThrow(/AI_KEY_ENCRYPTION_SECRET/);
    expect(decryptSecret(encryptSecret("x", USER, SECRET), USER, "short")).toBeNull();
  });
});

describe("shared key allowlist", () => {
  it("matches emails case-insensitively and ignores blanks", () => {
    const raw = " Owner@Example.com, ,friend@example.com ";
    expect(sharedKeyEmails(raw)).toEqual(["owner@example.com", "friend@example.com"]);
    expect(canUseSharedKey("owner@example.com", raw)).toBe(true);
    expect(canUseSharedKey("OWNER@example.com", raw)).toBe(true);
    expect(canUseSharedKey("stranger@example.com", raw)).toBe(false);
    expect(canUseSharedKey(undefined, raw)).toBe(false);
    expect(canUseSharedKey("owner@example.com", "")).toBe(false);
  });
});

describe("AI configs", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("maps each provider to its endpoint", () => {
    expect(providerAiConfig("anthropic", "k").baseURL).toBe("https://api.anthropic.com");
    expect(providerAiConfig("opencode-zen", "k").baseURL).toBe(PROVIDER_INFO["opencode-zen"].baseURL);
    expect(providerAiConfig("opencode-go", "k").model).toBe("claude-haiku-5-5");
  });

  it("reads the deployment key from the environment", () => {
    vi.stubEnv("OPENCODE_API_KEY", "");
    expect(deploymentAiConfig()).toBeNull();
    vi.stubEnv("OPENCODE_API_KEY", "deploy-key");
    vi.stubEnv("AI_BASE_URL", "https://gateway.example.com/anthropic/");
    vi.stubEnv("AI_MODEL", "claude-sonnet-5-5");
    expect(deploymentAiConfig()).toEqual({
      provider: "custom",
      apiKey: "deploy-key",
      baseURL: "https://gateway.example.com/anthropic",
      model: "claude-sonnet-5-5",
    });
  });

  it("validates providers and hints keys", () => {
    expect(isAiProvider("anthropic")).toBe(true);
    expect(isAiProvider("openai")).toBe(false);
    expect(keyHint(" sk-ant-1234abcd ")).toBe("abcd");
  });
});
