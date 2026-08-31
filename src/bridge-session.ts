import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { z } from "zod";
import { ensure, SafeError, strictJson } from "./safety.js";

const id = z.string().min(1).max(128);
const readParams = {
  "get-world-info": z.object({}).strict(),
  "get-combat-state": z.object({ combatId: id.optional() }).strict(),
  "get-scene-tokens": z.object({ sceneId: id }).strict(),
  "get-token": z.object({ sceneId: id, tokenId: id }).strict(),
  "get-actor": z.object({ actorId: id }).strict(),
  "get-actor-effects": z.object({ actorId: id, includeDisabled: z.boolean().optional() }).strict(),
  "get-combat-turn-context": z.object({ combatId: id }).strict(),
  "get-scene": z.object({ sceneId: id, includeScreenshot: z.literal(false) }).strict(),
} as const;
export const READ_COMMANDS = Object.freeze(Object.keys(readParams));
export type ReadCommand = keyof typeof readParams;
export interface BridgeReader { readonly epoch: string; readonly connected: boolean; read(type: ReadCommand, params: Record<string, unknown>): Promise<unknown> }
type Pending = { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> };
export class BridgeSession implements BridgeReader {
  private socket: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  epoch = randomUUID();
  readsSent = 0;
  constructor(private timeoutMs = 5000) {}
  get connected() { return this.socket?.readyState === WebSocket.OPEN; }
  attach(socket: WebSocket) {
    ensure(!this.connected, "BRIDGE_ALREADY_CONNECTED");
    this.socket = socket; this.epoch = randomUUID();
    socket.on("message", bytes => {
      if (socket !== this.socket) return;
      try {
        const parsed = strictJson(bytes.toString(), 2 * 1024 * 1024);
        const frame = z.object({ id: z.string(), success: z.boolean(), data: z.unknown().optional(), error: z.string().optional() }).strict().safeParse(parsed);
        if (!frame.success) throw new SafeError("INVALID_BRIDGE_FRAME");
        const pending = this.pending.get(frame.data.id); if (!pending) return;
        this.pending.delete(frame.data.id); clearTimeout(pending.timer);
        frame.data.success ? pending.resolve(frame.data.data) : pending.reject(new SafeError("BRIDGE_READ_FAILED"));
      } catch { socket.close(1008, "Invalid response"); this.disconnect(); }
    });
    socket.on("error", () => { if (socket === this.socket) this.disconnect(); });
    socket.on("close", () => { if (socket === this.socket) this.disconnect(); });
  }
  disconnect() {
    const old = this.socket; this.socket = null; this.epoch = randomUUID();
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(new SafeError("BRIDGE_DISCONNECTED")); }
    this.pending.clear(); old?.close();
  }
  async read(type: ReadCommand, params: Record<string, unknown>): Promise<unknown> {
    ensure(Object.hasOwn(readParams, type), "READ_ONLY_COMMAND_DENIED");
    ensure(readParams[type].safeParse(params).success, "READ_PARAMS_INVALID");
    ensure(this.connected && this.socket, "BRIDGE_DISCONNECTED");
    ensure(this.pending.size < 16, "TOO_MANY_READS");
    const socket = this.socket; const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new SafeError("BRIDGE_READ_TIMEOUT")); this.disconnect(); }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer }); this.readsSent++;
      socket.send(JSON.stringify({ id, type, params }), error => {
        if (!error) return;
        const p = this.pending.get(id); if (p) { clearTimeout(p.timer); this.pending.delete(id); p.reject(new SafeError("BRIDGE_SEND_FAILED")); }
      });
    });
  }
}
