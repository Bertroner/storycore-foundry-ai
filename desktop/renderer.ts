import type { DesktopApi, IpcResult, RunDecisionInput } from "./api.js";
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
const ids = (id: string) => input(id).value.split(",").map(value => value.trim()).filter(Boolean);
function lock(busy: boolean) {
  for (const id of ["save", "test", "clearApi", "clearBridge", "run"]) button(id).disabled = busy;
}
async function refresh() {
  try {
    const data = await unwrap(api.status());
    el("status").textContent = "Adapter ready | Bridge " + (data.bridge.connected ? "CONNECTED" : "disconnected") +
      " | Reads sent: " + data.bridge.readsSent + " | " + (data.busy ? "Busy" : "Idle") +
      " | OpenRouter key: " + (data.settings.hasOpenRouterKey ? "stored" : "missing") +
      " | Bridge key: " + (data.settings.hasBridgeKey ? "stored" : "missing") + " | Execution DISABLED";
    if (!initialized) { input("model").value = data.settings.model; input("temperature").value = String(data.settings.temperature); initialized = true; }
    lock(data.busy || localBusy);
    if (data.latest && !data.busy && !localBusy && data.latest.decisionId !== lastDecisionId) {
      view("result", data.latest); lastDecisionId = data.latest.decisionId;
    }
  } catch { el("status").textContent = "Desktop runtime unavailable. Close and restart the app."; }
}
async function operation(output: string, run: () => Promise<unknown>) {
  localBusy = true; lock(true);
  try { view(output, await run()); } catch (error) { view(output, { error: error instanceof Error ? error.message : "REQUEST_FAILED" }); }
  finally { localBusy = false; await refresh(); }
}
for (const [field, toggle] of [["apiKey", "showApi"], ["bridgeKey", "showBridge"]] as const) {
  button(toggle).onclick = () => {
    const show = input(field).type === "password"; input(field).type = show ? "text" : "password";
    button(toggle).textContent = show ? "Hide typed key" : "Show typed key";
  };
}
button("save").onclick = () => void operation("settingsResult", async () => {
  const data = { provider: "openrouter" as const, model: input("model").value.trim(), temperature: Number(input("temperature").value),
    apiKey: input("apiKey").value, bridgeKey: input("bridgeKey").value };
  const pending = api.saveSettings(data);
  // Clear only the submitted values; status polling never populates either secret field.
  input("apiKey").value = ""; input("bridgeKey").value = "";
  input("apiKey").type = "password"; input("bridgeKey").type = "password";
  button("showApi").textContent = "Show typed key"; button("showBridge").textContent = "Show typed key";
  return unwrap(pending);
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
button("run").onclick = () => void operation("result", async () => {
  if (!input("attest").checked) throw new Error("Verify the scene and tick the attestation for this run.");
  const actorId = input("actorId").value.trim();
  const request: RunDecisionInput = { requestId: crypto.randomUUID(),
    fixture: { sceneId: input("sceneId").value.trim(), combatId: input("combatId").value.trim(), actorId,
      tokenId: input("tokenId").value.trim(), linkedActorIds: ids("linkedActorIds"), perceivedTokenIds: ids("perceivedTokenIds"),
      attestSingleActiveCombat: true, attestViewedCombatScene: true, attestNormalWalkingNoTerrain: true },
    mind: { actorId, personality: input("personality").value, motivation: input("motivation").value,
      relationships: JSON.parse(input("relationships").value), relevantMemory: JSON.parse(input("memory").value) } };
  input("attest").checked = false;
  view("result", { status: "Reading Foundry and asking real OpenRouter in main. No writes..." });
  const result = await unwrap(api.runDecision(request)); lastDecisionId = result.decisionId; return result;
});
button("cancel").onclick = async () => {
  try { await unwrap(api.cancelDecision()); } catch { view("result", { error: "CANCEL_FAILED" }); }
};
void refresh(); setInterval(() => void refresh(), 2000);
