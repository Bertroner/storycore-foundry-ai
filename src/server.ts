import { createServer, type IncomingMessage } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { WebSocketServer } from "ws";
import { z } from "zod";
import { BridgeSession } from "./bridge-session.js";
import { CombatSensor } from "./combat-sensor.js";
import { DecisionRunner } from "./decision-runner.js";
import { OpenRouterDecisionProvider } from "./openrouter-provider.js";
import { SettingsStore, localDirectory } from "./settings.js";
import { ensure, redact, safeError, SafeError, strictJson } from "./safety.js";

const HOST = "127.0.0.1";
export async function createApp(settings: SettingsStore, port = 3210) {
  const bridge = new BridgeSession();
  const provider = new OpenRouterDecisionProvider(() => settings.credentials());
  const secrets = () => { const s = settings.credentials(); return [s.apiKey, s.bridgeKey]; };
  const runner = new DecisionRunner(new CombatSensor(bridge), provider, secrets);
  let latest: unknown = null, busy = false, controller: AbortController | null = null;
  const runs = new Map<string, { hash: string; result: unknown }>();
  const ws = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024, perMessageDeflate: false });
  const publicRoot = resolve("public");
  async function body(req: IncomingMessage) {
    let bytes = 0; const chunks: Buffer[] = [];
    for await (const chunk of req) { bytes += chunk.length; ensure(bytes <= 16384, "HTTP_BODY_TOO_LARGE"); chunks.push(chunk); }
    return strictJson(Buffer.concat(chunks).toString("utf8"), 16384);
  }
  const app = createServer(async (req, res) => {
    const origin = "http://" + HOST + ":" + (app.address() as { port: number }).port;
    const send = (status: number, data: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
      res.end(redact(JSON.stringify(data), secrets()));
    };
    try {
      ensure(req.headers.host === origin.slice(7), "HOST_DENIED");
      ensure(!req.headers.origin || req.headers.origin === origin, "ORIGIN_DENIED");
      ensure(req.headers["sec-fetch-site"] !== "cross-site", "ORIGIN_DENIED");
      if (req.method === "GET" && (req.url === "/" || req.url === "/app.js")) {
        const script = req.url === "/app.js";
        const content = await readFile(join(publicRoot, script ? "app.js" : "index.html"));
        res.writeHead(200, { "Content-Type": script ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
          "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
        res.end(content); return;
      }
      if (req.method === "GET" && req.url === "/api/status") {
        send(200, { settings: settings.publicView(), bridge: { connected: bridge.connected, epoch: bridge.epoch, readsSent: bridge.readsSent },
          busy, execution: "DISABLED", latest }); return;
      }
      ensure(req.method === "POST" && req.headers.origin === origin && req.headers["x-storycore-local"] === "1" &&
        req.headers["content-type"] === "application/json", "REQUEST_DENIED");
      if (req.url === "/api/cancel") { controller?.abort(); send(200, { status: "CANCEL_REQUESTED", writesDispatched: 0 }); return; }
      ensure(["/api/settings", "/api/test", "/api/decision"].includes(req.url ?? ""), "ROUTE_NOT_FOUND");
      ensure(!busy, "SERVICE_BUSY"); busy = true;
      try {
        const input = await body(req);
        if (req.url === "/api/settings") {
          const oldKey = settings.credentials().bridgeKey;
          const result = await settings.save(input);
          if (oldKey !== settings.credentials().bridgeKey) bridge.disconnect();
          send(200, result);
        } else if (req.url === "/api/test") {
          ensure(JSON.stringify(input) === "{}", "REQUEST_INVALID"); controller = new AbortController();
          const started = Date.now();
          try { send(200, await provider.testConnection(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))); }
          catch (error) { send(400, { success: false, model: settings.publicView().model, latencyMs: Date.now() - started, error: safeError(error) }); }
        } else {
          const parsed = z.object({ requestId: z.string().uuid(), fixture: z.unknown(), mind: z.unknown() }).strict().safeParse(input);
          ensure(parsed.success, "REQUEST_INVALID");
          const data = parsed.data; const hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
          const previous = runs.get(data.requestId);
          if (previous) { ensure(previous.hash === hash, "REPLAY_BODY_CHANGED"); send(200, previous.result); return; }
          ensure(runs.size < 100, "SESSION_RUN_LIMIT");
          ensure(settings.publicView().hasKey, "MODEL_KEY_REQUIRED");
          controller = new AbortController();
          const result = await runner.run(data.fixture, data.mind, controller.signal);
          latest = JSON.parse(redact(JSON.stringify(result), secrets()));
          runs.set(data.requestId, { hash, result: latest });
          await mkdir(join(settings.directory, "decisions"), { recursive: true });
          await writeFile(join(settings.directory, "decisions", result.decisionId + ".json"), JSON.stringify(latest, null, 2), { mode: 0o600 });
          console.log(JSON.stringify({ status: result.status, decisionId: result.decisionId, stateBytes: result.stateBytes, writesDispatched: 0 }));
          send(200, latest);
        }
      } finally { busy = false; controller = null; }
    } catch (error) { if (!res.headersSent) send(400, { error: safeError(error) }); else res.end(); }
  });
  app.requestTimeout = 45000; app.headersTimeout = 10000;
  app.on("upgrade", (req, socket, head) => {
    try {
      const address = app.address() as { port: number }; ensure(req.headers.host === HOST + ":" + address.port, "HOST_DENIED");
      const url = new URL(req.url ?? "", "http://" + HOST);
      const key = settings.credentials().bridgeKey;
      ensure(url.pathname === "/bridge" && key.length >= 16 && !bridge.connected, "BRIDGE_AUTH_DENIED");
      const supplied = url.searchParams.get("apiKey") ?? "";
      const digest = (s: string) => createHash("sha256").update(s).digest();
      ensure(timingSafeEqual(digest(key), digest(supplied)), "BRIDGE_AUTH_DENIED");
      ws.handleUpgrade(req, socket, head, client => bridge.attach(client));
    } catch { socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); socket.destroy(); }
  });
  await new Promise<void>((resolve, reject) => { app.once("error", () => reject(new SafeError("LOCAL_PORT_UNAVAILABLE"))); app.listen(port, HOST, resolve); });
  return { app, bridge, close: async () => {
    controller?.abort(); bridge.disconnect(); for (const client of ws.clients) client.terminate(); ws.close();
    await new Promise<void>(resolve => { app.close(() => resolve()); app.closeIdleConnections(); });
  } };
}
async function main() {
  const settings = new SettingsStore(localDirectory()); await settings.load();
  const runtime = await createApp(settings);
  console.log("StoryCore Phase 1A: http://127.0.0.1:3210 — READ ONLY; Foundry writes disabled.");
  const stop = () => { void runtime.close().then(() => process.exit(0)); };
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
}
