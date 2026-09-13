import { deckListFor, getDef, getLegend } from "./cards";
import type {
  BattlefieldState,
  CardInst,
  CombatReport,
  Domain,
  Effect,
  GameAction,
  GameState,
  PlayerState,
  SetupConfig,
} from "./types";

function nextRng(s: GameState): number {
  let t = (s.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(s: GameState, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRng(s) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function iid(s: GameState): string {
  s.iidSeq += 1;
  return `i${s.iidSeq}`;
}

function log(s: GameState, t: string, p?: number) {
  s.log = [{ t, p }, ...s.log].slice(0, 40);
}

export function cloneState(s: GameState): GameState {
  return structuredClone(s);
}

function player(s: GameState, id = s.current): PlayerState {
  const p = s.players[id];
  if (!p) throw new Error("bad player");
  return p;
}

export function auraMight(s: GameState, owner: number): number {
  const p = s.players[owner];
  if (!p) return 0;
  let n = 0;
  for (const g of p.base) {
    const d = getDef(g.defId);
    if (d.kind === "gear") n += d.gearAuraMight ?? 0;
  }
  return n;
}

export function unitMight(
  s: GameState,
  u: CardInst,
  role: "attack" | "defend" | "normal" = "normal",
  bfId?: string,
): number {
  const d = getDef(u.defId);
  let m = (d.might ?? 0) + u.tempMight + auraMight(s, u.owner);
  if (role === "attack") m += d.assault ?? 0;
  if (role === "defend") m += d.defender ?? 0;
  if (bfId) {
    const bf = s.battlefields.find((b) => b.id === bfId);
    if (bf) m += getDef(bf.defId).bfBonusMight ?? 0;
  }
  return Math.max(0, m);
}

export function energyOf(p: PlayerState): number {
  return p.runes.filter((r) => !r.exhausted).length;
}

export function unitEnergyCost(s: GameState, defId: string, owner: number): number {
  const d = getDef(defId);
  let e = d.energy;
  if (d.kind === "unit") {
    const p = s.players[owner]!;
    const legend = getLegend(p.legendId);
    if (legend.ability === "darius" && p.unitsPlayedThisTurn === 0) {
      e = Math.max(0, e - 1);
    }
  }
  return e;
}

function canPay(s: GameState, owner: number, energy: number, power: number, domains: Domain[]): boolean {
  const p = s.players[owner]!;
  if (energyOf(p) < energy) return false;
  if (power <= 0) return true;
  const matching = p.runes.filter((r) => domains.includes(r.domain));
  return matching.length >= power;
}

function pay(s: GameState, owner: number, energy: number, power: number, domains: Domain[]) {
  const p = s.players[owner]!;
  const ready = p.runes.filter((r) => !r.exhausted);
  let need = energy;
  for (const r of ready) {
    if (need <= 0) break;
    r.exhausted = true;
    need -= 1;
  }
  let pneed = power;
  const prefer = p.runes.filter((r) => domains.includes(r.domain));
  const order = [...prefer.filter((r) => r.exhausted), ...prefer.filter((r) => !r.exhausted)];
  for (const r of order) {
    if (pneed <= 0) break;
    const idx = p.runes.indexOf(r);
    if (idx >= 0) p.runes.splice(idx, 1);
    p.runeDeck.push(r.domain);
    pneed -= 1;
  }
}

export function draw(s: GameState, owner: number, n: number) {
  const p = s.players[owner]!;
  for (let i = 0; i < n; i++) {
    const c = p.deck.shift();
    if (!c) break;
    p.hand.push(c);
  }
}

function readyRune(s: GameState, owner: number) {
  const p = s.players[owner]!;
  const r = p.runes.find((x) => x.exhausted);
  if (r) r.exhausted = false;
}

function channel(s: GameState, owner: number, n: number) {
  const p = s.players[owner]!;
  for (let i = 0; i < n; i++) {
    const d = p.runeDeck.shift();
    if (!d) break;
    p.runes.push({ iid: iid(s), domain: d, exhausted: false });
  }
}

function healAll(s: GameState) {
  for (const p of s.players) {
    for (const u of [...p.base, ...p.hand, ...p.trash]) {
      u.damage = 0;
      u.tempMight = 0;
    }
  }
  for (const bf of s.battlefields) {
    for (const u of bf.units) {
      u.damage = 0;
      u.tempMight = 0;
    }
  }
}

function awaken(s: GameState, owner: number) {
  const p = s.players[owner]!;
  p.legendExhausted = false;
  p.legendUsed = false;
  p.unitsPlayedThisTurn = 0;
  for (const r of p.runes) r.exhausted = false;
  for (const u of p.base) u.exhausted = false;
  for (const bf of s.battlefields) {
    for (const u of bf.units) {
      if (u.owner === owner) u.exhausted = false;
    }
  }
}

function findUnit(s: GameState, unitIid: string): { unit: CardInst; bf?: BattlefieldState; from: "base" | "bf" } | null {
  for (const p of s.players) {
    const u = p.base.find((x) => x.iid === unitIid);
    if (u) return { unit: u, from: "base" };
  }
  for (const bf of s.battlefields) {
    const u = bf.units.find((x) => x.iid === unitIid);
    if (u) return { unit: u, bf, from: "bf" };
  }
  return null;
}

function removeUnit(s: GameState, unitIid: string): CardInst | null {
  for (const p of s.players) {
    const i = p.base.findIndex((x) => x.iid === unitIid);
    if (i >= 0) return p.base.splice(i, 1)[0] ?? null;
    const h = p.hand.findIndex((x) => x.iid === unitIid);
    if (h >= 0) return p.hand.splice(h, 1)[0] ?? null;
    if (p.champion?.iid === unitIid) {
      const c = p.champion;
      p.champion = null;
      return c;
    }
  }
  for (const bf of s.battlefields) {
    const i = bf.units.findIndex((x) => x.iid === unitIid);
    if (i >= 0) return bf.units.splice(i, 1)[0] ?? null;
  }
  return null;
}

function kill(s: GameState, unit: CardInst, bf?: BattlefieldState) {
  const d = getDef(unit.defId);
  const owner = s.players[unit.owner]!;
  if (bf && d.deathDamage) {
    const enemies = bf.units.filter((u) => u.owner !== unit.owner && u.iid !== unit.iid);
    const target = enemies.sort((a, b) => unitMight(s, b, "normal", bf.id) - unitMight(s, a, "normal", bf.id))[0];
    if (target) {
      target.damage += d.deathDamage;
      log(s, `${d.name} snaps — ${d.deathDamage} damage to ${getDef(target.defId).name}`, unit.owner);
      if (target.damage >= unitMight(s, target, "normal", bf.id)) {
        const dead = removeUnit(s, target.iid);
        if (dead) s.players[dead.owner]!.trash.push(dead);
      }
    }
  }
  owner.trash.push(unit);
}

function refreshControl(s: GameState, bf: BattlefieldState): number | null {
  const owners = [...new Set(bf.units.map((u) => u.owner))];
  if (owners.length === 1) bf.controller = owners[0]!;
  else if (owners.length === 0) bf.controller = null;
  return bf.controller;
}

/** War: first seat does not bring a battlefield. Skirmish: every seat does. */
export function battlefieldSeats<T>(mode: GameState["mode"], seats: T[]): T[] {
  return mode === "war" ? seats.slice(1) : seats;
}

/** Eighth point on a conquer only if every other field was already scored this turn. */
export function sweptForFinalPoint(s: GameState, bfId: string): boolean {
  const others = s.battlefields.filter((b) => b.id !== bfId);
  return others.length > 0 && others.every((b) => s.scoredThisTurn.includes(b.id));
}

function tryScore(s: GameState, owner: number, kind: "hold" | "conquer", bfId: string) {
  if (s.winner !== null) return;
  if (s.scoredThisTurn.includes(bfId)) return;
  const p = s.players[owner]!;
  const wouldWin = p.points + 1 >= s.victory;
  if (wouldWin) {
    if (kind === "hold") {
      p.points += 1;
      s.scoredThisTurn.push(bfId);
      s.winner = owner;
      s.phase = "gameover";
      log(s, `${p.name} holds and claims the Rift — ${p.points} points`, owner);
      return;
    }
    if (sweptForFinalPoint(s, bfId)) {
      p.points += 1;
      s.scoredThisTurn.push(bfId);
      s.winner = owner;
      s.phase = "gameover";
      log(s, `${p.name} sweeps the map and wins — ${p.points} points`, owner);
      return;
    }
    draw(s, owner, 1);
    log(s, `Final point denied on conquer — ${p.name} draws instead`, owner);
    return;
  }
  p.points += 1;
  s.scoredThisTurn.push(bfId);
  log(
    s,
    `${p.name} ${kind === "hold" ? "holds" : "conquers"} ${getDef(s.battlefields.find((b) => b.id === bfId)!.defId).name} (+1, ${p.points})`,
    owner,
  );
}

function applyEffect(
  s: GameState,
  owner: number,
  effect: Effect,
  target?: { iid?: string; battlefieldId?: string },
) {
  if (s.winner !== null) return;
  switch (effect.type) {
    case "draw":
      draw(s, owner, effect.n);
      log(s, `${s.players[owner]!.name} draws ${effect.n}`, owner);
      break;
    case "ready_rune":
      readyRune(s, owner);
      break;
    case "token": {
      const recruit = {
        iid: iid(s),
        defId: "recruit",
        owner,
        exhausted: true,
        damage: 0,
        tempMight: 0,
      };
      s.players[owner]!.base.push(recruit);
      log(s, `${s.players[owner]!.name} summons a Recruit`, owner);
      break;
    }
    case "damage": {
      if (!target?.iid) return;
      const found = findUnit(s, target.iid);
      if (!found) return;
      found.unit.damage += effect.n;
      const m = unitMight(s, found.unit, "normal", found.bf?.id);
      log(s, `${effect.n} damage to ${getDef(found.unit.defId).name}`, owner);
      if (found.unit.damage >= m) {
        const u = removeUnit(s, found.unit.iid);
        if (u) kill(s, u, found.bf);
        if (found.bf) {
          const prev = found.bf.controller;
          refreshControl(s, found.bf);
          if (found.bf.controller !== null && found.bf.controller !== prev && found.bf.controller === owner && !s.showdown) {
            onGainControl(s, owner, found.bf);
          }
        }
      }
      break;
    }
    case "damage_all_enemy_at": {
      const bf = s.battlefields.find((b) => b.id === target?.battlefieldId);
      if (!bf) return;
      const enemies = bf.units.filter((u) => u.owner !== owner);
      const dead: CardInst[] = [];
      for (const u of enemies) {
        u.damage += effect.n;
        if (u.damage >= unitMight(s, u, "normal", bf.id)) dead.push(u);
      }
      for (const u of dead) {
        const gone = removeUnit(s, u.iid);
        if (gone) kill(s, gone, bf);
      }
      log(s, `Sweep ${effect.n} at ${getDef(bf.defId).name}`, owner);
      const prev = bf.controller;
      refreshControl(s, bf);
      if (bf.controller !== null && bf.controller !== prev && bf.controller === owner && !s.showdown) {
        onGainControl(s, owner, bf);
      }
      break;
    }
    case "recall": {
      if (!target?.iid) return;
      const found = findUnit(s, target.iid);
      if (!found || found.unit.owner === owner) return;
      const u = removeUnit(s, found.unit.iid);
      if (!u) return;
      u.exhausted = true;
      s.players[u.owner]!.base.push(u);
      log(s, `${getDef(u.defId).name} is recalled to base`, owner);
      if (found.bf) {
        const prev = found.bf.controller;
        refreshControl(s, found.bf);
        if (found.bf.controller !== null && found.bf.controller !== prev && found.bf.controller === s.current && !s.showdown) {
          onGainControl(s, s.current, found.bf);
        }
      }
      break;
    }
    case "ready_unit": {
      if (!target?.iid) return;
      const found = findUnit(s, target.iid);
      if (!found || found.unit.owner !== owner) return;
      found.unit.exhausted = false;
      log(s, `${getDef(found.unit.defId).name} readies`, owner);
      break;
    }
    case "buff": {
      if (!target?.iid) return;
      const found = findUnit(s, target.iid);
      if (!found || found.unit.owner !== owner) return;
      found.unit.tempMight += effect.n;
      log(s, `${getDef(found.unit.defId).name} gets +${effect.n} Might`, owner);
      break;
    }
    default:
      break;
  }
}

function effectNeedsTarget(e: Effect): boolean {
  return (
    e.type === "damage" ||
    e.type === "damage_all_enemy_at" ||
    e.type === "recall" ||
    e.type === "ready_unit" ||
    e.type === "buff"
  );
}

function onGainControl(s: GameState, owner: number, bf: BattlefieldState) {
  tryScore(s, owner, "conquer", bf.id);
  const bdef = getDef(bf.defId);
  if (bdef.onConquer) {
    if (bdef.onConquer.type === "draw" || bdef.onConquer.type === "ready_rune") {
      applyEffect(s, owner, bdef.onConquer);
    } else if (bdef.onConquer.type === "damage") {
      const enemy = bf.units.find((u) => u.owner !== owner);
      if (enemy) applyEffect(s, owner, bdef.onConquer, { iid: enemy.iid });
    }
  }
  for (const u of bf.units.filter((x) => x.owner === owner)) {
    const d = getDef(u.defId);
    if (d.onConquer) applyEffect(s, owner, d.onConquer);
  }
}

function assignDamage(s: GameState, victims: CardInst[], incoming: number, bfId: string) {
  const sorted = victims.slice().sort((a, b) => unitMight(s, a, "normal", bfId) - unitMight(s, b, "normal", bfId));
  let rest = incoming;
  const killed: CardInst[] = [];
  for (const u of sorted) {
    if (rest <= 0) break;
    const hp = Math.max(1, unitMight(s, u, "normal", bfId) - u.damage);
    if (rest >= hp) {
      rest -= hp;
      u.damage += hp;
      killed.push(u);
    } else {
      u.damage += rest;
      rest = 0;
    }
  }
  return killed;
}

function resolveCombat(s: GameState, bf: BattlefieldState, attacker: number, defender: number): CombatReport {
  const atkUnits = bf.units.filter((u) => u.owner === attacker);
  const defUnits = bf.units.filter((u) => u.owner === defender);
  const atkMight = atkUnits.reduce((n, u) => n + unitMight(s, u, "attack", bf.id), 0);
  const defMight = defUnits.reduce((n, u) => n + unitMight(s, u, "defend", bf.id), 0);
  const killedA = assignDamage(s, atkUnits, defMight, bf.id);
  const killedD = assignDamage(s, defUnits, atkMight, bf.id);
  const report: CombatReport = {
    battlefieldId: bf.id,
    attacker,
    defender,
    atkMight,
    defMight,
    killed: [...killedA, ...killedD].map((u) => ({
      iid: u.iid,
      name: getDef(u.defId).name,
      owner: u.owner,
    })),
    result: "empty",
    log: [
      `${s.players[attacker]!.name} ${atkMight} Might vs ${s.players[defender]!.name} ${defMight} Might`,
    ],
  };
  for (const u of [...killedA, ...killedD]) {
    const gone = removeUnit(s, u.iid);
    if (gone) kill(s, gone, bf);
    report.log.push(`${getDef(u.defId).name} falls`);
  }
  const atkLeft = bf.units.filter((u) => u.owner === attacker);
  const defLeft = bf.units.filter((u) => u.owner === defender);
  if (atkLeft.length && !defLeft.length) {
    report.result = "attacker";
    for (const u of atkLeft) u.exhausted = true;
    refreshControl(s, bf);
    onGainControl(s, attacker, bf);
    report.log.push(`${s.players[attacker]!.name} wins the showdown`);
  } else if (defLeft.length && !atkLeft.length) {
    report.result = "defender";
    refreshControl(s, bf);
    report.log.push(`${s.players[defender]!.name} holds the ground`);
  } else if (!atkLeft.length && !defLeft.length) {
    report.result = "empty";
    bf.controller = null;
    report.log.push("Both armies are wiped — the battlefield lies open");
  } else {
    report.result = "recall";
    for (const u of atkLeft.slice()) {
      const gone = removeUnit(s, u.iid);
      if (gone) {
        gone.exhausted = true;
        s.players[gone.owner]!.base.push(gone);
      }
    }
    refreshControl(s, bf);
    report.log.push("Showdown stalls — attackers are recalled");
  }
  s.lastCombat = report;
  return report;
}

function resumePhase(s: GameState) {
  if (s.winner !== null) {
    s.phase = "gameover";
    return;
  }
  s.phase = s.showdown ? "showdown" : "action";
}

function openShowdown(s: GameState, bf: BattlefieldState, attacker: number, defender: number) {
  s.current = attacker;
  s.showdown = {
    battlefieldId: bf.id,
    attacker,
    defender,
    turnPlayer: attacker,
    participants: [attacker, defender],
    consecutivePasses: 0,
    priorityIndex: 0,
  };
  s.phase = "showdown";
  log(
    s,
    `Showdown at ${getDef(bf.defId).name} — play Actions and Reactions, ask for help, or pass to fight`,
    attacker,
  );
}

function advanceShowdown(s: GameState) {
  const sd = s.showdown;
  if (!sd || sd.participants.length === 0) {
    resumePhase(s);
    return;
  }
  const from = sd.participants.indexOf(s.current);
  const idx = from >= 0 ? from : Math.max(0, sd.priorityIndex);
  sd.priorityIndex = (idx + 1) % sd.participants.length;
  const next = sd.participants[sd.priorityIndex]!;
  s.current = next;
  const p = player(s);
  if (p.kind === "human" && s.humanCount > 1) s.phase = "pass_device";
  else s.phase = "showdown";
}

function yieldShowdown(s: GameState) {
  const sd = s.showdown;
  if (!sd) return;
  sd.consecutivePasses += 1;
  log(s, `${player(s).name} passes the showdown`, s.current);
  if (sd.participants.length > 0 && sd.consecutivePasses >= sd.participants.length) {
    finishShowdown(s);
    return;
  }
  advanceShowdown(s);
}

function afterShowdownSpell(s: GameState) {
  if (!s.showdown) return;
  s.showdown.consecutivePasses = 0;
  if (s.phase === "targeting") return;
  if (showdownMissingSide(s)) {
    finishShowdown(s);
    return;
  }
  advanceShowdown(s);
}

function showdownMissingSide(s: GameState): boolean {
  const sd = s.showdown;
  if (!sd) return false;
  const bf = s.battlefields.find((b) => b.id === sd.battlefieldId);
  if (!bf) return true;
  const atk = bf.units.some((u) => u.owner === sd.attacker);
  const def = bf.units.some((u) => u.owner === sd.defender);
  return !atk || !def;
}

function finishShowdown(s: GameState) {
  const sd = s.showdown;
  if (!sd) return;
  const bf = s.battlefields.find((b) => b.id === sd.battlefieldId);
  const turnPlayer = sd.turnPlayer;
  s.showdown = null;
  if (bf) resolveCombat(s, bf, sd.attacker, sd.defender);
  s.current = turnPlayer;
  s.phase = s.winner !== null ? "gameover" : "action";
}

function moveUnits(s: GameState, iids: string[], battlefieldId: string) {
  const bf = s.battlefields.find((b) => b.id === battlefieldId);
  if (!bf) return;
  const moving: CardInst[] = [];
  for (const id of iids) {
    const found = findUnit(s, id);
    if (!found || found.unit.owner !== s.current || found.unit.exhausted) continue;
    if (found.from === "bf" && found.bf?.id === battlefieldId) continue;
    if (found.from === "bf" && !getDef(found.unit.defId).ganking) continue;
    const u = removeUnit(s, id);
    if (u) {
      u.exhausted = true;
      moving.push(u);
    }
  }
  if (!moving.length) return;
  const enemies = [...new Set(bf.units.filter((u) => u.owner !== s.current).map((u) => u.owner))];
  for (const u of moving) bf.units.push(u);
  log(s, `${s.players[s.current]!.name} moves ${moving.length} to ${getDef(bf.defId).name}`, s.current);
  if (enemies.length === 1) {
    openShowdown(s, bf, s.current, enemies[0]!);
  } else if (enemies.length === 0) {
    const prev = bf.controller;
    refreshControl(s, bf);
    if (bf.controller === s.current && prev !== s.current) onGainControl(s, s.current, bf);
  }
}

export function launchNextMarch(s: GameState) {
  if (s.showdown || s.lastCombat || s.winner !== null) return;
  while (s.marchQueue.length && !s.showdown && !s.lastCombat && s.winner === null) {
    const step = s.marchQueue.shift()!;
    moveUnits(s, step.iids, step.battlefieldId);
  }
}

function queueMarch(s: GameState, iids: string[], battlefieldId: string) {
  const reserved = queuedIids(s);
  const free = iids.filter((id) => !reserved.has(id));
  if (!free.length) return;
  if (!legalMoveDests(s, free).includes(battlefieldId)) return;
  const existing = s.marchQueue.find((m) => m.battlefieldId === battlefieldId);
  if (existing) existing.iids.push(...free);
  else s.marchQueue.push({ iids: free, battlefieldId });
  const names = free.map((id) => getDef(findUnit(s, id)!.unit.defId).name).join(", ");
  log(s, `${player(s).name} assigns ${names} → ${getDef(s.battlefields.find((b) => b.id === battlefieldId)!.defId).name}`, s.current);
  if (!movableUnits(s).length) launchNextMarch(s);
}

export function legalTargets(
  s: GameState,
  effect: Effect,
  owner: number,
): { iids: string[]; battlefieldIds: string[] } {
  const iids: string[] = [];
  const battlefieldIds: string[] = [];
  if (effect.type === "damage") {
    for (const bf of s.battlefields) {
      for (const u of bf.units) iids.push(u.iid);
    }
    for (const p of s.players) {
      for (const u of p.base) {
        if (getDef(u.defId).kind === "unit") iids.push(u.iid);
      }
    }
  } else if (effect.type === "damage_all_enemy_at") {
    for (const bf of s.battlefields) {
      if (bf.units.some((u) => u.owner !== owner)) battlefieldIds.push(bf.id);
    }
  } else if (effect.type === "recall") {
    for (const bf of s.battlefields) {
      for (const u of bf.units) if (u.owner !== owner) iids.push(u.iid);
    }
  } else if (effect.type === "ready_unit") {
    for (const p of s.players) {
      if (p.id !== owner) continue;
      for (const u of p.base) if (u.exhausted && getDef(u.defId).kind === "unit") iids.push(u.iid);
    }
    for (const bf of s.battlefields) {
      for (const u of bf.units) if (u.owner === owner && u.exhausted) iids.push(u.iid);
    }
  } else if (effect.type === "buff") {
    for (const p of s.players) {
      if (p.id !== owner) continue;
      for (const u of p.base) if (getDef(u.defId).kind === "unit") iids.push(u.iid);
    }
    for (const bf of s.battlefields) {
      for (const u of bf.units) if (u.owner === owner) iids.push(u.iid);
    }
  }
  return { iids, battlefieldIds };
}

function legendLegal(s: GameState): boolean {
  const p = player(s);
  if (p.legendUsed) return false;
  const legend = getLegend(p.legendId);
  if (legend.ability === "darius") return false;
  if (legend.ability === "jinx") {
    if (p.runes.length < 1) return false;
    return legalTargets(s, { type: "damage", n: 1 }, p.id).iids.length > 0;
  }
  if (legend.ability === "ahri") {
    if (p.legendExhausted) return false;
    if (energyOf(p) < 1) return false;
    return legalTargets(s, { type: "recall" }, p.id).iids.length > 0;
  }
  if (legend.ability === "garen") {
    return s.battlefields.some(
      (bf) =>
        bf.controller === p.id &&
        bf.units.some((u) => u.owner === p.id && u.exhausted),
    );
  }
  if (legend.ability === "viktor") return true;
  if (legend.ability === "annie") return !p.legendExhausted && p.runes.some((r) => r.exhausted);
  if (legend.ability === "leesin") {
    if (p.legendExhausted || energyOf(p) < 1) return false;
    return legalTargets(s, { type: "buff", n: 1 }, p.id).iids.length > 0;
  }
  if (legend.ability === "lux") return false;
  return false;
}

export function spellSpeed(d: { kind: string; playEffect?: Effect | undefined }): "action" | "reaction" | "main" {
  if (d.kind !== "spell") return "main";
  const fx = d.playEffect?.type;
  if (fx === "damage" || fx === "damage_all_enemy_at" || fx === "recall") return "reaction";
  return "action";
}

export function playableFromHand(s: GameState, c: CardInst): boolean {
  if (s.winner !== null) return false;
  const d = getDef(c.defId);
  if (s.phase === "showdown") {
    if (spellSpeed(d) === "main") return false;
  } else if (s.phase !== "action") {
    return false;
  }
  const cost = unitEnergyCost(s, c.defId, s.current);
  if (!canPay(s, s.current, cost, d.power, d.domains)) return false;
  if (d.playEffect && effectNeedsTarget(d.playEffect)) {
    const t = legalTargets(s, d.playEffect, s.current);
    if (!t.iids.length && !t.battlefieldIds.length) return false;
  }
  return true;
}

export function canPlayChampion(s: GameState): boolean {
  const p = player(s);
  if (!p.champion || s.phase !== "action") return false;
  return playableFromHand(s, p.champion);
}

export function queuedIids(s: GameState): Set<string> {
  const set = new Set<string>();
  for (const m of s.marchQueue) for (const id of m.iids) set.add(id);
  return set;
}

export function movableUnits(s: GameState): CardInst[] {
  if (s.phase !== "action") return [];
  const p = player(s);
  const reserved = queuedIids(s);
  const out: CardInst[] = [];
  for (const u of p.base) {
    if (!u.exhausted && !reserved.has(u.iid) && getDef(u.defId).kind === "unit") out.push(u);
  }
  for (const bf of s.battlefields) {
    for (const u of bf.units) {
      if (u.owner === p.id && !u.exhausted && !reserved.has(u.iid) && getDef(u.defId).ganking) out.push(u);
    }
  }
  return out;
}

export function legalMoveDests(s: GameState, iids: string[]): string[] {
  if (!iids.length) return [];
  const units = iids
    .map((id) => findUnit(s, id))
    .filter((x): x is NonNullable<typeof x> => !!x && x.unit.owner === s.current && !x.unit.exhausted);
  if (!units.length) return [];
  const dests: string[] = [];
  for (const bf of s.battlefields) {
    const otherFighters = [...new Set(bf.units.filter((u) => u.owner !== s.current).map((u) => u.owner))];
    if (otherFighters.length > 1) continue;
    const fromThis = units.every((u) => u.bf?.id === bf.id);
    if (fromThis) continue;
    const needsGank = units.some((u) => u.from === "bf" && u.bf?.id !== bf.id);
    if (needsGank && units.some((u) => u.from === "bf" && !getDef(u.unit.defId).ganking)) continue;
    dests.push(bf.id);
  }
  return dests;
}

function playCard(s: GameState, inst: CardInst, fromChampion: boolean) {
  const d = getDef(inst.defId);
  const cost = unitEnergyCost(s, inst.defId, s.current);
  if (!canPay(s, s.current, cost, d.power, d.domains)) return;
  if (d.playEffect && effectNeedsTarget(d.playEffect)) {
    const t = legalTargets(s, d.playEffect, s.current);
    if (!t.iids.length && !t.battlefieldIds.length) return;
    pay(s, s.current, cost, d.power, d.domains);
    if (!fromChampion) {
      const p = player(s);
      const i = p.hand.findIndex((c) => c.iid === inst.iid);
      if (i >= 0) p.hand.splice(i, 1);
    } else {
      player(s).champion = null;
    }
    player(s).trash.push(inst);
    s.targeting = {
      effect: d.playEffect,
      source: "spell",
      paid: true,
      spellIid: inst.iid,
      spellDefId: d.id,
    };
    s.phase = "targeting";
    log(s, `${player(s).name} plays ${d.name} — choose a target`, s.current);
    if (getLegend(player(s).legendId).ability === "lux" && d.kind === "spell" && d.energy >= 3) {
      draw(s, s.current, 1);
      log(s, `${player(s).name} — Lux draws from a heavy spell`, s.current);
    }
    return;
  }
  pay(s, s.current, cost, d.power, d.domains);
  if (!fromChampion) {
    const p = player(s);
    const i = p.hand.findIndex((c) => c.iid === inst.iid);
    if (i >= 0) p.hand.splice(i, 1);
  } else {
    player(s).champion = null;
  }
  if (d.kind === "unit") {
    inst.exhausted = !d.accelerate;
    inst.damage = 0;
    player(s).base.push(inst);
    player(s).unitsPlayedThisTurn += 1;
    log(s, `${player(s).name} deploys ${d.name}`, s.current);
  } else if (d.kind === "gear") {
    inst.exhausted = false;
    player(s).base.push(inst);
    log(s, `${player(s).name} equips ${d.name}`, s.current);
  } else if (d.kind === "spell") {
    player(s).trash.push(inst);
    log(s, `${player(s).name} casts ${d.name}`, s.current);
  }
  if (d.playEffect) applyEffect(s, s.current, d.playEffect);
  if (d.id === "foxfire") draw(s, s.current, 1);
  if (d.id === "essence" || d.id === "consult" || d.id === "stand-united") readyRune(s, s.current);
  if (getLegend(player(s).legendId).ability === "lux" && d.kind === "spell" && d.energy >= 3) {
    draw(s, s.current, 1);
    log(s, `${player(s).name} — Lux draws from a heavy spell`, s.current);
  }
}

function beginTurn(s: GameState) {
  if (s.winner !== null) return;
  s.scoredThisTurn = [];
  s.lastCombat = null;
  s.targeting = null;
  s.marchQueue = [];
  const p = player(s);
  awaken(s, p.id);
  for (const bf of s.battlefields) {
    refreshControl(s, bf);
    if (bf.controller === p.id && bf.units.some((u) => u.owner === p.id)) {
      tryScore(s, p.id, "hold", bf.id);
      const bdef = getDef(bf.defId);
      if (bdef.onHold) applyEffect(s, p.id, bdef.onHold);
      for (const u of p.base) {
        const gd = getDef(u.defId);
        if (gd.kind === "gear" && gd.onHold) applyEffect(s, p.id, gd.onHold);
      }
    }
  }
  if (s.winner !== null) return;
  const last = s.players.length - 1;
  const extra = p.turnsTaken === 0 && p.id === last ? 1 : 0;
  channel(s, p.id, 2 + extra);
  const skipDraw = p.turnsTaken === 0 && p.id === 0;
  if (!skipDraw) draw(s, p.id, 1);
  p.turnsTaken += 1;
  s.turn += 1;
  log(
    s,
    `${p.name} — Awaken, ${s.scoredThisTurn.length ? "Hold, " : ""}Channel ${2 + extra}${skipDraw ? "" : ", Draw"}`,
    p.id,
  );
}

function endTurn(s: GameState) {
  healAll(s);
  if (s.winner !== null) return;
  s.current = (s.current + 1) % s.players.length;
  s.phase = "action";
  beginTurn(s);
  const next = player(s);
  if (next.kind === "human" && s.humanCount > 1 && s.winner === null) {
    s.phase = "pass_device";
  }
}

function applyMulligan(s: GameState, iids: string[]) {
  const p = player(s);
  const chosen = p.hand.filter((c) => iids.includes(c.iid)).slice(0, 2);
  for (const c of chosen) {
    const i = p.hand.indexOf(c);
    if (i >= 0) p.hand.splice(i, 1);
    p.deck.push(c);
  }
  draw(s, p.id, chosen.length);
  log(s, `${p.name} keeps ${4 - chosen.length}, bottoms ${chosen.length}`, p.id);
  p.mulliganDone = true;
  const next = s.players.find((x) => !x.mulliganDone);
  if (!next) {
    s.current = 0;
    s.phase = "action";
    beginTurn(s);
    if (player(s).kind === "human" && s.humanCount > 1) {
      s.phase = "pass_device";
    }
  } else {
    s.current = next.id;
    s.phase = next.kind === "human" && s.humanCount > 1 ? "pass_device" : "mulligan";
  }
}

/** Cards that appeared in `seat`'s hand after a mulligan (the replacements). */
export function drawnAfterMulligan(before: GameState, after: GameState, seat: number): CardInst[] {
  const prev = new Set((before.players[seat]?.hand ?? []).map((c) => c.iid));
  return (after.players[seat]?.hand ?? []).filter((c) => !prev.has(c.iid));
}

function autoMulligan(s: GameState) {
  const p = player(s);
  const expensive = p.hand
    .filter((c) => getDef(c.defId).energy >= 4)
    .slice(0, 2)
    .map((c) => c.iid);
  applyMulligan(s, expensive);
}

export function createGame(setup: SetupConfig): GameState {
  const s: GameState = {
    mode: setup.mode,
    victory: 8,
    players: [],
    battlefields: [],
    current: 0,
    turn: 0,
    phase: "mulligan",
    scoredThisTurn: [],
    winner: null,
    log: [],
    targeting: null,
    lastCombat: null,
    showdown: null,
    marchQueue: [],
    iidSeq: 0,
    rng: setup.seed ?? (Math.floor(Math.random() * 1e9) + 1),
    humanCount: setup.seats.filter((x) => x.kind === "human").length,
  };

  setup.seats.forEach((seat, idx) => {
    const legend = getLegend(seat.legendId);
    const p: PlayerState = {
      id: idx,
      name: seat.name.trim() || `Seat ${idx + 1}`,
      kind: seat.kind,
      legendId: seat.legendId,
      champion: null,
      legendExhausted: false,
      legendUsed: false,
      hand: [],
      deck: [],
      trash: [],
      base: [],
      runes: [],
      runeDeck: [],
      points: 0,
      unitsPlayedThisTurn: 0,
      turnsTaken: 0,
      mulliganDone: false,
    };
    const list = deckListFor(seat.legendId);
    const cards: CardInst[] = [];
    for (const [id, n] of list) {
      for (let i = 0; i < n; i++) {
        cards.push({
          iid: iid(s),
          defId: id,
          owner: idx,
          exhausted: false,
          damage: 0,
          tempMight: 0,
        });
      }
    }
    p.deck = shuffle(s, cards);
    p.champion = {
      iid: iid(s),
      defId: legend.championId,
      owner: idx,
      exhausted: false,
      damage: 0,
      tempMight: 0,
    };
    const runes: Domain[] = [];
    for (let i = 0; i < 6; i++) runes.push(legend.domains[0]!);
    for (let i = 0; i < 6; i++) runes.push(legend.domains[1]!);
    p.runeDeck = shuffle(s, runes);
    s.players.push(p);
    draw(s, idx, 4);
  });

  const contrib = battlefieldSeats(setup.mode, setup.seats);
  contrib.forEach((seat, i) => {
    const legend = getLegend(seat.legendId);
    s.battlefields.push({
      id: `bf${i}`,
      defId: legend.battlefieldId,
      controller: null,
      units: [],
    });
  });

  log(s, `${setup.mode === "war" ? "War" : "Skirmish"} — first to 8. ${s.battlefields.length} battlefields.`);
  // Flush AI mulligans at the start of the chain
  let guard = 0;
  while (s.phase === "mulligan" && player(s).kind === "ai" && guard++ < 8) {
    autoMulligan(s);
  }
  return s;
}

export function applyAction(state: GameState, action: GameAction): GameState {
  const s = cloneState(state);
  if (s.lastCombat && action.type !== "dismiss_combat") return s;
  if (action.type === "dismiss_combat") {
    s.lastCombat = null;
    launchNextMarch(s);
    if (
      s.winner === null &&
      s.phase === "action" &&
      !s.showdown &&
      !s.lastCombat &&
      movableUnits(s).length
    ) {
      log(s, `${player(s).name} still has ready units to march`, s.current);
    }
    return s;
  }
  if (action.type === "confirm_seat") {
    if (s.phase === "pass_device") {
      if (s.showdown) s.phase = "showdown";
      else s.phase = player(s).mulliganDone ? "action" : "mulligan";
    }
    return s;
  }
  if (s.winner !== null) return s;
  if (action.type === "mulligan") {
    if (s.phase !== "mulligan") return s;
    applyMulligan(s, action.iids);
    let guard = 0;
    while (s.phase === "mulligan" && player(s).kind === "ai" && guard++ < 8) autoMulligan(s);
    return s;
  }
  if (s.phase === "pass_device") return s;
  if (action.type === "cancel") {
    if (s.phase === "targeting" && s.targeting && (!s.targeting.paid || s.targeting.source === "legend")) {
      s.targeting = null;
      resumePhase(s);
    }
    return s;
  }
  if (action.type === "target") {
    if (s.phase !== "targeting" || !s.targeting) return s;
    const t = legalTargets(s, s.targeting.effect, s.current);
    if (action.iid && !t.iids.includes(action.iid)) return s;
    if (action.battlefieldId && !t.battlefieldIds.includes(action.battlefieldId)) return s;
    applyEffect(s, s.current, s.targeting.effect, action);
    if (s.targeting.spellDefId === "foxfire" || s.targeting.spellDefId === "lucent") draw(s, s.current, 1);
    if (s.targeting.spellDefId === "essence" || s.targeting.spellDefId === "consult" || s.targeting.spellDefId === "stand-united") readyRune(s, s.current);
    if (s.targeting.source === "legend") {
      const p = player(s);
      p.legendUsed = true;
      if (getLegend(p.legendId).ability === "ahri") p.legendExhausted = true;
    }
    s.targeting = null;
    resumePhase(s);
    afterShowdownSpell(s);
    return s;
  }
  if (action.type === "invite") {
    if (s.phase !== "showdown" || !s.showdown) return s;
    const sd = s.showdown;
    if (s.current !== sd.attacker && s.current !== sd.defender) return s;
    if (sd.participants.includes(action.playerId)) return s;
    if (!s.players[action.playerId]) return s;
    sd.participants.push(action.playerId);
    sd.consecutivePasses = 0;
    const pri = sd.participants.indexOf(s.current);
    if (pri >= 0) sd.priorityIndex = pri;
    log(s, `${player(s).name} asks ${s.players[action.playerId]!.name} for help`, s.current);
    return s;
  }
  if (s.phase === "showdown") {
    if (action.type === "pass") {
      yieldShowdown(s);
      return s;
    }
    if (action.type === "play") {
      const p = player(s);
      const card = p.hand.find((c) => c.iid === action.iid);
      if (!card || !playableFromHand(s, card)) return s;
      playCard(s, card, false);
      afterShowdownSpell(s);
      return s;
    }
    return s;
  }
  if (s.phase !== "action") return s;

  if (action.type === "pass") {
    endTurn(s);
    return s;
  }
  if (action.type === "play") {
    const p = player(s);
    const card = p.hand.find((c) => c.iid === action.iid);
    if (!card || !playableFromHand(s, card)) return s;
    playCard(s, card, false);
    return s;
  }
  if (action.type === "play_champion") {
    const p = player(s);
    if (!p.champion || !playableFromHand(s, p.champion)) return s;
    playCard(s, p.champion, true);
    return s;
  }
  if (action.type === "move") {
    if (!action.iids.length) return s;
    if (!legalMoveDests(s, action.iids).includes(action.battlefieldId)) return s;
    moveUnits(s, action.iids, action.battlefieldId);
    return s;
  }
  if (action.type === "queue_move") {
    if (!action.iids.length) return s;
    queueMarch(s, action.iids, action.battlefieldId);
    return s;
  }
  if (action.type === "launch_marches") {
    if (!s.marchQueue.length) return s;
    launchNextMarch(s);
    return s;
  }
  if (action.type === "cancel_marches") {
    s.marchQueue = [];
    log(s, `${player(s).name} cancels planned marches`, s.current);
    return s;
  }
  if (action.type === "legend") {
    if (!legendLegal(s)) return s;
    const p = player(s);
    const legend = getLegend(p.legendId);
    if (legend.ability === "jinx") {
      pay(s, p.id, 0, 1, legend.domains);
      s.targeting = { effect: { type: "damage", n: 1 }, source: "legend" };
      s.phase = "targeting";
      log(s, `${p.name} — Jinx ability`, p.id);
    } else if (legend.ability === "ahri") {
      pay(s, p.id, 1, 0, legend.domains);
      s.targeting = { effect: { type: "recall" }, source: "legend" };
      s.phase = "targeting";
      log(s, `${p.name} — Ahri charms`, p.id);
    } else if (legend.ability === "garen") {
      s.targeting = { effect: { type: "ready_unit" }, source: "legend" };
      s.phase = "targeting";
      log(s, `${p.name} — Garen readies a unit`, p.id);
    } else if (legend.ability === "viktor") {
      applyEffect(s, p.id, { type: "token" });
      p.legendUsed = true;
    } else if (legend.ability === "annie") {
      readyRune(s, p.id);
      readyRune(s, p.id);
      p.legendExhausted = true;
      p.legendUsed = true;
      log(s, `${p.name} — Annie readies two runes`, p.id);
    } else if (legend.ability === "leesin") {
      pay(s, p.id, 1, 0, legend.domains);
      p.legendExhausted = true;
      s.targeting = { effect: { type: "buff", n: 1 }, source: "legend" };
      s.phase = "targeting";
      log(s, `${p.name} — Lee Sin focuses a unit`, p.id);
    }
    return s;
  }
  return s;
}

export function getLegalActions(s: GameState): GameAction[] {
  if (s.winner !== null) return [];
  if (s.lastCombat) return [{ type: "dismiss_combat" }];
  if (s.phase === "pass_device") return [{ type: "confirm_seat" }];
  if (s.phase === "mulligan") {
    const p = player(s);
    const actions: GameAction[] = [{ type: "mulligan", iids: [] }];
    for (const c of p.hand) {
      actions.push({ type: "mulligan", iids: [c.iid] });
      for (const d of p.hand) {
        if (d.iid > c.iid) actions.push({ type: "mulligan", iids: [c.iid, d.iid] });
      }
    }
    return actions;
  }
  if (s.phase === "targeting" && s.targeting) {
    const t = legalTargets(s, s.targeting.effect, s.current);
    const acts: GameAction[] = [];
    if (!s.targeting.paid || s.targeting.source === "legend") acts.push({ type: "cancel" });
    for (const id of t.iids) acts.push({ type: "target", iid: id });
    for (const id of t.battlefieldIds) acts.push({ type: "target", battlefieldId: id });
    return acts;
  }
  if (s.phase === "showdown" && s.showdown) {
    const acts: GameAction[] = [{ type: "pass" }];
    const p = player(s);
    for (const c of p.hand) {
      if (playableFromHand(s, c)) acts.push({ type: "play", iid: c.iid });
    }
    const sd = s.showdown;
    if (s.current === sd.attacker || s.current === sd.defender) {
      for (const pl of s.players) {
        if (!sd.participants.includes(pl.id)) acts.push({ type: "invite", playerId: pl.id });
      }
    }
    return acts;
  }
  if (s.phase !== "action") return [];
  const acts: GameAction[] = [{ type: "pass" }];
  const p = player(s);
  for (const c of p.hand) {
    if (playableFromHand(s, c)) acts.push({ type: "play", iid: c.iid });
  }
  if (canPlayChampion(s)) acts.push({ type: "play_champion" });
  if (legendLegal(s)) acts.push({ type: "legend" });
  const mov = movableUnits(s);
  // Single units and all-base groups
  for (const u of mov) {
    const dests = legalMoveDests(s, [u.iid]);
    for (const d of dests) acts.push({ type: "move", iids: [u.iid], battlefieldId: d });
  }
  const baseReady = p.base.filter((u) => !u.exhausted && getDef(u.defId).kind === "unit");
  if (baseReady.length > 1) {
    const group = baseReady.map((u) => u.iid);
    for (const d of legalMoveDests(s, group)) {
      acts.push({ type: "move", iids: group, battlefieldId: d });
    }
  }
  return acts;
}

export function hideHands(s: GameState, viewer: number | null): GameState {
  const c = cloneState(s);
  if (viewer === null) return c;
  for (const p of c.players) {
    if (p.id === viewer && c.phase !== "pass_device") continue;
    p.hand = p.hand.map((card) => ({ ...card, defId: "__hidden" }));
  }
  return c;
}
