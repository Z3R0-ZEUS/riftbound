import { useState } from "react";
import { BookOpen, Bot, Download, Swords, Users, Volume2, VolumeX } from "lucide-react";
import { sfx } from "@/game/audio";
import { DOMAINS, getLegend, LEGENDS } from "@/game/cards";
import { PRODUCT_ART } from "@/game/products";
import { useGame } from "@/game/store";
import { cn } from "@/lib/cn";

export function FanNote({ className }: { className?: string }) {
  return (
    <p className={cn("fan-note leading-relaxed", className)}>
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
        "metal-token inline-flex h-10 items-center gap-2 rounded-full px-3 text-xs font-medium text-muted hover:text-fg",
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
    <div className="title-shell screen-enter">
      <img
        src="/art/rift.jpg"
        alt=""
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-cover opacity-55"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#060807] via-[#0a100d]/70 to-transparent" />
      <div className="vignette" />
      <div className="title-stage mx-auto flex min-h-dvh max-w-5xl flex-col justify-end px-5 pb-10 pt-12 sm:justify-end sm:pb-14">
        <div className="flex items-start justify-between gap-3">
          <p className="kicker">Local table · 3–4 seats</p>
          <MuteToggle />
        </div>
        <div className="title-wordmark mt-5 max-w-3xl">
          <h1 className="font-display text-6xl sm:text-8xl">Riftbound</h1>
          <p className="font-serif mt-4 max-w-xl text-xl leading-snug text-fg/90 sm:text-2xl">
            Open the box. Sit the table. First to eight.
          </p>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
            Pass-and-play Skirmish or War. Humans and AI. Hands stay hidden until you pass the device.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className="mode-card group overflow-hidden rounded-2xl text-left transition-transform duration-[220ms] hover:-translate-y-1 active:scale-[0.99]"
            onClick={() => {
              click();
              setSeatCount(3);
              fillHumans();
              setScreen("setup");
            }}
          >
            <img src="/art/bf-dragon.jpg" alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover opacity-40" />
            <div className="relative p-5">
              <Users className="size-5 text-accent" />
              <h2 className="font-display mt-3 text-2xl tracking-wide">Skirmish</h2>
              <p className="mt-1 text-sm text-muted">3 seats · 3 battlefields. The tight local table.</p>
            </div>
          </button>
          <button
            type="button"
            className="mode-card overflow-hidden rounded-2xl text-left transition-transform duration-[220ms] hover:-translate-y-1 active:scale-[0.99]"
            onClick={() => {
              click();
              setSeatCount(4);
              fillHumans();
              setScreen("setup");
            }}
          >
            <img src="/art/bf-baron.jpg" alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full object-cover opacity-40" />
            <div className="relative p-5">
              <Swords className="size-5 text-win" />
              <h2 className="font-display mt-3 text-2xl tracking-wide">War</h2>
              <p className="mt-1 text-sm text-muted">4 seats · 3 battlefields. First seat does not bring a field.</p>
            </div>
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="ghost-plaque inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors duration-[180ms] hover:text-fg"
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
        <div className="pack-credits mt-8">
          <p className="text-[10px] font-medium tracking-[0.18em] text-subtle uppercase">
            Fan packaging · every deck is in the box · not for sale
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRODUCT_ART.map((p) => (
              <img key={p.id} src={p.art} alt={p.name} title={p.name} className="pack-credit-art" />
            ))}
          </div>
        </div>
        <FanNote className="mt-5 max-w-xl pt-3" />
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
  const n = setup.seats.length;

  return (
    <div className="setup-shell screen-enter">
      <div className="vignette" />
      <div className="setup-stage mx-auto max-w-5xl px-4 py-8 sm:px-8">
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
        <p className="kicker mt-7">Seat the table</p>
        <h1 className="font-display mt-2 text-3xl tracking-wide sm:text-5xl">
          {setup.mode === "war" ? "War" : "Skirmish"} · {n} seats
        </h1>
        <p className="font-serif mt-3 max-w-2xl text-lg leading-snug text-fg/85">
          Choose a champion deck for each seat. All eight legends are in the box.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Jinx, Garen, Ahri, Darius, Viktor, Lee Sin, Annie, and Lux. Mark humans or AI. Hands stay hidden between
          seats — pass the device when the table asks.
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
              <article key={i} className="deck-box">
                <div className="relative h-28">
                  <img src={legend.art} alt="" crossOrigin="anonymous" className="h-full w-full object-cover object-top" />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                  <span className="absolute bottom-3 left-3 font-display text-lg">Seat {i + 1}</span>
                  {setup.mode === "war" && i === 0 && (
                    <span className="metal-token absolute top-3 right-3 rounded-full px-2 py-1 text-[10px] font-medium text-win">
                      No battlefield
                    </span>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <label className="block text-xs font-medium text-muted">
                    Name
                    <input
                      className="seat-input mt-1 h-10 w-full rounded-lg px-3 text-sm text-fg outline-none focus:border-accent"
                      value={seat.name}
                      maxLength={16}
                      onChange={(e) => patchSeat(i, { name: e.target.value })}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={cn(
                        "h-10 flex-1 rounded-full text-sm font-medium",
                        seat.kind === "human" ? "metal-token is-on" : "metal-token text-muted",
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
                        "h-10 flex-1 rounded-full text-sm font-medium",
                        seat.kind === "ai" ? "metal-token is-on" : "metal-token text-muted",
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
                    {LEGENDS.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        className={cn(
                          "h-8 rounded-full px-2.5 text-xs font-medium",
                          seat.legendId === l.id ? "metal-token is-on" : "metal-token text-muted hover:text-fg",
                        )}
                        onClick={() => {
                          click();
                          patchSeat(i, { legendId: l.id });
                        }}
                      >
                        {l.name}
                      </button>
                    ))}
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
        <div className="deal-rail sticky bottom-0 z-10 -mx-4 mt-6 px-4 py-4 sm:-mx-8 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {setup.seats.map((s) => `${s.kind === "ai" ? "AI " : ""}${getLegend(s.legendId).name}`).join(" · ")}
            </p>
            <button
              type="button"
              className="plaque-btn inline-flex h-12 items-center justify-center rounded-full px-10 text-sm font-semibold transition-transform duration-[180ms] active:scale-[0.98]"
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

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-full px-4 text-sm font-medium",
        active ? "metal-token is-on" : "metal-token text-muted hover:text-fg",
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
      <div className="parchment-panel relative z-10 max-h-[86dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-6 sm:rounded-2xl">
        <h2 className="font-display text-2xl tracking-wide">How to play</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <p>First player to 8 points wins. You score by conquering a battlefield and by holding it at the start of your turn.</p>
          <p>Turns open ABCD: Awaken exhausted cards, score Holds, Channel 2 runes, Draw 1. The first seat skips their first draw. The last seat channels 3 on their first turn.</p>
          <p>Pay energy by exhausting runes. Pay power by recycling runes of the card's domain (they return to the bottom of your rune deck).</p>
          <p>Play units to your base, then click ready units to form a raid and send them onto a battlefield. Send the whole group to one field, or split them across several — planned marches resolve as Showdowns in order. During a Showdown both fighters may play Action and Reaction spells, and either can ask a third player for help, before Might is compared. After a fight you can still march any units that are ready.</p>
          <p>Your eighth point cannot come from a single last-second conquer unless you scored every battlefield this turn. Holding still wins immediately.</p>
          <p>Skirmish uses 3 battlefields. War (4 players) uses 3 — the first seat does not bring one.</p>
          <p>Every champion deck is in the box: Jinx, Garen, Ahri, Darius, Viktor, Lee Sin, Annie, Lux. Nothing is locked and nothing is sold.</p>
        </div>
        <FanNote className="mt-5 pt-4" />
        <button
          type="button"
          className="plaque-btn mt-6 h-11 w-full rounded-full text-sm font-semibold"
          onClick={() => setRules(false)}
        >
          Close
        </button>
      </div>
    </div>
  );
}
