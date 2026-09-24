import { getDef } from "./cards";
import {
  applyAction,
  getLegalActions,
  legalMoveDests,
  legalTargets,
  movableUnits,
  unitMight,
} from "./engine";
import type { CardInst, GameAction, GameState } from "./types";

function scoreAction(s: GameState, a: GameAction): number {
  if (a.type === "dismiss_combat" || a.type === "confirm_seat") return 1000;
  if (s.showdown && a.type === "invite") {
    const sd = s.showdown;
    const bf = s.battlefields.find((b) => b.id === sd.battlefieldId);
    if (!bf) return 0;
    const atk = bf.units.filter((u) => u.owner === sd.attacker).reduce((n, u) => n + unitMight(s, u, "attack", bf.id), 0);
    const def = bf.units.filter((u) => u.owner === sd.defender).reduce((n, u) => n + unitMight(s, u, "defend", bf.id), 0);
    const mine = s.current === sd.attacker ? atk : def;
    const theirs = s.current === sd.attacker ? def : atk;
    return mine < theirs ? 9 : 1;
  }
  if (a.type === "pass") {
    if (s.showdown) {
      const sd = s.showdown;
      const bf = s.battlefields.find((b) => b.id === sd.battlefieldId);
      if (!bf) return 8;
      const atk = bf.units.filter((u) => u.owner === sd.attacker).reduce((n, u) => n + unitMight(s, u, "attack", bf.id), 0);
      const def = bf.units.filter((u) => u.owner === sd.defender).reduce((n, u) => n + unitMight(s, u, "defend", bf.id), 0);
      const mine = s.current === sd.attacker ? atk : def;
      const theirs = s.current === sd.attacker ? def : atk;
      return mine >= theirs ? 14 : 3;
    }
    return 1;
  }
  if (a.type === "cancel") return -5;
  if (a.type === "mulligan") {
    const p = s.players[s.current]!;
    const expensive = a.iids.filter((id) => {
      const c = p.hand.find((x) => x.iid === id);
      return c && getDef(c.defId).energy >= 4;
    }).length;
    return expensive * 4 - a.iids.length;
  }
  if (a.type === "play" || a.type === "play_champion") {
    const p = s.players[s.current]!;
    const inst =
      a.type === "play_champion"
        ? p.champion
        : p.hand.find((c) => c.iid === a.iid);
    if (!inst) return -10;
    const d = getDef(inst.defId);
    if (d.kind === "unit") {
      return 6 + (d.might ?? 0) * 2 - d.energy + (d.accelerate ? 3 : 0) + (d.isChampion ? 6 : 0);
    }
    if (d.kind === "gear") return 9 + (d.gearAuraMight ?? 0) * 4;
    if (d.kind === "spell") {
      if (d.playEffect?.type === "draw") return 5 + d.playEffect.n * 3;
      if (d.playEffect?.type === "damage") {
        const fx = d.playEffect;
        const kills = legalTargets(s, fx, s.current).iids.filter((id) => {
          for (const bf of s.battlefields) {
            const u = bf.units.find((x) => x.iid === id && x.owner !== s.current);
            if (u && unitMight(s, u, "normal", bf.id) - u.damage <= fx.n) return true;
          }
          return false;
        }).length;
        return 4 + fx.n + kills * 10;
      }
      if (d.playEffect?.type === "recall") return 14;
      if (d.playEffect?.type === "damage_all_enemy_at") return 12;
      if (d.playEffect?.type === "ready_unit") return 8;
      if (d.playEffect?.type === "buff") return 7;
    }
    return 3;
  }
  if (a.type === "legend") return 11;
  if (a.type === "move") {
    const bf = s.battlefields.find((b) => b.id === a.battlefieldId);
    if (!bf) return 0;
    const movingMight = a.iids.reduce((n, id) => {
      for (const p of s.players) {
        const u = p.base.find((x) => x.iid === id);
        if (u) return n + unitMight(s, u, "attack", bf.id);
      }
      for (const b of s.battlefields) {
        const u = b.units.find((x) => x.iid === id);
        if (u) return n + unitMight(s, u, "attack", bf.id);
      }
      return n;
    }, 0);
    const enemies = bf.units.filter((u) => u.owner !== s.current);
    const enemyMight = enemies.reduce((n, u) => n + unitMight(s, u, "defend", bf.id), 0);
    if (!enemies.length) {
      const emptyBonus = bf.controller === s.current ? 4 : 32;
      return emptyBonus + movingMight + a.iids.length;
    }
    if (movingMight > enemyMight) return 26 + (movingMight - enemyMight);
    if (movingMight === enemyMight) return 6;
    return -8 - (enemyMight - movingMight);
  }
  if (a.type === "target") {
    const effect = s.targeting?.effect;
    if (!effect) return 0;
    if (a.iid) {
      const targetIid = a.iid;
      const unit = (() => {
        for (const bf of s.battlefields) {
          const u = bf.units.find((x) => x.iid === targetIid);
          if (u) return { u, bf };
        }
        for (const p of s.players) {
          const u = p.base.find((x) => x.iid === targetIid);
          if (u) return { u, bf: undefined };
        }
        return null;
      })();
      if (!unit) return 0;
      const enemy = unit.u.owner !== s.current;
      const m = unitMight(s, unit.u, "normal", unit.bf?.id);
      if (effect.type === "damage") {
        if (enemy && m - unit.u.damage <= effect.n) return 20 + m;
        if (enemy) return 6 + effect.n;
        return -12;
      }
      if (effect.type === "recall") return enemy ? 12 + m : -12;
      if (effect.type === "ready_unit") return unit.bf ? 10 : 6;
      if (effect.type === "buff") return 5 + m;
    }
    if (a.battlefieldId) {
      const bf = s.battlefields.find((b) => b.id === a.battlefieldId);
      if (!bf) return 0;
      return bf.units.filter((u) => u.owner !== s.current).length * 6;
    }
  }
  return 0;
}

