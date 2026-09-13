import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MUTE_KEY, readMuted, writeMuted, type MuteStorage } from "./mute.ts";

function memory(): MuteStorage & { data: Record<string, string> } {
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

describe("mute persistence", () => {
  it("reads and writes riftbound-muted", () => {
    const store = memory();
    assert.equal(readMuted(store), false);
    writeMuted(true, store);
    assert.equal(store.data[MUTE_KEY], "1");
    assert.equal(readMuted(store), true);
    writeMuted(false, store);
    assert.equal(store.data[MUTE_KEY], "0");
    assert.equal(readMuted(store), false);
  });

  it("treats a missing store as unmuted", () => {
    assert.equal(readMuted(null), false);
  });
});
