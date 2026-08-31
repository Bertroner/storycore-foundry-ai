import type { DesktopApi, IpcResult, RunDecisionInput } from "./api.js";
import type { DetectedTurn } from "../src/turn-detector.js";
declare global { interface Window { storycore: DesktopApi } }
const api = window.storycore;
function el(id: string): HTMLElement { const node = document.getElementById(id); if (!node) throw new Error("Missing UI element"); return node; }
const input = (id: string) => el(id) as HTMLInputElement;
const button = (id: string) => el(id) as HTMLButtonElement;
const view = (id: string, data: unknown) => { el(id).textContent = JSON.stringify(data, null, 2); };
async function unwrap<T>(result: Promise<IpcResult<T>>): Promise<T> {
  const reply = await result; if (!reply.ok) throw new Error(reply.error); return reply.data;
}
let initialized = false, lastDecisionId: string | null = null, localBusy = false;
let detected: DetectedTurn | null = null;
const selected = new Set<string>();
function scopeError(code: string) {
  if (code === "DETECTED_SCOPE_STALE") return "The detected turn or selected targets changed. Click Detect / Refresh and confirm again. " + code;
  if (["NO_ACTIVE_NPC_TURN", "UNSUPPORTED_CURRENT_COMBAT", "UNSUPPORTED_ACTOR"].includes(code))
    return "No supported active NPC turn. Start combat and make the NPC current. " + code;
  if (code === "UNSUPPORTED_GRID_OR_DOORS") return "Current scene unsupported: square grid in feet, no doors required. " + code;
  if (code.startsWith("BRIDGE_DATA_INVALID:get-combat-state")) return "Could not read current Foundry combat: " + code;
  return "Could not use the current Foundry turn. Check the active scene, NPC turn and Bridge connection. " + code;
}
function resetConfirmation() { input("attest").checked = false; lock(localBusy); }
function updateRelationships() {
  const names = detected?.candidates.filter(c => selected.has(c.candidateId) && c.disposition === "hostile").map(c => c.name + ": Hostile combatant") ?? [];
  el("relationships").textContent = names.join("\n") || "No selected hostile combatants.";
}
function showDetected(data: DetectedTurn) {
  detected = data; selected.clear(); input("attest").checked = false;
  el("turnSummary").hidden = false;
  el("sceneName").textContent = data.scene.name;
  el("combatName").textContent = "Round " + data.combat.round + " / Turn " + (data.combat.turn + 1);
  el("npcName").textContent = data.npc.name;
  el("npcHp").textContent = data.npc.hp ? data.npc.hp.current + " / " + data.npc.hp.max : "Unknown";
  el("tokenName").textContent = data.token.name;
  el("targets").replaceChildren();
  for (const candidate of data.candidates) {
    const row = document.createElement("label"); row.className = "target-row";
    const check = document.createElement("input"); check.type = "checkbox";
    check.checked = candidate.eligible; check.disabled = !candidate.eligible;
    check.dataset.candidate = candidate.candidateId; check.dataset.eligible = String(candidate.eligible);
    if (candidate.eligible) selected.add(candidate.candidateId);
    const text = document.createElement("span");
    text.textContent = candidate.name + " / " + candidate.disposition +
      (candidate.distanceFt === null ? "" : " / " + candidate.distanceFt + " ft") +
      (candidate.eligible ? " / LOS reported (confirm perception)" : " / Excluded: " + candidate.excludedReason);
    check.onchange = () => {
      if (check.checked) selected.add(candidate.candidateId); else selected.delete(candidate.candidateId);
      resetConfirmation(); updateRelationships();
    };
    row.append(check, text); el("targets").append(row);
  }
  if (!data.candidates.length) el("targets").textContent = "No other combatants detected.";
  view("turnDiagnostics", { detectionId: data.detectionId, detectedAt: data.detectedAt, sceneId: data.scene.id,
    combatId: data.combat.id, round: data.combat.round, turn: data.combat.turn, combatantId: data.combat.combatantId,
    actorId: data.npc.actorId, tokenId: data.token.id, actorLink: null,
    participants: data.candidates.map(c => ({ name: c.name, actorId: c.actorId, tokenId: c.tokenId, combatantId: c.combatantId })) });
  updateRelationships();
}
const savedKeys = { apiKey: false, bridgeKey: false };
function keyStatus(field: keyof typeof savedKeys) {
  const typed = !!input(field).value;
  el(field + "Status").textContent = typed
    ? "New value entered; not saved yet." + (savedKeys[field] ? " A saved key already exists." : "")
    : savedKeys[field] ? "Saved on this PC. The saved key is hidden; no need to enter it again." : "No key saved on this PC.";
  input(field).placeholder = savedKeys[field] ? "Saved key hidden; blank keeps it" : field === "bridgeKey" ? "Enter at least 16 characters" : "Enter OpenRouter API key";
}
function lock(busy: boolean) {
  for (const id of ["save", "test", "clearApi", "clearBridge", "detect", "refreshTurn"]) button(id).disabled = busy;
  button("run").disabled = busy || !detected || !input("attest").checked;
  input("attest").disabled = busy || !detected;
  for (const node of document.querySelectorAll<HTMLInputElement>("[data-candidate]")) node.disabled = busy || node.dataset.eligible !== "true";
}
async function refresh() {
  try {
    const data = await unwrap(api.status());
    el("status").textContent = "Adapter ready | Bridge " + (data.bridge.connected ? "CONNECTED" : "disconnected") +
      " | Reads sent: " + data.bridge.readsSent + " | " + (data.busy ? "Busy" : "Idle") +
      " | OpenRouter key: " + (data.settings.hasOpenRouterKey ? "stored" : "missing") +
      " | Bridge key: " + (data.settings.hasBridgeKey ? "stored" : "missing") + " | Execution DISABLED";
    if (!initialized) { input("model").value = data.settings.model; input("temperature").value = String(data.settings.temperature); initialized = true;
      (document.querySelector(".settings-panel") as HTMLDetailsElement).open = !data.settings.hasOpenRouterKey || !data.settings.hasBridgeKey; }
    savedKeys.apiKey = data.settings.hasOpenRouterKey; savedKeys.bridgeKey = data.settings.hasBridgeKey;
    keyStatus("apiKey"); keyStatus("bridgeKey");
    if (detected && detected.epoch !== data.bridge.epoch) {
      detected = null; input("attest").checked = false;
      el("turnStatus").textContent = "Bridge session changed. Click Detect / Refresh again.";
    }
    lock(data.busy || localBusy);
    if (data.latest && !data.busy && !localBusy && data.latest.decisionId !== lastDecisionId) {
      view("result", data.latest); lastDecisionId = data.latest.decisionId;
    }
  } catch { el("status").textContent = "Desktop runtime unavailable. Close and restart the app."; }
}
async function operation(output: string, run: () => Promise<unknown>) {
  localBusy = true; lock(true);
  try {
    const result = await run();
    if (output === "turnStatus") { const data = result as { status: string; message: string }; el(output).textContent = data.status + "\n" + data.message; }
    else view(output, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    if (output === "turnStatus") el(output).textContent = message; else view(output, { error: message });
  }
  finally { localBusy = false; await refresh(); }
}
for (const [field, toggle] of [["apiKey", "showApi"], ["bridgeKey", "showBridge"]] as const) {
  input(field).oninput = () => keyStatus(field);
  button(toggle).onclick = () => {
    const show = input(field).type === "password"; input(field).type = show ? "text" : "password";
    button(toggle).textContent = show ? "Hide typed key" : "Show typed key";
  };
}
button("save").onclick = () => void operation("settingsResult", async () => {
  const data = { provider: "openrouter" as const, model: input("model").value.trim(), temperature: Number(input("temperature").value),
    apiKey: input("apiKey").value, bridgeKey: input("bridgeKey").value };
  if (data.bridgeKey.trim() && data.bridgeKey.trim().length < 16)
    throw new Error("Not saved: the local Bridge key needs at least 16 characters. Your typed values are kept; correct the key and save again.");
  let saved;
  try { saved = await unwrap(api.saveSettings(data)); }
  catch {
    throw new Error("Settings were not confirmed saved. Your typed values are kept. Check the model ID, temperature (0-2), key lengths (maximum 512 characters), and local storage, then retry.");
  }
  // Clear only successfully submitted values, never edits made while the save was pending.
  for (const [field, toggle] of [["apiKey", "showApi"], ["bridgeKey", "showBridge"]] as const) {
    if (input(field).value === data[field]) {
      input(field).value = ""; input(field).type = "password"; button(toggle).textContent = "Show typed key";
    }
  }
  return { status: "SETTINGS_SAVED", message: "Saved on this PC. Key fields are now empty for privacy; blank fields keep saved keys.",
    openRouterKey: saved.hasOpenRouterKey ? "saved (hidden)" : "not saved",
    bridgeKey: saved.hasBridgeKey ? "saved (hidden)" : "not saved" };
});
button("test").onclick = () => void operation("settingsResult", async () => {
  view("settingsResult", { status: "Testing saved OpenRouter settings in main..." }); return unwrap(api.testOpenRouter());
});
button("clearApi").onclick = () => void operation("settingsResult", async () => {
  input("apiKey").value = ""; return unwrap(api.clearOpenRouterKey());
});
button("clearBridge").onclick = () => void operation("settingsResult", async () => {
  input("bridgeKey").value = ""; return unwrap(api.clearBridgeKey());
});
async function detectTurn() {
  detected = null; selected.clear(); input("attest").checked = false; el("turnSummary").hidden = true;
  await operation("turnStatus", async () => {
    el("turnStatus").textContent = "Reading current combat and active scene...";
    try { showDetected(await unwrap(api.detectTurn())); }
    catch (error) { throw new Error(scopeError(error instanceof Error ? error.message : "REQUEST_FAILED")); }
    return { status: "SUPPORTED FOR PHASE 1A", message: "Inspect targets and confirm perception / linked-Actor scope before running. No writes." };
  });
}
button("detect").onclick = () => void detectTurn();
button("refreshTurn").onclick = () => void detectTurn();
input("attest").onchange = () => lock(localBusy);
button("run").onclick = () => void operation("result", async () => {
  if (!detected || !input("attest").checked) throw new Error("Detect the current turn and confirm the selected targets for this run.");
  const request: RunDecisionInput = { requestId: crypto.randomUUID(), detectionId: detected.detectionId,
    selectedCandidateIds: [...selected], attested: true,
    mind: { personality: input("personality").value, motivation: input("motivation").value,
      relevantMemory: JSON.parse(input("memory").value) } };
  input("attest").checked = false;
  view("result", { status: "Rechecking detected scope and asking real OpenRouter in main. No writes..." });
  try {
    const result = await unwrap(api.runDecision(request)); lastDecisionId = result.decisionId;
    if (result.status === "DETECTED_SCOPE_STALE") {
      detected = null; el("turnStatus").textContent = scopeError(result.status);
    }
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === "DETECTED_SCOPE_STALE") {
      detected = null; el("turnStatus").textContent = scopeError(error.message); throw new Error(scopeError(error.message));
    }
    throw error;
  }
});
button("cancel").onclick = async () => {
  try { await unwrap(api.cancelDecision()); } catch { view("result", { error: "CANCEL_FAILED" }); }
};
void refresh(); setInterval(() => void refresh(), 2000);
