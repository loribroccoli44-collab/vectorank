import Link from "next/link";
import { loadPapers, loadProfiles } from "@/lib/profiles/load";
import {
  FACETS,
  facetLabel,
  facetVocabulary,
  parseContext,
  searchCandidates,
  toQuery,
  type Context,
  type Facet,
} from "@/lib/profiles/context";
import { Shell } from "../_ui/chrome";
import { Chip, NotStated, Stat } from "../_ui/atoms";

// Screen 1: define a delivery context. Deliberately simple: three choices and
// one button. The form is a plain GET to /results, so the lens lives in the
// URL and needs no client JavaScript. Candidate lookup is secondary, and the
// corpus detail sits behind "About this evidence base".

const FACET_META: Record<Facet, { label: string; any: string }> = {
  tissue: { label: "Tissue", any: "Any tissue" },
  model: { label: "Model / species", any: "Any model" },
  route: { label: "Administration route", any: "Any route" },
};

const EXAMPLES: { label: string; ctx: Context }[] = [
  { label: "CNS · nonhuman primate", ctx: { tissue: "CNS", model: "nonhuman_primate" } },
  { label: "Liver · mouse", ctx: { tissue: "Liver", model: "mouse" } },
  { label: "Retina · intravitreal", ctx: { tissue: "Retina", route: "intravitreal" } },
];

