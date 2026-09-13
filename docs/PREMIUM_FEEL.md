# Premium Feel

Graphics + interface pass so the local table reads as a **digital TCG / tabletop product**, not a Tailwind marketing site. No shop. All eight legends stay unlocked. Mulligan “Drew into” and inspect E/P/M chip sizing were not touched.

Fan table only. No Riot pack scans, official card-text scrapes, or sampled audio.

## What changed

### Shell

- Title, setup, and play sit in full-bleed shells (`title-shell`, `setup-shell`, `table-shell`) instead of a boxed landing hero or flat `bg-bg` page.
- A CSS **vignette** darkens the felt edges. Leftover glass “hero-frame” chrome is gone.
- Fan disclaimer stays on title, setup, rules, pass-device, and winner — quieter type, still present.

### Title + setup

- Title is a product-box open: rift art, gold wordmark, two mode lids (Skirmish / War). Numbered wizard copy (“1 · Choose a mode”) is gone.
- Setup is seating a table: felt ground, **deck-box** seats, **metal-token** toggles, brass **Deal in** plaque. All eight champion chips remain (Jinx, Garen, Ahri, Darius, Viktor, Lee Sin, Annie, Lux).

### Materials

- Felt (table / hand / battlefields), wood (current-player rail, action bars), metal (header, mute, score tokens), parchment (inspect, rules, mulligan, combat, pass, winner).
- Battlefield frames keep domain-tinted edges plus a brass inner lip.

### Cards

- Stronger physical edge (foil inset + drop shadow) and hover lift. Playable cards lift a little more.
- **E / P / M chips and keyword chips keep the larger padding, min-size, and line-height from the inspect fix.** Do not shrink them.

### Type + motion + audio

- Cinzel for titles, Cormorant Garamond for a few product lines, Outfit for rules and chrome.
- Screen enter, card hover, draw flash, raid/score VFX sit in the **120–280ms** range with `--ease-out`. `prefers-reduced-motion` kills those animations.
- Soft click/UI ticks; heavier showdown + score cues. Mute still writes `riftbound-muted`.

### Files

- `src/styles.css` — theme, materials, card presence, motion.
- `src/components/game/Screens.tsx`, `GameTable.tsx`, `CardView.tsx` — class/layout only.
- `src/game/audio.ts` — cue mix. Mute API unchanged.
- `src/routes/__root.tsx` — felt theme-color + display serif.

## Still needs Z eyes

- Does the title feel like opening a box, or still like a splash page? Wordmark size / gold gradient may be too loud or too quiet on a phone.
- Setup deck boxes: champion chip wrap on a narrow seat card — still readable?
- Table: wood rail + felt hand vs. “too much texture.” Vignette strength on a bright display.
- Inspect parchment next to the live card: E/P/M still fully drawn (no clip) at default and large text?
- Mulligan → **Drew into** face-up replacements still obvious after a two-card bottom.
- Audio: UI ticks too soft? Combat too punchy on laptop speakers? Mute still sticky after refresh.
- Reduced-motion: screens should cut, not slide; SFX still play unless muted.
- Live 3–4 human pass-device on a real phone — privacy overlay + parchment plaque.

## Out of scope (on purpose)

- Shop / unlocks / monetization
- New engine rules
- Sampled Riot SFX or official card art
- Networked multiplayer
