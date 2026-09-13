import { useEffect, useState } from "react";
import { BookOpen, Bot, Download, Lock, Package, Swords, Users, Volume2, VolumeX } from "lucide-react";
import { sfx } from "@/game/audio";
import { DOMAINS, getDef, getLegend, LEGENDS } from "@/game/cards";
import {
  getProduct,
  isLegendUnlocked,
  PRODUCTS,
  uniqueOwnedCount,
  unlockedLegendIds,
} from "@/game/collection";
import { useGame } from "@/game/store";
import { CardView } from "./CardView";
import { cn } from "@/lib/cn";

export function FanNote({ className }: { className?: string }) {
  return (
    <p className={cn("fan-note text-xs leading-relaxed", className)}>
      Fan-made pass-and-play table. Original card text and art only. Not affiliated with Riot Games.
      League of Legends and Riftbound are trademarks of Riot Games.
    </p>
  );
}

export function MuteToggle({ className }: { className?: string }) {
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-lg px-3 text-xs font-medium text-muted hover:text-fg",
        className,
      )}
      onClick={() => {
        toggleMute();
        if (muted) sfx("click");
      }}
      aria-pressed={muted}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      {muted ? "Muted" : "Sound"}
    </button>
  );
}

function click() {
  sfx("click");
}

export function TitleScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const setSeatCount = useGame((s) => s.setSeatCount);
  const fillHumans = useGame((s) => s.fillHumans);
  const fillAi = useGame((s) => s.fillAi);
  const start = useGame((s) => s.start);
  const setRules = useGame((s) => s.setRules);
  const [dl, setDl] = useState<"idle" | "busy" | "done" | "err">("idle");

  async function downloadZip() {
    setDl("busy");
    try {
      const res = await fetch("/riftbound.zip");
      if (!res.ok) throw new Error("missing");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "riftbound.zip";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setDl("done");
    } catch {
      setDl("err");
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <img
        src="/art/rift.jpg"
        alt=""
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/25" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-5xl flex-col justify-end px-5 pb-10 pt-14 sm:justify-center sm:pb-16">
        <div className="hero-frame max-w-3xl rounded-3xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium tracking-[0.28em] text-accent uppercase">Local table · 3–4 seats</p>
          <MuteToggle />
        </div>
        <h1 className="font-display mt-3 text-5xl text-fg sm:text-7xl">Riftbound</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Pass-and-play Skirmish or War. Humans and AI. First to eight points. Hands stay hidden until you pass the
          device.
        </p>

        <p className="mt-6 text-xs font-medium tracking-[0.2em] text-subtle uppercase">1 · Choose a mode</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="mode-card group overflow-hidden rounded-2xl text-left transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.99]"
            onClick={() => {
              click();
              setSeatCount(3);
              fillHumans();
              setScreen("setup");
            }}
          >
            <img src="/art/bf-dragon.jpg" alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover opacity-35" />
            <div className="relative p-5">
            <Users className="size-5 text-accent" />
            <h2 className="font-display mt-3 text-2xl">Skirmish</h2>
            <p className="mt-1 text-sm text-muted">3 seats · 3 battlefields. The tight local table.</p>
            </div>
          </button>
          <button
            type="button"
            className="mode-card overflow-hidden rounded-2xl text-left transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.99]"
            onClick={() => {
              click();
              setSeatCount(4);
              fillHumans();
              setScreen("setup");
            }}
          >
            <img src="/art/bf-baron.jpg" alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover opacity-35" />
            <div className="relative p-5">
            <Swords className="size-5 text-win" />
            <h2 className="font-display mt-3 text-2xl">War</h2>
            <p className="mt-1 text-sm text-muted">4 seats · 3 battlefields. First seat does not bring a field.</p>
            </div>
          </button>
        </div>

        <p className="mt-6 text-xs font-medium tracking-[0.2em] text-subtle uppercase">2 · Or sit versus AI</p>
        <button
          type="button"
          className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-transparent px-6 text-sm font-medium text-muted transition-colors duration-150 hover:text-fg"
          onClick={() => {
            click();
            setSeatCount(3);
            fillAi();
            start();
          }}
        >
          <Bot className="size-4" />
          You vs two AIs · Skirmish
        </button>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-accent hover:text-fg"
            onClick={() => {
              click();
              setScreen("shop");
            }}
          >
            <Package className="size-4" />
            Shop / Packs
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
            onClick={() => {
              click();
              setRules(true);
            }}
          >
            <BookOpen className="size-4" />
            How to play
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-accent hover:text-fg disabled:opacity-50"
            onClick={() => void downloadZip()}
            disabled={dl === "busy"}
          >
            <Download className="size-4" />
            {dl === "busy"
              ? "Preparing zip…"
              : dl === "done"
                ? "Saved riftbound.zip"
                : dl === "err"
                  ? "Download failed — try again"
                  : "Download game (.zip)"}
          </button>
        </div>
        <FanNote className="mt-8 max-w-xl pt-4" />
        </div>
      </div>
    </div>
  );
}

