import type { DesktopService } from "../src/desktop-service.js";
import { ensure, safeError } from "../src/safety.js";
export const UI_URL = "storycore-app://ui/index.html";
export const IPC_CHANNELS = Object.freeze([
  "storycore:status", "storycore:save-settings", "storycore:clear-openrouter-key", "storycore:clear-bridge-key",
  "storycore:test-openrouter", "storycore:detect-turn", "storycore:run-decision", "storycore:cancel-decision",
] as const);
export type IpcSender = { sender: { id: number }; senderFrame: { url: string; parent: unknown } | null };
// Explicit dispatch table, not a bridge-command or arbitrary IPC passthrough.
export function createIpcHandlers(service: DesktopService, trustedSender: (event: IpcSender) => boolean) {
  function wrap(operation: (input?: unknown) => unknown, acceptsInput = false) {
    return async (event: IpcSender, ...args: unknown[]) => {
      try {
        ensure(trustedSender(event) && event.senderFrame?.url === UI_URL && event.senderFrame.parent === null, "IPC_SENDER_DENIED");
        ensure(acceptsInput ? args.length === 1 : args.length === 0, "IPC_ARGUMENTS_INVALID");
        if (acceptsInput) ensure(Buffer.byteLength(JSON.stringify(args[0]) ?? "") <= 16384, "IPC_PAYLOAD_TOO_LARGE");
        return { ok: true, data: await operation(args[0]) };
      } catch (error) { return { ok: false, error: safeError(error) }; }
    };
  }
  return Object.freeze({
    "storycore:status": wrap(() => service.status()),
    "storycore:save-settings": wrap(input => service.saveSettings(input), true),
    "storycore:clear-openrouter-key": wrap(() => service.clearOpenRouterKey()),
    "storycore:clear-bridge-key": wrap(() => service.clearBridgeKey()),
    "storycore:test-openrouter": wrap(() => service.testOpenRouter()),
    "storycore:detect-turn": wrap(() => service.detectTurn()),
    "storycore:run-decision": wrap(input => service.runDecision(input), true),
    "storycore:cancel-decision": wrap(() => service.cancel()),
  });
}
