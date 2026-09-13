import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stepAi } from "./ai.ts";
import {
  applyAction,
  battlefieldSeats,
  createGame,
  drawnAfterMulligan,
  energyOf,
  hideHands,
  legalMoveDests,
  movableUnits,
  sweptForFinalPoint,
} from "./engine.ts";
import type { CardInst, GameState, SeatConfig } from "./types.ts";

const HUMANS: SeatConfig[] = [
  { name: "A", kind: "human", legendId: "jinx" },
  { name: "B", kind: "human", legendId: "garen" },
  { name: "C", kind: "human", legendId: "ahri" },
];

const VS_AI: SeatConfig[] = [
  { name: "You", kind: "human", legendId: "jinx" },
  { name: "AI1", kind: "ai", legendId: "garen" },
  { name: "AI2", kind: "ai", legendId: "ahri" },
];

const ALL_AI: SeatConfig[] = [
  { name: "AI1", kind: "ai", legendId: "jinx" },
  { name: "AI2", kind: "ai", legendId: "garen" },
  { name: "AI3", kind: "ai", legendId: "ahri" },
];

function unit(iid: string, owner: number, defId = "scrapling"): CardInst {
  return { iid, defId, owner, exhausted: false, damage: 0, tempMight: 0 };
}

function windowSig(s: GameState): string {
  return [
    s.phase,
    s.current,
    s.iidSeq,
    s.lastCombat ? 1 : 0,
    s.showdown?.consecutivePasses ?? "-",
    s.targeting?.effect.type ?? "-",
    s.players.map((p) => `${p.hand.length}/${p.base.length}/${p.points}/${energyOf(p)}`).join(";"),
    s.battlefields.map((b) => `${b.controller ?? "x"}:${b.units.map((u) => u.iid).join("+")}`).join(","),
  ].join("|");
}

function toAction(s: GameState): GameState {
  let n = 0;
  while (s.winner === null && s.phase !== "action" && n++ < 24) {
    if (s.phase === "pass_device") s = applyAction(s, { type: "confirm_seat" });
    else if (s.phase === "mulligan") s = applyAction(s, { type: "mulligan", iids: [] });
    else if (s.lastCombat) s = applyAction(s, { type: "dismiss_combat" });
    else break;
  }
  return s;
}

describe("mulligan replacements", () => {
  it("returns the new hand cards after a human bottoms one", () => {
    const before = createGame({ mode: "skirmish", seats: HUMANS, seed: 1 });
    assert.equal(before.phase, "mulligan");
    const tossed = before.players[0]!.hand[0]!;
    const after = applyAction(before, { type: "mulligan", iids: [tossed.iid] });
    const drawn = drawnAfterMulligan(before, after, 0);
    assert.equal(drawn.length, 1);
    assert.notEqual(drawn[0]!.iid, tossed.iid);
    assert.ok(after.players[0]!.hand.some((c) => c.iid === drawn[0]!.iid));
    assert.ok(!after.players[0]!.hand.some((c) => c.iid === tossed.iid));
  });

  it("returns nothing when the hand is kept", () => {
    const before = createGame({ mode: "skirmish", seats: HUMANS, seed: 2 });
    const after = applyAction(before, { type: "mulligan", iids: [] });
    assert.deepEqual(drawnAfterMulligan(before, after, 0), []);
  });
});

describe("hideHands / pass-device privacy", () => {
  it("hides every hand while the device is being passed", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 1 }));
    s = { ...s, phase: "pass_device" };
    const hidden = hideHands(s, s.current);
    for (const p of hidden.players) {
      assert.ok(p.hand.length > 0);
      assert.ok(p.hand.every((c) => c.defId === "__hidden"));
    }
  });

  it("shows only the viewer's hand during their action window", () => {
    const s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 1 }));
    const hidden = hideHands(s, s.current);
    assert.ok(hidden.players[s.current]!.hand.every((c) => c.defId !== "__hidden"));
    for (const p of hidden.players) {
      if (p.id === s.current) continue;
      assert.ok(p.hand.every((c) => c.defId === "__hidden"));
    }
  });
});

