import { BookOpen, Bot, Swords, Users } from "lucide-react";
import { DOMAINS, getLegend, LEGENDS } from "@/game/cards";
import { useGame } from "@/game/store";
import { cn } from "@/lib/cn";

export function TitleScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const setSeatCount = useGame((s) => s.setSeatCount);
  const fillHumans = useGame((s) => s.fillHumans);
  const fillAi = useGame((s) => s.fillAi);
  const start = useGame((s) => s.start);
  const setRules = useGame((s) => s.setRules);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <img
        src="/art/rift.jpg"
        alt=""
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/30" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-5xl flex-col justify-end px-5 pb-12 pt-16 sm:justify-center sm:pb-20">
        <p className="text-xs font-medium tracking-[0.28em] text-accent uppercase">League of Legends TCG</p>
        <h1 className="font-display mt-3 text-5xl text-fg sm:text-7xl">Riftbound</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          Official Champion Decks and Proving Grounds precons on one PC. Three or four seats. First to eight.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-fg px-6 text-sm font-medium text-bg transition-transform duration-150 hover:opacity-90 active:scale-[0.98]"
            onClick={() => {
              setSeatCount(3);
              fillHumans();
              setScreen("setup");
            }}
          >
            <Users className="size-4" />
            Local Skirmish · 3 players
          </button>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-6 text-sm font-medium text-fg transition-transform duration-150 hover:bg-raised active:scale-[0.98]"
            onClick={() => {
              setSeatCount(4);
              fillHumans();
              setScreen("setup");
            }}
          >
            <Swords className="size-4" />
            Local War · 4 players
          </button>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-transparent px-6 text-sm font-medium text-muted transition-colors duration-150 hover:text-fg"
            onClick={() => {
              setSeatCount(3);
              fillAi();
              start();
            }}
          >
            <Bot className="size-4" />
            You vs two AIs
          </button>
        </div>
        <button
          type="button"
          className="mt-5 inline-flex items-center gap-2 text-sm text-muted hover:text-fg"
          onClick={() => setRules(true)}
        >
          <BookOpen className="size-4" />
          How to play
        </button>
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
    <div className="min-h-dvh bg-bg px-4 py-8 text-fg sm:px-8">
      <div className="mx-auto max-w-5xl">
        <button type="button" className="text-sm text-muted hover:text-fg" onClick={toTitle}>
          Back
        </button>
        <h1 className="font-display mt-4 text-3xl sm:text-4xl">Seat the table</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Pick an Origins Champion Deck or a Proving Grounds precon. Hands stay hidden between seats. Mix in AI if you want.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Toggle active={n === 3} onClick={() => setSeatCount(3)} label="3 — Skirmish" />
          <Toggle active={n === 4} onClick={() => setSeatCount(4)} label="4 — War" />
          <Toggle active={false} onClick={fillHumans} label="All human" />
          <Toggle active={false} onClick={fillAi} label="You + AI" />
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {setup.seats.map((seat, i) => {
            const legend = getLegend(seat.legendId);
            return (
              <article key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="relative h-28">
                  <img src={legend.art} alt="" crossOrigin="anonymous" className="h-full w-full object-cover object-top" />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                  <span className="absolute bottom-3 left-3 font-display text-lg">Seat {i + 1}</span>
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
                      onClick={() => patchSeat(i, { kind: "human" })}
                    >
                      Human
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "h-10 flex-1 rounded-lg text-sm font-medium",
                        seat.kind === "ai" ? "bg-fg text-bg" : "bg-raised text-muted",
                      )}
                      onClick={() => patchSeat(i, { kind: "ai" })}
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
                          seat.legendId === l.id ? "bg-fg text-bg" : "bg-raised text-muted hover:text-fg",
                        )}
                        onClick={() => patchSeat(i, { legendId: l.id })}
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
        <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-line bg-bg/95 px-4 py-4 backdrop-blur-sm sm:-mx-8 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {setup.seats.map((s) => getLegend(s.legendId).name).join(" · ")}
            </p>
            <button
              type="button"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-fg px-10 text-sm font-medium text-bg transition-transform duration-150 active:scale-[0.98]"
              onClick={start}
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
