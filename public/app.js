const el = id => document.getElementById(id);
const view = (id, value) => { el(id).textContent = JSON.stringify(value, null, 2); };
async function api(path, value) {
  const response = await fetch(path, value === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", "X-StoryCore-Local": "1" }, body: JSON.stringify(value) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
let initialized = false, lastDecisionId = null;
async function refresh() {
  try {
    const data = await api("/api/status");
    el("status").textContent = "Bridge: " + (data.bridge.connected ? "CONNECTED" : "disconnected") +
      " | Read commands sent: " + data.bridge.readsSent + " | Service: " + (data.busy ? "busy" : "ready") +
      " | OpenRouter key: " + (data.settings.hasKey ? "stored" : "missing") + " | Bridge key: " + (data.settings.hasBridgeKey ? "stored" : "missing") + " | Execution DISABLED";
    if (!initialized) { el("model").value = data.settings.model; el("temperature").value = data.settings.temperature; initialized = true; }
    if (data.latest && !data.busy && !el("run").disabled && data.latest.decisionId !== lastDecisionId) { view("result", data.latest); lastDecisionId = data.latest.decisionId; }
  } catch { el("status").textContent = "Local service unavailable"; }
}
el("save").onclick = async () => {
  try {
    view("settingsResult", await api("/api/settings", { provider: "openrouter", model: el("model").value.trim(),
      temperature: Number(el("temperature").value), apiKey: el("apiKey").value, bridgeKey: el("bridgeKey").value }));
  } catch (e) { view("settingsResult", { error: e.message }); }
  finally { el("apiKey").value = ""; el("bridgeKey").value = ""; await refresh(); }
};
el("test").onclick = async () => {
  view("settingsResult", { status: "Testing saved model with a real OpenRouter requestРІР‚В¦" });
  try { view("settingsResult", await api("/api/test", {})); } catch (e) { view("settingsResult", { error: e.message }); }
};
const ids = id => el(id).value.split(",").map(v => v.trim()).filter(Boolean);
el("run").onclick = async () => {
  el("run").disabled = true;
  try {
    if (!el("attest").checked) throw new Error("Verify the scene and tick the attestation for this run.");
    const actorId = el("actorId").value.trim();
    const fixture = { sceneId: el("sceneId").value.trim(), combatId: el("combatId").value.trim(), actorId,
      tokenId: el("tokenId").value.trim(), linkedActorIds: ids("linkedActorIds"), perceivedTokenIds: ids("perceivedTokenIds"),
      attestSingleActiveCombat: true, attestViewedCombatScene: true, attestNormalWalkingNoTerrain: true };
    const mind = { actorId, personality: el("personality").value, motivation: el("motivation").value,
      relationships: JSON.parse(el("relationships").value), relevantMemory: JSON.parse(el("memory").value) };
    el("attest").checked = false;
    view("result", { status: "Reading live Foundry and asking real OpenRouter; no writesРІР‚В¦" });
    const result = await api("/api/decision", { requestId: crypto.randomUUID(), fixture, mind });
    view("result", result); lastDecisionId = result.decisionId;
  } catch (e) { view("result", { error: e.message }); } finally { el("run").disabled = false; }
};
el("cancel").onclick = async () => { try { await api("/api/cancel", {}); } catch (e) { view("result", { error: e.message }); } };
void refresh(); setInterval(refresh, 2000);