describe("march queue", () => {
  it("merges later assignments onto the first planned field (A, B, A)", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 42 }));
    const atk = s.current;
    const def = (atk + 1) % 3;
    s.battlefields[0]!.units.push(unit("e0", def, "vanguard"));
    s.battlefields[1]!.units.push(unit("e1", def, "vanguard"));
    s.players[atk]!.base.push(unit("u1", atk), unit("u2", atk), unit("u3", atk));
    const a = s.battlefields[0]!.id;
    const b = s.battlefields[1]!.id;
    s = applyAction(s, { type: "queue_move", iids: ["u1"], battlefieldId: a });
    s = applyAction(s, { type: "queue_move", iids: ["u2"], battlefieldId: b });
    s = applyAction(s, { type: "queue_move", iids: ["u3"], battlefieldId: a });
    // All ready units assigned → first contested march opens a showdown.
    assert.equal(s.phase, "showdown");
    assert.equal(s.showdown?.battlefieldId, a);
    assert.deepEqual(
      s.marchQueue.map((m) => ({ bf: m.battlefieldId, n: m.iids.length, iids: m.iids })),
      [{ bf: b, n: 1, iids: ["u2"] }],
    );
    const atkOnA = s.battlefields[0]!.units.filter((u) => u.owner === atk).map((u) => u.iid);
    assert.deepEqual(atkOnA.sort(), ["u1", "u3"]);
  });

  it("sends a multi-select group as one raid", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 3 }));
    const atk = s.current;
    const def = (atk + 1) % 3;
    s.battlefields[0]!.units.push(unit("e0", def, "vanguard"));
    s.players[atk]!.base.push(unit("g1", atk), unit("g2", atk));
    const dests = legalMoveDests(s, ["g1", "g2"]);
    assert.ok(dests.includes(s.battlefields[0]!.id));
    s = applyAction(s, { type: "queue_move", iids: ["g1", "g2"], battlefieldId: s.battlefields[0]!.id });
    assert.equal(s.showdown?.battlefieldId, s.battlefields[0]!.id);
    const moved = s.battlefields[0]!.units.filter((u) => u.owner === atk).map((u) => u.iid);
    assert.deepEqual(moved.sort(), ["g1", "g2"]);
  });

  it("splits leftover ready units across a second field", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 8 }));
    const atk = s.current;
    s.players[atk]!.base.push(unit("s1", atk), unit("s2", atk));
    s = applyAction(s, { type: "queue_move", iids: ["s1"], battlefieldId: s.battlefields[0]!.id });
    assert.equal(s.marchQueue.length, 1);
    assert.equal(movableUnits(s).some((u) => u.iid === "s2"), true);
    s = applyAction(s, { type: "queue_move", iids: ["s2"], battlefieldId: s.battlefields[1]!.id });
    // Empty fields auto-resolve both marches.
    assert.equal(s.marchQueue.length, 0);
    assert.ok(s.battlefields[0]!.units.some((u) => u.iid === "s1"));
    assert.ok(s.battlefields[1]!.units.some((u) => u.iid === "s2"));
  });
});

describe("showdown passes", () => {
  it("finishes after each participant passes once, including a helper", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 7 }));
    const atk = s.current;
    const def = (atk + 1) % 3;
    const help = (atk + 2) % 3;
    const bf = s.battlefields[0]!;
    bf.units.push(unit("def1", def, "vanguard"));
    s.players[atk]!.base.push(unit("atk2", atk, "fishbones"));
    s = applyAction(s, { type: "move", iids: ["atk2"], battlefieldId: bf.id });
    assert.equal(s.phase, "showdown");
    s = applyAction(s, { type: "invite", playerId: help });
    assert.deepEqual(s.showdown?.participants, [atk, def, help]);
    s = applyAction(s, { type: "pass" });
    if (s.phase === "pass_device") s = applyAction(s, { type: "confirm_seat" });
    s = applyAction(s, { type: "pass" });
    if (s.phase === "pass_device") s = applyAction(s, { type: "confirm_seat" });
    s = applyAction(s, { type: "pass" });
    assert.equal(s.showdown, null);
    assert.ok(s.lastCombat);
    assert.equal(s.current, atk);
    assert.equal(s.phase, "action");
  });

  it("resets the pass streak when someone plays, so the fight does not end early", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 11 }));
    const atk = s.current;
    const def = (atk + 1) % 3;
    const bf = s.battlefields[0]!;
    bf.units.push(unit("def1", def, "vanguard"));
    s.players[atk]!.base.push(unit("atk2", atk, "fishbones"));
    s = applyAction(s, { type: "move", iids: ["atk2"], battlefieldId: bf.id });
    s = applyAction(s, { type: "pass" });
    if (s.phase === "pass_device") s = applyAction(s, { type: "confirm_seat" });
    assert.equal(s.showdown?.consecutivePasses, 1);
    const spell = s.players[s.current]!.hand.find((c) => {
      // Prefer a no-target action so we stay in the showdown window.
      return ["consult", "essence", "stand-united", "insight"].includes(c.defId);
    });
    if (spell) {
      const after = applyAction(s, { type: "play", iid: spell.iid });
      if (after.showdown) {
        assert.equal(after.showdown.consecutivePasses, 0);
        return;
      }
    }
    // If this seed has no cheap action, passing again should still finish cleanly (2 seats).
    s = applyAction(s, { type: "pass" });
    assert.equal(s.showdown, null);
    assert.ok(s.lastCombat);
  });
});

