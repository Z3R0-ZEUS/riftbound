# Packs / Shop

Local-only fan shop on the title screen. No real money, no storefront, no official Riot pack scans.

Product art is original Grok-generated packaging saved under `public/art/packs/`. Card pulls use the existing `CARD_BY_ID` pool from `src/game/cards.ts`.

## Products

| Order | Product | File | Opens as |
| --- | --- | --- | --- |
| 1 | Origins Booster Pack | `pack-origins.png` | 8 weighted pulls |
| 2 | Proving Grounds Starter Set | `pack-proving-grounds.png` | Unlocks Annie, Garen, Lux |
| 3 | Jinx Champion Deck | `pack-champ-jinx.png` | Unlocks Jinx |
| 4 | Viktor Champion Deck | `pack-champ-viktor.png` | Unlocks Viktor |
| 5 | Lee Sin Champion Deck | `pack-champ-leesin.png` | Unlocks Lee Sin |
| 6 | Origins Domain Booster | `pack-domain.png` | 6 splashier pulls |

Ahri and Darius start unlocked (Origins constructed). They are not behind a pack.

## Boosters

Pool: every `unit` / `spell` / `gear` in `CARD_BY_ID`. Legends and battlefields never drop.

Rarity proxy (no official rarity field on the fan cards):

- **Rare** — champion unit or energy ≥ 5
- **Uncommon** — energy ≥ 3
- **Common** — everything else

Weights:

- Origins: 70 / 24 / 6 (common / uncommon / rare), 8 cards
- Domain: 48 / 36 / 16, 6 cards, then prefers cards of one rolled domain

Reveal overlay fans the pulls with procedural `pack` + `reveal` SFX (`src/game/audio.ts`). Oscillators only.

## Unlocks

Champion Deck products add that legend’s precon (`deckListFor`) plus the champion unit to the owned counts, and unlock the legend for seat setup.

Proving Grounds does the same for Annie, Garen, and Lux.

Locked legends show a lock on setup and cannot be seated until the matching product is opened. If fewer unique legends are unlocked than seats, the table reuses an unlocked precon rather than silently assigning a locked one.

## Persistence

`localStorage` key `riftbound-collection` (`src/game/collection.ts`):

```json
{
  "unlockedLegendIds": ["ahri", "darius", "jinx"],
  "ownedCardCounts": { "scrapling": 2 },
  "openedProductCounts": { "origins": 1 }
}
```

Hydrated on load and on `storage` events, same pattern as `riftbound-muted`.

## Disclaimer

Fan-made pass-and-play table. Original card text and packaging art only. Not affiliated with Riot Games. League of Legends and Riftbound are trademarks of Riot Games.
