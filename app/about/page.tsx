import Link from "next/link";
import type { Metadata } from "next";
import { Shell } from "../_ui/chrome";
import { SectionHeading } from "../_ui/atoms";
import { loadLlmEvidence, loadProfiles } from "@/lib/profiles/load";

export const metadata: Metadata = {
  title: "About and methodology · VectoRank",
  description:
    "What VectoRank is, how its literature evidence is collected and structured, what Gemini does, and what the platform does not claim.",
};

// About / methodology. Short on purpose: it says what the evidence is and is not. Every number is read from the data
// at build time; nothing here is a performance claim.

export default function AboutPage() {
  const artifact = loadProfiles();
  const ruleProfiles = artifact.profiles.filter((p) => !p.discovery);
  const discovered = artifact.profiles.length - ruleProfiles.length;
  const ruleRelations = ruleProfiles.reduce((n, p) => n + p.evidence.length, 0);
  const llm = loadLlmEvidence();
  const llmClaims =
    (llm?.relations.length ?? 0) +
    (llm?.discovered_profiles ?? []).reduce((n, p) => n + p.evidence.length, 0);
  const held = llm?.counts?.pending_or_rejected;

  const panel = "vr-panel p-5 text-[14px] leading-7 text-vr-muted";
  return (
    <Shell active="about">
      <div className="max-w-[820px]">
        <div className="vr-eyebrow">About · methodology</div>
        <h1 className="vr-display mt-3 text-[40px] font-semibold leading-[1.1] text-vr-ink sm:text-[48px]">
          A research-stage Beta for exploring AAV capsid evidence.
        </h1>
        <p className="mt-5 text-[16px] leading-8 text-vr-muted">
          VectoRank organizes what the scientific literature reports about AAV capsids, one capsid at a time: in which
          tissues, models and routes it was tested, what was observed, what is still unknown, and the sentence and
          publication behind every statement. It is a tool for finding and auditing evidence. It does not tell you which
          capsid is best.
        </p>

        <section className="mt-12">
          <SectionHeading eyebrow="1 · Collection" title="How the evidence is collected and structured" />
          <div className={panel}>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Titles and abstracts of {artifact.counts.papers_with_evidence} AAV papers are taken from PubMed. Only
                abstracts are read, never full texts.
              </li>
              <li>
                Each abstract is split into sentences. A claim is recorded as a <em>relation</em>: one capsid, one
                outcome (transduction / expression, efficacy, safety, immune response), the direction reported, and the
                tissue, model and route <em>when the sentence states them</em>.
              </li>
              <li>
                Capsid names are canonicalized conservatively (typography and a small reviewed alias list). Variants,
                pseudotypes, mutants and cargo constructs are not merged by inference; a name that cannot be resolved
                stays unresolved.
              </li>
              <li>
                Relations are aggregated under each capsid, so a profile summarizes the evidence across publications and
                every count opens the relations behind it.
              </li>
            </ol>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeading eyebrow="2 · Two kinds of evidence" title="Rule-based and AI-extracted" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className={panel}>
              <div className="vr-display text-[16px] font-semibold text-vr-ink">Rule-based</div>
              <p className="mt-2">
                Extracted from abstracts by fixed text rules.{" "}
                <span className="text-vr-ink">{ruleRelations.toLocaleString("en-US")}</span> relations under{" "}
                <span className="text-vr-ink">{ruleProfiles.length}</span> capsid profiles. Machine-extracted; none has
                been reviewed by a person.
              </p>
            </div>
            <div className={panel}>
              <div className="vr-display text-[16px] font-semibold text-vr-ink">AI-extracted (experimental)</div>
              <p className="mt-2">
                The same abstracts were read by Google’s Gemini Flash language model, which returned structured
                relations in a fixed schema. <span className="text-vr-ink">{llmClaims.toLocaleString("en-US")}</span>{" "}
                claims passed the automatic checks, including{" "}
                <span className="text-vr-ink">{discovered}</span> capsids that have no rule-based profile
                (“AI-discovered”). They are labelled and shown separately; they are never merged with rule-based
                evidence.
              </p>
            </div>
          </div>
          <div className={`${panel} mt-4`}>
            <div className="vr-display text-[16px] font-semibold text-vr-ink">What “AI-extracted” means</div>
            <p className="mt-2">
              A language model proposed the claim; deterministic checks then tested its form. The quoted sentence must
              occur in the abstract, the capsid must be named in it, and the claim must be an observed result. An effect
              of a treatment, drug or immune cell is not credited to the capsid, a direction is shown only when the
              sentence supports a comparison, and tissue, model and route are shown only when the sentence itself states
              them. These checks test the <em>form</em> of a claim, not whether it is scientifically correct.{" "}
              <span className="text-vr-ink">AI-extracted evidence has not been independently validated.</span>
            </p>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeading eyebrow="3 · Withheld" title="Why some observations are not shown" />
          <div className={panel}>
            <p>
              {typeof held === "number" ? `${held.toLocaleString("en-US")} extracted claims` : "Many extracted claims"} are held
              back rather than displayed, because showing them could mislead. Typical reasons:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li>the sentence is background, a hypothesis or a prospect, not a result;</li>
              <li>the capsid is unnamed (“our variant”) or only generic (“AAV vectors”);</li>
              <li>the effect belongs to a treatment, dose, cargo, promoter or immune response, not to the capsid;</li>
              <li>the capsid’s identity is ambiguous or looks like a mutation, accession, peptide or another virus;</li>
              <li>the sentence states no tissue, model or route, so the result could be misread.</li>
            </ul>
            <p className="mt-3">
              Missing values are shown as “not stated”, never filled in, and “no evidence in this corpus” is never read as
              a poor outcome. Positive, negative and neutral findings are all kept.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeading eyebrow="4 · Limits" title="What this Beta does not offer" />
          <div className={panel}>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="text-vr-ink">No validated prediction or ranking.</span> Counts say how much evidence was
                extracted, not how well a capsid performs. Observations are context-dependent and come from different
                experiments that are not directly comparable.
              </li>
              <li>
                <span className="text-vr-ink">No independent validation yet.</span> The rule-based extractor was measured
                only on a 30-paper development set; it is not a held-out result. The AI extraction has not been
                measured. An independent, human-annotated evaluation is planned and has not been run.
              </li>
              <li>Abstracts only; sentences can be incomplete, and the extraction can be wrong.</li>
              <li>The paper set is a fixed snapshot of the AAV literature, not a complete or current search.</li>
            </ul>
          </div>
        </section>

        <section className="mt-12">
          <SectionHeading eyebrow="5 · Sources and reuse" title="Citations and licences" />
          <div className={panel}>
            <p>
              Every claim links to its PubMed record. A source sentence is reproduced only where the article carries a CC
              BY or CC0 licence (taken from Europe PMC licence metadata), with attribution. For all other articles the
              sentence is withheld and only bibliographic information and the link are shown. Third-party articles remain
              under their authors’ licences.
            </p>
            <p className="mt-3">
              <Link href="/search" className="vr-focus text-vr-accent underline-offset-4 hover:underline">
                Search a capsid →
              </Link>
            </p>
          </div>
        </section>
      </div>
    </Shell>
  );
}
