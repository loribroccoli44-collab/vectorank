import { RememberResults } from "../_ui/BackToResults";
import Link from "next/link";
import EvidenceKey from "../_ui/EvidenceKey";
import { loadProfiles } from "@/lib/profiles/load";
import {
  FACETS,
  facetLabel,
  parseContext,
  searchCandidates,
  toQuery,
  type CandidateResult,
} from "@/lib/profiles/context";
import { dossierHref } from "@/lib/profiles/links";
import { Shell } from "../_ui/chrome";
import { Chip, NotStated, TextLink } from "../_ui/atoms";
import CandidateCard, { ResultsHeader } from "../_ui/CandidateCard";
import {
  DEFAULT_ORDER,
  ORDER_OPTIONS,
  parseOrder,
} from "@/lib/profiles/dimensions";

// Screen 2: candidates, not papers. The order is the amount of matching
// evidence and nothing else; it is not a quality, fit or suitability ordering.

const PAGE = 20;

function CompactRow({
  result,
  ctx,
  note,
}: {
  result: CandidateResult;
  ctx: ReturnType<typeof parseContext>;
  note: string;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-vr-line py-2.5 last:border-b-0">
      <Link
        href={dossierHref(result.profile.candidate_id, ctx, {}, null)}
        className="vr-focus text-[14px] text-vr-ink underline-offset-4 hover:underline"
      >
        {result.profile.canonical_name}
      </Link>
      <span className="text-[12px] text-vr-faint">{note}</span>
    </li>
  );
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const artifact = loadProfiles();
  const ctx = parseContext(params);
  const q = (typeof params.q === "string" ? params.q : "").trim();
  const shown = Math.max(
    PAGE,
    Math.min(Number(typeof params.n === "string" ? params.n : PAGE) || PAGE, 400),
  );

  const order = parseOrder(params.order);
  const outcome = searchCandidates(artifact, ctx, q || undefined, order);
  const selected = FACETS.filter((f) => ctx[f]);
  const hasLens = selected.length > 0;

  // One continuous result set. Candidates are not split into evidence tiers:
  // a paper count is shown on every row but never used to group them.
  const main = outcome.matches;
  const visible = main.slice(0, shown);
  const allMatching = outcome.matches.concat(outcome.review);
  const matchingRelations = allMatching.reduce(
    (n, r) => n + r.summary.matching.length,
    0,
  );
  const matchingPapers = new Set(
    allMatching.flatMap((r) => r.summary.matching.map((m) => m.pmid)),
  ).size;

  const editHref = `/search${toQuery({ ...ctx, q: q || undefined })}`;
  const orderHref = (id: string) =>
    `/results${toQuery({ ...ctx, q: q || undefined, order: id === DEFAULT_ORDER ? undefined : id })}`;
  const statement = ORDER_OPTIONS.find((o) => o.id === order)!.statement;

  return (
    <Shell active="results">
      <RememberResults />
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <div className="vr-eyebrow">Capsids with evidence for your search</div>
          <h1 className="vr-display mt-2 text-[32px] font-semibold">
            {allMatching.length}{" "}
            <span className="text-vr-muted">
              candidate{allMatching.length === 1 ? "" : "s"} with matching
              evidence
            </span>
          </h1>
          <p className="mt-2 text-[13px] text-vr-muted">
            <span className="vr-num text-vr-ink">{matchingRelations}</span>{" "}
            relations from{" "}
            <span className="vr-num text-vr-ink">{matchingPapers}</span> papers,
            grouped under canonical candidates ·{" "}
            <span className="font-vr-mono text-[11px] text-vr-faint">
              derived from {matchingRelations} relations
            </span>
          </p>
        </div>
        <TextLink href={editHref} className="text-[13px]">
          ← New search
        </TextLink>
      </div>

      <form action="/results" method="get" role="search" className="mt-5 flex max-w-[520px] gap-2">
        {FACETS.map((f) =>
          ctx[f] ? <input key={f} type="hidden" name={f} value={ctx[f]!} /> : null,
        )}
        <label htmlFor="rq" className="sr-only">
          Search a capsid by name or alias
        </label>
        <input
          id="rq"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search a capsid by name or alias"
          className="vr-focus min-w-0 flex-1 rounded-[8px] border border-vr-line-strong bg-vr-surface px-3.5 py-2.5 text-[14px] text-vr-ink placeholder:text-vr-faint hover:border-vr-faint"
        />
        <button
          type="submit"
          className="vr-focus rounded-[8px] border border-vr-line-strong px-4 py-2.5 text-[14px] text-vr-ink transition-colors hover:border-vr-accent hover:text-vr-accent"
        >
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {FACETS.filter((f) => ctx[f]).map((f) => (
          <span
            key={f}
            className="inline-flex items-center gap-2 rounded-[6px] border border-vr-line-strong px-2.5 py-1.5 text-[12px]"
          >
            <span className="vr-eyebrow !text-[10px]">{f}</span>
            <span className="text-vr-ink">{facetLabel(ctx[f]!)}</span>
          </span>
        ))}
        {q ? (
          <span className="inline-flex items-center gap-2 rounded-[6px] border border-vr-accent-dim px-2.5 py-1.5 text-[12px]">
            <span className="vr-eyebrow !text-[10px]">name</span>
            <span className="text-vr-accent">{q}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
        <p className="text-[13px] text-vr-muted">
          <span className="font-medium text-vr-ink">{statement}</span>{" "}
          <span className="text-vr-faint">
            Counts show how much evidence was extracted, not how well a vector
            performs.
          </span>
        </p>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-vr-faint">Order by</span>
          <div
            role="group"
            aria-label="Order by"
            className="inline-flex overflow-hidden rounded-[8px] border border-vr-line-strong"
          >
            {ORDER_OPTIONS.map((option) => (
              <Link
                key={option.id}
                href={orderHref(option.id)}
                aria-current={option.id === order ? "true" : undefined}
                className={`vr-focus px-3 py-1.5 transition-colors ${
                  option.id === order
                    ? "bg-vr-raised text-vr-ink"
                    : "text-vr-muted hover:text-vr-ink"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {hasLens && outcome.unknownOnly.length > 0 ? (
        <p className="mt-4 text-[13px] leading-6 text-vr-muted">
          <NotStated /> A further{" "}
          <span className="vr-num text-vr-ink">{outcome.unknownOnly.length}</span>{" "}
          candidates have no matching relation but do have relations that state
          nothing on a selected facet. That is unknown, not negative evidence.
        </p>
      ) : null}

      {allMatching.length === 0 ? (
        <div className="vr-panel mt-8 p-8 text-center">
          <p className="text-[15px] text-vr-ink">
            No capsid has a finding matching this search.
          </p>
          <p className="mx-auto mt-2 max-w-[520px] text-[13px] leading-6 text-vr-muted">
            That means the extracted corpus holds no such evidence for the
            current vocabulary, not that the combination was tested and failed.
            Try removing a facet. Route is the least often stated.
          </p>
          <div className="mt-4">
            <TextLink href={editHref}>Change search</TextLink>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <p className="mb-3 text-[11px] leading-5 text-vr-faint">
            Outcome columns: TRN transduction / expression · EFF efficacy · SAF safety · IMM immune · DUR durability ·
            MFG manufacturing · MEC mechanism. A number says how many relations were extracted in that category, not what the
            result was.
          </p>
          <ResultsHeader />
          <ul className="space-y-2.5">
            {visible.map((result) => (
              <li key={result.profile.candidate_id}>
                <CandidateCard result={result} ctx={ctx} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {main.length > shown ? (
        <div className="mt-6 text-center">
          <TextLink
            href={`/results${toQuery({ ...ctx, q: q || undefined, order: order === DEFAULT_ORDER ? undefined : order, n: String(shown + PAGE) })}`}
          >
            Show {Math.min(PAGE, main.length - shown)} more of {main.length - shown}
          </TextLink>
        </div>
      ) : null}

      <div className="mt-10 space-y-3">
        <EvidenceKey />
        {outcome.review.length > 0 ? (
          <details className="vr-panel">
            <summary className="flex items-center justify-between px-5 py-3.5 text-[14px] text-vr-ink">
              <span>
                Identity under review{" "}
                <span className="vr-num text-vr-muted">({outcome.review.length})</span>
              </span>
              <span className="text-[12px] text-vr-faint">
                strings that look like sentence fragments, not capsid names
              </span>
            </summary>
            <div className="px-5 pb-4">
              <p className="mb-2 text-[12px] leading-5 text-vr-faint">
                Display-layer flag, not an identity resolution. These profiles
                are not merged, renamed or re-attributed; they are only kept out
                of the main list until extraction is improved.
              </p>
              <ul>
                {outcome.review.map((r) => (
                  <CompactRow
                    key={r.profile.candidate_id}
                    result={r}
                    ctx={ctx}
                    note={`${r.summary.matching.length} relation${r.summary.matching.length === 1 ? "" : "s"} · ${r.review}`}
                  />
                ))}
              </ul>
            </div>
          </details>
        ) : null}

        {outcome.unknownOnly.length > 0 ? (
          <details className="vr-panel">
            <summary className="flex items-center justify-between px-5 py-3.5 text-[14px] text-vr-ink">
              <span>
                Unknown on a selected facet, no match{" "}
                <span className="vr-num text-vr-muted">
                  ({outcome.unknownOnly.length})
                </span>
              </span>
              <span className="text-[12px] text-vr-faint">
                not evidence of absence
              </span>
            </summary>
            <ul className="px-5 pb-3">
              {outcome.unknownOnly.slice(0, 60).map((r) => (
                <CompactRow
                  key={r.profile.candidate_id}
                  result={r}
                  ctx={ctx}
                  note={`${r.summary.unknownCompatible} of ${r.summary.total} relations state nothing on a selected facet`}
                />
              ))}
            </ul>
            {outcome.unknownOnly.length > 60 ? (
              <p className="px-5 pb-4 text-[12px] text-vr-faint">
                Showing 60 of {outcome.unknownOnly.length}, by unknown-relation count.
              </p>
            ) : null}
          </details>
        ) : null}

        <details className="vr-panel">
          <summary className="flex items-center justify-between px-5 py-3.5 text-[14px] text-vr-ink">
            <span>Not attributed to any candidate</span>
            <span className="text-[12px] text-vr-faint">
              <span className="vr-num">{artifact.counts.mentions_generic}</span>{" "}
              generic ·{" "}
              <span className="vr-num">{artifact.counts.mentions_unresolved}</span>{" "}
              unresolved ·{" "}
              <span className="vr-num">{artifact.counts.mentions_non_candidate}</span>{" "}
              non-candidate mentions
            </span>
          </summary>
          <div className="grid gap-6 px-5 pb-5 md:grid-cols-3">
            {(
              [
                ["Generic", "a class, not a candidate", artifact.generic_mentions],
                ["Unresolved", "names something it does not identify", artifact.unresolved_mentions],
                ["Non-candidate", "a known entity that is not an AAV capsid", artifact.non_candidate_mentions],
              ] as const
            ).map(([title, sub, rows]) => (
              <div key={title}>
                <div className="text-[13px] text-vr-ink">{title}</div>
                <div className="mb-2 text-[12px] text-vr-faint">{sub}</div>
                <ul className="space-y-1">
                  {rows.slice(0, 8).map((m) => (
                    <li
                      key={m.surface}
                      className="flex items-baseline justify-between gap-3 text-[12px]"
                    >
                      <span className="vr-num truncate text-vr-muted">{m.surface}</span>
                      <span className="vr-num text-vr-faint">{m.relation_count}</span>
                    </li>
                  ))}
                  {rows.length > 8 ? (
                    <li className="text-[12px] text-vr-faint">
                      + {rows.length - 8} more surface forms
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>
          <p className="px-5 pb-4 text-[12px] leading-5 text-vr-faint">
            These mentions stay in the relation artifact with their PMIDs. They
            are not dropped and not guessed into a neighbouring candidate.
          </p>
        </details>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2 text-[12px] text-vr-faint">
        <Chip>extractor label</Chip>
        candidate type is the extractor’s label, carried through unchanged and
        unvalidated.
      </div>
    </Shell>
  );
}
