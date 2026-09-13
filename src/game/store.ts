import { create } from "zustand";
import { stepAi } from "./ai";
import { setMuted, sfx, unlockAudio } from "./audio";
import { applyAction, createGame } from "./engine";
import { LEGENDS } from "./cards";
import { readMuted, writeMuted } from "./mute";
import type { GameAction, GameState, Mode, SeatConfig, SetupConfig } from "./types";

export type Screen = "title" | "setup" | "play";

const LEGEND_IDS = [
  "jinx",
  "viktor",
  "leesin",
  "annie",
  "lux",
  "garen",
  "ahri",
  "darius",
];

function defaultSeats(n: number, allHuman: boolean): SeatConfig[] {
  return Array.from({ length: n }, (_, i) => ({
    name: i === 0 ? "You" : `Player ${i + 1}`,
    kind: allHuman || i === 0 ? ("human" as const) : ("ai" as const),
    legendId: LEGEND_IDS[i % LEGEND_IDS.length]!,
  }));
}

type GameStore = {
  screen: Screen;
  setup: SetupConfig;
  state: GameState | null;
  selected: string[];
  inspect: string | null;
  rules: boolean;
  aiBusy: boolean;
  muted: boolean;
  setScreen: (s: Screen) => void;
  setMode: (m: Mode) => void;
  setSeatCount: (n: 3 | 4) => void;
  patchSeat: (i: number, patch: Partial<SeatConfig>) => void;
  fillHumans: () => void;
  fillAi: () => void;
  start: () => void;
  dispatch: (a: GameAction) => void;
  toggleSelect: (iid: string) => void;
  clearSelect: () => void;
  setInspect: (id: string | null) => void;
  setRules: (v: boolean) => void;
  toggleMute: () => void;
  hydrateMute: () => void;
  toTitle: () => void;
};

let aiTimer: ReturnType<typeof setTimeout> | null = null;

function playSfx(a: GameAction, prev: GameState | null, next: GameState) {
  if (a.type === "play" || a.type === "play_champion" || a.type === "legend") sfx("play");
  else if (a.type === "move" || a.type === "queue_move" || a.type === "launch_marches") {
    sfx(next.lastCombat && next.lastCombat !== prev?.lastCombat ? "showdown" : "march");
  }   else if (a.type === "pass") sfx(next.showdown || prev?.showdown ? "ui" : "channel");
  else if (a.type === "invite") sfx("invite");
  else if (a.type === "confirm_seat") sfx("ready");
  else if (a.type === "mulligan" || a.type === "target") sfx("click");
  if (next.winner !== null && prev?.winner === null) sfx("win");
  else if (next.log[0]?.t.includes("Final point denied")) sfx("deny");
  else if (prev && next.players.some((p, i) => p.points > (prev.players[i]?.points ?? 0))) {
    sfx(next.log[0]?.t.includes("holds") ? "hold" : "score");
  }
  if (next.lastCombat && next.lastCombat !== prev?.lastCombat) sfx("showdown");
}

function sameAiWindow(a: GameState, b: GameState): boolean {
  return (
    a.phase === b.phase &&
    a.current === b.current &&
    a.winner === b.winner &&
    !a.lastCombat &&
    !b.lastCombat &&
    a.showdown?.consecutivePasses === b.showdown?.consecutivePasses &&
    a.showdown?.priorityIndex === b.showdown?.priorityIndex &&
    a.targeting?.effect.type === b.targeting?.effect.type &&
    a.log[0]?.t === b.log[0]?.t &&
    a.marchQueue.length === b.marchQueue.length
  );
}

function queueAi(get: () => GameStore, set: (p: Partial<GameStore>) => void) {
  if (aiTimer) clearTimeout(aiTimer);
  aiTimer = setTimeout(() => {
    const { state, muted } = get();
    if (!state || state.winner !== null) {
      set({ aiBusy: false });
      return;
    }
    if (state.phase === "pass_device") {
      set({ aiBusy: false });
      return;
    }
    const p = state.players[state.current];
    if (!p || p.kind !== "ai") {
      set({ aiBusy: false });
      return;
    }
    const next = stepAi(state);
    if (!muted) playSfx({ type: "pass" }, state, next);
    const progressed = !sameAiWindow(state, next);
    set({ state: next, selected: [], inspect: next.phase === "pass_device" ? null : get().inspect, aiBusy: true });
    const stillAi =
      progressed &&
      next.winner === null &&
      next.players[next.current]?.kind === "ai" &&
      next.phase !== "pass_device";
    if (stillAi) queueAi(get, set);
    else set({ aiBusy: false });
  }, 700);
}

