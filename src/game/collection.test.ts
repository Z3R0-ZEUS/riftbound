import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CARD_BY_ID, deckListFor, LEGENDS } from "./cards.ts";
import {
  COLLECTION_KEY,
  DOMAIN_PULLS,
  ORIGINS_PULLS,
  boosterPool,
  emptyCollection,
  isLegendUnlocked,
  normalizeCollection,
  openProduct,
  pullBooster,
  rarityOf,
  readCollection,
  uniqueOwnedCount,
  unlockedLegendIds,
  writeCollection,
  type CollectionStorage,
  type Rng,
} from "./collection.ts";

function memory(): CollectionStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem(key: string) {
      return data[key] ?? null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
}

function seq(values: number[]): Rng {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("collection persistence", () => {
  it("starts with Ahri and Darius unlocked", () => {
    const c = emptyCollection();
    assert.deepEqual(unlockedLegendIds(c), ["ahri", "darius"]);
    assert.equal(isLegendUnlocked(c, "ahri"), true);
    assert.equal(isLegendUnlocked(c, "jinx"), false);
    assert.equal(isLegendUnlocked(c, "annie"), false);
  });

  it("reads and writes riftbound-collection", () => {
    const store = memory();
    const opened = openProduct(emptyCollection(), "champ-jinx", () => 0).collection;
    writeCollection(opened, store);
    assert.ok(store.data[COLLECTION_KEY]);
    const loaded = readCollection(store);
    assert.equal(isLegendUnlocked(loaded, "jinx"), true);
    assert.equal(isLegendUnlocked(loaded, "ahri"), true);
    assert.equal(loaded.openedProductCounts["champ-jinx"], 1);
  });

  it("treats a missing store as the starter box", () => {
    const c = readCollection(null);
    assert.deepEqual(unlockedLegendIds(c), ["ahri", "darius"]);
  });

  it("normalizes garbage and keeps starter unlocks", () => {
    const c = normalizeCollection({
      unlockedLegendIds: ["jinx", "not-a-legend", 12],
      ownedCardCounts: { scrapling: 2, nope: 9, "legend-jinx": -3 },
      openedProductCounts: { origins: 1, cash: 4 },
    });
    assert.equal(isLegendUnlocked(c, "jinx"), true);
    assert.equal(isLegendUnlocked(c, "ahri"), true);
    assert.equal(c.ownedCardCounts.scrapling, 2);
    assert.equal(c.ownedCardCounts.nope, undefined);
    assert.equal(c.openedProductCounts.origins, 1);
    assert.equal(c.openedProductCounts.cash, undefined);
  });
});

describe("booster pulls", () => {
  it("Origins pulls 8 playable cards from CARD_BY_ID", () => {
    const pulls = pullBooster("origins", seq([0.1, 0.2, 0.3, 0.4]));
    assert.equal(pulls.length, ORIGINS_PULLS);
    for (const p of pulls) {
      const d = CARD_BY_ID[p.defId];
      assert.ok(d, p.defId);
      assert.ok(d.kind === "unit" || d.kind === "spell" || d.kind === "gear");
      assert.equal(p.rarity, rarityOf(d));
    }
  });

  it("Domain pulls 6 cards and never returns legends or battlefields", () => {
    const pulls = pullBooster("domain", seq([0.99, 0.01, 0.5, 0.25]));
    assert.equal(pulls.length, DOMAIN_PULLS);
    const kinds = new Set(boosterPool().map((c) => c.kind));
    assert.ok(kinds.has("unit"));
    for (const p of pulls) {
      const d = CARD_BY_ID[p.defId]!;
      assert.notEqual(d.kind, "legend");
      assert.notEqual(d.kind, "battlefield");
    }
  });

  it("adding an Origins pack grows owned counts", () => {
    const result = openProduct(emptyCollection(), "origins", seq([0.2, 0.8]));
    assert.equal(result.pulls.length, ORIGINS_PULLS);
    assert.equal(result.collection.openedProductCounts.origins, 1);
    assert.equal(uniqueOwnedCount(result.collection) > 0, true);
    const sum = Object.values(result.collection.ownedCardCounts).reduce((a, b) => a + b, 0);
    assert.equal(sum, ORIGINS_PULLS);
    assert.deepEqual(result.newlyUnlocked, []);
  });
});

describe("product unlocks", () => {
  it("Jinx Champion Deck unlocks Jinx and adds her precon", () => {
    const result = openProduct(emptyCollection(), "champ-jinx", () => 0);
    assert.equal(isLegendUnlocked(result.collection, "jinx"), true);
    assert.deepEqual(result.newlyUnlocked, ["jinx"]);
    assert.equal(result.pulls[0]?.defId, LEGENDS.find((l) => l.id === "jinx")?.championId);
    for (const [id, n] of deckListFor("jinx")) {
      assert.equal(result.collection.ownedCardCounts[id], n);
    }
  });

  it("Viktor and Lee Sin decks unlock only those legends", () => {
    let c = emptyCollection();
    c = openProduct(c, "champ-viktor", () => 0).collection;
    c = openProduct(c, "champ-leesin", () => 0).collection;
    assert.equal(isLegendUnlocked(c, "viktor"), true);
    assert.equal(isLegendUnlocked(c, "leesin"), true);
    assert.equal(isLegendUnlocked(c, "annie"), false);
    assert.equal(isLegendUnlocked(c, "garen"), false);
  });

  it("Proving Grounds unlocks Annie, Garen, and Lux", () => {
    const result = openProduct(emptyCollection(), "proving-grounds", () => 0);
    assert.deepEqual(result.newlyUnlocked, ["garen", "annie", "lux"]);
    assert.equal(isLegendUnlocked(result.collection, "annie"), true);
    assert.equal(isLegendUnlocked(result.collection, "garen"), true);
    assert.equal(isLegendUnlocked(result.collection, "lux"), true);
    assert.equal(isLegendUnlocked(result.collection, "jinx"), false);
    assert.equal(result.pulls.length, 3);
  });
});
