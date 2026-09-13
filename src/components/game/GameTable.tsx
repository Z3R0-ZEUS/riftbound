import { useContext, useEffect, useRef, useState } from "react";
import { BookOpen, Crown, RotateCcw } from "lucide-react";
import { getDef, getLegend } from "@/game/cards";
import {
  canPlayChampion,
  energyOf,
  legalMoveDests,
  legalTargets,
  movableUnits,
  playableFromHand,
  unitMight,
} from "@/game/engine";
import { useGame } from "@/game/store";
import type { GameState, PlayerState } from "@/game/types";
import { cn } from "@/lib/cn";
import { CardPeek, CardSheet, CardView } from "./CardView";
import { FanNote, MuteToggle } from "./Screens";

function useScorePulses(state: GameState | null) {
  const prev = useRef<number[]>([]);
  const [hits, setHits] = useState<number[]>([]);
  useEffect(() => {
    if (!state) return;
    const next = state.players.filter((p, i) => p.points > (prev.current[i] ?? 0)).map((p) => p.id);
    prev.current = state.players.map((p) => p.points);
    if (!next.length) return;
    setHits(next);
    const t = window.setTimeout(() => setHits([]), 800);
    return () => window.clearTimeout(t);
  }, [state]);
  return hits;
}

function useScoredFields(state: GameState | null) {
  const prev = useRef<string[]>([]);
  const [hits, setHits] = useState<string[]>([]);
  useEffect(() => {
    if (!state) return;
    const next = state.scoredThisTurn.filter((id) => !prev.current.includes(id));
    prev.current = [...state.scoredThisTurn];
    if (!next.length) return;
    setHits(next);
    const t = window.setTimeout(() => setHits([]), 900);
    return () => window.clearTimeout(t);
  }, [state]);
  return hits;
}

function useRuneFlashes(runes: PlayerState["runes"]) {
  const prev = useRef<Set<string>>(new Set());
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const key = runes.map((r) => `${r.iid}:${r.exhausted ? 1 : 0}`).join(",");
  useEffect(() => {
    const newly = runes.filter((r) => r.exhausted && !prev.current.has(r.iid)).map((r) => r.iid);
    prev.current = new Set(runes.filter((r) => r.exhausted).map((r) => r.iid));
    if (!newly.length) return;
    setFlash(new Set(newly));
    const t = window.setTimeout(() => setFlash(new Set()), 450);
    return () => window.clearTimeout(t);
  }, [key, runes]);
  return flash;
}

