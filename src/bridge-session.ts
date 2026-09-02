import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { z } from "zod";
import { ensure, SafeError, strictJson } from "./safety.js";

const id = z.string().min(1).max(128);
const finite = z.number().finite();
const readParams = {
  "get-world-info": z.object({}).strict(),
  "get-combat-state": z.object({ combatId: id.optional() }).strict(),
  "get-scene-tokens": z.object({ sceneId: id }).strict(),
  "get-token": z.object({ sceneId: id, tokenId: id }).strict(),
  "get-actor": z.object({ actorId: id }).strict(),
  "get-actor-effects": z.object({ actorId: id, includeDisabled: z.boolean().optional() }).strict(),
  "get-combat-turn-context": z.object({ combatId: id }).strict(),
  "get-scene": z.object({ sceneId: id.optional(), includeScreenshot: z.literal(false) }).strict(),
} as const;
const writeParams = {
  "move-token": z.object({ sceneId: id, tokenId: id, x: finite, y: finite,
    animate: z.boolean().optional(), canOpenDoors: z.literal(false).optional() }).strict(),
  "dnd5e/activate-item": z.object({ actorId: id, itemId: id,
    targetTokenIds: z.array(id).max(12).optional() }).strict(),
  "clear-targets": z.object({}).strict(),
  "next-turn": z.object({ combatId: id }).strict(),
} as const;

export const READ_COMMANDS = Object.freeze(Object.keys(readParams));
export const WRITE_COMMANDS = Object.freeze(Object.keys(writeParams));
export type ReadCommand = keyof typeof readParams;
export type WriteCommand = keyof typeof writeParams;
export interface BridgeReader {
  readonly epoch: string;
  readonly connected: boolean;
  read(type: ReadCommand, params: Record<string, unknown>): Promise<unknown>;
}
export interface BridgeCommander extends BridgeReader {
  readonly writesSent: number;
  write(type: WriteCommand, params: Record<string, unknown>): Promise<unknown>;
}
type Pending = { type: string; kind: "read" | "write"; resolve(value: unknown): void; reject(error: Error): void;
  timer: ReturnType<typeof setTimeout> };

export class BridgeSession implements BridgeCommander {
  private socket: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  epoch = randomUUID();
  readsSent = 0;
  writesSent = 0;
  constructor(private timeoutMs = 5000) {}
  get connected() { return this.socket?.readyState === WebSocket.OPEN; }
  attach(socket: WebSocket) {
    ensure(!this.connected, "BRIDGE_ALREADY_CONNECTED");
    this.socket = socket; this.epoch = randomUUID();
    socket.on("message", bytes => {
      if (socket !== this.socket) return;
      try {
        const parsed = strictJson(bytes.toString(), 2 * 1024 * 1024);
        const frame = z.object({ id: z.string(), success: z.boolean(), data: z.unknown().optional(),
          error: z.string().optional() }).strict().safeParse(parsed);
        if (!frame.success) throw new SafeError("INVALID_BRIDGE_FRAME");
        const pending = this.pending.get(frame.data.id); if (!pending) return;
        this.pending.delete(frame.data.id); clearTimeout(pending.timer);
        frame.data.success ? pending.resolve(frame.data.data) :
          pending.reject(new SafeError(pending.kind === "read" ? this.readFailureCode(pending.type, frame.data.error) :
            "BRIDGE_COMMAND_FAILED:" + pending.type));
      } catch { socket.close(1008, "Invalid response"); this.disconnect(); }
    });
    socket.on("error", () => { if (socket === this.socket) this.disconnect(); });
    socket.on("close", () => { if (socket === this.socket) this.disconnect(); });
  }
  protected readFailureCode(_type: string, _error: string | undefined): string { return "BRIDGE_READ_FAILED"; }
  disconnect() {
    const old = this.socket; this.socket = null; this.epoch = randomUUID();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer); pending.reject(new SafeError("BRIDGE_DISCONNECTED"));
    }
    this.pending.clear(); old?.close();
  }
  async read(type: ReadCommand, params: Record<string, unknown>): Promise<unknown> {
    ensure(Object.hasOwn(readParams, type), "READ_ONLY_COMMAND_DENIED");
    ensure(readParams[type].safeParse(params).success, "READ_PARAMS_INVALID");
    return this.send(type, params, this.timeoutMs, "read");
  }
  async write(type: WriteCommand, params: Record<string, unknown>): Promise<unknown> {
    ensure(Object.hasOwn(writeParams, type), "WRITE_COMMAND_DENIED");
    ensure(writeParams[type].safeParse(params).success, "WRITE_PARAMS_INVALID");
    const timeout = type === "dnd5e/activate-item" ? 40000 : Math.max(this.timeoutMs, 10000);
    return this.send(type, params, timeout, "write");
  }
  // Reused by the isolated test reader; production read() and write() retain exact allowlists.
  protected async sendRead(type: string, params: Record<string, unknown>): Promise<unknown> {
    return this.send(type, params, this.timeoutMs, "read");
  }
  private async send(type: string, params: Record<string, unknown>, timeoutMs: number, kind: "read" | "write") {
    ensure(this.connected && this.socket, "BRIDGE_DISCONNECTED");
    ensure(this.pending.size < 16, "TOO_MANY_BRIDGE_REQUESTS");
    const socket = this.socket; const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new SafeError(kind === "read" ? "BRIDGE_READ_TIMEOUT" : "BRIDGE_COMMAND_TIMEOUT:" + type));
        this.disconnect();
      }, timeoutMs);
      this.pending.set(requestId, { type, kind, resolve, reject, timer });
      if (kind === "read") this.readsSent++; else this.writesSent++;
      socket.send(JSON.stringify({ id: requestId, type, params }), error => {
        if (!error) return;
        const pending = this.pending.get(requestId);
        if (pending) {
          clearTimeout(pending.timer); this.pending.delete(requestId);
          pending.reject(new SafeError(kind === "read" ? "BRIDGE_SEND_FAILED" : "BRIDGE_COMMAND_SEND_FAILED:" + type));
        }
      });
    });
  }
}
