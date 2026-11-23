import { withBase } from "@/lib/base";
import Link from "next/link";
import { primeServerData } from "@/lib/profiles/server-data";
import { loadPapers, loadProfiles } from "@/lib/profiles/load";
import {
  buildMatrix,
  facetLabel,
  filterEvidence,
  searchCandidates,
  toQuery,
  type Context,
} from "@/lib/profiles/context";
import { dossierHref } from "@/lib/profiles/links";
import { SiteFooter, SiteNav } from "./_ui/chrome";
import { SectionHeading } from "./_ui/atoms";
import EvidenceMatrix from "./_ui/EvidenceMatrix";
import EvidenceCard from "./_ui/EvidenceCard";

// Landing page. It keeps the dark biotech atmosphere and the AAV render, then
// shows the product working on real data instead of describing it: a
// delivery context, the candidates with evidence in it, the evidence matrix of
// one candidate, and one source sentence with its PMID. Every number below is
// read from the demo dataset at build time.

const LENS: Context = { tissue: "CNS", model: "nonhuman_primate" };
const NARROWER: Context = { ...LENS, route: "intravenous" };

// Words that make a sentence read as a hope rather than a result. Used only to
// pick a clean example sentence for the preview, never to filter evidence.
const HEDGE = /\b(may|might|could|should|would|potential|promise|promising|future)\b/i;

