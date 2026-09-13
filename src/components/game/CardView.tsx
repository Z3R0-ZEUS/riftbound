import { createContext, useContext, useRef } from "react";
import { getDef } from "@/game/cards";
import { spellSpeed, unitMight } from "@/game/engine";
import type { CardDef, CardInst, Domain, GameState } from "@/game/types";
import { cn } from "@/lib/cn";

export const CardPeek = createContext<{
  peek: (id: string | null) => void;
  inspect: (id: string | null) => void;
}>({ peek: () => {}, inspect: () => {} });

function DomainPips({ domains, className }: { domains: Domain[]; className?: string }) {
  return (
    <span className={cn("flex gap-0.5", className)}>
      {domains.map((d) => (
        <span key={d} className="pip" style={{ background: `var(--domain-${d})` }} title={d} />
      ))}
    </span>
  );
}

export function keywordList(d: CardDef): string[] {
  const k: string[] = [];
  if (d.isChampion) k.push("Champion");
  if (d.accelerate) k.push("Accelerate");
  if (d.ganking) k.push("Ganking");
  if (d.assault) k.push(`Assault ${d.assault}`);
  if (d.defender) k.push(`Defender ${d.defender}`);
  if (d.deathDamage) k.push(`Death ${d.deathDamage}`);
  if (d.gearAuraMight) k.push(`Aura +${d.gearAuraMight}`);
  if (d.bfBonusMight) k.push(`+${d.bfBonusMight} Might here`);
  const spd = spellSpeed(d);
  if (spd === "reaction") k.push("Reaction");
  else if (spd === "action") k.push("Action");
  return k;
}

function kindLabel(kind: CardDef["kind"]) {
  if (kind === "unit") return "Unit";
  if (kind === "spell") return "Spell";
  if (kind === "gear") return "Gear";
  if (kind === "legend") return "Legend";
  return "Battlefield";
}

export function CardView({
  inst,
  defId,
  size = "md",
  selected,
  playable,
  dim,
  hidden,
  state,
  bfId,
  onClick,
  onInspect,
}: {
  inst?: CardInst;
  defId?: string;
  size?: "xs" | "sm" | "md" | "lg";
  selected?: boolean;
  playable?: boolean;
  dim?: boolean;
  hidden?: boolean;
  state?: GameState;
  bfId?: string;
  onClick?: () => void;
  onInspect?: () => void;
}) {
  const peek = useContext(CardPeek);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const id = inst?.defId ?? defId;

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const openInspect = () => {
    held.current = true;
    if (onInspect) onInspect();
    else if (id) peek.inspect(id);
  };

  if (hidden || !id) {
    return (
      <button
        type="button"
        className={cn("tcg-card", sizeClass(size))}
        onClick={onClick}
        aria-label="Facedown card"
      >
        <img src="/art/cardback.jpg" alt="" crossOrigin="anonymous" />
      </button>
    );
  }

  const d = getDef(id);
  const might =
    d.kind === "unit" && inst && state
      ? unitMight(state, inst, "normal", bfId)
      : d.might;
  const keys = keywordList(d);
  const showText = size === "md" || size === "lg";
  const showKeys = size !== "xs";
  const domain = d.domains[0];

  return (
    <button
      type="button"
      className={cn(
        "tcg-card text-left",
        sizeClass(size),
        selected && "is-selected",
        playable && "is-playable",
        dim && "is-dim",
        inst?.exhausted && "is-exhausted",
      )}
      style={domain ? { ["--card-domain" as string]: `var(--domain-${domain})` } : undefined}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        onClick?.();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        openInspect();
      }}
      onMouseEnter={() => peek.peek(id)}
      onMouseLeave={() => {
        peek.peek(null);
        clearHold();
      }}
      onPointerDown={() => {
        held.current = false;
        clearHold();
        holdTimer.current = setTimeout(openInspect, 700);
      }}
      onPointerUp={clearHold}
      onPointerCancel={clearHold}
      aria-label={`${d.name}. ${kindLabel(d.kind)}. ${statLine(d, might)} ${d.text}`}
    >
      <img src={d.art} alt="" crossOrigin="anonymous" />
      {d.kind !== "battlefield" && d.kind !== "legend" && (
        <span
          className="absolute top-1 left-1 z-10 flex h-6 min-w-6 items-center justify-center rounded-full border border-line-strong bg-bg/92 px-1.5 text-xs font-semibold text-fg tabular"
          title={d.power > 0 ? `Energy ${d.energy}, Power ${d.power}` : `Energy ${d.energy}`}
        >
          {d.energy}
          {d.power > 0 ? `/${d.power}` : ""}
        </span>
      )}
      {typeof might === "number" && d.kind === "unit" && (
        <span
          className="absolute top-1 right-1 z-10 flex h-6 min-w-6 items-center justify-center rounded-full border border-black/30 bg-win px-1.5 text-xs font-semibold text-accent-fg tabular shadow-sm"
          title={`Might ${might}`}
        >
          {might}
        </span>
      )}
      {inst && inst.damage > 0 && (
        <span className="absolute top-8 right-1 rounded-sm bg-danger px-1 text-xs font-semibold text-fg">
          −{inst.damage}
        </span>
      )}
      <span className="tcg-nameplate">
        <span className="flex items-center justify-between gap-1">
          <span className="font-display text-xs leading-tight text-fg">{d.name}</span>
          <DomainPips domains={d.domains} />
        </span>
        {showKeys && (
          <span className="mt-0.5 block text-xs leading-tight text-win">
            {kindLabel(d.kind)}
            {keys.length ? ` · ${keys.join(" · ")}` : ""}
          </span>
        )}
        {showText && (
          <span className="mt-0.5 block text-xs leading-snug text-fg/90">
            {d.text || "No ability."}
          </span>
        )}
      </span>
    </button>
  );
}

