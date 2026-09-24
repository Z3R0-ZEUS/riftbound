export type Domain = "fury" | "calm" | "mind" | "body" | "chaos" | "order";
export type CardKind = "unit" | "spell" | "gear" | "legend" | "battlefield";
export type PlayerKind = "human" | "ai";
export type Phase =
  | "mulligan"
  | "action"
  | "targeting"
  | "showdown"
  | "pass_device"
  | "gameover";
export type Mode = "duel" | "skirmish" | "war";

export type Effect =
  | { type: "draw"; n: number }
  | { type: "damage"; n: number }
  | { type: "damage_all_enemy_at"; n: number }
  | { type: "recall" }
  | { type: "ready_unit" }
  | { type: "buff"; n: number }
  | { type: "ready_rune" }
  | { type: "token" };

export type LegendAbility =
  | "jinx"
  | "ahri"
  | "darius"
  | "garen"
  | "viktor"
  | "leesin"
  | "annie"
  | "lux";

export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  domains: Domain[];
  energy: number;
  power: number;
  might?: number;
  text: string;
  art: string;
  assault?: number;
  defender?: number;
  ganking?: boolean;
  accelerate?: boolean;
  deathDamage?: number;
  playEffect?: Effect;
  onConquer?: Effect;
  onHold?: Effect;
  gearAuraMight?: number;
  legendAbility?: LegendAbility;
  isChampion?: boolean;
  bfBonusMight?: number;
}

export interface CardInst {
  iid: string;
  defId: string;
  owner: number;
  exhausted: boolean;
  damage: number;
  tempMight: number;
}

export interface RuneInst {
  iid: string;
  domain: Domain;
  exhausted: boolean;
}

export interface PlayerState {
  id: number;
  name: string;
  kind: PlayerKind;
  legendId: string;
  champion: CardInst | null;
  legendExhausted: boolean;
  legendUsed: boolean;
  hand: CardInst[];
  deck: CardInst[];
  trash: CardInst[];
  base: CardInst[];
  runes: RuneInst[];
  runeDeck: Domain[];
  points: number;
  unitsPlayedThisTurn: number;
  turnsTaken: number;
  mulliganDone: boolean;
}

export interface BattlefieldState {
  id: string;
  defId: string;
  controller: number | null;
  units: CardInst[];
}

export interface CombatReport {
  battlefieldId: string;
  attacker: number;
  defender: number;
  atkMight: number;
  defMight: number;
  killed: { iid: string; name: string; owner: number }[];
  result: "attacker" | "defender" | "recall" | "empty";
  log: string[];
}

export interface ShowdownState {
  battlefieldId: string;
  attacker: number;
  defender: number;
  turnPlayer: number;
  participants: number[];
  consecutivePasses: number;
  /** Index into `participants` for whose priority window this is. */
  priorityIndex: number;
}

export interface March {
  iids: string[];
  battlefieldId: string;
}

export interface LogLine {
  t: string;
  p?: number;
}

export interface GameState {
  mode: Mode;
  victory: number;
  players: PlayerState[];
  battlefields: BattlefieldState[];
  current: number;
  turn: number;
  phase: Phase;
  scoredThisTurn: string[];
  winner: number | null;
  log: LogLine[];
  targeting: null | {
    effect: Effect;
    source: "spell" | "legend" | "trigger";
    paid?: boolean;
    spellIid?: string;
    spellDefId?: string;
  };
  lastCombat: CombatReport | null;
  showdown: ShowdownState | null;
  marchQueue: March[];
  iidSeq: number;
  rng: number;
  humanCount: number;
}

export type GameAction =
  | { type: "mulligan"; iids: string[] }
  | { type: "play"; iid: string }
  | { type: "play_champion" }
  | { type: "move"; iids: string[]; battlefieldId: string }
  | { type: "queue_move"; iids: string[]; battlefieldId: string }
  | { type: "launch_marches" }
  | { type: "cancel_marches" }
  | { type: "legend" }
  | { type: "target"; iid?: string; battlefieldId?: string }
  | { type: "cancel" }
  | { type: "pass" }
  | { type: "invite"; playerId: number }
  | { type: "dismiss_combat" }
  | { type: "confirm_seat" };

export interface SeatConfig {
  name: string;
  kind: PlayerKind;
  legendId: string;
}

export interface SetupConfig {
  mode: Mode;
  seats: SeatConfig[];
  seed?: number;
}
