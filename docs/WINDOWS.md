# Windows desktop launch

`npm run dev`, `npm run build`, and `npm run preview` all go through `scripts/with-app-env.mjs`.

That wrapper:

1. Merges `.grok/app-env.json` `VITE_` flags into the child environment (a real `process.env` value still wins).
2. Resolves a bare `vite` to `node_modules/vite/bin/vite.js` and starts it with the same Node that ran the wrapper.

On Windows, `spawn("vite")` does **not** search `node_modules/.bin`, so the old wrapper failed with `spawn vite ENOENT` and the Desktop shortcut could not open the table. Launching the JS file through `process.execPath` works on Windows, macOS, and Linux.

If Vite is still missing after `npm install`, the wrapper falls back to `node_modules/.bin/vite.cmd` (with `shell: true`) and prepends `.bin` to `PATH` / `Path`.