export function GameTable() {
  const state = useGame((s) => s.state);
  const selected = useGame((s) => s.selected);
  const dispatch = useGame((s) => s.dispatch);
  const toggleSelect = useGame((s) => s.toggleSelect);
  const clearSelect = useGame((s) => s.clearSelect);
  const setInspect = useGame((s) => s.setInspect);
  const inspect = useGame((s) => s.inspect);
  const mulliganReveal = useGame((s) => s.mulliganReveal);
  const justDrawn = useGame((s) => s.justDrawn);
  const aiBusy = useGame((s) => s.aiBusy);
  const setRules = useGame((s) => s.setRules);
  const toTitle = useGame((s) => s.toTitle);
  const [peekId, setPeekId] = useState<string | null>(null);
  const pulses = useScorePulses(state);
  const scoredFields = useScoredFields(state);
  if (!state) return null;

  const acting = state.players[state.current]!;
  const passing = state.phase === "pass_device";
  const me =
    passing || acting.kind === "human"
      ? acting
      : (state.players.find((p) => p.kind === "human") ?? acting);
  const hideHand = passing || (acting.kind === "ai" && state.humanCount > 1);
  const frozen = acting.kind === "ai" || passing || aiBusy;
  const myTurn =
    !frozen &&
    acting.id === me.id &&
    acting.kind === "human" &&
    (state.phase === "action" || state.phase === "showdown");
  const others = state.players.filter((p) => p.id !== me.id);
  const dests = selected.length && myTurn ? legalMoveDests(state, selected) : [];
  const movable = new Set(myTurn ? movableUnits(state).map((u) => u.iid) : []);
  const targets = state.targeting && !frozen ? legalTargets(state, state.targeting.effect, state.current) : null;

  if (passing && !mulliganReveal) {
    return (
      <div className="relative flex min-h-dvh flex-col bg-bg text-fg">
        <header className="relative z-[81] flex items-center justify-between gap-3 px-3 py-2 sm:px-5">
          <span className="font-display text-lg tracking-wide">Riftbound</span>
          <MuteToggle />
        </header>
        <PassOverlay />
      </div>
    );
  }

  return (
    <CardPeek.Provider value={{ peek: setPeekId, inspect: setInspect }}>
    <div className="flex min-h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg tracking-wide">Riftbound</span>
          <span className="hidden text-xs text-muted sm:inline">
            {state.mode === "war" ? "War" : "Skirmish"} · First to {state.victory}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.players.map((p) => (
            <span
              key={p.id}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs tabular",
                p.id === state.current ? "bg-fg text-bg" : "bg-raised text-muted",
                pulses.includes(p.id) && "score-pulse",
              )}
            >
              {p.name} {p.points}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <MuteToggle />
          <button type="button" className="grid size-10 place-items-center rounded-lg text-muted hover:text-fg" onClick={() => setRules(true)} aria-label="Rules">
            <BookOpen className="size-4" />
          </button>
          <button type="button" className="grid size-10 place-items-center rounded-lg text-muted hover:text-fg" onClick={toTitle} aria-label="Leave table">
            <RotateCcw className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-3 py-2 sm:px-5">
        {others.map((p) => (
          <OpponentRail key={p.id} p={p} active={p.id === state.current} pulsed={pulses.includes(p.id)} />
        ))}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 px-3 py-2 sm:grid-cols-3 sm:px-5">
        {state.battlefields.map((bf) => {
          const bdef = getDef(bf.defId);
          const drop = dests.includes(bf.id);
          const ctrl = bf.controller !== null ? state.players[bf.controller] : null;
          const targetBf = targets?.battlefieldIds.includes(bf.id);
          const incoming = state.marchQueue.filter((m) => m.battlefieldId === bf.id);
          const incomingCount = incoming.reduce((n, m) => n + m.iids.length, 0);
          const showdownHere = state.showdown?.battlefieldId === bf.id;
          const impact = state.lastCombat?.battlefieldId === bf.id;
          const domain = bdef.domains[0];
          const justScored = scoredFields.includes(bf.id);
          return (
            <section
              key={bf.id}
              className={cn(
                "bf-panel relative min-h-44 overflow-hidden rounded-2xl border border-line bg-surface",
                (drop || targetBf || showdownHere) && "bf-glow",
                incomingCount > 0 && "bf-march",
                justScored && "conquer-flash",
                impact && "shake",
              )}
              style={domain ? { borderColor: `color-mix(in oklab, var(--domain-${domain}) 55%, transparent)` } : undefined}
            >
              <img src={bdef.art} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover opacity-45" />
              {incomingCount > 0 && <div className="march-trail" />}
              {impact && (
                <>
                  <div className="vfx-impact" />
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i} className="vfx-spark" style={{ ["--i" as string]: i }} />
                  ))}
                </>
              )}
              {justScored && <span className="score-float">+1</span>}
              <div className="relative flex h-full flex-col p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="bf-nameplate">
                      {domain && <span className="pip" style={{ background: `var(--domain-${domain})` }} />}
                      <h3 className="font-display text-base">{bdef.name}</h3>
                    </div>
                    <p className="text-[11px] text-muted">{bdef.text}</p>
                    <p className="mt-1 text-[11px] text-subtle">
                      {ctrl ? `Held by ${ctrl.name}` : "Contested / open"}
                    </p>
                  </div>
                  {incomingCount > 0 && (
                    <span className="rounded-full bg-accent px-2 py-1 text-xs font-medium text-accent-fg">
                      {incomingCount} marching
                    </span>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                  {bf.units.map((u) => (
                    <CardView
                      key={u.iid}
                      inst={u}
                      size="xs"
                      state={state}
                      bfId={bf.id}
                      selected={selected.includes(u.iid)}
                      playable={movable.has(u.iid) && !hideHand}
                      dim={!!targets && !targets.iids.includes(u.iid)}
                      onClick={() => {
                        if (targets?.iids.includes(u.iid)) dispatch({ type: "target", iid: u.iid });
                        else if (movable.has(u.iid) && me.kind === "human") toggleSelect(u.iid);
                        else setInspect(u.defId);
                      }}
                      onInspect={() => setInspect(u.defId)}
                    />
                  ))}
                </div>
                {(drop || targetBf) && me.kind === "human" && myTurn && (
                  <button
                    type="button"
                    className="mt-2 h-10 rounded-lg bg-fg text-sm font-medium text-bg"
                    onClick={() => {
                      if (targetBf) dispatch({ type: "target", battlefieldId: bf.id });
                      else dispatch({ type: "queue_move", iids: selected, battlefieldId: bf.id });
                    }}
                  >
                    {targetBf
                      ? "Target battlefield"
                      : selected.length > 1
                        ? `Send ${selected.length} here`
                        : "Send here"}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <CurrentRow
        state={state}
        me={me}
        hideHand={hideHand}
        myTurn={myTurn}
        selected={selected}
        movable={movable}
        targets={targets}
        onToggle={toggleSelect}
        onInspect={setInspect}
      />

      <HandBar
        state={state}
        me={me}
        hideHand={hideHand}
        myTurn={myTurn}
        onInspect={setInspect}
        drawn={justDrawn}
      />

      {state.phase === "action" && acting.kind === "human" && myTurn && (
        <MarchBar state={state} selected={selected.length} ready={movable.size} />
      )}
      {state.phase === "showdown" && state.showdown && acting.kind === "human" && myTurn && (
        <ShowdownBar state={state} />
      )}
      {state.phase === "targeting" && acting.kind === "human" && !frozen && (
        <div className="border-t border-line bg-raised px-4 py-2 text-center text-sm text-accent">
          Choose a target
          <button type="button" className="ml-3 text-muted underline" onClick={() => dispatch({ type: "cancel" })}>
            Cancel
          </button>
        </div>
      )}

      {(aiBusy || acting.kind === "ai") && state.phase !== "pass_device" && state.winner === null && (
        <div className="border-t border-line bg-raised px-4 py-2 text-center text-sm text-muted">
          {acting.name} is acting… the table is locked.
        </div>
      )}

      {state.phase === "mulligan" && acting.kind === "human" && !mulliganReveal && (
        <MulliganOverlay />
      )}
      {mulliganReveal && <MulliganRevealOverlay />}
      {passing && !mulliganReveal && <PassOverlay />}
      {state.lastCombat && <CombatOverlay />}
      {state.winner !== null && <WinnerOverlay />}
      {inspect && <InspectCard defId={inspect} onClose={() => setInspect(null)} />}
      {peekId && !inspect && !passing && (
        <aside className="pointer-events-none fixed top-16 left-3 z-50 hidden w-[22rem] md:block">
          <CardSheet defId={peekId} />
        </aside>
      )}
      {selected.length > 0 && me.kind === "human" && myTurn && (
        <button type="button" className="fixed right-4 bottom-28 z-20 h-10 rounded-full bg-raised px-4 text-xs text-muted" onClick={clearSelect}>
          Clear selection ({selected.length})
        </button>
      )}
    </div>
    </CardPeek.Provider>
  );
}

function OpponentRail({ p, active, pulsed }: { p: PlayerState; active: boolean; pulsed: boolean }) {
  const legend = getLegend(p.legendId);
  const peek = useContext(CardPeek);
  return (
    <div className={cn("flex min-w-52 items-center gap-3 rounded-xl border bg-surface px-3 py-2", active ? "border-accent" : "border-line")}>
      <button
        type="button"
        className="shrink-0"
        onMouseEnter={() => peek.peek(`legend-${p.legendId}`)}
        onMouseLeave={() => peek.peek(null)}
        onClick={() => peek.inspect(`legend-${p.legendId}`)}
        aria-label={legend.name}
      >
        <img src={legend.art} alt="" crossOrigin="anonymous" className="size-12 rounded-lg object-cover" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{p.name}</span>
          <span className={cn("tabular text-win", pulsed && "score-pulse")}>{p.points}</span>
        </div>
        <p className="text-[11px] text-muted">
          {legend.name} · {p.hand.length} cards · {energyOf(p)}/{p.runes.length} runes · {p.base.filter((c) => getDef(c.defId).kind === "unit").length} at base
        </p>
      </div>
    </div>
  );
}

function CurrentRow({
  state,
  me,
  hideHand,
  myTurn,
  selected,
  movable,
  targets,
  onToggle,
  onInspect,
}: {
  state: GameState;
  me: PlayerState;
  hideHand: boolean;
  myTurn: boolean;
  selected: string[];
  movable: Set<string>;
  targets: { iids: string[]; battlefieldIds: string[] } | null;
  onToggle: (iid: string) => void;
  onInspect: (id: string | null) => void;
}) {
  const dispatch = useGame((s) => s.dispatch);
  const peek = useContext(CardPeek);
  const legend = getLegend(me.legendId);
  const units = me.base.filter((c) => getDef(c.defId).kind === "unit");
  const gear = me.base.filter((c) => getDef(c.defId).kind === "gear");
  const flashes = useRuneFlashes(me.runes);
  return (
    <div className="border-t border-line bg-surface/80 px-3 py-3 sm:px-5">
      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          className="relative w-20 shrink-0 sm:w-24"
          onClick={() => onInspect(`legend-${me.legendId}`)}
          onMouseEnter={() => peek.peek(`legend-${me.legendId}`)}
          onMouseLeave={() => peek.peek(null)}
          aria-label={`${legend.name}. ${legend.abilityText}`}
        >
          <img src={legend.art} alt="" crossOrigin="anonymous" className="aspect-[2/3] w-full rounded-xl object-cover" />
          <span className="absolute inset-x-0 bottom-0 rounded-b-xl bg-bg/80 px-1 py-1 text-center font-display text-xs">{legend.name}</span>
        </button>
        {me.champion && (
          <CardView
            inst={me.champion}
            size="sm"
            state={state}
            hidden={hideHand}
            playable={!hideHand && myTurn && canPlayChampion(state)}
            onClick={() => {
              if (!hideHand && myTurn && canPlayChampion(state)) dispatch({ type: "play_champion" });
              else onInspect(me.champion!.defId);
            }}
            onInspect={() => onInspect(me.champion!.defId)}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="text-fg">{me.name}</span>
            <span className="tabular text-win">{me.points} pts</span>
            <span>
              {energyOf(me)} energy · {me.runes.length} runes · {me.deck.length} deck
            </span>
          </div>
          <p className="mb-2 max-w-xl text-xs leading-relaxed text-muted">{legend.abilityText}</p>
          <p className="mb-2 text-xs text-subtle">
            Click ready units to build a raid, then send the group to one field — or split them across fields and start battles in order.
          </p>
          <div className="flex flex-wrap gap-1">
            {me.runes.map((r) => (
              <span
                key={r.iid}
                title={r.domain}
                className={cn(
                  "size-4 rounded-full border border-line-strong sm:size-5",
                  r.exhausted && "opacity-30",
                  flashes.has(r.iid) && "rune-flash",
                )}
                style={{ background: `var(--domain-${r.domain})` }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {units.map((u) => (
              <CardView
                key={u.iid}
                inst={u}
                size="xs"
                state={state}
                selected={selected.includes(u.iid)}
                playable={movable.has(u.iid) && !hideHand}
                dim={!!targets && !targets.iids.includes(u.iid)}
                onClick={() => {
                  if (targets?.iids.includes(u.iid)) dispatch({ type: "target", iid: u.iid });
                  else if (movable.has(u.iid) && me.kind === "human") onToggle(u.iid);
                  else onInspect(u.defId);
                }}
                onInspect={() => onInspect(u.defId)}
              />
            ))}
            {gear.map((g) => (
              <CardView key={g.iid} inst={g} size="xs" onClick={() => onInspect(g.defId)} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={hideHand || !myTurn || me.legendUsed || state.phase !== "action"}
            className="h-11 rounded-xl border border-line bg-raised px-4 text-sm font-medium text-fg disabled:opacity-40"
            onClick={() => dispatch({ type: "legend" })}
          >
            Legend
          </button>
          <button
            type="button"
            disabled={
              hideHand ||
              !myTurn ||
              (state.phase !== "showdown" && (state.phase !== "action" || state.marchQueue.length > 0))
            }
            className="h-11 rounded-xl bg-fg px-4 text-sm font-medium text-bg disabled:opacity-40"
            onClick={() => dispatch({ type: "pass" })}
          >
            {state.phase === "showdown" ? "Pass showdown" : "Pass turn"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HandBar({
  state,
  me,
  hideHand,
  myTurn,
  onInspect,
  drawn,
}: {
  state: GameState;
  me: PlayerState;
  hideHand: boolean;
  myTurn: boolean;
  onInspect: (id: string | null) => void;
  drawn: string[];
}) {
  const dispatch = useGame((s) => s.dispatch);
  return (
    <div className="border-t border-line bg-bg px-2 py-3 sm:px-5">
      <p className="mb-2 text-center text-xs text-subtle">
        {hideHand
          ? "Hands are face-down until this seat is ready."
          : "Hover a card to read it. Hold or right-click to pin. E is Energy, P is Power, gold M is Might."}
      </p>
      <div className="flex items-end justify-center gap-1 overflow-x-auto pb-1 sm:gap-2">
        {me.hand.map((c) => {
          const playable = !hideHand && myTurn && playableFromHand(state, c);
          return (
            <CardView
              key={c.iid}
              inst={c}
              size="md"
              hidden={hideHand}
              playable={playable}
              drawn={drawn.includes(c.iid)}
              dim={!hideHand && !playable && state.phase === "action"}
              onClick={() => {
                if (hideHand || !myTurn) return;
                if (playable) dispatch({ type: "play", iid: c.iid });
                else onInspect(c.defId);
              }}
              onInspect={() => onInspect(c.defId)}
            />
          );
        })}
      </div>
    </div>
  );
}

function MulliganRevealOverlay() {
  const reveal = useGame((s) => s.mulliganReveal);
  const clear = useGame((s) => s.clearMulliganReveal);
  const setInspect = useGame((s) => s.setInspect);
  if (!reveal) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="scrim absolute inset-0" />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-line-strong bg-surface p-5 pop">
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">Drew into</p>
        <h2 className="font-display mt-1 text-2xl">
          {reveal.defIds.length === 1 ? "Replacement card" : `${reveal.defIds.length} replacement cards`}
        </h2>
        <p className="mt-1 text-sm text-muted">Face-up so you can read what came off the deck. These are in your hand.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {reveal.defIds.map((id, i) => (
            <CardView
              key={`${id}-${i}`}
              defId={id}
              size="md"
              drawn
              onClick={() => setInspect(id)}
            />
          ))}
        </div>
        <button
          type="button"
          className="mt-5 h-12 w-full rounded-xl bg-fg text-sm font-medium text-bg"
          onClick={() => {
            setInspect(null);
            clear();
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function MulliganOverlay() {
  const state = useGame((s) => s.state)!;
  const dispatch = useGame((s) => s.dispatch);
  const selected = useGame((s) => s.selected);
  const toggleSelect = useGame((s) => s.toggleSelect);
  const me = state.players[state.current]!;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="scrim absolute inset-0" />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-line bg-surface p-5 pop">
        <h2 className="font-display text-2xl">{me.name} — Mulligan</h2>
        <p className="mt-1 text-sm text-muted">Bottom up to two cards, then draw replacements. The deck is not shuffled.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {me.hand.map((c) => (
            <CardView
              key={c.iid}
              inst={c}
              size="md"
              selected={selected.includes(c.iid)}
              playable
              onClick={() => {
                if (selected.includes(c.iid) || selected.length < 2) toggleSelect(c.iid);
              }}
            />
          ))}
        </div>
        <button
          type="button"
          className="mt-5 h-12 w-full rounded-xl bg-fg text-sm font-medium text-bg"
          onClick={() => dispatch({ type: "mulligan", iids: selected.slice(0, 2) })}
        >
          Keep {me.hand.length - Math.min(2, selected.length)}
        </button>
      </div>
    </div>
  );
}

function PassOverlay() {
  const state = useGame((s) => s.state)!;
  const dispatch = useGame((s) => s.dispatch);
  const me = state.players[state.current]!;
  const legend = getLegend(me.legendId);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <img src={legend.art} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-md" />
      <div className="scrim absolute inset-0" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-bg/95 p-6 text-center pop sm:p-8">
        <p className="text-xs tracking-[0.25em] text-accent uppercase">Pass the device</p>
        <h2 className="font-display mt-3 text-4xl">{me.name}</h2>
        <p className="mt-2 text-sm text-muted">
          {legend.name}, {legend.title}. Every hand is face-down until you confirm.
        </p>
        <FanNote className="mx-auto mt-4 max-w-sm pt-3 text-left" />
        <button
          type="button"
          className="mt-6 h-12 w-full rounded-xl bg-fg text-sm font-medium text-bg"
          onClick={() => dispatch({ type: "confirm_seat" })}
        >
          I'm ready — show my hand
        </button>
      </div>
    </div>
  );
}

function MarchBar({ state, selected, ready }: { state: GameState; selected: number; ready: number }) {
  const dispatch = useGame((s) => s.dispatch);
  if (!state.marchQueue.length && selected === 0) {
    if (ready <= 0) return null;
    const leftover = state.log[0]?.t.includes("still has ready units");
    return (
      <div className="border-t border-line bg-raised px-4 py-2 text-center text-xs text-muted">
        {leftover
          ? `${ready} still ready after the showdown — Accelerate and Ganking units can still march.`
          : `${ready} units ready. Select several and send them together, or split them across battlefields.`}
      </div>
    );
  }
  if (!state.marchQueue.length) {
    return (
      <div className="border-t border-line bg-raised px-4 py-2 text-center text-xs text-muted">
        {selected} selected. Tap a battlefield to send this raid.
      </div>
    );
  }
  const parts = state.marchQueue.map((m) => {
    const bf = state.battlefields.find((b) => b.id === m.battlefieldId);
    return `${m.iids.length} → ${bf ? getDef(bf.defId).name : "field"}`;
  });
  return (
    <div className="border-t border-line bg-raised px-4 py-3">
      <p className="text-center text-sm text-accent">Marches planned: {parts.join(" · ")}</p>
      <p className="mt-1 text-center text-xs text-muted">
        {ready ? `${ready} still ready to assign. ` : ""}Showdowns will resolve in this order.
      </p>
      <div className="mt-2 flex justify-center gap-2">
        <button
          type="button"
          className="h-10 rounded-xl bg-fg px-4 text-sm font-medium text-bg"
          onClick={() => dispatch({ type: "launch_marches" })}
        >
          Start battles
        </button>
        <button
          type="button"
          className="h-10 rounded-xl border border-line px-4 text-sm text-muted"
          onClick={() => dispatch({ type: "cancel_marches" })}
        >
          Cancel plans
        </button>
      </div>
    </div>
  );
}

function ShowdownBar({ state }: { state: GameState }) {
  const dispatch = useGame((s) => s.dispatch);
  const sd = state.showdown!;
  const bf = state.battlefields.find((b) => b.id === sd.battlefieldId);
  const atkMight =
    bf?.units.filter((u) => u.owner === sd.attacker).reduce((n, u) => n + unitMight(state, u, "attack", bf.id), 0) ?? 0;
  const defMight =
    bf?.units.filter((u) => u.owner === sd.defender).reduce((n, u) => n + unitMight(state, u, "defend", bf.id), 0) ?? 0;
  const guests = state.players.filter((p) => !sd.participants.includes(p.id));
  const canInvite = state.current === sd.attacker || state.current === sd.defender;
  return (
    <div className="border-t border-line bg-raised px-4 py-3">
      <p className="text-center text-sm text-accent">
        Showdown at {bf ? getDef(bf.defId).name : "the field"} — {state.players[sd.attacker]?.name} {atkMight} vs{" "}
        {state.players[sd.defender]?.name} {defMight}
      </p>
      <p className="mt-1 text-center text-xs text-muted">
        Play an Action or Reaction, ask another seat for help, or pass. When everyone passes, Might is compared.
      </p>
      {canInvite && guests.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {guests.map((p) => (
            <button
              key={p.id}
              type="button"
              className="h-9 rounded-full border border-line bg-surface px-3 text-xs font-medium text-fg"
              onClick={() => dispatch({ type: "invite", playerId: p.id })}
            >
              Ask {p.name} for help
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CombatOverlay() {
  const state = useGame((s) => s.state)!;
  const dispatch = useGame((s) => s.dispatch);
  const c = state.lastCombat!;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button type="button" className="scrim absolute inset-0" onClick={() => dispatch({ type: "dismiss_combat" })} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-surface p-6 pop">
        <div className="vfx-impact rounded-xl" />
        <h2 className="font-display text-2xl">Showdown</h2>
        <p className="mt-2 tabular text-sm text-muted">
          {state.players[c.attacker]?.name} {c.atkMight} · {state.players[c.defender]?.name} {c.defMight}
        </p>
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {c.log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-5 h-11 w-full rounded-xl bg-fg text-sm font-medium text-bg"
          onClick={() => dispatch({ type: "dismiss_combat" })}
        >
          {state.marchQueue.length ? "Next battlefield" : "Continue"}
        </button>
      </div>
    </div>
  );
}

function WinnerOverlay() {
  const state = useGame((s) => s.state)!;
  const start = useGame((s) => s.start);
  const toTitle = useGame((s) => s.toTitle);
  const w = state.players[state.winner!]!;
  const legend = getLegend(w.legendId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <img src={legend.art} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover opacity-45" />
      <div className="scrim absolute inset-0" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-bg/90 p-8 text-center pop">
        <Crown className="mx-auto size-8 text-win" />
        <h2 className="font-display mt-3 text-4xl">{w.name} wins</h2>
        <p className="mt-2 text-sm text-muted">
          {legend.name} closed the Rift at {w.points} points.
        </p>
        <ul className="mt-4 space-y-1 text-sm text-muted">
          {state.players.map((p) => (
            <li key={p.id} className="tabular">
              {p.name} — {p.points}
            </li>
          ))}
        </ul>
        <FanNote className="mx-auto mt-4 max-w-sm pt-3 text-left" />
        <div className="mt-6 flex gap-2">
          <button type="button" className="h-11 flex-1 rounded-xl bg-fg text-sm font-medium text-bg" onClick={start}>
            Rematch
          </button>
          <button type="button" className="h-11 flex-1 rounded-xl border border-line text-sm" onClick={toTitle}>
            Title
          </button>
        </div>
      </div>
    </div>
  );
}

function InspectCard({ defId, onClose }: { defId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="scrim absolute inset-0" onClick={onClose} aria-label="Close card" />
      <div className="relative z-10 w-full max-w-lg pop">
        <CardSheet defId={defId} />
        <button
          type="button"
          className="mt-3 h-11 w-full rounded-xl bg-fg text-sm font-medium text-bg"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
