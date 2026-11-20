import Link from "next/link";
import {
  FACETS,
  NOT_STATED,
  evidenceProfile,
  facetLabel,
  type CandidateResult,
  type Context,
} from "@/lib/profiles/context";
import {
  OUTCOME_SLOTS,
  PRIORITIZATION_DIMENSIONS,
} from "@/lib/profiles/dimensions";
import { dossierHref } from "@/lib/profiles/links";
import { EvidencePips, NotStated } from "./atoms";

// One candidate in the Results workspace. Every row has the same internal
// structure so the eye can scan down a column:
//
//   zone 1  Identity              name, extractor label, alias match
//   zone 2  Evidence profile      matching evidence + pips | outcome slots | routes
//   zone 3  Prioritization        RESERVED: renders nothing until a validated
//                                 dimension is registered (see dimensions.ts)
//
// Everything shown is a dataset field or a plain count over the candidate's own
// relations. There is no score, rank, confidence or fit.

const GRID =
  "lg:grid-cols-[200px_minmax(210px,1.1fr)_272px_minmax(170px,0.9fr)_16px]";
const GRID_WITH_PRIORITIZATION =
  "lg:grid-cols-[200px_minmax(210px,1.1fr)_272px_minmax(170px,0.9fr)_minmax(140px,0.6fr)_16px]";

// Shared by the header and every row so their columns line up.
export const RESULT_GRID =
  PRIORITIZATION_DIMENSIONS.length > 0 ? GRID_WITH_PRIORITIZATION : GRID;

const ROUTE_CHIPS = 3;

// Zone 3. Intentionally empty today: no validated prioritization dimension
// exists, so nothing is drawn and no grid column is reserved on screen.
function PrioritizationZone() {
  if (PRIORITIZATION_DIMENSIONS.length === 0) return null;
  return (
    <div className="min-w-0">
      {PRIORITIZATION_DIMENSIONS.map((d) => (
        <div key={d.id} title={d.source} className="text-[12px] text-vr-muted">
          {d.label}
        </div>
      ))}
    </div>
  );
}

export function ResultsHeader() {
  return (
    <div className="mb-2 hidden px-5 lg:block">
      <div className={`grid gap-x-5 ${RESULT_GRID}`}>
        <span className="vr-eyebrow !text-[10px]">Identity</span>
        <span className="vr-eyebrow !text-[10px] lg:col-span-3">
          Evidence profile · descriptive counts
        </span>
        {PRIORITIZATION_DIMENSIONS.length > 0 ? (
          <span className="vr-eyebrow !text-[10px]">Prioritization</span>
        ) : null}
        <span />
      </div>
      <div className={`mt-1.5 grid gap-x-5 text-[11px] text-vr-faint ${RESULT_GRID}`}>
        <span>Candidate</span>
        <span>Matching evidence</span>
        <span
          className="grid grid-cols-7 gap-1 text-center font-vr-mono text-[10px]"
          title="Matching relations by extracted outcome category. A count says a category was extracted, not what the result was."
        >
          {OUTCOME_SLOTS.map((slot) => (
            <span key={slot.key} title={slot.label}>
              {slot.short}
            </span>
          ))}
        </span>
        <span>Routes in matching evidence</span>
        {PRIORITIZATION_DIMENSIONS.length > 0 ? <span /> : null}
        <span />
      </div>
    </div>
  );
}

