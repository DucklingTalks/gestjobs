import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encryption for API keys stored in the database (server-only).
 *
 * AES-256-GCM with a key derived from AI_KEY_ENCRYPTION_SECRET. The user id
 * is bound as additional authenticated data, so a ciphertext copied to
 * another user's row fails to decrypt. Format: "v1.<iv>.<tag>.<data>", each
 * part base64url.
 */

const VERSION = "v1";

function secretKey(secret = process.env.AI_KEY_ENCRYPTION_SECRET?.trim() ?? ""): Buffer | null {
  if (secret.length < 32) return null;
  return createHash("sha256").update(secret).digest();
}

export function isKeyEncryptionConfigured(): boolean {
  return secretKey() !== null;
}

export function encryptSecret(plain: string, userId: string, secret?: string): string {
  const key = secretKey(secret);
  if (!key) throw new Error("AI_KEY_ENCRYPTION_SECRET is missing or shorter than 32 characters.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, data].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

/** The plain secret, or null if it can't be decrypted (wrong secret, user or tampered data). */
export function decryptSecret(sealed: string, userId: string, secret?: string): string | null {
  const key = secretKey(secret);
  if (!key) return null;
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(userId, "utf8"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