export const useGame = create<GameStore>((set, get) => ({
  screen: "title",
  setup: { mode: "skirmish", seats: defaultSeats(3, true) },
  state: null,
  selected: [],
  inspect: null,
  rules: false,
  aiBusy: false,
  muted: false,
  setScreen: (screen) => set({ screen }),
  setMode: (mode) =>
    set((s) => ({
      setup: {
        ...s.setup,
        mode,
        seats:
          mode === "war"
            ? s.setup.seats.length === 4
              ? s.setup.seats
              : [...s.setup.seats, ...defaultSeats(4, true)].slice(0, 4)
            : s.setup.seats.slice(0, 3),
      },
    })),
  setSeatCount: (n) =>
    set((s) => ({
      setup: {
        ...s.setup,
        mode: n === 4 ? "war" : "skirmish",
        seats: n === s.setup.seats.length ? s.setup.seats : defaultSeats(n, true),
      },
    })),
  patchSeat: (i, patch) =>
    set((s) => {
      const seats = s.setup.seats.map((seat, idx) => (idx === i ? { ...seat, ...patch } : seat));
      if (patch.legendId) {
        for (let j = 0; j < seats.length; j++) {
          if (j !== i && seats[j]!.legendId === patch.legendId) {
            const used = new Set(seats.map((x) => x.legendId));
            const alt = LEGEND_IDS.find((id) => !used.has(id) || id === seats[j]!.legendId);
            if (alt && alt !== patch.legendId) seats[j] = { ...seats[j]!, legendId: alt };
          }
        }
      }
      return { setup: { ...s.setup, seats } };
    }),
  fillHumans: () =>
    set((s) => ({
      setup: {
        ...s.setup,
        seats: s.setup.seats.map((seat, i) => ({
          ...seat,
          kind: "human" as const,
          name: i === 0 ? "You" : `Player ${i + 1}`,
        })),
      },
    })),
  fillAi: () =>
    set((s) => ({
      setup: {
        ...s.setup,
        seats: s.setup.seats.map((seat, i) => ({
          ...seat,
          kind: i === 0 ? ("human" as const) : ("ai" as const),
          name: i === 0 ? "You" : `AI ${LEGENDS.find((l) => l.id === seat.legendId)?.name ?? i}`,
        })),
      },
    })),
  start: () => {
    try {
      unlockAudio();
      if (aiTimer) clearTimeout(aiTimer);
      const setup = get().setup;
      const used = new Set<string>();
      const seats = setup.seats.map((seat, i) => {
        let legendId = seat.legendId;
        if (used.has(legendId)) {
          legendId = LEGEND_IDS.find((id) => !used.has(id)) ?? legendId;
        }
        used.add(legendId);
        return {
          ...seat,
          legendId,
          name: seat.name.trim() || `Player ${i + 1}`,
        };
      });
      const state = createGame({ ...setup, seats });
      set({ screen: "play", state, selected: [], inspect: null, aiBusy: false });
      if (state.players[state.current]?.kind === "ai") {
        set({ aiBusy: true });
        queueAi(get, set);
      }
    } catch (err) {
      console.error(err);
    }
  },
  dispatch: (a) => {
    const { state, muted } = get();
    if (!state) return;
    const cur = state.players[state.current];
    if (cur?.kind === "ai" && a.type !== "dismiss_combat" && a.type !== "confirm_seat") return;
    const next = applyAction(state, a);
    if (!muted) playSfx(a, state, next);
    const clearSelect =
      a.type === "move" || a.type === "queue_move" || a.type === "mulligan" || a.type === "play";
    set({
      state: next,
      selected: clearSelect ? [] : get().selected,
      inspect: next.phase === "pass_device" ? null : get().inspect,
    });
    if (next.players[next.current]?.kind === "ai" && next.winner === null && next.phase !== "pass_device") {
      set({ aiBusy: true });
      queueAi(get, set);
    } else if (next.players[next.current]?.kind !== "ai") {
      set({ aiBusy: false });
    }
  },
  toggleSelect: (iid) =>
    set((s) => ({
      selected: s.selected.includes(iid) ? s.selected.filter((x) => x !== iid) : [...s.selected, iid],
    })),
  clearSelect: () => set({ selected: [] }),
  setInspect: (inspect) => set({ inspect }),
  setRules: (rules) => set({ rules }),
  toggleMute: () => {
    const muted = !get().muted;
    setMuted(muted);
    writeMuted(muted);
    set({ muted });
  },
  hydrateMute: () => {
    const muted = readMuted();
    setMuted(muted);
    set({ muted });
  },
  toTitle: () => {
    if (aiTimer) clearTimeout(aiTimer);
    set({ screen: "title", state: null, selected: [], inspect: null, aiBusy: false });
  },
}));
