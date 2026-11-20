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
        <NotStated /> not stated in any of the {total} relations
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
          title={`${e.relation_count} relations from ${e.pmids.length} papers. Open them in the evidence ledger.`}
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
          · not stated in {notStated} of {total}
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
  const missing = OUTCOME_SLOTS.filter((s) => !byOutcome.has(s.key)).map((s) => s.label.replace(" (category label)", ""));

  return (
    <section className="mt-8" aria-labelledby="glance-title">
      <div className="vr-panel p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 id="glance-title" className="vr-eyebrow">
            At a glance · what the literature documents
          </h2>
          <Derived n={total} />
        </div>
        <Row label="Type">
          {facetLabel(profile.candidate_type)}{" "}
          <span className="text-[12px] text-vr-faint">(the extractor’s label, not verified)</span>
        </Row>
        <Row label="Tissues">
          <FacetChips entries={profile.tissues} facet="tissue" profile={profile} current={current} notStated={notStated("tissue")} total={total} />
        </Row>
        <Row label="Models">
          <FacetChips entries={profile.models} facet="model" profile={profile} current={current} notStated={notStated("model")} total={total} />
        </Row>
        <Row label="Delivery routes">
          <FacetChips entries={profile.routes} facet="route" profile={profile} current={current} notStated={notStated("route")} total={total} />
        </Row>
        <Row label="Outcomes reported">
          {documented.length === 0 ? (
            <NotStated />
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {documented.map(([type, n]) => (
                <Link
                  key={type}
                  href={dossierHref(profile.candidate_id, current, { outcome: type })}
                  className="vr-focus"
                  title="Open these relations in the evidence ledger"
                >
                  <Chip tone="accent">
                    {outcomeLabel(type)} <span className="text-vr-faint">{n}</span>
                  </Chip>
                </Link>
              ))}
              {mixed.size > 0 ? (
                <Chip tone="note">
                  directions differ between papers for{" "}
                  {mixed.size <= 2
                    ? [...mixed].map(outcomeLabel).join(" and ").toLowerCase()
                    : `${mixed.size} outcome categories`}
                </Chip>
              ) : null}
            </div>
          )}
        </Row>
        <Row label="Not documented">
          {missing.length === 0 ? (
            "Every outcome category has at least one extracted relation."
          ) : (
            <>
              No relation extracted for {missing.join(", ").toLowerCase()}.{" "}
              <span className="text-[12px] text-vr-faint">
                Absence in this corpus of abstracts is not evidence of a poor outcome.
              </span>
            </>
          )}
        </Row>
        {llmCount > 0 ? (
          <Row label="AI-extracted">
            <a href="#ai-extracted" className="vr-focus text-vr-accent underline-offset-4 hover:underline">
              {llmCount} further {llmCount === 1 ? "relation" : "relations"} extracted by a language model
            </a>{" "}
            <span className="text-[12px] text-vr-faint">· experimental, not independently validated, shown separately below.</span>
          </Row>
        ) : null}
      </div>
    </section>
  );
}
