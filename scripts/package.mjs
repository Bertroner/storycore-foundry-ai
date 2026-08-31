import { packager } from "@electron/packager";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
const root = resolve(import.meta.dirname, "..");
const stage = resolve(root, "build", "desktop-package");
const release = resolve(root, "release");
if (stage !== join(root, "build", "desktop-package") || release !== join(root, "release")) throw new Error("PACKAGE_PATH_DENIED");
await rm(stage, { recursive: true, force: true }); await mkdir(stage, { recursive: true });
// Explicit staging: never package donors, tests, settings, campaign data or the working tree.
for (const path of ["dist/src", "dist/desktop", "desktop/ui"]) await cp(join(root, path), join(stage, path), { recursive: true });
for (const file of ["package.json", "package-lock.json"]) await cp(join(root, file), join(stage, file));
await writeFile(join(stage, "DESKTOP_TESTING.txt"), "StoryCore Foundry AI Phase 1A: READ ONLY. Launch StoryCoreFoundryAI.exe. Settings remain in %LOCALAPPDATA%\\StoryCoreFoundryAI. No auto-update. This portable build is unsigned.\n");
if (!process.env.npm_execpath) throw new Error("Run packaging with npm run package");
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [process.env.npm_execpath, "ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"],
    { cwd: stage, stdio: "inherit", windowsHide: true });
  child.on("error", reject); child.on("close", code => code === 0 ? resolve() : reject(new Error("PACKAGE_DEPENDENCIES_FAILED")));
});
const runtimePackage = JSON.parse(await readFile(join(stage, "package.json"), "utf8"));
delete runtimePackage.devDependencies; delete runtimePackage.scripts;
await writeFile(join(stage, "package.json"), JSON.stringify(runtimePackage, null, 2));
const electronVersion = JSON.parse(await readFile(join(root, "node_modules/electron/package.json"), "utf8")).version;
const paths = await packager({ dir: stage, name: "StoryCoreFoundryAI", platform: "win32", arch: "x64",
  out: release, overwrite: true, asar: true, prune: false, electronVersion, executableName: "StoryCoreFoundryAI",
  appVersion: "0.1.0", win32metadata: { ProductName: "StoryCore Foundry AI", FileDescription: "Phase 1A read-only desktop test app" } });
for (const path of paths) console.log("Portable Windows package: " + path);
