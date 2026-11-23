import {
  NOT_STATED,
  directionLabel,
  facetLabel,
  outcomeLabel,
} from "@/lib/profiles/context";
import type { LlmRelation, Paper } from "@/lib/profiles/types";
import { Chip, NotStated } from "./atoms";

// One AI-extracted relation, kept visually distinct from the rule-based ledger.
// It shows what the model reported for this capsid in one paper, with its
// source; it carries no score and does not say the result is good or bad.
// The quote appears only where the article's open licence is verified.

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-[88px]">
      <div className="vr-eyebrow !text-[10px]">{label}</div>
      <div className="mt-1 text-[13px] text-vr-ink">
        {value === null ? <NotStated /> : facetLabel(value)}
      </div>
    </div>
  );
}

export default function LlmEvidenceCard({
  relation,
  paper,
}: {
  relation: LlmRelation;
  paper: Paper | undefined;
}) {
  const meta = [paper?.journal, paper?.year].filter(Boolean).join(" · ");
  return (
    <article className="vr-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${relation.pmid}/`}
            target="_blank"
            rel="noreferrer"
            className="vr-focus vr-num text-[13px] text-vr-accent underline-offset-4 hover:underline"
          >
            PMID {relation.pmid} ↗
          </a>
          <div className="mt-1 max-w-[760px] text-[13px] leading-5 text-vr-muted">
            {paper?.title ?? "Title not recorded"}
            {meta ? <span className="text-vr-faint"> — {meta}</span> : null}
          </div>
        </div>
        <Chip tone="note">AI-extracted — not independently validated</Chip>
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-3">
        <div className="min-w-[160px]">
          <div className="vr-eyebrow !text-[10px]">topic</div>
          <div className="mt-1 text-[13px] text-vr-ink">
            {outcomeLabel(relation.outcome_type)}
          </div>
        </div>
        <div className="min-w-[120px]">
          <div className="vr-eyebrow !text-[10px]">direction reported</div>
          <div className="mt-1 text-[13px] text-vr-ink">
            {relation.direction === null ? (
              <NotStated />
            ) : (
              directionLabel(relation.direction ?? NOT_STATED)
            )}
          </div>
        </div>
        <Field label="tissue" value={relation.tissue} />
        <Field label="model" value={relation.model} />
        <Field label="route" value={relation.route} />
        {relation.cargo ? <Field label="cargo (not the capsid)" value={relation.cargo} /> : null}
        {relation.comparators.length > 0 ? (
          <div>
            <div className="vr-eyebrow !text-[10px]">compared with</div>
            <div className="mt-1 text-[13px] text-vr-ink">
              {relation.comparators.join(", ")}
            </div>
          </div>
        ) : null}
      </div>

      {relation.excerpt !== null ? (
        <>
          <blockquote className="mt-4 border-l-2 border-vr-accent-dim pl-3 text-[14px] leading-6 text-vr-ink">
            {relation.excerpt}
          </blockquote>
          {paper?.attribution ? (
            <p className="mt-1.5 text-[11px] leading-5 text-vr-faint">
              {paper.attribution}{" "}
              <a
                href={paper.license_source_url}
                target="_blank"
                rel="noreferrer"
                className="vr-focus underline-offset-4 hover:underline"
              >
                Licence record ↗
              </a>
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-4 border-l-2 border-vr-line-strong pl-3 text-[13px] leading-6 text-vr-muted">
          Source sentence not shown here: no verified open licence allows reproducing it.{" "}
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${relation.pmid}/`}
            target="_blank"
            rel="noreferrer"
            className="vr-focus text-vr-accent underline-offset-4 hover:underline"
          >
            Read it on PubMed ↗
          </a>
        </p>
      )}
      <div className="mt-1.5 text-[12px] text-vr-faint">
        Written as{" "}
        <span className="vr-num text-vr-muted">{relation.surface_candidate}</span>
        . Not reviewed by a person.
        {relation.shared_claim_with.length > 0
          ? ` This sentence also names ${relation.shared_claim_with.join(", ")}: it is one shared claim, not an independent finding for each.`
          : ""}
      </div>
      {flagNotes(relation.flags).map((note) => (
        <p key={note} className="mt-1 text-[12px] leading-5 text-vr-faint">
          {note}
        </p>
      ))}
    </article>
  );
}

// Plain-language reading of the downstream qualifications. Only flags that change how a reader should take the claim
// are shown; internal rule names are never displayed.
function flagNotes(flags: string[] | undefined): string[] {
  const notes: string[] = [];
  for (const flag of flags ?? []) {
    if (flag === "direction_not_supported_by_a_comparison") {
      notes.push(
        "Direction not stated: the sentence reports the result but no comparison supports an increase or a decrease.",
      );
    } else if (flag.startsWith("identity_from_extraction_capsid_field")) {
      notes.push(
        "Capsid identity read from the source notation (for example a pseudotype such as AAV2/8, or a serotype in a list); the cargo is not part of the capsid identity.",
      );
    }
  }
  return notes;
}