export function SetupScreen() {
  const setup = useGame((s) => s.setup);
  const setSeatCount = useGame((s) => s.setSeatCount);
  const patchSeat = useGame((s) => s.patchSeat);
  const fillHumans = useGame((s) => s.fillHumans);
  const fillAi = useGame((s) => s.fillAi);
  const start = useGame((s) => s.start);
  const toTitle = useGame((s) => s.toTitle);
  const setScreen = useGame((s) => s.setScreen);
  const collection = useGame((s) => s.collection);
  const n = setup.seats.length;

  return (
    <div className="min-h-dvh bg-bg px-4 py-8 text-fg sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-sm text-muted hover:text-fg"
            onClick={() => {
              click();
              toTitle();
            }}
          >
            Back
          </button>
          <MuteToggle />
        </div>
        <p className="mt-6 text-xs font-medium tracking-[0.22em] text-accent uppercase">Seat the table</p>
        <h1 className="font-display mt-2 text-3xl sm:text-4xl">
          {setup.mode === "war" ? "War" : "Skirmish"} · {n} seats
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Pick a champion deck for each seat. Locked legends unlock from{" "}
          <button
            type="button"
            className="text-accent hover:text-fg"
            onClick={() => {
              click();
              setScreen("shop");
            }}
          >
            Shop / Packs
          </button>
          . Ahri and Darius are in the box. Mark humans or AI. Hands stay hidden between seats — pass the device when
          the table asks.
          {setup.mode === "war" ? " War: seat 1 brings no battlefield." : ""}
        </p>

        <section className="mt-6">
          <h2 className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Mode</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Toggle
              active={n === 3}
              onClick={() => {
                click();
                setSeatCount(3);
              }}
              label="Skirmish · 3"
            />
            <Toggle
              active={n === 4}
              onClick={() => {
                click();
                setSeatCount(4);
              }}
              label="War · 4"
            />
          </div>
        </section>

        <section className="mt-5">
          <h2 className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Who sits</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Toggle
              active={setup.seats.every((s) => s.kind === "human")}
              onClick={() => {
                click();
                fillHumans();
              }}
              label="All human"
            />
            <Toggle
              active={setup.seats[0]?.kind === "human" && setup.seats.slice(1).every((s) => s.kind === "ai")}
              onClick={() => {
                click();
                fillAi();
              }}
              label="You + AI"
            />
          </div>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {setup.seats.map((seat, i) => {
            const legend = getLegend(seat.legendId);
            return (
              <article key={i} className="menu-frame overflow-hidden rounded-2xl">
                <div className="relative h-28">
                  <img src={legend.art} alt="" crossOrigin="anonymous" className="h-full w-full object-cover object-top" />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                  <span className="absolute bottom-3 left-3 font-display text-lg">Seat {i + 1}</span>
                  {setup.mode === "war" && i === 0 && (
                    <span className="absolute top-3 right-3 rounded-full bg-bg/85 px-2 py-1 text-[10px] font-medium text-win">
                      No battlefield
                    </span>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <label className="block text-xs font-medium text-muted">
                    Name
                    <input
                      className="mt-1 h-10 w-full rounded-lg border border-line bg-raised px-3 text-sm text-fg outline-none focus:border-accent"
                      value={seat.name}
                      maxLength={16}
                      onChange={(e) => patchSeat(i, { name: e.target.value })}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={cn(
                        "h-10 flex-1 rounded-lg text-sm font-medium",
                        seat.kind === "human" ? "bg-fg text-bg" : "bg-raised text-muted",
                      )}
                      onClick={() => {
                        click();
                        patchSeat(i, { kind: "human" });
                      }}
                    >
                      Human
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "h-10 flex-1 rounded-lg text-sm font-medium",
                        seat.kind === "ai" ? "bg-fg text-bg" : "bg-raised text-muted",
                      )}
                      onClick={() => {
                        click();
                        patchSeat(i, { kind: "ai" });
                      }}
                    >
                      AI
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {LEGENDS.map((l) => {
                      const locked = !isLegendUnlocked(collection, l.id);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          disabled={locked}
                          title={locked ? `Unlock via Shop · ${l.product}` : l.name}
                          className={cn(
                            "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
                            seat.legendId === l.id
                              ? "bg-fg text-bg"
                              : locked
                                ? "bg-raised text-subtle"
                                : "bg-raised text-muted hover:text-fg",
                          )}
                          onClick={() => {
                            if (locked) return;
                            click();
                            patchSeat(i, { legendId: l.id });
                          }}
                        >
                          {locked && <Lock className="size-3" />}
                          {l.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs leading-relaxed text-muted">
                    {legend.product} · {legend.domains.map((d) => DOMAINS[d].label).join(" / ")}
                    <span className="mt-1 block">{legend.blurb}</span>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
        <FanNote className="mt-8 max-w-2xl pt-4" />
        <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-line bg-bg/95 px-4 py-4 backdrop-blur-sm sm:-mx-8 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {setup.seats.map((s) => `${s.kind === "ai" ? "AI " : ""}${getLegend(s.legendId).name}`).join(" · ")}
            </p>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-fg px-10 text-sm font-medium text-bg transition-transform duration-150 active:scale-[0.98]"
              onClick={() => {
                click();
                start();
              }}
            >
              Deal in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShopScreen() {
  const toTitle = useGame((s) => s.toTitle);
  const setScreen = useGame((s) => s.setScreen);
  const collection = useGame((s) => s.collection);
  const buyProduct = useGame((s) => s.buyProduct);
  const lastOpen = useGame((s) => s.lastOpen);
  const clearLastOpen = useGame((s) => s.clearLastOpen);
  const unlocked = unlockedLegendIds(collection);
  const owned = uniqueOwnedCount(collection);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!lastOpen) {
      setShown(0);
      return;
    }
    setShown(0);
    const n = lastOpen.pulls.length;
    if (!n) return;
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setShown(i);
      sfx("reveal");
      if (i >= n) window.clearInterval(t);
    }, 140);
    return () => window.clearInterval(t);
  }, [lastOpen]);

  const opened = lastOpen ? getProduct(lastOpen.productId) : undefined;

  return (
    <div className="min-h-dvh bg-bg px-4 py-8 text-fg sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="text-sm text-muted hover:text-fg"
            onClick={() => {
              click();
              clearLastOpen();
              toTitle();
            }}
          >
            Back
          </button>
          <MuteToggle />
        </div>
        <p className="mt-6 text-xs font-medium tracking-[0.22em] text-accent uppercase">Local shop · no real money</p>
        <h1 className="font-display mt-2 text-3xl sm:text-4xl">Packs</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Fan-made product art only — not official Riot pack scans. Opening a pack is free and stays on this device.
          Boosters pull from the existing card pool. Champion decks and Proving Grounds unlock those legends for seat
          setup.
        </p>

        <section className="menu-frame mt-6 rounded-2xl p-4 sm:p-5">
          <h2 className="text-xs font-medium tracking-[0.18em] text-subtle uppercase">Your box</h2>
          <p className="mt-2 text-sm text-muted">
            {owned} unique card{owned === 1 ? "" : "s"} saved · {unlocked.length} legend
            {unlocked.length === 1 ? "" : "s"} unlocked
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {LEGENDS.map((l) => {
              const on = unlocked.includes(l.id);
              return (
                <span
                  key={l.id}
                  className={cn(
                    "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
                    on ? "bg-fg text-bg" : "bg-raised text-subtle",
                  )}
                >
                  {!on && <Lock className="size-3" />}
                  {l.name}
                </span>
              );
            })}
          </div>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => {
            const times = collection.openedProductCounts[p.id] ?? 0;
            return (
              <article key={p.id} className="pack-card overflow-hidden rounded-2xl">
                <div className="pack-art relative">
                  <img src={p.art} alt="" className="h-full w-full object-contain" />
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-[10px] font-medium tracking-[0.18em] text-accent uppercase">
                    {p.kind === "booster" ? "Booster" : p.kind === "starter-set" ? "Starter set" : "Champion deck"}
                  </p>
                  <h2 className="font-display text-xl leading-tight">{p.name}</h2>
                  <p className="text-xs leading-relaxed text-muted">{p.blurb}</p>
                  <p className="text-xs text-subtle">{times ? `Opened ×${times}` : "Unopened"}</p>
                  <button
                    type="button"
                    className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-fg text-sm font-medium text-bg transition-transform duration-150 active:scale-[0.98]"
                    onClick={() => {
                      buyProduct(p.id);
                    }}
                  >
                    Open · local · free
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <FanNote className="mt-8 max-w-2xl pt-4" />
        <p className="mt-3 max-w-2xl text-xs text-subtle">
          Collection is stored as <code>riftbound-collection</code> in localStorage. Nothing is purchased and nothing
          leaves this browser.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-line px-5 text-sm text-muted hover:text-fg"
            onClick={() => {
              click();
              clearLastOpen();
              setScreen("setup");
            }}
          >
            Seat the table
          </button>
        </div>
      </div>

      {lastOpen && opened && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="scrim absolute inset-0"
            aria-label="Close reveal"
            onClick={() => clearLastOpen()}
          />
          <div className="relative z-10 max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 sm:rounded-2xl sm:p-6">
            <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">Opened</p>
            <h2 className="font-display mt-1 text-2xl">{opened.name}</h2>
            {lastOpen.newlyUnlocked.length > 0 && (
              <p className="mt-2 text-sm text-win">
                Unlocked {lastOpen.newlyUnlocked.map((id) => getLegend(id).name).join(", ")} for seat setup.
              </p>
            )}
            {lastOpen.pulls.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Added to your local box.</p>
            ) : (
              <div className="pack-fan mt-5">
                {lastOpen.pulls.map((pull, i) => {
                  const d = getDef(pull.defId);
                  const visible = i < shown;
                  return (
                    <div
                      key={`${pull.defId}-${i}`}
                      className={cn("pack-reveal", visible && "is-shown")}
                      style={{ ["--i" as string]: i }}
                    >
                      {visible ? (
                        <CardView defId={d.id} size="sm" />
                      ) : (
                        <div className="tcg-card w-[4.5rem] sm:w-20">
                          <img src="/art/cardback.jpg" alt="" />
                        </div>
                      )}
                      {visible && (
                        <p className="mt-1 text-center text-[10px] font-medium tracking-wide text-win uppercase">
                          {pull.rarity}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              className="mt-6 h-11 w-full rounded-xl bg-fg text-sm font-medium text-bg"
              onClick={() => {
                click();
                clearLastOpen();
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-full px-4 text-sm font-medium",
        active ? "bg-fg text-bg" : "border border-line bg-surface text-muted hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

export function RulesModal() {
  const open = useGame((s) => s.rules);
  const setRules = useGame((s) => s.setRules);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="scrim absolute inset-0" aria-label="Close rules" onClick={() => setRules(false)} />
      <div className="relative z-10 max-h-[86dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-line bg-surface p-6 sm:rounded-2xl">
        <h2 className="font-display text-2xl">How to play</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <p>First player to 8 points wins. You score by conquering a battlefield and by holding it at the start of your turn.</p>
          <p>Turns open ABCD: Awaken exhausted cards, score Holds, Channel 2 runes, Draw 1. The first seat skips their first draw. The last seat channels 3 on their first turn.</p>
          <p>Pay energy by exhausting runes. Pay power by recycling runes of the card's domain (they return to the bottom of your rune deck).</p>
          <p>Play units to your base, then click ready units to form a raid and send them onto a battlefield. Send the whole group to one field, or split them across several — planned marches resolve as Showdowns in order. During a Showdown both fighters may play Action and Reaction spells, and either can ask a third player for help, before Might is compared. After a fight you can still march any units that are ready.</p>
          <p>Your eighth point cannot come from a single last-second conquer unless you scored every battlefield this turn. Holding still wins immediately.</p>
          <p>Skirmish uses 3 battlefields. War (4 players) uses 3 — the first seat does not bring one.</p>
        </div>
        <FanNote className="mt-5 pt-4" />
        <button
          type="button"
          className="mt-6 h-11 w-full rounded-xl bg-fg text-sm font-medium text-bg"
          onClick={() => setRules(false)}
        >
          Close
        </button>
      </div>
    </div>
  );
}
