import Link from "next/link";
import {
  FACETS,
  NOT_STATED,
  evidenceProfile,
  facetLabel,
  type CandidateResult,
  type Context,
} from "@/lib/profiles/context";
import { OUTCOME_SLOTS } from "@/lib/profiles/dimensions";
import { dossierHref } from "@/lib/profiles/links";

// One capsid in the results list. It answers four questions in order:
//   which capsid is this, how many findings and publications match, which
//   evidence topics are documented, and how to open the detailed evidence.
// Technical breakdowns (totals, naming, unknown context) sit in "Evidence
// details". Every number is a count of extracted findings; there is no score,
// rank, confidence or fit.

const ROUTE_CHIPS = 3;

const TOPIC_HELP: Record<string, string> = {
  transduction_expression: "Findings about gene delivery into cells and the resulting transgene expression.",
  efficacy: "Findings labelled as therapeutic or functional efficacy.",
  safety: "Findings about toxicity or adverse effects.",
  immune: "Findings about immune responses, including neutralizing antibodies.",
  durability: "Findings about how long expression lasted.",
  manufacturing: "Findings about vector production or yield.",
  mechanism: "Findings about how the capsid works (binding, entry, trafficking).",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

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
  const evidence = evidenceProfile(summary, OUTCOME_SLOTS.map((s) => s.key));
  const topics = OUTCOME_SLOTS.map((s) => ({ ...s, n: summary.outcomeTypes[s.key] ?? 0 })).filter(
    (t) => t.n > 0,
  );

  const stated = evidence.routes.filter((r) => r.value !== NOT_STATED);
  const notStatedRoutes = evidence.routes.find((r) => r.value === NOT_STATED)?.n ?? 0;
  const shownRoutes = stated.slice(0, ROUTE_CHIPS);
  const hiddenRoutes = stated.length - shownRoutes.length;
  const href = dossierHref(profile.candidate_id, ctx, {}, null);

  return (
    <div className="vr-row group relative grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-3 rounded-[10px] border border-vr-line bg-vr-surface px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Link
            href={href}
            className="vr-display vr-focus break-words text-[22px] font-semibold leading-tight text-vr-ink after:absolute after:inset-0 after:content-['']"
          >
            {profile.canonical_name}
          </Link>
          {profile.discovery ? (
            <span className="text-[11px] text-vr-note" title={profile.discovery.label}>
              AI-discovered name, unverified
            </span>
          ) : null}
          {alias ? (
            <span className="text-[12px] text-vr-accent">
              {alias.exact ? `matched ${alias.kind}: ${alias.via}` : `name contains “${alias.via}”`}
            </span>
          ) : null}
        </div>

        <p className="mt-1.5 text-[14px] text-vr-ink">
          <span className="vr-num font-medium">{matching}</span>{" "}
          {hasLens ? "matching " : ""}
          {matching === 1 ? "finding" : "findings"} across{" "}
          <span className="vr-num font-medium">{papers}</span>{" "}
          {papers === 1 ? "publication" : "publications"}
        </p>

        {topics.length > 0 ? (
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[12px] text-vr-muted">
            <span className="mr-1 text-vr-faint">Evidence topics:</span>
            {topics.map((t) => (
              <span
                key={t.key}
                title={`${TOPIC_HELP[t.key] ?? t.label} The number counts findings, not a result.`}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-vr-line-strong px-1.5 py-0.5"
              >
                {t.label}
                <span className="vr-num text-vr-ink">{t.n}</span>
              </span>
            ))}
          </p>
        ) : null}

        {!ctx.route && stated.length > 0 ? (
          <p className="mt-2 text-[12px] text-vr-muted">
            <span className="text-vr-faint">Delivery routes reported:</span>{" "}
            {shownRoutes.map((r) => `${facetLabel(r.value)} (${r.n})`).join(", ")}
            {hiddenRoutes > 0 ? `, +${hiddenRoutes} more` : ""}
          </p>
        ) : null}
      </div>

      <div className="relative z-10 flex items-center lg:justify-end">
        <Link href={href} className="vr-cta vr-focus whitespace-nowrap px-4 py-2 text-[13px]">
          View capsid profile →
        </Link>
      </div>

      <details className="relative z-10 col-span-full border-t border-vr-line pt-2.5 text-[12px] text-vr-muted">
        <summary className="inline-block cursor-pointer text-vr-faint hover:text-vr-ink">
          Evidence details
        </summary>
        <ul className="mt-2 space-y-1.5 leading-5">
          {hasLens ? (
            <li>
              {plural(matching, "finding matches", "findings match")} your search, out of{" "}
              {plural(summary.total, "finding", "findings")} from {plural(summary.totalPapers, "publication", "publications")} for this capsid.
            </li>
          ) : null}
          <li>
            The capsid is named in the sentence of{" "}
            <span className="vr-num text-vr-ink">{evidence.attribution.named}</span> of these findings and inferred from nearby
            text in <span className="vr-num text-vr-ink">{evidence.attribution.carried}</span>.
          </li>
          {hasLens && summary.unknownCompatible > 0 ? (
            <li>
              <span className="vr-num text-vr-ink">{summary.unknownCompatible}</span> other findings do not report the
              selected context in the available abstract. They are not counted as matches, and that does not mean the capsid failed there.
            </li>
          ) : null}
          {notStatedRoutes > 0 && !ctx.route ? (
            <li>
              <span className="vr-num text-vr-ink">{notStatedRoutes}</span> findings do not report a delivery route in the available abstract.
            </li>
          ) : null}
          {evidence.otherOutcomes > 0 ? (
            <li>{plural(evidence.otherOutcomes, "finding belongs", "findings belong")} to other outcome categories.</li>
          ) : null}
          <li className="text-vr-faint">
            Numbers count extracted findings. They are not measurements of performance, quality or suitability.
          </li>
        </ul>
      </details>
    </div>
  );
}