describe("AI seats", () => {
  it("keeps stepping AI seats until a human window or the game ends", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: VS_AI, seed: 99 }));
    assert.equal(s.players[s.current]!.kind, "human");
    s = applyAction(s, { type: "pass" });
    assert.equal(s.players[s.current]!.kind, "ai");
    let guard = 0;
    while (s.players[s.current]!.kind === "ai" && s.winner === null && guard++ < 40) {
      const before = windowSig(s);
      s = s.lastCombat ? applyAction(s, { type: "dismiss_combat" }) : stepAi(s);
      const after = windowSig(s);
      if (before === after) {
        assert.fail(`AI seat froze at ${before}`);
      }
    }
    assert.ok(s.winner !== null || s.players[s.current]!.kind === "human");
  });

  it("plays an all-AI skirmish to a winner without a stuck window", () => {
    let s = createGame({ mode: "skirmish", seats: ALL_AI, seed: 4 });
    let guard = 0;
    while (s.winner === null && guard++ < 500) {
      const before = windowSig(s);
      s = s.lastCombat ? applyAction(s, { type: "dismiss_combat" }) : stepAi(s);
      const after = windowSig(s);
      if (before === after) assert.fail(`all-AI froze at ${before}`);
    }
    assert.ok(s.winner !== null, "expected a winner within 500 AI steps");
  });
});

const WAR: SeatConfig[] = [
  { name: "First", kind: "human", legendId: "jinx" },
  { name: "B", kind: "human", legendId: "garen" },
  { name: "C", kind: "human", legendId: "ahri" },
  { name: "D", kind: "human", legendId: "darius" },
];

describe("War seating", () => {
  it("uses three battlefields and skips the first seat's field", () => {
    const s = createGame({ mode: "war", seats: WAR, seed: 2 });
    assert.equal(s.battlefields.length, 3);
    assert.deepEqual(
      s.battlefields.map((b) => b.defId),
      battlefieldSeats("war", WAR).map((seat) => {
        const id = seat.legendId;
        if (id === "garen") return "nexus";
        if (id === "ahri") return "abyss";
        if (id === "darius") return "baron";
        return id;
      }),
    );
    assert.equal(s.battlefields.some((b) => b.defId === "dragon"), false);
  });
});

describe("final-point exception", () => {
  it("lets a hold claim the eighth point immediately", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 5 }));
    const next = (s.current + 1) % s.players.length;
    s.players[next]!.points = 7;
    s.battlefields[0]!.controller = next;
    s.battlefields[0]!.units.push(unit("hold1", next, "vanguard"));
    s = applyAction(s, { type: "pass" });
    if (s.phase === "pass_device") s = applyAction(s, { type: "confirm_seat" });
    assert.equal(s.winner, next);
    assert.equal(s.players[next]!.points, 8);
    assert.match(s.log[0]!.t, /holds and claims/);
  });

  it("denies a lone last-second conquer and does not mark the field scored", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 5 }));
    const p = s.current;
    s.players[p]!.points = 7;
    s.players[p]!.base.push(unit("c1", p, "fishbones"));
    const bf = s.battlefields[0]!.id;
    assert.equal(sweptForFinalPoint(s, bf), false);
    const handBefore = s.players[p]!.hand.length;
    s = applyAction(s, { type: "move", iids: ["c1"], battlefieldId: bf });
    assert.equal(s.winner, null);
    assert.equal(s.players[p]!.points, 7);
    assert.equal(s.scoredThisTurn.includes(bf), false);
    assert.equal(s.players[p]!.hand.length, handBefore + 1);
    assert.match(s.log[0]!.t, /Final point denied/);
  });

  it("allows the eighth point on a conquer after scoring every other field this turn", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 5 }));
    const p = s.current;
    s.players[p]!.points = 7;
    s.scoredThisTurn = [s.battlefields[1]!.id, s.battlefields[2]!.id];
    s.players[p]!.base.push(unit("c1", p, "fishbones"));
    const bf = s.battlefields[0]!.id;
    assert.equal(sweptForFinalPoint(s, bf), true);
    s = applyAction(s, { type: "move", iids: ["c1"], battlefieldId: bf });
    assert.equal(s.winner, p);
    assert.equal(s.players[p]!.points, 8);
    assert.match(s.log[0]!.t, /sweeps the map/);
  });

  it("uses the same sweep rule in War (3 fields, first seat brings none)", () => {
    let s = toAction(createGame({ mode: "war", seats: WAR, seed: 6 }));
    assert.equal(s.battlefields.length, 3);
    const p = s.current;
    s.players[p]!.points = 7;
    s.scoredThisTurn = [s.battlefields[0]!.id, s.battlefields[1]!.id];
    s.players[p]!.base.push(unit("c1", p, "fishbones"));
    s = applyAction(s, { type: "move", iids: ["c1"], battlefieldId: s.battlefields[2]!.id });
    assert.equal(s.winner, p);
  });
});