const selectClass =
  "vr-select vr-focus w-full rounded-[10px] border border-vr-line-strong bg-vr-bg px-4 py-3.5 pr-10 text-[15px] text-vr-ink transition-colors hover:border-vr-faint";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const artifact = loadProfiles();
  const vocabulary = facetVocabulary(artifact);
  const ctx = parseContext(params);
  const q = typeof params.q === "string" ? params.q : "";

  const ruleProfiles = artifact.profiles.filter((p) => !p.discovery);
  const aiDiscovered = artifact.profiles.length - ruleProfiles.length;
  const allRelations = ruleProfiles.flatMap((p) => p.evidence);
  const notStatedShare = Object.fromEntries(
    FACETS.map((f) => [
      f,
      allRelations.filter((r) => r[f] === null).length / allRelations.length,
    ]),
  ) as Record<Facet, number>;
  const papersWithRelations = new Set(allRelations.map((r) => r.pmid)).size;
  const papersShown = loadPapers().size;

  const hasLens = FACETS.some((f) => ctx[f]);
  const preview = hasLens ? searchCandidates(artifact, ctx, undefined) : null;
  const previewCandidates = preview ? preview.matches.length + preview.review.length : 0;
  const previewRelations = preview
    ? preview.matches
        .concat(preview.review)
        .reduce((n, r) => n + r.summary.matching.length, 0)
    : 0;

  const examples = EXAMPLES.map((e) => {
    const out = searchCandidates(artifact, e.ctx, undefined);
    return { ...e, candidates: out.matches.length + out.review.length };
  });

  return (
    <Shell active="search">
      <div className="relative">
        <div
          aria-hidden
          className="vr-texture pointer-events-none absolute -inset-x-6 -top-8 h-[420px]"
        />

        <section className="relative mx-auto max-w-[900px] pt-8 sm:pt-14">
          <div className="vr-eyebrow">Find a capsid</div>
          <h1 className="vr-display mt-3 text-[40px] font-semibold leading-[1.08] text-vr-ink sm:text-[52px]">
            Search by name, or define a delivery context.
          </h1>
          <p className="mt-4 max-w-[600px] text-[16px] leading-7 text-vr-muted">
            Look up a capsid by its name or any alias, or pick a tissue, a model
            and a route to see which candidates have extracted evidence there,
            and what is still unknown.
          </p>

          <form
            action="/results"
            method="get"
            role="search"
            className="vr-panel mt-8 border-vr-line-strong p-5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] sm:p-6"
          >
            <label htmlFor="q" className="block text-[13px] font-medium text-vr-ink">
              Capsid name or alias
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="q"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="AAV9, PHP.eB, AAV2/8"
                className="vr-focus min-w-0 flex-1 rounded-[8px] border border-vr-line-strong bg-vr-bg px-4 py-3 text-[15px] text-vr-ink placeholder:text-vr-faint hover:border-vr-faint"
              />
              <button type="submit" className="vr-cta vr-focus px-6 py-3 text-[15px]">
                Search
              </button>
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-vr-faint">
              Try
              {["AAV9", "AAV-PHP.B", "AAV2/8", "AAVrh10"].map((n) => (
                <a
                  key={n}
                  href={`/results?q=${encodeURIComponent(n)}`}
                  className="vr-focus rounded-[4px] border border-vr-line-strong px-2 py-0.5 font-vr-mono text-vr-muted hover:border-vr-accent hover:text-vr-accent"
                >
                  {n}
                </a>
              ))}
            </p>
          </form>

          <div className="mt-8 vr-eyebrow">Or explore by delivery context</div>

          <form
            action="/results"
            method="get"
            className="vr-panel mt-8 border-vr-line-strong p-5 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] sm:p-7"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {FACETS.map((facet) => (
                <label key={facet} className="block">
                  <span className="mb-2 block text-[13px] font-medium text-vr-ink">
                    {FACET_META[facet].label}
                  </span>
                  <select
                    name={facet}
                    defaultValue={ctx[facet] ?? ""}
                    className={selectClass}
                  >
                    <option value="">{FACET_META[facet].any}</option>
                    {vocabulary[facet].map((option) => (
                      <option key={option.value} value={option.value}>
                        {facetLabel(option.value)} ({option.relations})
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-vr-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-vr-accent" />
                <span>Shows where evidence exists, not a prediction.</span>
                <span>
                  Route is stated in only{" "}
                  <span className="vr-num text-vr-muted">
                    {Math.round((1 - notStatedShare.route) * 100)}%
                  </span>{" "}
                  of relations.
                </span>
              </p>
              <button type="submit" className="vr-cta vr-focus px-6 py-3 text-[15px]">
                Explore evidence →
              </button>
            </div>

            {hasLens && preview ? (
              <div className="mt-4 border-t border-vr-line pt-4 text-[13px] text-vr-muted">
                Your selection:{" "}
                <span className="vr-num text-vr-ink">{previewCandidates}</span>{" "}
                candidates with{" "}
                <span className="vr-num text-vr-ink">{previewRelations}</span>{" "}
                matching relations.
              </div>
            ) : null}
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-2.5 text-[13px]">
            <span className="text-vr-faint">Try</span>
            {examples.map((e) => (
              <Link
                key={e.label}
                href={`/results${toQuery({ ...e.ctx })}`}
                className="vr-row vr-focus inline-flex items-center gap-2 rounded-[8px] border border-vr-line px-3 py-1.5 text-vr-ink"
              >
                {e.label}
                <span className="vr-num text-[11px] text-vr-faint">
                  {e.candidates} candidates
                </span>
              </Link>
            ))}
          </div>

                    <details className="vr-panel group mt-10">
            <summary className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4">
              <span className="text-[14px] text-vr-ink">About this evidence base</span>
              <span className="vr-num text-[12px] text-vr-faint">
                {papersShown.toLocaleString("en-US")} papers ·{" "}
                {allRelations.length.toLocaleString("en-US")} candidate-attributed
                relations · {ruleProfiles.length} candidates{aiDiscovered > 0 ? ` · +${aiDiscovered} AI-discovered` : ""}
                <span className="ml-2 text-vr-muted group-open:hidden">+</span>
                <span className="ml-2 hidden text-vr-muted group-open:inline">−</span>
              </span>
            </summary>

            <div className="space-y-7 border-t border-vr-line px-5 pb-6 pt-6">
              <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
                <Stat value={papersShown.toLocaleString("en-US")} label="papers with evidence" />
                <Stat
                  value={artifact.counts.relations_total.toLocaleString("en-US")}
                  label="relations extracted"
                />
                <Stat
                  value={allRelations.length.toLocaleString("en-US")}
                  label={`attributed to a candidate · ${papersWithRelations} papers`}
                />
                <Stat
                  value={artifact.counts.candidate_profiles}
                  label={
                    artifact.counts.ai_discovered_profiles
                      ? `candidate profiles · ${artifact.counts.ai_discovered_profiles} AI-discovered`
                      : "candidate profiles"
                  }
                />
              </div>

              <div>
                <div className="vr-eyebrow mb-3">
                  Share of attributed relations that do not state…
                </div>
                <ul className="space-y-2.5">
                  {FACETS.map((f) => (
                    <li key={f} className="flex items-center gap-3">
                      <span className="w-[150px] text-[13px] text-vr-muted">
                        {FACET_META[f].label.split(" /")[0].toLowerCase()}
                      </span>
                      <span className="relative h-2 flex-1 overflow-hidden rounded-[2px] bg-vr-line">
                        <span
                          className="vr-hatch absolute inset-y-0 left-0"
                          style={{ width: `${notStatedShare[f] * 100}%` }}
                        />
                      </span>
                      <span className="vr-num w-10 text-right text-[13px] text-vr-ink">
                        {Math.round(notStatedShare[f] * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-vr-mono text-[11px] text-vr-faint">
                  derived from {allRelations.length.toLocaleString("en-US")}{" "}
                  candidate-attributed relations
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <div className="vr-eyebrow mb-2">It does</div>
                  <ul className="space-y-1.5 text-[13px] leading-5 text-vr-muted">
                    <li>Group extracted evidence under one canonical candidate.</li>
                    <li>Keep the PMID and supporting text for every relation.</li>
                    <li>Show what a paper did not state, as unknown.</li>
                  </ul>
                </div>
                <div>
                  <div className="vr-eyebrow mb-2">It does not</div>
                  <ul className="space-y-1.5 text-[13px] leading-5 text-vr-muted">
                    <li>Predict tropism, immunogenicity or manufacturability.</li>
                    <li>Score, rank by quality, or name a best vector.</li>
                    <li>Treat missing evidence as negative evidence.</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap items-start gap-3 border-t border-vr-line pt-5">
                <Chip>development pilot</Chip>
                <p className="min-w-[260px] flex-1 text-[12px] leading-5 text-vr-faint">
                  Extraction accuracy is measured only on an LLM-assisted 30-paper
                  development pilot (precision 0.52, recall 0.81), not on
                  held-out data. Profiles are unvalidated extraction output from
                  abstracts. <NotStated /> means the extractor found no value,
                  never a negative result.
                </p>
              </div>
            </div>
          </details>
        </section>
      </div>
    </Shell>
  );
}
