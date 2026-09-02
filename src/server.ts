import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";
import { BridgeSession } from "./bridge-session.js";
import type { SettingsStore } from "./settings.js";
import { ensure, SafeError } from "./safety.js";

const HOST = "127.0.0.1";
// Backend transport only. Settings, decisions and UI are never served over HTTP.
export async function createApp(settings: SettingsStore, port = 3210, bridge = new BridgeSession()) {
  const ws = new WebSocketServer({ noServer: true, maxPayload: 2 * 1024 * 1024, perMessageDeflate: false });
  const app = createServer((req, res) => {
    const expectedHost = HOST + ":" + (app.address() as { port: number }).port;
    const allowed = req.headers.host === expectedHost && !req.headers.origin && req.headers["sec-fetch-site"] !== "cross-site";
    const health = allowed && req.method === "GET" && req.url === "/health";
    res.writeHead(health ? 200 : allowed ? 404 : 400, {
      "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify(health ? { status: "ok", execution: "ENABLED_SUPERVISED" } : { error: "HTTP_UI_DISABLED" }));
    req.resume();
  });
  app.requestTimeout = 10000; app.headersTimeout = 10000;
  app.on("upgrade", (req, socket, head) => {
    try {
      const address = app.address() as { port: number }; ensure(req.headers.host === HOST + ":" + address.port, "HOST_DENIED");
      const url = new URL(req.url ?? "", "http://" + HOST); const key = settings.credentials().bridgeKey;
      ensure(url.pathname === "/bridge" && key.length >= 16 && !bridge.connected, "BRIDGE_AUTH_DENIED");
      const digest = (s: string) => createHash("sha256").update(s).digest();
      ensure(timingSafeEqual(digest(key), digest(url.searchParams.get("apiKey") ?? "")), "BRIDGE_AUTH_DENIED");
      ws.handleUpgrade(req, socket, head, client => bridge.attach(client));
    } catch { socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); socket.destroy(); }
  });
  await new Promise<void>((resolve, reject) => {
    app.once("error", () => reject(new SafeError("LOCAL_PORT_UNAVAILABLE"))); app.listen(port, HOST, resolve);
  });
  return { app, bridge, close: async () => {
    bridge.disconnect(); for (const client of ws.clients) client.terminate(); ws.close();
    await new Promise<void>(resolve => { app.close(() => resolve()); app.closeIdleConnections(); });
  } };
}