describe("showdown depth", () => {
  it("keeps the helper window after a targeting Reaction", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 7 }));
    const atk = s.current;
    const def = (atk + 1) % 3;
    const help = (atk + 2) % 3;
    const bf = s.battlefields[0]!;
    bf.units.push(unit("def1", def, "vanguard"));
    s.players[atk]!.base.push(unit("atk2", atk, "fishbones"));
    s.players[atk]!.hand.push({
      iid: "zap1",
      defId: "zap",
      owner: atk,
      exhausted: false,
      damage: 0,
      tempMight: 0,
    });
    s.players[atk]!.runes.push({ iid: "r-zap", domain: "fury", exhausted: false });
    s = applyAction(s, { type: "move", iids: ["atk2"], battlefieldId: bf.id });
    s = applyAction(s, { type: "invite", playerId: help });
    s = applyAction(s, { type: "play", iid: "zap1" });
    assert.equal(s.phase, "targeting");
    assert.ok(s.showdown);
    s = applyAction(s, { type: "target", iid: "def1" });
    assert.ok(s.showdown, "showdown continues after the Reaction");
    assert.equal(s.showdown!.consecutivePasses, 0);
    assert.equal(s.current, def);
    if (s.phase === "pass_device") s = applyAction(s, { type: "confirm_seat" });
    s = applyAction(s, { type: "pass" });
    if (s.phase === "pass_device") s = applyAction(s, { type: "confirm_seat" });
    assert.equal(s.current, help);
    assert.equal(s.showdown?.participants.includes(help), true);
    s = applyAction(s, { type: "pass" });
    if (s.phase === "pass_device") s = applyAction(s, { type: "confirm_seat" });
    s = applyAction(s, { type: "pass" });
    assert.equal(s.showdown, null);
    assert.ok(s.lastCombat);
  });

  it("lets an AI helper take a window while two humans fight", () => {
    const seats: SeatConfig[] = [
      { name: "A", kind: "human", legendId: "jinx" },
      { name: "B", kind: "human", legendId: "garen" },
      { name: "AI", kind: "ai", legendId: "ahri" },
    ];
    let s = toAction(createGame({ mode: "skirmish", seats, seed: 9 }));
    const atk = 0;
    const def = 1;
    const help = 2;
    assert.equal(s.current, atk);
    s.battlefields[0]!.units.push(unit("def1", def, "vanguard"));
    s.players[atk]!.base.push(unit("atk2", atk, "fishbones"));
    s = applyAction(s, { type: "move", iids: ["atk2"], battlefieldId: s.battlefields[0]!.id });
    s = applyAction(s, { type: "invite", playerId: help });
    s = applyAction(s, { type: "pass" });
    if (s.phase === "pass_device") s = applyAction(s, { type: "confirm_seat" });
    s = applyAction(s, { type: "pass" });
    assert.equal(s.current, help);
    assert.equal(s.players[help]!.kind, "ai");
    assert.equal(s.phase, "showdown");
    const before = windowSig(s);
    s = stepAi(s);
    assert.notEqual(windowSig(s), before);
  });

  it("allows leftover Accelerate and Ganking units to march after a showdown", () => {
    let s = toAction(createGame({ mode: "skirmish", seats: HUMANS, seed: 12 }));
    const atk = s.current;
    const def = (atk + 1) % 3;
    s.battlefields[0]!.units.push(unit("def1", def, "vanguard"));
    s.players[atk]!.base.push(unit("atk2", atk, "fishbones"));
    s.players[atk]!.base.push({
      iid: "acc1",
      defId: "powpow",
      owner: atk,
      exhausted: false,
      damage: 0,
      tempMight: 0,
    });
    s.battlefields[2]!.units.push({
      iid: "gank1",
      defId: "rocket-girl",
      owner: atk,
      exhausted: false,
      damage: 0,
      tempMight: 0,
    });
    s = applyAction(s, { type: "move", iids: ["atk2"], battlefieldId: s.battlefields[0]!.id });
    s = applyAction(s, { type: "pass" });
    if (s.phase === "pass_device") s = applyAction(s, { type: "confirm_seat" });
    s = applyAction(s, { type: "pass" });
    assert.ok(s.lastCombat);
    s = applyAction(s, { type: "dismiss_combat" });
    assert.equal(s.phase, "action");
    assert.equal(s.current, atk);
    const leftover = movableUnits(s).map((u) => u.iid).sort();
    assert.deepEqual(leftover, ["acc1", "gank1"]);
    s = applyAction(s, { type: "queue_move", iids: ["acc1"], battlefieldId: s.battlefields[1]!.id });
    assert.ok(s.battlefields[1]!.units.some((u) => u.iid === "acc1") || s.marchQueue.some((m) => m.iids.includes("acc1")));
  });
});
