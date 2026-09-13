import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import {
  envWithLocalBin,
  projectRoot,
  resolvePackageBin,
  resolveSpawnTarget,
} from "./with-app-env.mjs";

const execFileAsync = promisify(execFile);
const WRAPPER = join(projectRoot(), "scripts/with-app-env.mjs");

test("resolves vite to the workspace vite.js (Windows-safe)", () => {
  const script = resolvePackageBin("vite");
  assert.ok(script);
  assert.match(script.replaceAll("\\", "/"), /\/vite\/bin\/vite\.js$/);
  const target = resolveSpawnTarget("vite");
  assert.equal(target.command, process.execPath);
  assert.equal(target.args[0], script);
  assert.equal(target.shell, false);
});

test("leaves an absolute command path unchanged", () => {
  const target = resolveSpawnTarget(process.execPath);
  assert.deepEqual(target, { command: process.execPath, args: [], shell: false });
});

test("prepends node_modules/.bin on PATH and Windows Path", () => {
  const root = projectRoot();
  const unix = envWithLocalBin({ PATH: "/usr/bin" }, root);
  assert.equal(unix.PATH.startsWith(join(root, "node_modules", ".bin")), true);
  const win = envWithLocalBin({ Path: "C:\\Windows\\System32" }, root);
  assert.equal(win.Path.startsWith(join(root, "node_modules", ".bin")), true);
  assert.equal(win.PATH, undefined);
});

test("PATH rewrite keeps merged VITE_ flags", () => {
  const merged = envWithLocalBin(
    { VITE_AUTH_ENABLED: "false", PATH: "/usr/bin" },
    projectRoot(),
  );
  assert.equal(merged.VITE_AUTH_ENABLED, "false");
  assert.ok(merged.PATH.includes(join(projectRoot(), "node_modules", ".bin")));
});

test("the wrapper can launch the local vite binary", async () => {
  const { stdout } = await execFileAsync(process.execPath, [WRAPPER, "vite", "--version"]);
  assert.match(stdout, /vite/i);
});
