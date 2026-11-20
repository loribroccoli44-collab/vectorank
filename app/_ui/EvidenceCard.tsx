import {
  NOT_STATED,
  directionLabel,
  facetLabel,
  outcomeLabel,
} from "@/lib/profiles/context";
import type { EvidenceRelation, Paper } from "@/lib/profiles/types";
import { Chip, NotStated } from "./atoms";

// One extracted relation. The source sentence is shown verbatim only when the
// article's Creative Commons licence is verified, with its attribution line and
// a link to where the licence is stated. Otherwise it is withheld and the
// reader is sent to the PubMed record. Abstracts are never shown.

function Context({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="min-w-[88px]">
      <div className="vr-eyebrow !text-[10px]">{label}</div>
      <div className="mt-1 text-[13px] text-vr-ink">
        {value === null ? <NotStated /> : facetLabel(value)}
      </div>
    </div>
  );
}

const WITHHELD: Record<string, string> = {
  reuse_rights_not_verified: "reuse rights for this text are not verified",
  no_supporting_text: "the extractor stored no sentence",
};

export default function EvidenceCard({
  relation,
  paper,
}: {
  relation: EvidenceRelation;
  paper: Paper | undefined;
}) {
  const inherited = relation.candidate_status === "inherited";
  const ai = relation.source === "llm_gemini";
  const direction = relation.direction ?? NOT_STATED;
  const meta = [paper?.journal, paper?.year].filter(Boolean).join(" · ");

  return (
    <article className="vr-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`https://pubmed.ncbi.nlm.nih.gov/${relation.pmid}/`}
              target="_blank"
              rel="noreferrer"
              className="vr-focus vr-num text-[13px] text-vr-accent underline-offset-4 hover:underline"
            >
              PMID {relation.pmid} ↗
            </a>
            <span className="vr-num text-[11px] text-vr-faint">
              {relation.relation_ref}
            </span>
          </div>
          <div className="mt-1 max-w-[760px] text-[13px] leading-5 text-vr-muted">
            {paper?.title ? paper.title : "Title not recorded"}
            {meta ? <span className="text-vr-faint"> — {meta}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ai ? <Chip tone="note">AI-extracted — not independently validated</Chip> : null}
          <Chip tone={inherited ? "note" : "neutral"}>
            {inherited
              ? "candidate carried over from nearby text"
              : "candidate named in this sentence"}
          </Chip>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-x-8 gap-y-3">
        <div className="min-w-[160px]">
          <div className="vr-eyebrow !text-[10px]">outcome</div>
          <div className="mt-1 text-[13px] text-vr-ink">
            {outcomeLabel(relation.outcome_type)}
          </div>
        </div>
        <div className="min-w-[120px]">
          <div className="vr-eyebrow !text-[10px]">extracted direction</div>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-vr-ink">
            {relation.direction === null ? (
              <NotStated />
            ) : (
              <>
                <span aria-hidden className="vr-num text-vr-muted">
                  {direction === "increased" ? "↑" : direction === "reduced" ? "↓" : "•"}
                </span>
                {directionLabel(relation.direction)}
              </>
            )}
          </div>
        </div>
        <Context label="tissue" value={relation.tissue} />
        <Context label="model" value={relation.model} />
        <Context label="route" value={relation.route} />
        {relation.experimental_context ? (
          <div>
            <div className="vr-eyebrow !text-[10px]">context</div>
            <div className="mt-1 text-[13px] text-vr-ink">
              {facetLabel(relation.experimental_context)}
            </div>
          </div>
        ) : null}
        {relation.comparators.length > 0 ? (
          <div>
            <div className="vr-eyebrow !text-[10px]">comparators</div>
            <div className="mt-1 text-[13px] text-vr-ink">
              {relation.comparators.join(", ")}
            </div>
          </div>
        ) : null}
      </div>

      {relation.excerpt !== null ? (
        <blockquote className="mt-4 border-l-2 border-vr-accent-dim pl-3 text-[14px] leading-6 text-vr-ink">
          {relation.excerpt}
        </blockquote>
      ) : (
        <p className="mt-4 border-l-2 border-vr-line-strong pl-3 text-[13px] leading-6 text-vr-muted">
          Source sentence not reproduced here (
          {WITHHELD[relation.excerpt_withheld_reason ?? ""] ?? "excerpt policy"}).{" "}
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
      {relation.excerpt !== null && paper?.attribution ? (
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
      <div className="mt-1.5 text-[12px] text-vr-faint">
        Written as{" "}
        <span className="vr-num text-vr-muted">{relation.surface_candidate}</span>
        . {ai ? "AI-extracted" : "Machine-extracted"}, not reviewed by a human.
        {relation.shared_claim_with && relation.shared_claim_with.length > 0
          ? ` This sentence also names ${relation.shared_claim_with.join(", ")}: it is one shared claim, not an independent finding for each.`
          : ""}
      </div>
    </article>
  );
}
