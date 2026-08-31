// Supervised read-only Phase 1A: real OpenRouter/Qwen exceeded the original 30-second window.
// Snapshot expiry and the entire bounded decision share this lifetime; continuations never reset it.
export const PHASE1A_DECISION_LIFETIME_MS = 60_000;