export default function HomePage() {
  primeServerData();
  const artifact = loadProfiles();
  const papers = loadPapers();

  const lens = searchCandidates(artifact, LENS, undefined);
  const narrower = searchCandidates(artifact, NARROWER, undefined);
  const rows = lens.matches.slice(0, 5);
  const lead = rows[0]?.profile ?? artifact.profiles[0];

  // Headline counts are the rule-based evidence base; AI-discovered capsids are counted apart, never folded in.
  const ruleProfiles = artifact.profiles.filter((p) => !p.discovery);
  const aiDiscovered = artifact.profiles.length - ruleProfiles.length;
  const attributed = ruleProfiles.reduce((n, p) => n + p.evidence.length, 0);
  const matrix = buildMatrix(lead.evidence);

  const example = filterEvidence(lead.evidence, LENS)
    .filter(
      (r) =>
        r.candidate_status === "explicit" &&
        r.direction !== null &&
        r.excerpt !== null &&
        !HEDGE.test(r.excerpt),
    )
    .sort(
      (a, b) =>
        Number(papers.get(b.pmid)?.year ?? 0) - Number(papers.get(a.pmid)?.year ?? 0) ||
        a.relation_ref.localeCompare(b.relation_ref, undefined, { numeric: true }),
    )[0];

  const exploreHref = `/results${toQuery({ ...LENS })}`;

  return (
    <div className="min-h-screen bg-vr-bg font-vr-sans text-vr-ink antialiased selection:bg-vr-accent/25">
      <SiteNav variant="landing" />

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="vr-texture pointer-events-none absolute inset-x-0 top-0 h-[720px] !opacity-[0.13]"
        />
        <div className="relative mx-auto grid max-w-[1240px] gap-14 px-6 pb-24 pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-vr-line-strong px-3 py-1 font-vr-mono text-[11px] text-vr-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-vr-accent" />
              Research-stage Beta · AAV gene delivery
            </span>
            <h1 className="vr-display mt-6 text-[46px] font-extrabold leading-[1.02] text-white sm:text-[60px] lg:text-[68px]">
              Navigate the evidence behind{" "}
              <span className="text-vr-accent">gene delivery.</span>
            </h1>
            <p className="mt-6 max-w-[560px] text-[18px] leading-8 text-vr-muted">
              Explore AAV capsids and see what published studies report about
              each one: the tissues, models and delivery routes it was tested
              in, what is still unknown, and the original publication behind
              every finding.
            </p>
            <form
              action={withBase("/results")}
              method="get"
              role="search"
              className="mt-8 flex max-w-[560px] gap-2"
            >
              <label htmlFor="home-q" className="sr-only">
                Search a capsid by name or alias
              </label>
              <input
                id="home-q"
                type="search"
                name="q"
                placeholder="e.g. AAV9"
                className="vr-focus min-w-0 flex-1 rounded-[8px] border border-vr-line-strong bg-vr-surface px-4 py-3.5 text-[15px] text-vr-ink placeholder:text-vr-faint hover:border-vr-faint"
              />
              <button type="submit" className="vr-cta vr-focus px-6 py-3.5 text-[15px]">
                Search
              </button>
            </form>
            <div className="mt-4 flex max-w-[560px] flex-wrap items-center gap-x-2 gap-y-2 text-[13px]">
              <span className="text-vr-faint">Try:</span>
              {["AAV9", "AAV-PHP.B", "MC5", "BAAV"].map((name) => (
                <Link
                  key={name}
                  href={`/results?q=${encodeURIComponent(name)}`}
                  className="vr-focus rounded-[6px] border border-vr-line-strong px-2.5 py-1 font-vr-mono text-[12px] text-vr-ink transition-colors hover:border-vr-accent hover:text-vr-accent"
                >
                  {name}
                </Link>
              ))}
            </div>
            <p className="mt-5 text-[14px] text-vr-muted">
              Don&apos;t know the name?{" "}
              <Link
                href="/search"
                className="vr-focus text-vr-accent underline-offset-4 hover:underline"
              >
                Find capsids by tissue, model or route →
              </Link>
            </p>
            <p className="vr-num mt-8 text-[12px] text-vr-faint">
              {papers.size.toLocaleString("en-US")} publications ·{" "}
              {attributed.toLocaleString("en-US")} extracted findings ·{" "}
              {ruleProfiles.length} capsids
              {aiDiscovered > 0 ? ` · +${aiDiscovered} AI-discovered (experimental)` : ""}
            </p>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-vr-line-strong bg-vr-surface p-2 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={withBase("/aav_capsid_render.png")}
                alt="Illustrative render of an AAV capsid"
                className="w-full rounded-xl object-cover"
              />
              <span className="absolute right-5 top-5 rounded-[4px] border border-vr-line-strong bg-vr-bg/80 px-2 py-1 font-vr-mono text-[10px] text-vr-muted backdrop-blur">
                illustration, not VectoRank data
              </span>
              <Link
                href={dossierHref(lead.candidate_id, {}, {}, null)}
                className="vr-focus absolute inset-x-5 bottom-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-[10px] border border-vr-line-strong bg-vr-bg/85 px-4 py-3 backdrop-blur transition-colors hover:border-vr-accent"
              >
                <span className="vr-display text-[18px] font-semibold">
                  <span className="mr-2 font-vr-mono text-[10px] font-normal uppercase tracking-wider text-vr-faint">
                    open profile
                  </span>
                  {lead.canonical_name}
                </span>
                <span className="vr-num text-[12px] text-vr-muted">
                  {lead.paper_count} publications · {lead.relation_count} findings{" "}
                  <span className="text-vr-accent">→</span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- workflow */}
      <section id="workflow" className="border-t border-vr-line bg-[#0b0f16] py-20">
        <div className="mx-auto max-w-[1240px] px-6">
          <SectionHeading
            eyebrow="From a question to a sentence"
            title="How to read a capsid profile: a worked example"
          />
          <p className="mb-10 max-w-[640px] text-[15px] leading-7 text-vr-muted">
            This is a worked example on real data: {lead.canonical_name} in the
            central nervous system (CNS) of nonhuman primates. The example is
            fixed. To use your own, search a capsid above or{" "}
            <Link href="/search" className="vr-focus text-vr-accent underline-offset-4 hover:underline">
              choose a tissue, model and route
            </Link>
            . The square tiles are links: each one opens the evidence behind
            its number.
          </p>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            {/* 1. context -> candidates */}
            <div className="vr-panel flex flex-col p-5">
              <div className="flex items-center gap-3">
                <span className="vr-num text-[11px] text-vr-accent">1</span>
                <span className="text-[14px] font-medium">Find capsids by what was studied</span>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-vr-faint">
                Example context (fixed here, editable on the search page):
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ["tissue", facetLabel(LENS.tissue!)],
                  ["model", facetLabel(LENS.model!)],
                  ["route", "any"],
                ].map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-2 rounded-[6px] border border-dashed border-vr-line-strong px-2.5 py-1.5 text-[12px]"
                  >
                    <span className="vr-eyebrow !text-[10px]">{k}</span>
                    <span className={v === "any" ? "text-vr-faint" : "text-vr-ink"}>
                      {v}
                    </span>
                  </span>
                ))}
              </div>

              <div className="mt-5 text-[12px] text-vr-muted">
                <span className="vr-num text-vr-ink">{lens.matches.length}</span>{" "}
                capsids have matching evidence
              </div>
              <ul className="mt-3 divide-y divide-vr-line rounded-[8px] border border-vr-line">
                {rows.map((r) => (
                  <li key={r.profile.candidate_id}>
                    <Link
                      href={dossierHref(r.profile.candidate_id, LENS, {}, null)}
                      className="vr-row vr-focus grid grid-cols-[1fr_auto_auto] items-baseline gap-x-5 px-4 py-3 text-[13px]"
                    >
                      <span className="vr-display text-[16px] font-semibold">
                        {r.profile.canonical_name}
                      </span>
                      <span className="vr-num text-vr-ink">
                        {r.summary.matching.length}{" "}
                        <span className="text-[11px] text-vr-faint">
                          {r.summary.matching.length === 1 ? "finding" : "findings"}
                        </span>
                      </span>
                      <span className="vr-num text-vr-muted">
                        {r.summary.matchingPapers}{" "}
                        <span className="text-[11px] text-vr-faint">
                          {r.summary.matchingPapers === 1 ? "publication" : "publications"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] leading-5 text-vr-faint">
                Ordered by matching evidence volume, not suitability. Adding
                route = intravenous leaves{" "}
                <span className="vr-num text-vr-muted">{narrower.matches.length}</span>{" "}
                capsids, because most findings do not report a delivery route. That is
                unknown, not negative.
              </p>
              <div className="mt-auto pt-4">
                <Link
                  href={exploreHref}
                  className="vr-cta vr-focus inline-block px-4 py-2 text-[13px]"
                >
                  Open these results →
                </Link>
              </div>
            </div>

            {/* 2. aggregate: the evidence matrix */}
            <div className="vr-panel p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="vr-num text-[11px] text-vr-accent">2</span>
                  <span className="text-[14px] font-medium">
                    What one capsid was tested in
                  </span>
                </div>
                <span className="vr-num text-[12px] text-vr-muted">
                  {lead.canonical_name} · {lead.relation_count} relations
                </span>
              </div>
              <div className="mt-3">
                <EvidenceMatrix
                  matrix={matrix}
                  candidateId={lead.candidate_id}
                  filter={LENS}
                  compact
                />
              </div>
            </div>
          </div>

          {/* 3. source */}
          <div className="mt-5 vr-panel p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="vr-num text-[11px] text-vr-accent">3</span>
                <span className="text-[14px] font-medium">
                  Read one finding and open its source publication
                </span>
              </div>
              <span className="text-[12px] text-vr-faint">
                one of {filterEvidence(lead.evidence, LENS).length}{" "}
                {lead.canonical_name} findings in this context
              </span>
            </div>
            {example ? (
              <div className="mt-4">
                <EvidenceCard relation={example} paper={papers.get(example.pmid)} />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ scope */}
      <section id="scope" className="border-t border-vr-line py-20">
        <div className="mx-auto max-w-[1240px] px-6">
          <SectionHeading eyebrow="Built to be audited" title="What VectoRank does, and what it does not" />
          <div className="grid gap-5 md:grid-cols-3">
            {[
              [
                "Counts, not scores",
                "Cell shade, bars and ordering show how much evidence exists. Nothing is ranked by quality, and nothing is predicted.",
              ],
              [
                "Unknown stays unknown",
                "When an abstract does not report a tissue, model or route, VectoRank shows “not reported”. It is never filled in and never read as a negative result.",
              ],
              [
                "Every number opens its sentence",
                "Each count leads to the findings behind it, the supporting text where the licence allows, and the PubMed record it came from.",
              ],
            ].map(([title, text]) => (
              <div key={title} className="vr-panel p-5">
                <div className="vr-display text-[17px] font-semibold">{title}</div>
                <p className="mt-2 text-[14px] leading-6 text-vr-muted">{text}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-[820px] text-[12px] leading-5 text-vr-faint">
            Evidence is extracted automatically from abstracts. Extraction
            accuracy is known only on an LLM-assisted 30-paper development pilot
            (precision 0.52, recall 0.81), not on held-out data, so profiles are
            unvalidated. VectoRank does not predict tropism, immunogenicity or
            manufacturability.
          </p>
          <div className="mt-10">
            <Link href="/search" className="vr-cta vr-focus inline-block px-6 py-3.5 text-[15px]">
              Explore evidence →
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
