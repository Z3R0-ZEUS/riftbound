# Spike 2 notes — leftovers + polish

Stacked on Spike 1. Fan table only. No Riot scrapes or ripped audio.

## What this spike changed

### Final-point / War seating

- Eighth point on a **hold** still wins immediately.
- Eighth point on a **conquer** only if every other battlefield was already scored this turn (`sweptForFinalPoint`). A lone last-second conquer draws instead and does **not** mark the field scored.
- War still deals **3 battlefields** from seats 2–4. Seat 1 is labeled **No battlefield** on setup. `battlefieldSeats()` is the shared helper.

### Showdown depth

- A targeting Reaction resets the pass streak, then yields to the next participant — the helper still gets a window.
- An invited AI helper can act while two humans fight (no pass-device on the AI seat).
- After combat is dismissed, leftover **Accelerate** (ready at base) and **Ganking** units remain movable. The table says so when that happens.

### Pass-device + mute

- Pass-device no longer mounts hands, base, or battlefield cards — overlay only. Safer on a small screen (no incoming-hand flash).
- Mute is `localStorage` key `riftbound-muted` (`src/game/mute.ts`). Hydrated on load and on `storage` events.

### Presentation

- Title sits in a framed hero; Skirmish/War cards use original battlefield stills.
- Battlefields have a domain pip + nameplate; a `+1` float and conquer flash on score.
- SoundManager cues: hold, deny, invite, ready (still oscillators only).

## Verified here

- `npm run typecheck`
- `npm test` (engine + mute + lib)
- `npm run build`
- Engine: War seating, hold-at-8, denied conquer, sweep win (Skirmish + War), targeting Reaction + helper, AI helper window, leftover Accelerate/Ganking march
- Mute read/write against an in-memory store

## Still needs Z playtest

- Live 3–4 human pass-device on a phone — confirm the overlay-only view and no flash when rotating.
- A real close game: 7 points, hold vs denied conquer vs sweep of all three fields.
- Invite AI help during a human vs human showdown, then play a targeting Zap.
- After a showdown, march a leftover Accelerate unit and a Ganker to a second field.
- Mute across refresh via `Riftbound.lnk` on Zeus (`riftbound-muted` = `1`).
- Reduced-motion: new conquer/`+1` VFX should stay quiet.
- Download zip on a clean preview host (still untested here).

## Out of scope

- Networked multiplayer
- Official card text / Riot art / sampled Riot SFX
