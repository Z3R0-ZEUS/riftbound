import { CARD_BY_ID, deckListFor, LEGENDS } from "./cards";
import type { CardDef, Domain } from "./types";

export const COLLECTION_KEY = "riftbound-collection";

export type ProductId =
  | "origins"
  | "proving-grounds"
  | "champ-jinx"
  | "champ-viktor"
  | "champ-leesin"
  | "domain";

export type ProductKind = "booster" | "champion-deck" | "starter-set";
export type PullRarity = "common" | "uncommon" | "rare";
export type Rng = () => number;

export interface Product {
  id: ProductId;
  name: string;
  blurb: string;
  art: string;
  kind: ProductKind;
  unlocks: string[];
  pullCount?: number;
}

export interface PackPull {
  defId: string;
  rarity: PullRarity;
}

export interface CollectionState {
  unlockedLegendIds: string[];
  ownedCardCounts: Record<string, number>;
  openedProductCounts: Record<string, number>;
}

export interface OpenResult {
  collection: CollectionState;
  pulls: PackPull[];
  newlyUnlocked: string[];
}

export type CollectionStorage = Pick<Storage, "getItem" | "setItem">;

export const STARTER_LEGENDS = ["ahri", "darius"] as const;

export const ORIGINS_WEIGHTS = { common: 70, uncommon: 24, rare: 6 } as const;
export const DOMAIN_WEIGHTS = { common: 48, uncommon: 36, rare: 16 } as const;
export const ORIGINS_PULLS = 8;
export const DOMAIN_PULLS = 6;

const DOMAINS: Domain[] = ["fury", "calm", "mind", "body", "chaos", "order"];

