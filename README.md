# Riftbound — local table

Fan-made pass-and-play recreation of Riot’s **Riftbound** TCG. 3–4 players on one machine, or you vs AI.

Not affiliated with Riot Games. Card text and art are original stand-ins for a tabletop demo.

## Play

```bash
npm install
npm run dev
```

Opens on port 8080. On Windows the Desktop shortcut runs this same script; `scripts/with-app-env.mjs` launches the local Vite binary (not a bare `vite` on PATH) and still applies `.grok/app-env.json` `VITE_` flags. See `docs/WINDOWS.md`.

- **Skirmish** — 3 seats, 3 battlefields  
- **War** — 4 seats, 3 battlefields (first seat brings none)  
- Mix humans and AI. Hands stay hidden until you pass the device.
- Sound is procedural Web Audio (mute from the title, setup, or table; remembered as `riftbound-muted`). Nothing here is ripped from Riot.
- Every champion deck is in the box from setup. Fan pack shots on the title are credits only — no shop and nothing is for sale. See `docs/PACKS.md`.

## How a turn works

Awaken, Hold, Channel, Draw. Play units to your base, then raid battlefields.

- Select several ready units and send them as one raid, or split them across fields. Planned marches resolve as **Showdowns** in order.
- During a Showdown, play **Actions** and **Reactions**, or ask another seat for help, before Might is compared.
- First to 8 points wins (conquer + hold). Final-point scoring follows the official “score every battlefield this turn” exception.

Champion decks in the box: Jinx, Garen, Ahri, Darius, Viktor, Lee Sin, Annie, Lux. All selectable in setup.

## License

Unofficial fan work. League of Legends and Riftbound are trademarks of Riot Games.
