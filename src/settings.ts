import { spawn } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ensure, SafeError } from "./safety.js";

export const DEFAULT_MODEL = "qwen/qwen3-30b-a3b-instruct-2507";
export const settingsInput = z.object({
  provider: z.literal("openrouter"), model: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/),
  temperature: z.number().min(0).max(2),
  apiKey: z.string().max(512).optional(), bridgeKey: z.string().max(512).refine(s => !s.trim() || s.trim().length >= 16).optional(),
}).strict();
export type Settings = { provider: "openrouter"; model: string; temperature: number; apiKey: string; bridgeKey: string };
export interface SecretProtector { protect(value: string): Promise<string>; unprotect(value: string): Promise<string> }
// DPAPI CurrentUser: keys travel over stdin, never process arguments or console.
export class WindowsDpapi implements SecretProtector {
  async transform(value: string, decrypt: boolean): Promise<string> {
    if (!value) return "";
    ensure(process.platform === "win32", "WINDOWS_DPAPI_REQUIRED");
    const op = decrypt ? "Unprotect" : "Protect";
    const script = "Add-Type -AssemblyName System.Security; $v=[Console]::In.ReadToEnd(); " +
      "$b=[Convert]::FromBase64String($v); $r=[Security.Cryptography.ProtectedData]::" + op +
      "($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($r))";
    return new Promise((resolve, reject) => {
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      let out = ""; const timer = setTimeout(() => { child.kill(); reject(new SafeError("SECRET_STORAGE_TIMEOUT")); }, 10000);
      child.stdout.on("data", b => { out += b; if (out.length > 8192) child.kill(); });
      child.stderr.resume();
      child.on("error", () => { clearTimeout(timer); reject(new SafeError("SECRET_STORAGE_FAILED")); });
      child.on("close", code => { clearTimeout(timer); code === 0 && out.length <= 8192 ? resolve(out.trim()) : reject(new SafeError("SECRET_STORAGE_FAILED")); });
      child.stdin.on("error", () => {});
      child.stdin.end(decrypt ? value : Buffer.from(value).toString("base64"));
    });
  }
  protect(value: string) { return this.transform(value, false); }
  async unprotect(value: string) { return Buffer.from(await this.transform(value, true), "base64").toString("utf8"); }
}
export class SettingsStore {
  private value: Settings = { provider: "openrouter", model: DEFAULT_MODEL, temperature: 0.25, apiKey: "", bridgeKey: "" };
  constructor(readonly directory: string, private protector: SecretProtector = new WindowsDpapi()) {}
  async load() {
    let stored: string;
    try { stored = await readFile(join(this.directory, "settings.json"), "utf8"); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return; throw new SafeError("SETTINGS_READ_FAILED"); }
    const schema = z.object({ model: settingsInput.shape.model, temperature: settingsInput.shape.temperature,
      encryptedApiKey: z.string(), encryptedBridgeKey: z.string() }).strict();
    const parsed = schema.safeParse(JSON.parse(stored)); ensure(parsed.success, "SETTINGS_INVALID");
    this.value = { provider: "openrouter", model: parsed.data.model, temperature: parsed.data.temperature,
      apiKey: await this.protector.unprotect(parsed.data.encryptedApiKey), bridgeKey: await this.protector.unprotect(parsed.data.encryptedBridgeKey) };
  }
  publicView() { return { provider: this.value.provider, model: this.value.model, temperature: this.value.temperature,
    maxOutputTokens: 700, hasKey: !!this.value.apiKey, hasBridgeKey: !!this.value.bridgeKey }; }
  credentials(): Settings { return { ...this.value }; }
  async save(input: unknown) {
    const parsed = settingsInput.safeParse(input); ensure(parsed.success, "SETTINGS_INVALID");
    const data = parsed.data;
    const next: Settings = { provider: data.provider, model: data.model, temperature: data.temperature,
      apiKey: data.apiKey?.trim() || this.value.apiKey, bridgeKey: data.bridgeKey?.trim() || this.value.bridgeKey };
    const disk = { model: next.model, temperature: next.temperature,
      encryptedApiKey: await this.protector.protect(next.apiKey), encryptedBridgeKey: await this.protector.protect(next.bridgeKey) };
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, "settings.tmp"), JSON.stringify(disk, null, 2), { mode: 0o600 });
    await rename(join(this.directory, "settings.tmp"), join(this.directory, "settings.json"));
    this.value = next; return this.publicView();
  }
}
export function localDirectory() { ensure(process.env.LOCALAPPDATA, "LOCALAPPDATA_REQUIRED"); return join(process.env.LOCALAPPDATA, "StoryCoreFoundryAI"); }
