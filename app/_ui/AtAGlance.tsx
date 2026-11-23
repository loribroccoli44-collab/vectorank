import Link from "next/link";
import { facetLabel, outcomeLabel, type EvidenceFilter } from "@/lib/profiles/context";
import { OUTCOME_SLOTS } from "@/lib/profiles/dimensions";
import { dossierHref } from "@/lib/profiles/links";
import type { CandidateProfile, FacetEntry } from "@/lib/profiles/types";
import { Chip, Derived, NotStated } from "./atoms";

// The first thing a reader sees on a capsid profile: which characteristics the
// literature documents for it, under what conditions, and what is still unknown.
// Everything here is a count or a value already in the profile; nothing is
// inferred or scored. Each chip opens the evidence behind it in the ledger.

const TOP = 5;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-1.5 border-t border-vr-line py-3 first:border-t-0 sm:grid-cols-[140px_minmax(0,1fr)]">
      <div className="vr-eyebrow !text-[10px] pt-1">{label}</div>
      <div className="min-w-0 text-[13px] leading-6 text-vr-muted">{children}</div>
    </div>
  );
}

function FacetChips({
  entries,
  facet,
  profile,
  current,
  notStated,
  total,
}: {
  entries: FacetEntry[];
  facet: "tissue" | "model" | "route";
  profile: CandidateProfile;
  current: EvidenceFilter;
  notStated: number;
  total: number;
}) {
  const shown = [...entries].sort((a, b) => b.relation_count - a.relation_count).slice(0, TOP);
  if (shown.length === 0) {
    return (
      <span className="inline-flex items-center gap-2">
        <NotStated /> not reported in any of the {total} findings
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((e) => (
        <Link
          key={e.value}
          href={dossierHref(profile.candidate_id, current, { [facet]: e.value })}
          className="vr-focus"
          title={`${e.relation_count} finding${e.relation_count === 1 ? "" : "s"} from ${e.pmids.length} publication${e.pmids.length === 1 ? "" : "s"}. Open them.`}
        >
          <Chip tone="accent">
            {facetLabel(e.value)} <span className="text-vr-faint">{e.relation_count}</span>
          </Chip>
        </Link>
      ))}
      {entries.length > TOP ? (
        <a href="#matrix" className="vr-focus text-[12px] text-vr-faint hover:text-vr-muted">
          +{entries.length - TOP} more in the matrix
        </a>
      ) : null}
      {notStated > 0 ? (
        <span className="text-[12px] text-vr-faint">
          · not reported in {notStated} of {total} findings
        </span>
      ) : null}
    </div>
  );
}

export default function AtAGlance({
  profile,
  current,
  llmCount,
}: {
  profile: CandidateProfile;
  current: EvidenceFilter;
  llmCount: number;
}) {
  const total = profile.evidence.length;
  const notStated = (f: "tissue" | "model" | "route") => profile.evidence.filter((r) => r[f] === null).length;
  const byOutcome = new Map<string, number>();
  for (const o of profile.outcomes) {
    byOutcome.set(o.outcome_type, (byOutcome.get(o.outcome_type) ?? 0) + o.relation_count);
  }
  const mixed = new Set(profile.contradiction_flags.map((f) => f.outcome_type));
  const documented = [...byOutcome.entries()].sort((a, b) => b[1] - a[1]);
  const missing = OUTCOME_SLOTS.filter((s) => !byOutcome.has(s.key)).map((s) => s.label);

  return (
    <section className="mt-8" aria-labelledby="glance-title">
      <div className="vr-panel p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="glance-title" className="vr-eyebrow">
            At a glance · what published studies report
          </h2>
          <Derived n={total} />
        </div>
        <p className="mb-3 text-[12px] leading-5 text-vr-faint">
          Numbers on the chips count extracted findings, not measurements. “Not reported” means the available abstract did
          not say, not that the capsid failed.
        </p>
        <Row label="Type">
          {facetLabel(profile.candidate_type)}{" "}
          <span className="text-[12px] text-vr-faint">(classification extracted automatically, not verified)</span>
        </Row>
        <Row label="Tissues">
          <FacetChips entries={profile.tissues} facet="tissue" profile={profile} current={current} notStated={notStated("tissue")} total={total} />
        </Row>
        <Row label="Models / species">
          <FacetChips entries={profile.models} facet="model" profile={profile} current={current} notStated={notStated("model")} total={total} />
        </Row>
        <Row label="Delivery routes">
          <FacetChips entries={profile.routes} facet="route" profile={profile} current={current} notStated={notStated("route")} total={total} />
        </Row>
        <Row label="Topics reported">
          {documented.length === 0 ? (
            <NotStated />
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {documented.map(([type, n]) => (
                <Link
                  key={type}
                  href={dossierHref(profile.candidate_id, current, { outcome: type })}
                  className="vr-focus"
                  title="Open these findings"
                >
                  <Chip tone="accent">
                    {outcomeLabel(type)} <span className="text-vr-faint">{n}</span>
                  </Chip>
                </Link>
              ))}
              {mixed.size > 0 ? (
                <Chip tone="note">
                  papers report different directions for{" "}
                  {mixed.size <= 2
                    ? [...mixed].map(outcomeLabel).join(" and ").toLowerCase()
                    : `${mixed.size} outcome categories`}
                </Chip>
              ) : null}
            </div>
          )}
        </Row>
        <Row label="Not reported">
          {missing.length === 0 ? (
            "Every outcome topic has at least one extracted finding."
          ) : (
            <>
              No finding extracted for {missing.join(", ").toLowerCase()}.{" "}
              <span className="text-[12px] text-vr-faint">
                Not reported in the available abstracts is not evidence of a poor outcome.
              </span>
            </>
          )}
        </Row>
        {llmCount > 0 ? (
          <Row label="AI-extracted">
            <a href="#ai-extracted" className="vr-focus text-vr-accent underline-offset-4 hover:underline">
              {llmCount} further {llmCount === 1 ? "finding" : "findings"} extracted by a language model
            </a>{" "}
            <span className="text-[12px] text-vr-faint">· experimental, not independently validated, shown separately below.</span>
          </Row>
        ) : null}
        <div className="mt-4 border-t border-vr-line pt-4">
          <Link
            href={dossierHref(profile.candidate_id, current, {}, "ledger")}
            className="vr-cta vr-focus inline-block px-5 py-2.5 text-[14px]"
          >
            View supporting evidence →
          </Link>
          <span className="ml-3 text-[12px] text-vr-faint">each finding links to its source publication on PubMed</span>
        </div>
      </div>
    </section>
  );
}
