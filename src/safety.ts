import { parseTree, type Node, type ParseError } from "jsonc-parser";

export class SafeError extends Error { constructor(public code: string) { super(code); } }
export function ensure(ok: unknown, code: string): asserts ok { if (!ok) throw new SafeError(code); }
const BRIDGE_DIAGNOSTIC_READS = new Set(["get-combat-state", "get-world-info", "get-scene", "get-scene-tokens",
  "get-actor", "get-actor-effects", "get-combat-turn-context", "get-token"]);
export const BRIDGE_DIAGNOSTIC_FIELDS: ReadonlySet<string> = new Set(["payload", "id", "sceneId", "name", "x", "y",
  "width", "height", "elevation", "rotation", "hidden", "disposition", "actorId", "textureSrc", "hp", "ac",
  "round", "turn", "started", "current", "combatants", "world", "active", "grid", "walls", "tokens",
  "type", "system", "items", "activeStatuses", "effects", "currentCombatant", "nearbyTokens"]);
export function safeError(error: unknown): string {
  if (!(error instanceof SafeError)) return "INTERNAL_ERROR";
  if (/^[A-Z0-9_]{1,80}$/.test(error.code)) return error.code;
  const parts = error.code.split(":");
  return parts.length === 3 && parts[0] === "BRIDGE_DATA_INVALID" &&
    BRIDGE_DIAGNOSTIC_READS.has(parts[1]!) && BRIDGE_DIAGNOSTIC_FIELDS.has(parts[2]!) ? error.code : "INTERNAL_ERROR";
}
export function strictJson(text: string, cap = 8192): unknown {
  ensure(Buffer.byteLength(text) <= cap, "PAYLOAD_TOO_LARGE");
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
  ensure(tree && !errors.length, "INVALID_JSON");
  function walk(node: Node, depth: number) {
    ensure(depth <= 32, "JSON_TOO_DEEP");
    if (node.type === "object") {
      const keys = (node.children ?? []).map(p => p.children?.[0]?.value);
      ensure(new Set(keys).size === keys.length, "DUPLICATE_JSON_KEY");
    }
    for (const child of node.children ?? []) walk(child, depth + 1);
  }
  walk(tree, 0);
  try { return JSON.parse(text); } catch { throw new SafeError("INVALID_JSON"); }
}
export function redact(text: string, secrets: string[] = []): string {
  for (const secret of secrets.filter(Boolean)) text = text.split(secret).join("[REDACTED]");
  return text.replace(/(?:sk-or-v1-|sk-|pk_)[A-Za-z0-9_-]{8,}/g, "[REDACTED]")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/(apiKey[=:]\s*)[^&\s"']+/gi, "$1[REDACTED]");
}
export function ensureNoSecrets(text: string, secrets: string[]) {
  ensure(secrets.filter(Boolean).every(s => !text.includes(s)) && redact(text) === text, "SECRET_IN_CONTEXT");
}
export function plain(value: unknown, cap = 80): string {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, cap) : "";
}
export function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export async function limitedText(response: Response, cap: number): Promise<string> {
  ensure(response.body, "EMPTY_PROVIDER_RESPONSE");
  const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; ensure(size <= cap, "PROVIDER_RESPONSE_TOO_LARGE"); chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks).toString("utf8");
}
