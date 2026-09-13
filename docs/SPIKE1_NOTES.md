# Spike 1 notes — playability harden + presentation lift

Fan table only. No Riot art dumps, official card-text scrapes, or ripped audio were added.

## What this spike changed

### Engine / table reliability

- **March queue order.** Assigning units to field A, then B, then A again now joins the later A units to the first planned raid. Showdowns keep the order you first pointed at each field.
- **Showdown passes.** Priority walks a `priorityIndex` on the participant list so a missing `current` seat cannot wrap into a pass loop. A helper still gets a window; N consecutive passes still compare Might.
- **Pass-device privacy.** Confirm overlay sits above inspect/peek, inspect is cleared when the device is passed, incoming champion/hand stay face-down, and the scrim is darker. `hideHands()` still hides every hand while `phase === "pass_device"`.
- **AI seats freeze the table.** Human cards no longer light up as playable on an AI window. Dispatch already ignored most human actions; the UI now matches. Multi-human games hide hands while an AI acts. The AI stepper bails if a window does not progress instead of spinning.
- **Combat overlay.** Continue is always available so a last-combat screen cannot trap the table if the AI stepper is idle.

### Presentation (same PR)

- **Menus.** Title is mode-first (Skirmish / War), then seat setup (human vs AI). Fan disclaimer stays on title, setup, pass-device, rules, and winner.
- **Chrome.** Cards get a domain accent bar plus clearer Energy / Might badges. Battlefields show controller, domain-tinted frames, and dashed march trails on queued raids.
- **VFX.** CSS-only: showdown impact flash + sparks, score pulse on the point chips, rune exhaust flash. `prefers-reduced-motion` disables them.
- **SFX.** `src/game/audio.ts` is a small `SoundManager` (mute + unlock). Cues: click/ui, card play, rune channel, march, showdown hit, score, win. Oscillators + a short noise burst only.

### Tooling

- Restored `pgliteBootstrapPlugin` in `vite.config.ts` (the zip plugin had closed the function early and broken the config parse).
- `npm test` now runs `src/game/engine.test.ts` plus the existing `src/lib` tests. Grok-template `scripts/**/*.test.mjs` checks that expect `.grok/skills` files are not part of this game’s gate.

## Verified here

- `npm install`
- `npm run typecheck`
- `npm test` (engine + lib)
- `npm run lint` (vite parse error gone; remaining template warnings may still exist)
- Engine cases: pass-device hand hiding, A/B/A march merge, multi-select raid, split across fields, 3-seat showdown + helper pass cycle, AI vs AI to a winner, human-then-AI turn handoff
- Browser sit: title → You vs two AIs Skirmish, mute toggle, one human window (see test plan on the PR)

## Still needs Z playtest

- Live 3–4 human pass-device around a real table (mulligan → action → showdown invite). Confirm no hand flash on a phone-sized screen.
- Split raids into two *contested* fields, then add more units back to the first field — confirm the joined raid and the remaining queue match what you meant.
- Showdown where someone plays a targeting Reaction, then everyone passes. Confirm priority does not skip the helper.
- AI invited as third-seat help while two humans fight.
- Final-point conquer exception (must have scored every battlefield this turn) in a close game — not re-simulated in this spike.
- War (4 seats) seating + “first seat brings no battlefield.”
- Mute persistence across refresh (`localStorage` key `riftbound-muted`).
- Reduced-motion: VFX should stay quiet; SFX still play unless muted.
- Legend abilities + Accelerate / Ganking during a planned march (engine allows leftover ready units after a showdown).
- Download zip from the title screen on a clean preview host.

## Out of scope

- Networked multiplayer
- Official card text / Riot art
- Sampled Riot SFX
- Rewriting the grok/auth scaffold tests
