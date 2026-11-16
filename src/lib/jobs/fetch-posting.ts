import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetch a job posting URL and reduce it to plain text (server-only).
 *
 * Prefers schema.org `JobPosting` JSON-LD, which most job boards embed, and
 * falls back to the page's visible text. Guards against requests to
 * private/internal addresses, since the URL is user-supplied.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;

export type PostingResult =
  | { ok: true; text: string; title: string; company: string }
  | { ok: false; error: string };

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = address.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function assertPublicUrl(url: URL): Promise<string | null> {
  if (url.protocol !== "https:" && url.protocol !== "http:") return "Only http(s) links are supported.";
  if (url.username || url.password) return "Links with credentials are not supported.";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    return "That address is not reachable.";
  }
  try {
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      return "That address is not reachable.";
    }
  } catch {
    return "That website could not be found.";
  }
  return null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article|ul|ol)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type JsonLd = Record<string, unknown>;

function findJobPosting(node: unknown): JsonLd | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  const record = node as JsonLd;
  const type = record["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return record;
  return findJobPosting(record["@graph"]);
}

export function extractJobPosting(html: string): { text: string; title: string; company: string } | null {
  const scripts = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    try {
      const posting = findJobPosting(JSON.parse(body));
      if (!posting) continue;
      const title = typeof posting.title === "string" ? posting.title : "";
      const org = posting.hiringOrganization as JsonLd | string | undefined;
      const company = typeof org === "string" ? org : typeof org?.name === "string" ? org.name : "";
      const description = typeof posting.description === "string" ? htmlToText(posting.description) : "";
      if (description.length < 80) continue;
      const header = [title, company].filter(Boolean).join(" — ");
      return { text: header ? `${header}\n\n${description}` : description, title, company };
    } catch {
      // Malformed JSON-LD; try the next block.
    }
  }
  return null;
}

async function readLimited(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

export async function fetchJobPosting(rawUrl: string): Promise<PostingResult> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: "Enter a valid job posting URL." };
  }

  let response: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const problem = await assertPublicUrl(url);
    if (problem) return { ok: false, error: problem };
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; gestjobs/0.1; +job posting reader)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en,es;q=0.8",
        },
      });
    } catch {
      return { ok: false, error: "The page took too long or could not be reached. Paste the posting text instead." };
    }
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    break;
  }

  if (!response || response.status >= 300) {
    return {
      ok: false,
      error:
        response && [401, 403, 429, 999].includes(response.status)
          ? "That site blocks automatic reading (common on LinkedIn). Paste the posting text instead."
          : "The page could not be loaded. Paste the posting text instead.",
    };
  }

  const html = await readLimited(response);
  const posting = extractJobPosting(html);
  if (posting) return { ok: true, ...posting };

  const text = htmlToText(html);
  if (text.length < 200) {
    return {
      ok: false,
      error: "No posting text was found on that page (it may need a login or JavaScript). Paste the text instead.",
    };
  }
  return { ok: true, text: text.slice(0, 30_000), title: "", company: "" };
}