function statLine(d: CardDef, might?: number) {
  const bits: string[] = [];
  if (d.kind !== "legend" && d.kind !== "battlefield") bits.push(`Energy ${d.energy}`);
  if (d.power > 0) bits.push(`Power ${d.power}`);
  if (typeof might === "number") bits.push(`Might ${might}`);
  return bits.join(", ");
}

function sizeClass(size: "xs" | "sm" | "md" | "lg") {
  if (size === "xs") return "w-14 sm:w-16";
  if (size === "sm") return "w-[4.5rem] sm:w-20";
  if (size === "lg") return "w-36 sm:w-44";
  return "w-[5.5rem] sm:w-28";
}

export function CardSheet({ defId }: { defId: string }) {
  const d = getDef(defId);
  const keys = keywordList(d);
  return (
    <article className="flex w-full max-w-lg flex-col gap-4 sm:flex-row">
      <div className="mx-auto w-44 shrink-0 pointer-events-none">
        <CardView defId={d.id} size="lg" />
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface p-4">
        <p className="text-xs font-medium tracking-wide text-accent uppercase">{kindLabel(d.kind)}</p>
        <h3 className="font-display mt-1 text-2xl text-fg">{d.name}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <DomainPips domains={d.domains} />
          {d.domains.map((dom) => (
            <span key={dom} className="text-xs capitalize text-muted">
              {dom}
            </span>
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2">
          {d.kind !== "legend" && d.kind !== "battlefield" && (
            <Stat label="Energy" value={d.energy} />
          )}
          {d.power > 0 && <Stat label="Power" value={d.power} />}
          {typeof d.might === "number" && <Stat label="Might" value={d.might} />}
        </dl>
        {keys.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {keys.map((k) => (
              <span key={k} className="rounded-full border border-line bg-raised px-2 py-1 text-xs text-win">
                {k}
              </span>
            ))}
          </div>
        )}
        <p className="mt-4 text-sm leading-relaxed text-fg">{d.text || "No ability text."}</p>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-raised px-2 py-2 text-center">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-display text-xl text-fg tabular">{value}</dd>
    </div>
  );
}
