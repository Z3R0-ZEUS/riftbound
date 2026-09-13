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
  drawn,
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
  drawn?: boolean;
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
        drawn && "is-drawn",
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
        <span className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-1">
          <StatBadge kind="energy" value={d.energy} />
          {d.power > 0 && <StatBadge kind="power" value={d.power} />}
        </span>
      )}
      {typeof might === "number" && d.kind === "unit" && (
        <span className="absolute top-1.5 right-1.5 z-10">
          <StatBadge kind="might" value={might} />
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
          <span className="mt-0.5 flex flex-wrap gap-0.5">
            <span className="keyword-chip is-kind">{kindLabel(d.kind)}</span>
            {keys.map((k) => (
              <span key={k} className="keyword-chip">
                {k}
              </span>
            ))}
          </span>
        )}
        {showText && (
          <span className="card-ability mt-1 block text-xs leading-snug">
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
  const playable = d.kind !== "legend" && d.kind !== "battlefield";
  return (
    <article className="flex w-full max-w-lg flex-col gap-4 sm:flex-row">
      <div className="mx-auto w-44 shrink-0 pointer-events-none">
        <CardView defId={d.id} size="lg" />
      </div>
      <div className="inspect-sheet min-w-0 flex-1 rounded-xl border border-line-strong bg-surface p-4">
        <p className="text-xs font-semibold tracking-wide text-accent uppercase">{kindLabel(d.kind)}</p>
        <h3 className="font-display mt-1 text-2xl text-fg">{d.name}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <DomainPips domains={d.domains} />
          {d.domains.map((dom) => (
            <span key={dom} className="text-xs font-medium capitalize text-fg">
              {dom}
            </span>
          ))}
        </div>
        {playable && (
          <dl className="mt-4 grid grid-cols-3 gap-2.5">
            <Stat kind="energy" label="Energy" value={d.energy} />
            <Stat kind="power" label="Power" value={d.power} />
            {d.kind === "unit" ? (
              <Stat kind="might" label="Might" value={d.might ?? 0} />
            ) : (
              <div className="stat-box is-empty rounded-lg text-center">
                <dt className="uppercase">Might</dt>
                <dd className="font-display text-xl text-subtle tabular">—</dd>
              </div>
            )}
          </dl>
        )}
        {keys.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {keys.map((k) => (
              <span key={k} className="keyword-chip is-lg">
                {k}
              </span>
            ))}
          </div>
        )}
        <section className="ability-panel mt-4 rounded-lg p-3">
          <h4 className="text-[10px] font-semibold tracking-[0.16em] text-accent uppercase">Ability</h4>
          <p className="mt-1 text-sm leading-relaxed text-fg">{d.text || "No ability text."}</p>
        </section>
      </div>
    </article>
  );
}

function StatBadge({ kind, value }: { kind: "energy" | "power" | "might"; value: number }) {
  const label = kind === "energy" ? "E" : kind === "power" ? "P" : "M";
  const title = kind === "energy" ? "Energy" : kind === "power" ? "Power" : "Might";
  return (
    <span className={cn("stat-badge", `is-${kind}`)} title={`${title} ${value}`}>
      <span className="stat-badge-label">{label}</span>
      <span className="stat-badge-value tabular">{value}</span>
    </span>
  );
}

function Stat({
  kind,
  label,
  value,
}: {
  kind: "energy" | "power" | "might";
  label: string;
  value: number;
}) {
  return (
    <div className={cn("stat-box rounded-lg text-center", `is-${kind}`)}>
      <dt className="uppercase">{label}</dt>
      <dd className="font-display text-xl tabular">{value}</dd>
    </div>
  );
}