type RaidPlan = { iids: string[]; battlefieldId: string };

function onBase(s: GameState, u: CardInst): boolean {
  return s.players[u.owner]?.base.some((x) => x.iid === u.iid) ?? false;
}

/**
 * Minimum force that strictly out-might the defenders.
 * One unit is enough for an empty field. A fight we cannot win is skipped
 * so the leftover unit stays home.
 */
function cheapestWin(s: GameState, pool: CardInst[], enemyMight: number, bfId: string): CardInst[] | null {
  const byEconomy = (a: CardInst, b: CardInst) => {
    const base = Number(onBase(s, b)) - Number(onBase(s, a));
    if (base !== 0) return base;
    return unitMight(s, a, "attack", bfId) - unitMight(s, b, "attack", bfId);
  };
  const ordered = pool.slice().sort(byEconomy);
  const solo = ordered.find((u) => unitMight(s, u, "attack", bfId) > enemyMight);
  const heavy = pool.slice().sort((a, b) => {
    const base = Number(onBase(s, b)) - Number(onBase(s, a));
    if (base !== 0) return base;
    return unitMight(s, b, "attack", bfId) - unitMight(s, a, "attack", bfId);
  });
  const chosen: CardInst[] = [];
  if (!solo) {
    let might = 0;
    for (const u of heavy) {
      chosen.push(u);
      might += unitMight(s, u, "attack", bfId);
      if (might > enemyMight) break;
    }
    if (chosen.reduce((n, u) => n + unitMight(s, u, "attack", bfId), 0) <= enemyMight) return null;
  }
  const group = solo ? [solo] : chosen;
  if (!legalMoveDests(s, group.map((u) => u.iid)).includes(bfId)) return null;
  return group;
}

/** Split ready units across fields. Leaves a unit home when every fight is a loss. */
export function planRaids(s: GameState): RaidPlan[] {
  if (s.phase !== "action" || s.showdown || s.lastCombat || s.winner !== null) return [];
  const me = s.current;
  const p = s.players[me];
  if (!p) return [];
  const pool = movableUnits(s);
  if (!pool.length) return [];
  const pointMatters = s.victory - p.points <= 2;

  const dests = s.battlefields.flatMap((bf) => {
    const enemies = bf.units.filter((u) => u.owner !== me);
    const owners = new Set(enemies.map((u) => u.owner));
    if (owners.size > 1) return [];
    const weHold = bf.controller === me && bf.units.some((u) => u.owner === me);
    const empty = enemies.length === 0;
    const scores = !s.scoredThisTurn.includes(bf.id) && !weHold;
    return [
      {
        bf,
        enemyMight: enemies.reduce((n, u) => n + unitMight(s, u, "defend", bf.id), 0),
        empty,
        scores,
        weHold,
      },
    ];
  });

  const rank = (d: (typeof dests)[number]) => {
    if (d.empty && d.weHold) return 500;
    if (d.empty && d.scores) return pointMatters ? 0 : 30;
    if (!d.empty && d.scores) return pointMatters ? 10 : 0;
    if (!d.empty) return 40;
    return 50;
  };
  const ordered = dests.slice().sort((a, b) => rank(a) - rank(b) || a.enemyMight - b.enemyMight);

  const used = new Set<string>();
  const claimed = new Set(s.marchQueue.map((m) => m.battlefieldId));
  const raids: RaidPlan[] = [];
  for (const d of ordered) {
    if (claimed.has(d.bf.id)) continue;
    if (d.empty && (d.weHold || !d.scores)) continue;
    const free = pool.filter((u) => !used.has(u.iid) && legalMoveDests(s, [u.iid]).includes(d.bf.id));
    if (!free.length) continue;
    const group = cheapestWin(s, free, d.empty ? 0 : d.enemyMight, d.bf.id);
    if (!group) continue;
    for (const u of group) used.add(u.iid);
    raids.push({ iids: group.map((u) => u.iid), battlefieldId: d.bf.id });
  }
  return raids;
}

/** Next march-queue step: one planned raid, or launch when someone is staying home. */
export function nextMarchAction(s: GameState): GameAction | null {
  const plan = planRaids(s);
  if (plan.length) {
    const raid = plan[0]!;
    return { type: "queue_move", iids: raid.iids, battlefieldId: raid.battlefieldId };
  }
  if (s.phase === "action" && !s.showdown && !s.lastCombat && s.marchQueue.length) {
    return { type: "launch_marches" };
  }
  return null;
}

export function chooseAction(s: GameState): GameAction {
  const acts = getLegalActions(s);
  if (!acts.length) return { type: "pass" };

  if (s.phase === "action" && !s.lastCombat) {
    const nonMove = acts.filter((a) => a.type !== "move");
    let best = nonMove[0] ?? acts[0]!;
    let bestScore = -9999;
    for (const a of nonMove) {
      const sc = scoreAction(s, a);
      if (sc > bestScore) {
        bestScore = sc;
        best = a;
      }
    }
    const march = nextMarchAction(s);
    if (march && bestScore <= 1) return march;
    return best;
  }

  let best = acts[0]!;
  let bestScore = -9999;
  for (const a of acts) {
    const sc = scoreAction(s, a);
    if (sc > bestScore) {
      bestScore = sc;
      best = a;
    }
  }
  return best;
}

export function stepAi(s: GameState): GameState {
  const a = chooseAction(s);
  return applyAction(s, a);
}