export default function CandidateCard({
  result,
  ctx,
}: {
  result: CandidateResult;
  ctx: Context;
}) {
  const { profile, summary, alias } = result;
  const hasLens = FACETS.some((f) => ctx[f]);
  const matching = summary.matching.length;
  const papers = hasLens ? summary.matchingPapers : summary.totalPapers;
  const evidence = evidenceProfile(
    summary,
    OUTCOME_SLOTS.map((s) => s.key),
  );

  const stated = evidence.routes.filter((r) => r.value !== NOT_STATED);
  const notStated = evidence.routes.find((r) => r.value === NOT_STATED);
  const shownRoutes = stated.slice(0, ROUTE_CHIPS);
  const hiddenRoutes = stated.slice(ROUTE_CHIPS);

  return (
    <Link
      href={dossierHref(profile.candidate_id, ctx, {}, null)}
      className={`vr-row vr-focus group grid items-start gap-x-5 gap-y-4 rounded-[10px] border border-vr-line bg-vr-surface px-5 py-4 ${RESULT_GRID}`}
    >
      {/* ------------------------------------------------ zone 1: identity */}
      <div className="min-w-0">
        <div className="vr-display truncate text-[20px] font-semibold leading-tight text-vr-ink">
          {profile.canonical_name}
        </div>
        {profile.discovery ? (
          <div className="mt-1 text-[11px] leading-4 text-vr-note">
            {profile.discovery.label}
          </div>
        ) : null}
        <div
          className="mt-1 text-[11px] leading-4 text-vr-faint"
          title="Candidate type is the extractor's label, carried through unchanged and unvalidated."
        >
          extractor label · {facetLabel(profile.candidate_type)}
        </div>
        {alias ? (
          <div className="mt-1 text-[11px] leading-4 text-vr-accent">
            {alias.exact
              ? `matched ${alias.kind}: ${alias.via}`
              : `contains “${alias.via}”`}
          </div>
        ) : null}
      </div>

      {/* ------------------------------ zone 2a: matching evidence and pips */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="vr-num text-[22px] font-medium leading-none text-vr-ink">
            {matching}
          </span>
          <span className="text-[12px] text-vr-muted">
            {matching === 1 ? "relation" : "relations"}
          </span>
          <span className="text-vr-faint">·</span>
          <span className="vr-num text-[14px] leading-none text-vr-ink">{papers}</span>
          <span className="text-[12px] text-vr-muted">
            {papers === 1 ? "paper" : "papers"}
          </span>
        </div>
        <div className="mt-2.5">
          <EvidencePips groups={evidence.paperGroups} />
        </div>
        {hasLens ? (
          <div className="vr-num mt-2 text-[11px] text-vr-faint">
            of {summary.total} {summary.total === 1 ? "relation" : "relations"} ·{" "}
            {summary.totalPapers} {summary.totalPapers === 1 ? "paper" : "papers"} total
          </div>
        ) : null}
      </div>

      {/* --------------------------- zone 2b: fixed outcome-category slots */}
      <div className="grid grid-cols-7 gap-1">
        {OUTCOME_SLOTS.map((slot) => {
          const n = summary.outcomeTypes[slot.key] ?? 0;
          return (
            <div
              key={slot.key}
              title={
                n > 0
                  ? `${slot.label}: ${n} matching relation${n === 1 ? "" : "s"}`
                  : `${slot.label}: none among matching relations`
              }
              className="text-center"
            >
              <div className="vr-num text-[9px] text-vr-faint lg:hidden">
                {slot.short}
              </div>
              <div
                className={`vr-num rounded-[4px] py-1 text-[12px] ${
                  n > 0
                    ? "border border-vr-line-strong bg-vr-raised text-vr-ink"
                    : "text-vr-faint"
                }`}
              >
                {n > 0 ? n : "·"}
              </div>
            </div>
          );
        })}
      </div>

      {/* ----------------------------------- zone 2c: route composition */}
      <div className="min-w-0 text-[12px] text-vr-muted">
        {ctx.route ? (
          <span className="text-vr-faint">
            route selected:{" "}
            <span className="text-vr-muted">{facetLabel(ctx.route)}</span>
          </span>
        ) : (
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {shownRoutes.map((r) => (
              <li key={r.value} className="whitespace-nowrap">
                {facetLabel(r.value)}{" "}
                <span className="vr-num text-vr-faint">{r.n}</span>
              </li>
            ))}
            {hiddenRoutes.length > 0 ? (
              <li
                className="whitespace-nowrap text-vr-faint"
                title={hiddenRoutes
                  .map((r) => `${facetLabel(r.value)} ${r.n}`)
                  .join(" · ")}
              >
                +{hiddenRoutes.length} more
              </li>
            ) : null}
            {notStated ? (
              <li className="flex items-center gap-1.5">
                <NotStated />
                <span className="vr-num text-vr-faint">{notStated.n}</span>
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {/* ----------------------- zone 3: reserved prioritization (empty) */}
      <PrioritizationZone />

      <span
        aria-hidden
        className="hidden pt-1 text-vr-faint transition-transform group-hover:translate-x-0.5 group-hover:text-vr-accent lg:block"
      >
        →
      </span>

      {/* -------------------------- quiet provenance and unknown metadata */}
      <div className="col-span-full flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-vr-line pt-2.5 text-[11px] leading-4 text-vr-faint">
        <span>
          attribution · named in sentence{" "}
          <span className="vr-num text-vr-muted">{evidence.attribution.named}</span>{" "}
          · carried over from nearby text{" "}
          <span className="vr-num text-vr-muted">{evidence.attribution.carried}</span>
        </span>
        {hasLens && summary.unknownCompatible > 0 ? (
          <span className="flex items-center gap-1.5">
            <NotStated label={`+${summary.unknownCompatible}`} />
            other relations do not state the selected context
          </span>
        ) : null}
        {evidence.otherOutcomes > 0 ? (
          <span>
            {evidence.otherOutcomes} relation
            {evidence.otherOutcomes === 1 ? "" : "s"} in other outcome categories
          </span>
        ) : null}
      </div>
    </Link>
  );
}
