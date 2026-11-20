import Link from "next/link";
import type { ReactNode } from "react";
import {
  DIRECTION_ORDER,
  NOT_STATED,
  directionLabel,
} from "@/lib/profiles/context";

// Directions are drawn with a hue-free ramp. An extracted direction (increased,
// reduced, ...) says what changed, not whether that is good or bad, so color is
// never used to judge it; the labels carry the meaning.
export const DIRECTION_SWATCH: Record<string, string> = {
  increased: "bg-vr-dir-1",
  positive: "bg-vr-dir-2",
  favorable: "bg-vr-dir-3",
  reduced: "bg-vr-dir-4",
  adverse: "bg-vr-dir-5",
  no_detected_signal: "border border-vr-muted bg-transparent",
  [NOT_STATED]: "vr-hatch border border-vr-line-strong",
};

export function Swatch({ direction }: { direction: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-[2px] ${
        DIRECTION_SWATCH[direction] ?? "bg-vr-muted"
      }`}
    />
  );
}

// The one visual for "the paper did not say".
export function NotStated({ label = "not stated" }: { label?: string }) {
  return (
    <span className="vr-hatch inline-flex items-center rounded-[4px] border border-vr-line-strong px-1.5 py-0.5 font-vr-mono text-[11px] leading-none text-vr-muted">
      {label}
    </span>
  );
}

export function Chip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "note";
}) {
  const tones = {
    neutral: "border-vr-line-strong text-vr-muted",
    accent: "border-vr-accent-dim text-vr-accent",
    note: "border-[#5a4a22] text-vr-note",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 font-vr-mono text-[11px] leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

// "derived from N relations": every frontend-computed count says so.
export function Derived({ n }: { n: number }) {
  return (
    <span className="font-vr-mono text-[11px] text-vr-faint">
      derived from {n} relation{n === 1 ? "" : "s"}
    </span>
  );
}

export function Stat({
  value,
  label,
  note,
}: {
  value: ReactNode;
  label: string;
  note?: ReactNode;
}) {
  return (
    <div>
      <div className="vr-num text-[26px] font-medium leading-none text-vr-ink">
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-vr-muted">{label}</div>
      {note ? <div className="mt-0.5">{note}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  aside,
  id,
}: {
  eyebrow: string;
  title: string;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-1 scroll-mt-20"
    >
      <div>
        <div className="vr-eyebrow">{eyebrow}</div>
        <h2 className="vr-display mt-1 text-[21px] font-semibold text-vr-ink">
          {title}
        </h2>
      </div>
      {aside ? <div className="text-right">{aside}</div> : null}
    </div>
  );
}

// Segmented bar of direction counts. Hatched = the paper stated no direction.
export function DirectionStrip({
  counts,
  showLegend = true,
}: {
  counts: Record<string, number>;
  showLegend?: boolean;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const keys = DIRECTION_ORDER.filter((k) => (counts[k] ?? 0) > 0);
  if (total === 0) return null;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-[3px] border border-vr-line-strong">
        {keys.map((k) => (
          <div
            key={k}
            title={`${directionLabel(k)}: ${counts[k]}`}
            className={DIRECTION_SWATCH[k]}
            style={{ width: `${(counts[k] / total) * 100}%` }}
          />
        ))}
      </div>
      {showLegend ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {keys.map((k) => (
            <li
              key={k}
              className="flex items-center gap-1.5 text-[12px] text-vr-muted"
            >
              <Swatch direction={k} />
              <span>{directionLabel(k)}</span>
              <span className="vr-num text-vr-ink">{counts[k]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Stacked bar for a selected facet: matches / stated-but-different / not stated.
export function CoverageBar({
  match,
  other,
  notStated,
}: {
  match: number;
  other: number;
  notStated: number;
}) {
  const total = match + other + notStated;
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-[2px] bg-vr-line">
      <div className="bg-vr-accent" style={{ width: pct(match) }} />
      <div className="bg-vr-line-strong" style={{ width: pct(other) }} />
      <div className="vr-hatch" style={{ width: pct(notStated) }} />
    </div>
  );
}

export function TextLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`vr-focus text-vr-accent underline-offset-4 hover:underline ${className}`}
    >
      {children}
    </Link>
  );
}

// Evidence pips: one small square per matching relation, grouped by the paper
// the relations come from. They are a literal count, in one neutral grey, so
// they show volume and independence of sources and cannot read as a score:
// no scale, no color ramp, no bar length. Display is capped; the remainder is
// stated as a number.
export const PIP_CAP = 36;

export function EvidencePips({
  groups,
  cap = PIP_CAP,
}: {
  groups: number[];
  cap?: number;
}) {
  const total = groups.reduce((a, b) => a + b, 0);
  const papers = groups.length;
  let remaining = cap;
  const shown: number[] = [];
  for (const g of groups) {
    if (remaining <= 0) break;
    const take = Math.min(g, remaining);
    shown.push(take);
    remaining -= take;
  }
  const hidden = total - shown.reduce((a, b) => a + b, 0);

  return (
    <div
      role="img"
      aria-label={`${total} relation${total === 1 ? "" : "s"} from ${papers} paper${papers === 1 ? "" : "s"}`}
      title={`1 square = 1 relation. Squares are grouped by supporting paper (${papers} paper${papers === 1 ? "" : "s"}).`}
      className="flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      {shown.map((count, i) => (
        <span key={i} className="inline-flex gap-[2px]">
          {Array.from({ length: count }, (_, j) => (
            <span
              key={j}
              className="inline-block h-[7px] w-[7px] rounded-[1.5px] bg-[#8791a6]"
            />
          ))}
        </span>
      ))}
      {hidden > 0 ? (
        <span className="vr-num text-[11px] text-vr-faint">+{hidden}</span>
      ) : null}
    </div>
  );
}
