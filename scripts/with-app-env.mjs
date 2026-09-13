#!/usr/bin/env node
/**
 * Run a command with `.grok/app-env.json` merged into its environment.
 *
 * `dev`, `build` and `preview` all route through this wrapper, so the dev
 * server, the built bundle and the preview server can never disagree about
 * `VITE_AUTH_ENABLED` — a divergence that only shows up as a built-output
 * mismatch long after the fact. Anything that starts Vite directly bypasses it.
 *
 * Only `VITE_`-prefixed keys are honored: the file is a build flag carrier, not
 * a secret store, and only `VITE_` vars reach the browser anyway. A real
 * `process.env` entry always wins, so an explicit override still works.
 *
 * That precedence also means the file governs this workspace only. A deployed
 * build runs with the provider's project env, where the deployer sets
 * `VITE_AUTH_ENABLED` itself (today unconditionally `"true"`), so the deployed
 * flag is the platform's, not this file's.
 *
 * Vite picks the values up because `loadEnv` prefix-matches entries already in
 * `process.env`, which is why the merge has to happen before Vite starts.
 *
 * Bare commands such as `vite` are resolved to the workspace package (then
 * `node node_modules/vite/bin/vite.js …`). Windows `spawn("vite")` does not
 * search `node_modules/.bin` and fails with ENOENT; launching the JS file
 * through `process.execPath` works on Windows, macOS, and Linux.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { constants as osConstants } from "node:os";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ENV_REL_PATH = ".grok/app-env.json";

const VITE_PREFIX = "VITE_";

/**
 * Parse an app-env document, keeping only `VITE_`-prefixed string entries.
 * Anything unparseable is an empty environment — a workspace without the file
 * must behave exactly like today (auth on, no overrides).
 */
export function parseAppEnv(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const env = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.startsWith(VITE_PREFIX)) continue;
    if (typeof value !== "string") continue;
    env[key] = value;
  }
  return env;
}

/** The app env recorded under `root`, or `{}` when the file is absent. */
export function readAppEnv(root) {
  try {
    return parseAppEnv(readFileSync(join(root, APP_ENV_REL_PATH), "utf8"));
  } catch {
    return {};
  }
}

/** File values under the process environment: an explicit override wins. */
export function mergeAppEnv(appEnv, processEnv) {
  return { ...appEnv, ...processEnv };
}

/**
 * Translate a child's `exit` `(code, signal)` into this process's exit status.
 *
 * Do not re-raise the signal with `process.kill(process.pid, signal)`: under
 * qemu-user (amd64 image builds on an arm host) a self-directed signal is
 * routinely delivered as SIGSEGV to the wrong process, which takes down the
 * test worker and fails the image build. `128 + signo` is what a shell reports
 * for a signal-killed command, so a cancelled `vite build` is still a failure.
 */
export function exitStatusFromChild(code, signal) {
  if (signal) {
    const signo = osConstants.signals[signal];
    return 128 + (typeof signo === "number" ? signo : 1);
  }
  return code ?? 1;
}

/** The workspace root (this file lives in `<root>/scripts/`). */
export function projectRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function looksLikePath(command) {
  return isAbsolute(command) || command.includes("/") || command.includes("\\");
}

/**
 * Absolute path to a workspace package's bin script, or `null`.
 * For Vite that is `node_modules/vite/bin/vite.js`.
 */
export function resolvePackageBin(command, root = projectRoot()) {
  if (!command || looksLikePath(command)) return null;
  try {
    const req = createRequire(join(root, "package.json"));
    const pkgPath = req.resolve(`${command}/package.json`);
    const bin = JSON.parse(readFileSync(pkgPath, "utf8")).bin;
    const rel =
      typeof bin === "string"
        ? bin
        : bin && typeof bin === "object"
          ? (bin[command] ?? Object.values(bin)[0])
          : null;
    if (typeof rel !== "string" || !rel) return null;
    const script = join(dirname(pkgPath), rel);
    return existsSync(script) ? script : null;
  } catch {
    return null;
  }
}

/**
 * Turn a bare command (`vite`) into a spawn target that exists on Windows.
 * Absolute / relative paths (tests spawn `process.execPath`) are left alone.
 */
export function resolveSpawnTarget(command, root = projectRoot(), platform = process.platform) {
  if (!command) return { command, args: [], shell: false };
  if (looksLikePath(command)) return { command, args: [], shell: false };

  const script = resolvePackageBin(command, root);
  if (script) return { command: process.execPath, args: [script], shell: false };

  const binDir = join(root, "node_modules", ".bin");
  if (platform === "win32") {
    for (const name of [`${command}.cmd`, `${command}.exe`, command]) {
      const candidate = join(binDir, name);
      if (existsSync(candidate)) {
        return { command: candidate, args: [], shell: name.endsWith(".cmd") };
      }
    }
    return { command, args: [], shell: true };
  }

  const unix = join(binDir, command);
  if (existsSync(unix)) return { command: unix, args: [], shell: false };
  return { command, args: [], shell: false };
}

/** Prepend `<root>/node_modules/.bin` so nested tools resolve on Windows too. */
export function envWithLocalBin(env, root = projectRoot()) {
  const next = { ...env };
  const pathKey = Object.keys(next).find((k) => k.toLowerCase() === "path") ?? "PATH";
  const bin = join(root, "node_modules", ".bin");
  const current = String(next[pathKey] ?? "");
  const parts = current.split(delimiter).filter(Boolean);
  if (!parts.includes(bin)) next[pathKey] = [bin, ...parts].join(delimiter);
  return next;
}

/**
 * Whether `moduleUrl` is the script node was asked to run.
 *
 * Both sides are resolved through symlinks: node realpaths `import.meta.url`
 * but leaves `process.argv[1]` as typed, so comparing them raw makes a CLI
 * launched through a symlinked path (`/tmp` on macOS) a silent no-op.
 */
export function isMainModule(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

function main(argv) {
  const [command, ...args] = argv;
  if (!command) {
    console.error("usage: node scripts/with-app-env.mjs <command> [args…]");
    process.exit(2);
  }
  const root = projectRoot();
  const env = envWithLocalBin(mergeAppEnv(readAppEnv(root), process.env), root);
  const target = resolveSpawnTarget(command, root);
  const child = spawn(target.command, [...target.args, ...args], {
    stdio: "inherit",
    env,
    shell: target.shell,
  });
  // The dev server is long-running and is stopped by signalling this wrapper.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("error", (err) => {
    console.error(`[with-app-env] failed to run ${command}:`, err?.message || err);
    process.exit(127);
  });
  child.on("exit", (code, signal) => {
    process.exit(exitStatusFromChild(code, signal));
  });
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2));
}