export const PRODUCTS: Product[] = [
  {
    id: "origins",
    name: "Origins Booster Pack",
    blurb: "Eight weighted pulls from the fan card pool. Local only — no real money.",
    art: "/art/packs/pack-origins.png",
    kind: "booster",
    unlocks: [],
    pullCount: ORIGINS_PULLS,
  },
  {
    id: "proving-grounds",
    name: "Proving Grounds Starter Set",
    blurb: "Unlocks the Annie, Garen, and Lux precon decks for seat setup.",
    art: "/art/packs/pack-proving-grounds.png",
    kind: "starter-set",
    unlocks: ["annie", "garen", "lux"],
  },
  {
    id: "champ-jinx",
    name: "Jinx Champion Deck",
    blurb: "Unlocks the Jinx precon for seat setup.",
    art: "/art/packs/pack-champ-jinx.png",
    kind: "champion-deck",
    unlocks: ["jinx"],
  },
  {
    id: "champ-viktor",
    name: "Viktor Champion Deck",
    blurb: "Unlocks the Viktor precon for seat setup.",
    art: "/art/packs/pack-champ-viktor.png",
    kind: "champion-deck",
    unlocks: ["viktor"],
  },
  {
    id: "champ-leesin",
    name: "Lee Sin Champion Deck",
    blurb: "Unlocks the Lee Sin precon for seat setup.",
    art: "/art/packs/pack-champ-leesin.png",
    kind: "champion-deck",
    unlocks: ["leesin"],
  },
  {
    id: "domain",
    name: "Origins Domain Booster",
    blurb: "Six splashier pulls, biased toward a rolled domain. Local only — no real money.",
    art: "/art/packs/pack-domain.png",
    kind: "booster",
    unlocks: [],
    pullCount: DOMAIN_PULLS,
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

function defaultStorage(): CollectionStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function knownLegend(id: string): boolean {
  return LEGENDS.some((l) => l.id === id);
}

function asCount(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(9999, Math.floor(v));
}

export function emptyCollection(): CollectionState {
  return {
    unlockedLegendIds: [...STARTER_LEGENDS],
    ownedCardCounts: {},
    openedProductCounts: {},
  };
}

export function normalizeCollection(raw: unknown): CollectionState {
  const base = emptyCollection();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<CollectionState>;
  const unlocked = new Set<string>(STARTER_LEGENDS);
  if (Array.isArray(o.unlockedLegendIds)) {
    for (const id of o.unlockedLegendIds) {
      if (typeof id === "string" && knownLegend(id)) unlocked.add(id);
    }
  }
  const owned: Record<string, number> = {};
  if (o.ownedCardCounts && typeof o.ownedCardCounts === "object") {
    for (const [id, n] of Object.entries(o.ownedCardCounts)) {
      if (CARD_BY_ID[id]) {
        const c = asCount(n);
        if (c > 0) owned[id] = c;
      }
    }
  }
  const opened: Record<string, number> = {};
  if (o.openedProductCounts && typeof o.openedProductCounts === "object") {
    for (const [id, n] of Object.entries(o.openedProductCounts)) {
      if (getProduct(id)) {
        const c = asCount(n);
        if (c > 0) opened[id] = c;
      }
    }
  }
  return {
    unlockedLegendIds: LEGENDS.map((l) => l.id).filter((id) => unlocked.has(id)),
    ownedCardCounts: owned,
    openedProductCounts: opened,
  };
}

export function readCollection(
  storage: CollectionStorage | null = defaultStorage(),
): CollectionState {
  if (!storage) return emptyCollection();
  try {
    const raw = storage.getItem(COLLECTION_KEY);
    if (!raw) return emptyCollection();
    return normalizeCollection(JSON.parse(raw));
  } catch {
    return emptyCollection();
  }
}

export function writeCollection(
  state: CollectionState,
  storage: CollectionStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(COLLECTION_KEY, JSON.stringify(normalizeCollection(state)));
  } catch {
    void 0;
  }
}

export function unlockedLegendIds(collection: CollectionState): string[] {
  const set = new Set<string>([...STARTER_LEGENDS, ...collection.unlockedLegendIds]);
  return LEGENDS.map((l) => l.id).filter((id) => set.has(id) && knownLegend(id));
}

export function isLegendUnlocked(collection: CollectionState, legendId: string): boolean {
  return unlockedLegendIds(collection).includes(legendId);
}

export function uniqueOwnedCount(collection: CollectionState): number {
  return Object.keys(collection.ownedCardCounts).filter((id) => {
    return (collection.ownedCardCounts[id] ?? 0) > 0 && CARD_BY_ID[id];
  }).length;
}

export function boosterPool(): CardDef[] {
  return Object.values(CARD_BY_ID).filter(
    (c) => c.kind === "unit" || c.kind === "spell" || c.kind === "gear",
  );
}

export function rarityOf(def: CardDef): PullRarity {
  if (def.isChampion || def.energy >= 5) return "rare";
  if (def.energy >= 3) return "uncommon";
  return "common";
}

function rollRarity(
  weights: { common: number; uncommon: number; rare: number },
  rng: Rng,
): PullRarity {
  const total = weights.common + weights.uncommon + weights.rare;
  const r = rng() * total;
  if (r < weights.rare) return "rare";
  if (r < weights.rare + weights.uncommon) return "uncommon";
  return "common";
}

function pickFrom(list: CardDef[], rng: Rng): CardDef {
  return list[Math.floor(rng() * list.length) % list.length]!;
}

function pickCard(
  pool: CardDef[],
  rarity: PullRarity,
  rng: Rng,
  preferDomain?: Domain,
): CardDef {
  let bucket = pool.filter((c) => rarityOf(c) === rarity);
  if (preferDomain) {
    const aligned = bucket.filter((c) => c.domains.includes(preferDomain));
    if (aligned.length) bucket = aligned;
  }
  if (!bucket.length) bucket = pool.filter((c) => rarityOf(c) === "common");
  if (!bucket.length) bucket = pool;
  return pickFrom(bucket, rng);
}

export function pullBooster(productId: ProductId, rng: Rng = Math.random): PackPull[] {
  const product = getProduct(productId);
  if (!product || product.kind !== "booster") return [];
  const pool = boosterPool();
  if (!pool.length) return [];
  const n = product.pullCount ?? ORIGINS_PULLS;
  const weights = productId === "domain" ? DOMAIN_WEIGHTS : ORIGINS_WEIGHTS;
  const prefer =
    productId === "domain" ? DOMAINS[Math.floor(rng() * DOMAINS.length) % DOMAINS.length] : undefined;
  const pulls: PackPull[] = [];
  for (let i = 0; i < n; i++) {
    const rarity = rollRarity(weights, rng);
    const card = pickCard(pool, rarity, rng, prefer);
    pulls.push({ defId: card.id, rarity: rarityOf(card) });
  }
  return pulls;
}

function addCopies(owned: Record<string, number>, id: string, n: number) {
  if (!CARD_BY_ID[id] || n <= 0) return;
  owned[id] = (owned[id] ?? 0) + n;
}

function addDeck(owned: Record<string, number>, legendId: string) {
  for (const [id, n] of deckListFor(legendId)) addCopies(owned, id, n);
  const legend = LEGENDS.find((l) => l.id === legendId);
  if (legend) addCopies(owned, legend.championId, 1);
}

function cloneCollection(c: CollectionState): CollectionState {
  return {
    unlockedLegendIds: [...c.unlockedLegendIds],
    ownedCardCounts: { ...c.ownedCardCounts },
    openedProductCounts: { ...c.openedProductCounts },
  };
}

export function openProduct(
  collection: CollectionState,
  productId: ProductId,
  rng: Rng = Math.random,
): OpenResult {
  const product = getProduct(productId);
  const next = normalizeCollection(cloneCollection(collection));
  if (!product) return { collection: next, pulls: [], newlyUnlocked: [] };

  const before = new Set(unlockedLegendIds(next));
  next.openedProductCounts[product.id] = (next.openedProductCounts[product.id] ?? 0) + 1;

  let pulls: PackPull[] = [];
  if (product.kind === "booster") {
    pulls = pullBooster(product.id, rng);
    for (const p of pulls) addCopies(next.ownedCardCounts, p.defId, 1);
  } else {
    for (const id of product.unlocks) {
      if (knownLegend(id) && !next.unlockedLegendIds.includes(id)) {
        next.unlockedLegendIds.push(id);
      }
      addDeck(next.ownedCardCounts, id);
    }
    next.unlockedLegendIds = unlockedLegendIds(next);
    pulls = product.unlocks.flatMap((id) => {
      const legend = LEGENDS.find((l) => l.id === id);
      if (!legend || !CARD_BY_ID[legend.championId]) return [];
      const def = CARD_BY_ID[legend.championId]!;
      return [{ defId: def.id, rarity: rarityOf(def) }];
    });
  }

  const after = unlockedLegendIds(next);
  next.unlockedLegendIds = after;
  return {
    collection: next,
    pulls,
    newlyUnlocked: after.filter((id) => !before.has(id)),
  };
}
